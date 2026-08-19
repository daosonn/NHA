import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { AiClientService, type GiftIdeasResult, type MessageResult } from './ai-client.service';
import { AiContextService } from './ai-context.service';
import { ProfileService } from './profile.service';
import { experienceKeyword, parseJpyRange, ShopsService, type ResolveInfo, type ShopProduct } from './shops.service';
import type { GiftIdeasRequestDto, SaveGiftIdeaDto } from './dto/gift-ideas.dto';
import type { MessageRequestDto } from './dto/message.dto';

/**
 * Orchestration cho màn 21-25: gom evidence (AiContextService) → gọi FastAPI (AiClientService)
 * → trả view cho mobile. Provenance là bắt buộc: view giữ nguyên sources[] + evidence_read.
 */

export interface GiftIdeasView extends Omit<GiftIdeasResult, 'ideas'> {
  ideas: (GiftIdeasResult['ideas'][number] & {
    products: ShopProduct[];
    /** vì sao ra/không ra sản phẩm — UI hiện badge "cache" / "đã nới" / "đã loại N món" */
    resolve: ResolveInfo | null;
  })[];
  saved_ideas: SavedGiftIdea[];
  /** có tra được sàn thật không (thiếu YAHOO_SHOPPING_APPID → false, UI rơi về link tìm kiếm) */
  shops_enabled: boolean;
  /** cả lượt này lấy từ cache (0 token) — nút ↻ ở header gọi lại với force */
  cached: boolean;
  /** version hồ sơ đã chưng cất được dùng để sinh gợi ý này */
  profile_version: number;
}

export type MessageView = MessageResult;

export interface SavedGiftIdea {
  id: string;
  title: string;
  why: string | null;
  price_range: string | null;
  saved_at: string;
}

