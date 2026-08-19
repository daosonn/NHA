import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PrismaService } from '../database/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiClientService, type AiProfileJson } from './ai-client.service';
import { AiContextService } from './ai-context.service';

/**
 * Hai tầng "hiểu một người" — port từ demo onemoretime (docs/03-ai/architecture.md).
 *
 *   bài đăng ──analyze──► InterestSignal (bằng chứng nguyên tử, append-only)
 *                              │
 *                       rollup │ (đủ N bài, hoặc ngay trước khi gợi ý)
 *                              ▼
 *                        MemberProfile v+1 (bản chưng cất ~1k token)
 *
 * Vì sao hai tầng: nếu mỗi lần gợi ý lại đọc toàn bộ bài đăng thì vừa tốn token
 * vừa không có ký ức — mâu thuẫn theo thời gian không ai xử lý, và "bà đã bỏ ngọt
 * từ tháng Tư" không bao giờ thắng được một bức ảnh bánh kem năm ngoái. Signal giữ
 * mọi bằng chứng để dựng lại được; profile là bản đã gộp, có confidence và trend.
 *
 * Điểm quan trọng nhất khi đọc code này: signal luôn thuộc về NGƯỜI ĐĂNG, không
 * phải người trong ảnh. Bài "Con trai về quê thăm mẹ" do người mẹ đăng nói lên
 * rằng MẸ được con về thăm — không phải mẹ thích đi thăm ai.
 */

/** Ảnh gửi model: 768px, JPEG q82, detail="low" — đủ để nhận bối cảnh, ~85 token/ảnh. */
const VISION_MAX_PX = 768;
const VISION_MAX_IMAGES = 6;

/** Trần confidence theo nguồn: suy từ caption yếu hơn suy từ ảnh có mặt bằng chứng. */
const CONFIDENCE_CAP: Record<string, number> = { caption: 0.75, photo: 0.85, video_transcript: 0.85 };

/** Một nguồn AI đã trích, đã lần được về dữ liệu thật (màn 23 · 11d). */
export interface EvidenceRef {
  ref: string;
  kind: 'signal' | 'memo' | 'post' | 'unknown';
  /** caption bài gốc, hoặc chi tiết signal khi bài đã bị xoá */
  text: string | null;
  author_name: string | null;
  created_at: string | null;
  /** có thì UI cho bấm "Open the post" */
  post_id: string | null;
  /** ảnh đầu tiên của bài — UI hiện trong sheet "Where this came from" */
  media_id: string | null;
  /** chủ đề signal ("tưới lan mỗi sáng") — nhãn ngắn cho chip */
  topic: string | null;
}

