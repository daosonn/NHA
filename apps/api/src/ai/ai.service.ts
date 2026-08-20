import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  AiClientService,
  type GiftIdeasResult,
  type MessageResult,
} from './ai-client.service';
import {
  AiContextService,
  type MemberEvidenceBundle,
} from './ai-context.service';
import { ProfileService } from './profile.service';
import {
  experienceKeyword,
  parseJpyRange,
  ShopsService,
  type ResolveInfo,
  type ShopProduct,
} from './shops.service';
import type {
  GiftIdeasRequestDto,
  SaveGiftIdeaDto,
} from './dto/gift-ideas.dto';
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

export type MessageView = MessageResult & {
  /** true khi trả từ AiSuggestionCache (0 token) — mobile không bắt buộc đọc */
  cached?: boolean;
};

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
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorUserId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorUserId !== userId)
      throw new ForbiddenException('Not your post');
  }

  /** Đếm evidence 0-token (không gọi AI) — grounding hint của màn Ask */
  async evidenceStats(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<EvidenceStats> {
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
    // Chứa cả NGƯỜI HỎI + dấu vân memo (số memo của tôi + memo mới nhất): context
    // giờ khác nhau theo người hỏi (memo chỉ-của-tôi, 2026-08-20), và memo mới
    // không làm tăng profile version nên phải tự nó làm miss cache.
    const cacheKey = [
      'gift',
      memberId,
      `by${me.memberId}`,
      dto.occasionDate ?? dto.occasionLabel,
      `v${bundle.profileVersion}`,
      `m${bundle.counts.notes}:${bundle.context.evidence[0]?.created_at ?? '-'}`,
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
      // 5, khớp GIFT_SYSTEM "EXACTLY 5" — 6 là chỉ dẫn vênh nhau + ~1s sinh idea thừa
      max_ideas: dto.maxIdeas ?? 5,
      saved_ideas: saved.map((s) => s.title),
    });
    const aiMs = Date.now() - startedAi;
    // Nhãn chip nguồn do code dựng (model chỉ trả evidence_id kể từ 2026-08-20 —
    // bắt model soạn nhãn là ~0.5-1s/lượt chỉ để viết chữ mà code viết được)
    await this.attachSourceLabels(result, bundle, memberId, dto.locale ?? 'en');
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
    const ideas = new Array<GiftIdeasView['ideas'][number]>(
      result.ideas.length,
    );
    const queue = result.ideas.map((idea, index) => ({ idea, index }));
    const worker = async (): Promise<void> => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        const { idea, index } = item;
        const keyword =
          idea.kind === 'together'
            ? (experienceKeyword(idea.experience_kind) ??
              (idea.search_keywords_ja || experienceKeyword('general')!))
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
    await this.writeSuggestionCache(
      cacheKey,
      memberId,
      'gift',
      view,
      dto.occasionDate ?? null,
    );
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
    const parsed = occasionDate
      ? new Date(`${occasionDate.slice(0, 10)}T23:59:59Z`)
      : null;
    const expiresAt =
      parsed && parsed.getTime() > Date.now()
        ? parsed
        : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.prisma.aiSuggestionCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        memberId,
        kind,
        payload: payload as object,
        expiresAt,
      },
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
        content: {
          kind: 'gift_idea',
          why: dto.why ?? null,
          price_range: dto.priceRange ?? null,
        },
      },
    });
    // ♡ là FEEDBACK NGƯỜI THẬT (confidence 0.9): nó vào Signal Store và ở lần rollup
    // sau sẽ ghi đè các suy luận từ ảnh nếu mâu thuẫn.
    await this.profiles
      .recordGiftFeedback(memberId, dto.title, dto.occasionLabel ?? null)
      // Rollup NGAY trong NỀN: signal ♡ vừa tạo (processed=false) mà để đó thì
      // request gợi ý KẾ TIẾP phải gánh ~5s rollup trước mắt người dùng (đo 20/08).
      // Fire-and-forget; ensureFreshProfile có khoá in-flight nên bấm gợi ý trong
      // lúc rollup đang chạy chỉ nối vào promise sẵn có, không mở call trùng.
      .then(() => {
        void this.profiles
          .ensureFreshProfile(memberId, dto.locale ?? 'en')
          .catch((error: unknown) =>
            this.logger.warn(
              `rollup nền sau ♡ lỗi (sẽ tự vá ở lần gợi ý sau): ${String(error)}`,
            ),
          );
      })
      .catch(() => undefined);
    return this.toSaved(plan);
  }

  async savedGiftIdeas(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<SavedGiftIdea[]> {
    await this.context.assertMembership(userId, familyId);
    const plans = await this.prisma.plan.findMany({
      where: {
        ownerUserId: userId,
        aboutMemberId: memberId,
        title: { startsWith: 'gift:' },
      },
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
    // Cùng quy tắc với giftIdeas: chưng cất nốt bài chưa phân tích trước khi
    // build context, để lời nhắn không tụt hậu so với bài vừa đăng.
    await this.profiles.ensureFreshProfile(memberId, dto.locale ?? 'en');
    const bundle = await this.context.buildFor(userId, familyId, memberId);

    // Cache như giftIdeas (đo 20/08: full call 4.4-5.1s, cache hit ~50ms).
    // Key = người nhận + NGƯỜI GỬI + dịp + tone + version hồ sơ + dấu vân memo
    // (memo đi nguyên văn vào prompt mà không bump version → phải tự làm miss).
    // KHÔNG cache khi có extraNote: input tự do, mỗi lần một khác.
    const cacheKey = [
      'message',
      memberId,
      `by${me.memberId}`,
      dto.occasionLabel,
      dto.tone ?? 'warm',
      `v${bundle.profileVersion}`,
      `m${bundle.counts.notes}:${bundle.context.evidence[0]?.created_at ?? '-'}`,
      dto.locale ?? 'en',
    ].join('|');
    const cacheable = !dto.extraNote;
    if (cacheable && !dto.force) {
      const hit = await this.readSuggestionCache<MessageView>(cacheKey);
      if (hit) return { ...hit, cached: true };
    }

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
    const result = await this.client.messageSuggestions({
      member: bundle.context,
      occasion_label: dto.occasionLabel,
      giver_name: me.displayName,
      giver_relation: bundle.giverRelation,
      tone: dto.tone ?? 'warm',
      locale: dto.locale ?? 'en',
    });
    if (cacheable) {
      await this.writeSuggestionCache(
        cacheKey,
        memberId,
        'message',
        result,
        null,
      );
    }
    return { ...result, cached: false };
  }

  // ---------------------------------------------------- nhãn chip nguồn (0 token)

  /**
   * Điền `label` cho mọi source trong kết quả gift — "Ghi chú của Lan · 2 tuần trước".
   * Model chỉ trả `evidence_id`; nhãn dựng từ dữ liệu THẬT nên không bao giờ bịa:
   *  - memo_…: tác giả + thời điểm đã nằm sẵn trong bundle (0 query);
   *  - sig_… : MỘT query batch theo prefix 8 ký tự (không gọi resolveEvidence từng cái).
   */
  private async attachSourceLabels(
    result: GiftIdeasResult,
    bundle: MemberEvidenceBundle,
    memberId: string,
    locale: 'en' | 'ja' | 'vi',
  ): Promise<void> {
    const allSources = [
      ...result.ideas.flatMap((i) => i.sources),
      ...result.insights.flatMap((i) => i.sources),
    ];
    if (allSources.length === 0) return;
    const refs = new Set(allSources.map((s) => s.evidence_id));

    const labels = new Map<string, string>();
    for (const e of bundle.context.evidence) {
      if (refs.has(e.id) && e.kind === 'memo') {
        labels.set(
          e.id,
          this.memoLabel(e.author_name ?? null, e.created_at ?? null, locale),
        );
      }
    }
    const sigPrefixes = [...refs]
      .filter((r) => r.startsWith('sig_') && !labels.has(r))
      .map((r) => r.slice(4))
      .filter((p) => /^[0-9a-f]{8}$/.test(p));
    if (sigPrefixes.length > 0) {
      const signals = await this.prisma.interestSignal.findMany({
        where: {
          memberId,
          revoked: false,
          OR: sigPrefixes.map((p) => ({ id: { startsWith: p } })),
        },
        select: { id: true, topic: true, observedAt: true },
      });
      for (const s of signals) {
        const when = this.relativeTime(s.observedAt.toISOString(), locale);
        labels.set(
          `sig_${s.id.slice(0, 8)}`,
          `${s.topic.slice(0, 40)} · ${when}`,
        );
      }
    }

    const fallback = {
      en: 'From a shared moment',
      ja: '家族の思い出から',
      vi: 'Từ một khoảnh khắc chung',
    }[locale];
    for (const s of allSources) s.label = labels.get(s.evidence_id) ?? fallback;
  }

  private memoLabel(
    author: string | null,
    createdAt: string | null,
    locale: 'en' | 'ja' | 'vi',
  ): string {
    const base = {
      en: author ? `${author}'s note` : 'A family note',
      ja: author ? `${author}のメモ` : '家族のメモ',
      vi: author ? `Ghi chú của ${author}` : 'Ghi chú gia đình',
    }[locale];
    return createdAt
      ? `${base} · ${this.relativeTime(createdAt, locale)}`
      : base;
  }

  /** "2 weeks ago" / "2週間前" / "2 tuần trước" — Intl có sẵn cả ba locale trong Node */
  private relativeTime(iso: string, locale: 'en' | 'ja' | 'vi'): string {
    const days = Math.max(
      0,
      Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000),
    );
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (days < 1) return rtf.format(0, 'day');
    if (days < 7) return rtf.format(-days, 'day');
    if (days < 31) return rtf.format(-Math.round(days / 7), 'week');
    if (days < 365) return rtf.format(-Math.round(days / 30), 'month');
    return rtf.format(-Math.round(days / 365), 'year');
  }

  private toSaved(plan: {
    id: string;
    title: string;
    content: unknown;
    createdAt: Date;
  }): SavedGiftIdea {
    const c = (plan.content ?? {}) as {
      why?: string | null;
      price_range?: string | null;
    };
    return {
      id: plan.id,
      title: plan.title.slice('gift:'.length),
      why: c.why ?? null,
      price_range: c.price_range ?? null,
      saved_at: plan.createdAt.toISOString(),
    };
  }
}