/** Màn 21 (11a): "12 photos and 4 notes about her · shared since January" — hiện TRƯỚC khi hỏi AI */
export interface EvidenceStats {
  notes: number;
  photos: number;
  past_gifts: number;
  /** ISO của evidence cũ nhất — UI format "shared since January" */
  since: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: AiClientService,
    private readonly context: AiContextService,
    private readonly profiles: ProfileService,
    private readonly shops: ShopsService,
  ) {}

  health(): Promise<{ ok: boolean; mock: boolean; has_key: boolean }> {
    return this.client.health();
  }

  /** Guard dùng lại cho các route profile (rollup) */
  async assertMember(userId: string, familyId: string): Promise<void> {
    await this.context.assertMembership(userId, familyId);
  }

  /** Chỉ tác giả được yêu cầu phân tích lại bài của mình */
  async assertPostAuthor(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorUserId: true } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorUserId !== userId) throw new ForbiddenException('Not your post');
  }

  /** Đếm evidence 0-token (không gọi AI) — grounding hint của màn Ask */
  async evidenceStats(userId: string, familyId: string, memberId: string): Promise<EvidenceStats> {
    const bundle = await this.context.buildFor(userId, familyId, memberId);
    const dates = bundle.context.evidence
      .map((e) => e.created_at)
      .filter((d): d is string => !!d)
      .sort();
    return {
      notes: bundle.counts.notes,
      photos: bundle.counts.photos,
      past_gifts: bundle.counts.pastGifts,
      since: dates[0] ?? null,
    };
  }

  async giftIdeas(
    userId: string,
    familyId: string,
    memberId: string,
    dto: GiftIdeasRequestDto,
  ): Promise<GiftIdeasView> {
    const me = await this.context.assertMembership(userId, familyId);
    // Có bằng chứng mới thì chưng cất TRƯỚC khi hỏi — gợi ý phải dùng hiểu biết
    // mới nhất, không phải bản rollup của tuần trước.
    await this.profiles.ensureFreshProfile(memberId, dto.locale ?? 'en');
    const bundle = await this.context.buildFor(userId, familyId, memberId);
    const saved = await this.savedGiftIdeas(userId, familyId, memberId);

    // Khoá cache chứa VERSION hồ sơ: có bằng chứng mới → version tăng → tự miss.
    const cacheKey = [
      'gift',
      memberId,
      dto.occasionDate ?? dto.occasionLabel,
      `v${bundle.profileVersion}`,
      dto.budgetLabel ?? '-',
      dto.locale ?? 'en',
    ].join('|');
    if (!dto.force) {
      const hit = await this.readSuggestionCache<GiftIdeasView>(cacheKey);
      // saved_ideas đọc lại tươi: người dùng có thể vừa ♡ thêm một ý
      if (hit) return { ...hit, saved_ideas: saved, cached: true };
    }

    const startedAi = Date.now();
    const result = await this.client.giftIdeas({
      member: bundle.context,
      occasion_label: dto.occasionLabel,
      occasion_date: dto.occasionDate ?? null,
      giver_name: me.displayName,
      giver_relation: bundle.giverRelation,
      budget_label: dto.budgetLabel ?? null,
      locale: dto.locale ?? 'en',
      max_ideas: dto.maxIdeas ?? 6,
      saved_ideas: saved.map((s) => s.title),
    });
    const aiMs = Date.now() - startedAi;
    const startedShops = Date.now();

    // Sản phẩm THẬT cho từng ý tưởng (màn 22 — "One in stock near this price").
    // Quà trải nghiệm dùng từ khoá 体験ギフト tương ứng, vì ở Nhật nó được bán
    // dưới dạng catalog gift có thật.
    //
    // Chạy 3 luồng song song: tuần tự thì 5-6 ý tưởng (mỗi ý có thể thử tới 4 lần)
    // mất ~22s đo được ngày 19/08. Không mở rộng hơn 3: Yahoo giới hạn ~1 req/s và
    // 429 thì mất hết sản phẩm, chậm còn hơn trắng.
    const budget = parseJpyRange(dto.budgetLabel);
    const avoidItems = bundle.context.avoid;
    const ideas: GiftIdeasView['ideas'] = new Array(result.ideas.length);
    const queue = result.ideas.map((idea, index) => ({ idea, index }));
    const worker = async (): Promise<void> => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        const { idea, index } = item;
        const keyword =
          idea.kind === 'together'
            ? experienceKeyword(idea.experience_kind) ?? (idea.search_keywords_ja || experienceKeyword('general')!)
            : idea.search_keywords_ja;
        const priced = parseJpyRange(idea.price_range ?? dto.budgetLabel);
        const { products, info } = await this.shops.resolve({
          keyword,
          // ngân sách người dùng chọn là quyết định; price_range của AI chỉ để tham khảo
          priceMin: Math.min(budget.min, priced.min),
          priceMax: Math.max(budget.max, priced.max),
          avoidItems,
        });
        ideas[index] = { ...idea, products, resolve: info };
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Tách rõ hai phần: chậm là do model hay do tra sàn — đừng đoán, đọc log.
    this.logger.log(
      `gift ideas: AI ${(aiMs / 1000).toFixed(1)}s · shops ${((Date.now() - startedShops) / 1000).toFixed(1)}s · ` +
        `${ideas.length} ý tưởng, ${ideas.reduce((a, i) => a + (i.resolve?.attempts.length ?? 0), 0)} lượt gọi sàn`,
    );

    const view: GiftIdeasView = {
      ...result,
      // Số evidence phải là số THẬT trong DB. FastAPI chỉ đếm được những gì nó nhận,
      // mà nó không còn nhận caption nữa (bài đăng đã chưng cất vào hồ sơ) — để nó
      // tự đếm thì màn Ideas báo "0 ảnh" trong khi gia đình đã chia sẻ hàng chục.
      evidence_read: {
        notes: bundle.counts.notes,
        photos: bundle.counts.photos,
        past_gifts: bundle.counts.pastGifts,
      },
      ideas,
      saved_ideas: saved,
      shops_enabled: this.shops.enabled,
      cached: false,
      profile_version: bundle.profileVersion,
    };
    await this.writeSuggestionCache(cacheKey, memberId, 'gift', view, dto.occasionDate ?? null);
    return view;
  }

  // ------------------------------------------------------------- cache lượt gợi ý

  private async readSuggestionCache<T>(cacheKey: string): Promise<T | null> {
    const row = await this.prisma.aiSuggestionCache.findFirst({
      where: { cacheKey, expiresAt: { gt: new Date() } },
      select: { payload: true },
    });
    return row ? (row.payload as unknown as T) : null;
  }

  /**
   * Hết hạn vào cuối ngày diễn ra dịp — qua dịp rồi thì gợi ý cũ vô nghĩa.
   * Không biết ngày thì giữ 7 ngày.
   */
  private async writeSuggestionCache(
    cacheKey: string,
    memberId: string,
    kind: 'gift' | 'message',
    payload: unknown,
    occasionDate: string | null,
  ): Promise<void> {
    const parsed = occasionDate ? new Date(`${occasionDate.slice(0, 10)}T23:59:59Z`) : null;
    const expiresAt =
      parsed && parsed.getTime() > Date.now() ? parsed : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.prisma.aiSuggestionCache.upsert({
      where: { cacheKey },
      create: { cacheKey, memberId, kind, payload: payload as object, expiresAt },
      update: { payload: payload as object, expiresAt },
    });
  }

  async saveGiftIdea(
    userId: string,
    familyId: string,
    memberId: string,
    dto: SaveGiftIdeaDto,
  ): Promise<SavedGiftIdea> {
    await this.context.assertMembership(userId, familyId);
    // Lưu vào Plan (bảng có sẵn, content JSON) — quy ước title "gift:<tên>" để
    // AiContextService đưa vào past_gifts (không gợi lại) và màn 21 hiện "saved last year".
    const plan = await this.prisma.plan.create({
      data: {
        ownerUserId: userId,
        aboutMemberId: memberId,
        title: `gift:${dto.title}`,
        content: { kind: 'gift_idea', why: dto.why ?? null, price_range: dto.priceRange ?? null },
      },
    });
    // ♡ là FEEDBACK NGƯỜI THẬT (confidence 0.9): nó vào Signal Store và ở lần rollup
    // sau sẽ ghi đè các suy luận từ ảnh nếu mâu thuẫn.
    await this.profiles.recordGiftFeedback(memberId, dto.title, dto.occasionLabel ?? null).catch(() => undefined);
    return this.toSaved(plan);
  }

  async savedGiftIdeas(userId: string, familyId: string, memberId: string): Promise<SavedGiftIdea[]> {
    await this.context.assertMembership(userId, familyId);
    const plans = await this.prisma.plan.findMany({
      where: { ownerUserId: userId, aboutMemberId: memberId, title: { startsWith: 'gift:' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return plans.map((p) => this.toSaved(p));
  }

  async messageSuggestions(
    userId: string,
    familyId: string,
    memberId: string,
    dto: MessageRequestDto,
  ): Promise<MessageView> {
    const me = await this.context.assertMembership(userId, familyId);
    const bundle = await this.context.buildFor(userId, familyId, memberId);
    if (dto.extraNote) {
      // "Anything to add" đi vào evidence như lời dặn của người gửi — model được phép dùng nguyên văn
      bundle.context.evidence.unshift({
        id: 'giver_note',
        kind: 'memo',
        text: `Note from the giver (use it): ${dto.extraNote}`,
        author_name: me.displayName,
        created_at: null,
      });
    }
    return this.client.messageSuggestions({
      member: bundle.context,
      occasion_label: dto.occasionLabel,
      giver_name: me.displayName,
      giver_relation: null,
      tone: dto.tone ?? 'warm',
      locale: dto.locale ?? 'en',
    });
  }

  private toSaved(plan: { id: string; title: string; content: unknown; createdAt: Date }): SavedGiftIdea {
    const c = (plan.content ?? {}) as { why?: string | null; price_range?: string | null };
    return {
      id: plan.id,
      title: plan.title.slice('gift:'.length),
      why: c.why ?? null,
      price_range: c.price_range ?? null,
      saved_at: plan.createdAt.toISOString(),
    };
  }
}