export interface RollupOutcome {
  ran: boolean;
  oldVersion: number;
  newVersion: number;
  signalsUsed: number;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly rollupEvery: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiClientService,
    private readonly context: AiContextService,
    config: ConfigService,
  ) {
    // Mặc định 1 = chưng cất NGAY sau mỗi bài đăng.
    // Vì sao không chờ đủ N bài: rollup lúc gợi ý là thứ người dùng phải NGỒI CHỜ,
    // còn rollup lúc đăng bài chạy nền và không ai thấy. Dồn 5 bài chỉ tiết kiệm
    // được vài call nhưng đánh đổi bằng đúng chỗ đau nhất.
    this.rollupEvery = Math.max(1, Number(config.get('ROLLUP_EVERY_N_POSTS') ?? 1) || 1);
  }

  // ---------------------------------------------------------------- tầng 1

  /**
   * Phân tích một bài đăng → interest signal về tác giả. Idempotent theo bài:
   * gọi lại lần hai không sinh thêm signal trùng (khoá theo sourceId).
   */
  async analyzePost(postId: string, locale = 'en'): Promise<{ signals: number; rollup: RollupOutcome | null }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        eventDate: true,
        place: true,
        authorUserId: true,
        author: { select: { name: true } },
        families: { select: { familyId: true } },
        memberTags: { select: { memberId: true, member: { select: { displayName: true } } } },
        media: { select: { id: true, storageKey: true, mimeType: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');

    const familyId = post.families[0]?.familyId;
    if (!familyId) return { signals: 0, rollup: null }; // bài riêng tư: không có gia đình nào để hiểu

    // Signal thuộc về TÁC GIẢ — tìm member row của họ trong family này
    const authorMember = await this.prisma.familyMember.findFirst({
      where: { familyId, userId: post.authorUserId },
      select: { id: true, displayName: true },
    });
    if (!authorMember) return { signals: 0, rollup: null };

    const already = await this.prisma.interestSignal.count({
      where: { memberId: authorMember.id, sourceId: postId, revoked: false },
    });
    if (already > 0) return { signals: 0, rollup: null };

    const images = await this.imagesFor(post.media);
    const relations = await this.relationSentences(familyId, authorMember.id);

    const result = await this.ai.analyzePost({
      post_id: post.id,
      caption: post.content,
      author_name: post.author?.name ?? authorMember.displayName,
      author_role: null,
      author_relations: relations,
      tagged: post.memberTags.map((t, i) => ({
        label: String.fromCharCode(65 + i), // A, B, C… — model không bao giờ tự đoán ai là ai
        display_name: t.member.displayName,
        relation_to_author:
          t.memberId === authorMember.id ? 'THIS IS THE AUTHOR' : null,
      })),
      taken_at: (post.eventDate ?? post.createdAt).toISOString().slice(0, 10),
      place: post.place,
      images_b64: images,
      locale,
    });

    const observedAt = post.eventDate ?? post.createdAt;
    let written = 0;
    for (const sig of result.signals) {
      // Nguồn suy ra từ `basis` bằng CODE, không tin model tự khai
      const basis = sig.basis.join(' ').toLowerCase();
      const fromImage = /ảnh|anh \d|photo|keyframe|image|写真/.test(basis);
      const sourceType = basis.includes('transcript')
        ? 'video_transcript'
        : !fromImage && basis.includes('caption')
          ? 'caption'
          : 'photo';
      await this.prisma.interestSignal.create({
        data: {
          memberId: authorMember.id,
          sourceType,
          sourceId: post.id,
          signalType: sig.signal_type,
          topic: sig.topic.slice(0, 120),
          detail: sig.detail.slice(0, 500),
          confidence: Math.min(sig.confidence, CONFIDENCE_CAP[sourceType] ?? 0.85),
          basis: sig.basis,
          observedAt,
        },
      });
      written++;
    }

    const rollup = written > 0 ? await this.bumpCounter(authorMember.id, locale) : null;
    this.logger.log(`analyze ${postId}: ${written} signal(s)${rollup?.ran ? `, rollup → v${rollup.newVersion}` : ''}`);
    return { signals: written, rollup };
  }

  /**
   * Gọi sau khi tạo bài — không chặn response (AI hỏng ≠ đăng bài hỏng).
   *
   * Thử lại MỘT lần sau 8s: lỗi tạm của provider (429/5xx) mà bỏ luôn thì bài đó
   * không bao giờ được đọc lại, vì không có gì kích hoạt lần hai — hồ sơ mất vĩnh
   * viễn phần hiểu biết từ bài ấy. Lần hai vẫn lỗi thì log và dừng; tác giả có thể
   * gọi tay POST /posts/:id/analyze.
   */
  analyzePostInBackground(postId: string, locale = 'en'): void {
    const attempt = (n: number): void => {
      void this.analyzePost(postId, locale).catch((error) => {
        const message = String((error as Error)?.message ?? error);
        if (n === 1) {
          this.logger.warn(`analyze ${postId} lỗi (thử lại sau 8s): ${message}`);
          setTimeout(() => attempt(2), 8_000);
          return;
        }
        this.logger.error(`analyze ${postId} thất bại lần 2, bỏ qua: ${message}`);
      });
    };
    attempt(1);
  }

  /** Ghi nhận feedback trực tiếp của người dùng (♡ một ý tưởng quà) — 0 token, tin cậy cao. */
  async recordGiftFeedback(memberId: string, title: string, occasionLabel: string | null): Promise<void> {
    await this.prisma.interestSignal.create({
      data: {
        memberId,
        sourceType: 'gift_feedback',
        sourceId: null,
        signalType: 'gift_idea',
        topic: title.slice(0, 120),
        detail: `The family saved the idea "${title}"${occasionLabel ? ` for ${occasionLabel}` : ''} — direct feedback`,
        confidence: 0.9, // nguồn người: ghi đè suy luận từ ảnh khi mâu thuẫn
        basis: ['user'],
        observedAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------- tầng 2

  /** Có signal nào chưa được gộp không */
  async hasUnprocessed(memberId: string): Promise<boolean> {
    return (
      (await this.prisma.interestSignal.count({ where: { memberId, processed: false, revoked: false } })) > 0
    );
  }

  /**
   * Gộp signal chưa xử lý thành một version profile MỚI.
   * Rollup lỗi thì không đụng gì cả — thà giữ profile cũ còn hơn một bản dở dang.
   */
  async rollupMember(memberId: string, locale = 'en'): Promise<RollupOutcome> {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { id: true, familyId: true, displayName: true, userId: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const signals = await this.prisma.interestSignal.findMany({
      where: { memberId, processed: false, revoked: false },
      orderBy: { observedAt: 'asc' },
      take: 60,
    });
    const current = await this.context.latestProfile(memberId);
    const oldVersion = current?.version ?? 0;
    if (signals.length === 0) return { ran: false, oldVersion, newVersion: oldVersion, signalsUsed: 0 };

    const lifeProfile = await this.prisma.lifeProfile.findFirst({
      where: member.userId ? { userId: member.userId } : { memberId: member.id },
      select: { birthDate: true },
    });

    const { profile } = await this.ai.profileRollup({
      display_name: member.displayName,
      role_label: null,
      birth_date: lifeProfile?.birthDate ? lifeProfile.birthDate.toISOString().slice(0, 10) : null,
      relations: await this.relationSentences(member.familyId, member.id),
      today: new Date().toISOString().slice(0, 10),
      current_version: oldVersion,
      current_profile: current?.profile ?? null,
      signals: signals.map((s) => ({
        id: `sig_${s.id.slice(0, 8)}`,
        source_type: s.sourceType,
        source_id: s.sourceId,
        signal_type: s.signalType,
        topic: s.topic,
        detail: s.detail,
        confidence: s.confidence,
        observed_at: s.observedAt.toISOString().slice(0, 10),
      })),
      locale,
    });

    const newVersion = oldVersion + 1;
    await this.prisma.$transaction([
      this.prisma.memberProfile.create({
        data: { memberId, version: newVersion, profile: profile as unknown as object },
      }),
      this.prisma.interestSignal.updateMany({
        where: { id: { in: signals.map((s) => s.id) } },
        data: { processed: true },
      }),
      this.prisma.memberCounter.upsert({
        where: { memberId },
        create: { memberId, postsSinceRollup: 0 },
        update: { postsSinceRollup: 0 },
      }),
    ]);

    return { ran: true, oldVersion, newVersion, signalsUsed: signals.length };
  }

  /**
   * Gọi NGAY TRƯỚC khi gợi ý: nếu có bằng chứng mới thì gộp trước, để lời gợi ý
   * dùng hiểu biết mới nhất chứ không phải bản chưng cất của tuần trước.
   */
  async ensureFreshProfile(memberId: string, locale = 'en'): Promise<RollupOutcome | null> {
    if (!(await this.hasUnprocessed(memberId))) return null;
    try {
      return await this.rollupMember(memberId, locale);
    } catch (error) {
      this.logger.warn(`pre-suggest rollup ${memberId} lỗi: ${String((error as Error)?.message ?? error)}`);
      return null; // gợi ý vẫn chạy với profile hiện tại
    }
  }

  /**
   * Lần theo một nguồn mà AI đã trích, về đúng thứ có thật trong DB.
   *
   * Đây là thứ giữ cho provenance còn nguyên sau khi caption bị bỏ khỏi prompt:
   *  - `sig_<8 ký tự đầu id>` → InterestSignal → bài đăng gốc + tấm ảnh đầu tiên;
   *  - `memo_<id>`            → ghi chú người thân (nguyên văn, ai viết, khi nào);
   *  - `post_<id>`            → bài đăng (vẫn nhận, cho dữ liệu cũ).
   * Id lạ trả kind 'unknown' chứ không throw: một nguồn không tra được thì UI ẩn
   * chip đó, không được làm sập cả màn gợi ý.
   */
  async resolveEvidence(
    userId: string,
    familyId: string,
    memberId: string,
    refs: string[],
  ): Promise<EvidenceRef[]> {
    await this.context.assertMembership(userId, familyId);
    const out: EvidenceRef[] = [];

    for (const ref of [...new Set(refs)].slice(0, 12)) {
      if (ref.startsWith('memo_')) {
        const memo = await this.prisma.memo.findFirst({
          where: { id: ref.slice(5), aboutMemberId: memberId },
          select: { id: true, content: true, createdAt: true, owner: { select: { name: true } } },
        });
        out.push(
          memo
            ? {
                ref,
                kind: 'memo',
                text: memo.content,
                author_name: memo.owner.name,
                created_at: memo.createdAt.toISOString(),
                post_id: null,
                media_id: null,
                topic: null,
              }
            : { ref, kind: 'unknown', text: null, author_name: null, created_at: null, post_id: null, media_id: null, topic: null },
        );
        continue;
      }

      if (ref.startsWith('sig_') || ref.startsWith('post_')) {
        // Rollup gửi signal id dạng rút gọn 8 ký tự đầu để hồ sơ (đi kèm MỌI prompt)
        // không phình vì uuid; tra lại bằng prefix, giới hạn trong signal của chính
        // người này nên khả năng trùng là không đáng kể.
        const signal = ref.startsWith('sig_')
          ? await this.prisma.interestSignal.findFirst({
              where: { memberId, revoked: false, id: { startsWith: ref.slice(4) } },
              orderBy: { createdAt: 'desc' },
              select: { topic: true, detail: true, sourceId: true, observedAt: true, sourceType: true },
            })
          : null;
        if (ref.startsWith('sig_') && !signal) {
          out.push({ ref, kind: 'unknown', text: null, author_name: null, created_at: null, post_id: null, media_id: null, topic: null });
          continue;
        }

        const postId = ref.startsWith('post_') ? ref.slice(5) : signal?.sourceId ?? null;
        const post = postId
          ? await this.prisma.post.findFirst({
              where: { id: postId, families: { some: { familyId } } },
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: { select: { name: true } },
                media: { select: { id: true, mimeType: true } },
              },
            })
          : null;
        const photo = post?.media.find((m) => m.mimeType.startsWith('image/')) ?? post?.media[0] ?? null;
        out.push({
          ref,
          kind: signal ? 'signal' : post ? 'post' : 'unknown',
          // Bài gốc bị xoá: vẫn còn signal, nên nói cái signal biết chứ đừng câm lặng
          text: post?.content ?? signal?.detail ?? null,
          author_name: post?.author?.name ?? null,
          created_at: (post?.createdAt ?? signal?.observedAt)?.toISOString() ?? null,
          post_id: post?.id ?? null,
          media_id: photo?.id ?? null,
          topic: signal?.topic ?? null,
        });
        continue;
      }

      out.push({ ref, kind: 'unknown', text: null, author_name: null, created_at: null, post_id: null, media_id: null, topic: null });
    }

    return out;
  }

  /** Hồ sơ đã chưng cất, cho UI xem "AI hiểu gì về người này" */
  async profileFor(userId: string, familyId: string, memberId: string) {
    await this.context.assertMembership(userId, familyId);
    const member = await this.prisma.familyMember.findFirst({ where: { id: memberId, familyId }, select: { id: true } });
    if (!member) throw new ForbiddenException('Member not in this family');

    const [latest, signalCount, pending] = await Promise.all([
      this.context.latestProfile(memberId),
      this.prisma.interestSignal.count({ where: { memberId, revoked: false } }),
      this.prisma.interestSignal.count({ where: { memberId, processed: false, revoked: false } }),
    ]);
    return {
      version: latest?.version ?? 0,
      profile: latest?.profile ?? null,
      signals_total: signalCount,
      signals_pending: pending,
    };
  }

  // ---------------------------------------------------------------- helpers

  private async bumpCounter(memberId: string, locale: string): Promise<RollupOutcome> {
    const row = await this.prisma.memberCounter.upsert({
      where: { memberId },
      create: { memberId, postsSinceRollup: 1 },
      update: { postsSinceRollup: { increment: 1 } },
      select: { postsSinceRollup: true },
    });
    if (row.postsSinceRollup < this.rollupEvery) {
      return { ran: false, oldVersion: 0, newVersion: 0, signalsUsed: 0 };
    }
    return this.rollupMember(memberId, locale);
  }

  /** Ảnh của bài, thu nhỏ + base64. Bỏ qua video: keyframe là việc của bước sau. */
  private async imagesFor(media: { storageKey: string; mimeType: string }[]): Promise<string[]> {
    const out: string[] = [];
    for (const m of media.slice(0, VISION_MAX_IMAGES)) {
      if (!m.mimeType.startsWith('image/')) continue;
      try {
        const raw = await readFile(this.storage.absolutePathOf(m.storageKey));
        const buf = await sharp(raw)
          .rotate() // tôn trọng EXIF orientation, rồi bỏ toàn bộ metadata (gồm GPS)
          .resize({ width: VISION_MAX_PX, height: VISION_MAX_PX, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
        out.push(buf.toString('base64'));
      } catch (error) {
        this.logger.warn(`không đọc được media ${m.storageKey}: ${String(error)}`);
      }
    }
    return out;
  }

  /** "X is the parent of Y" — nguyên liệu để model giải nghĩa "mẹ", "bà", "con"… */
  private async relationSentences(familyId: string, memberId: string): Promise<string[]> {
    const edges = await this.prisma.relationship.findMany({
      where: { familyId, OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] },
      select: {
        type: true,
        label: true,
        fromMemberId: true,
        fromMember: { select: { displayName: true } },
        toMember: { select: { displayName: true } },
      },
      take: 20,
    });
    const word: Record<string, [string, string]> = {
      PARENT: ['parent', 'child'],
      ADOPTED_PARENT: ['adoptive parent', 'adopted child'],
      STEP_PARENT: ['step-parent', 'step-child'],
      SPOUSE: ['spouse', 'spouse'],
      SIBLING: ['sibling', 'sibling'],
    };
    return edges.map((e) => {
      const iAmFrom = e.fromMemberId === memberId;
      const other = iAmFrom ? e.toMember.displayName : e.fromMember.displayName;
      if (e.type === 'OTHER') return `related to ${other}${e.label ? ` (${e.label})` : ''}`;
      const pair = word[e.type];
      return pair ? `${iAmFrom ? pair[0] : pair[1]} of ${other}` : `related to ${other}`;
    });
  }
}

export type { AiProfileJson };
