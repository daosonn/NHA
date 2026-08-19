import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { AiEvidenceItem, AiMemberContext, AiProfileJson } from './ai-client.service';

/**
 * Gom EVIDENCE thật từ DB cho một thành viên — đây là "grounding" của mọi gợi ý AI.
 *
 * Hai tầng hiểu một người (port từ demo onemoretime, xem docs/03-ai/architecture.md):
 *  - `InterestSignal` = bằng chứng nguyên tử, append-only (mỗi bài đăng sinh 0-4 cái);
 *  - `MemberProfile`  = bản chưng cất ~1k token, version hoá, do rollup viết lại.
 * Ở đây ta gửi sang FastAPI: profile đã chưng cất + MEMO NGUYÊN VĂN + caption bài
 * đăng + quà đã lưu. Memo cố tình KHÔNG nằm trong profile: nó là lời người thân
 * viết tay, là nguồn tin cậy cao nhất, và phải tới model nguyên văn từng chữ.
 *
 * Authorization ở đây (NestJS), FastAPI chỉ nhận context đã lọc:
 *  - requester phải là thành viên của family (membership-based như mọi module khác);
 *  - posts: chỉ bài requester được xem (đăng vào family này);
 *  - memos: ghi chú CỦA MỌI THÀNH VIÊN về người này — theo design màn 22
 *    ("From Lan's note"), nguồn note của người khác được hiển thị cho người hỏi quà.
 */

/** Memo là nguồn tin cậy cao nhất và rất ngắn → gửi hết (demo cũng không cắt). */
const MAX_MEMOS = 12;

export interface MemberEvidenceBundle {
  context: AiMemberContext;
  counts: { notes: number; photos: number; pastGifts: number };
  /** "her granddaughter" — quan hệ NGƯỜI HỎI → người nhận, để AI chọn đúng giọng */
  giverRelation: string | null;
  /** version của hồ sơ đã chưng cất đang dùng (0 = chưa có bản nào) */
  profileVersion: number;
}

/** Nhãn quan hệ theo hướng from→to; dùng cho giọng văn, không phải để phân quyền. */
const RELATION_LABEL: Record<string, { forward: string; backward: string }> = {
  PARENT: { forward: 'parent', backward: 'child' },
  ADOPTED_PARENT: { forward: 'adoptive parent', backward: 'adopted child' },
  STEP_PARENT: { forward: 'step-parent', backward: 'step-child' },
  SPOUSE: { forward: 'spouse', backward: 'spouse' },
  SIBLING: { forward: 'sibling', backward: 'sibling' },
};

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** Membership check dùng chung cho mọi endpoint AI */
  async assertMembership(userId: string, familyId: string): Promise<{ memberId: string; displayName: string }> {
    const me = await this.prisma.familyMember.findFirst({
      where: { familyId, userId },
      select: { id: true, displayName: true },
    });
    if (!me) throw new ForbiddenException('You are not a member of this family');
    return { memberId: me.id, displayName: me.displayName };
  }

  /** Hồ sơ đã chưng cất mới nhất; null khi người này chưa từng được rollup. */
  async latestProfile(memberId: string): Promise<{ version: number; profile: AiProfileJson } | null> {
    const row = await this.prisma.memberProfile.findFirst({
      where: { memberId },
      orderBy: { version: 'desc' },
      select: { version: true, profile: true },
    });
    return row ? { version: row.version, profile: row.profile as unknown as AiProfileJson } : null;
  }

  async buildFor(userId: string, familyId: string, memberId: string): Promise<MemberEvidenceBundle> {
    const me = await this.assertMembership(userId, familyId);

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
      select: { id: true, userId: true, displayName: true },
    });
    if (!member) throw new NotFoundException('Member not found in this family');

    // Life profile (interests + birth date): linked member → profile theo userId, placeholder → theo memberId
    const lifeProfile = await this.prisma.lifeProfile.findFirst({
      where: member.userId ? { userId: member.userId } : { memberId: member.id },
      select: { interests: true, birthDate: true },
    });

    // Memo về người này từ các thành viên trong CÙNG family (xem ghi chú đầu file về quyền riêng tư)
    const memos = await this.prisma.memo.findMany({
      where: { aboutMemberId: memberId },
      orderBy: { createdAt: 'desc' },
      take: MAX_MEMOS,
      include: { owner: { select: { name: true } } },
    });

    // Quà đã lưu về người này (mọi ý user Save ở màn Ideas) — cũng là "không gợi lại món cũ"
    const savedGiftPlans = await this.prisma.plan.findMany({
      where: { aboutMemberId: memberId, title: { startsWith: 'gift:' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { title: true },
    });
    const pastGifts = savedGiftPlans.map((p) => p.title.slice('gift:'.length));

    /**
     * Evidence gửi cho model CHỈ gồm memo — không có caption bài đăng.
     *
     * Vì sao: mỗi bài đăng đã được đọc một lần ở `analyzePost` và chưng cất vào
     * `MemberProfile` (interests kèm `sig_…` trỏ về đúng signal). Nhồi lại caption
     * là phân tích lần hai cùng một dữ liệu — prompt phình, chậm hơn, tốn token hơn,
     * mà không biết thêm điều gì. Provenance vẫn nguyên vẹn: model trích `sig_…`
     * trong hồ sơ, và `GET …/evidence?refs=` lần theo signal về đúng bài gốc + ảnh.
     * Memo thì ngược lại, PHẢI đi nguyên văn: nó là lời người thân viết tay, không
     * bao giờ được chưng cất (dễ mất chi tiết sức khoẻ/kiêng kỵ).
     */
    const evidence: AiEvidenceItem[] = memos.map((m) => ({
      id: `memo_${m.id}`,
      kind: 'memo' as const,
      text: m.content.slice(0, 300),
      author_name: m.owner.name,
      created_at: m.createdAt.toISOString(),
    }));

    const rawInterests = Array.isArray(lifeProfile?.interests)
      ? (lifeProfile?.interests as string[]).map(String)
      : [];
    // Quy ước cũ vẫn được tôn trọng: interest bắt đầu bằng "avoid:" là kiêng kỵ cứng
    const legacyAvoid = rawInterests.filter((i) => i.toLowerCase().startsWith('avoid:')).map((i) => i.slice(6).trim());

    // Hồ sơ đã chưng cất — nguồn "hiểu người này" thật sự (interests có confidence/trend,
    // avoid có hard, wishes, ý tưởng đang chờ, lịch sử quà)
    const distilled = await this.latestProfile(memberId);
    const profileAvoid = (distilled?.profile.avoid ?? []).map((a) => a.item);
    const profileInterests = (distilled?.profile.interests ?? []).map((i) => i.topic);

    // Đếm trên TOÀN BỘ dữ liệu, không phải trên danh sách đã cắt ở trên:
    // "12 photos and 4 notes about her" là lời hứa về những gì app đang có,
    // không phải về những gì vừa được gửi cho model.
    const [notesTotal, photoCount] = await Promise.all([
      this.prisma.memo.count({ where: { aboutMemberId: memberId } }),
      this.prisma.media.count({
        where: {
          post: {
            families: { some: { familyId } },
            OR: [
              { memberTags: { some: { memberId } } },
              ...(member.userId ? [{ authorUserId: member.userId }] : []),
            ],
          },
        },
      }),
    ]);

    // Không gửi CÙNG MỘT SỰ THẬT hai lần. Khi đã có hồ sơ chưng cất, `interests` và
    // `gift_history` nằm sẵn trong JSON hồ sơ (kèm confidence/trend/evidence) — nhắc
    // lại ở danh sách phẳng chỉ làm prompt dài ra (đo được: input 2651 → chờ lâu hơn)
    // và tạo nguy cơ hai bản mâu thuẫn. Chỉ `avoid` được nhắc lại có chủ đích: nó là
    // ràng buộc tuyệt đối, prompt trỏ thẳng vào "HARD AVOID LIST".
    const manualInterests = rawInterests.filter((i) => !i.toLowerCase().startsWith('avoid:'));
    const hasProfile = distilled !== null;

    return {
      context: {
        member_id: member.id,
        display_name: member.displayName,
        role_label: null,
        birth_date: lifeProfile?.birthDate ? lifeProfile.birthDate.toISOString().slice(0, 10) : null,
        interests: hasProfile
          ? manualInterests.filter((i) => !profileInterests.some((t) => t.toLowerCase() === i.toLowerCase()))
          : manualInterests,
        avoid: [...new Set([...profileAvoid, ...legacyAvoid])],
        evidence,
        past_gifts: pastGifts,
        profile: distilled?.profile ?? null,
        profile_version: distilled?.version ?? 0,
      },
      counts: { notes: notesTotal, photos: photoCount, pastGifts: pastGifts.length },
      giverRelation: await this.relationLabel(familyId, me.memberId, member.id),
      profileVersion: distilled?.version ?? 0,
    };
  }

  /**
   * Nhãn quan hệ giữa hai thành viên ("parent", "child", "sibling"…).
   * Chỉ dùng cạnh trực tiếp: đoán quan hệ bắc cầu (ông/cháu qua 2 cạnh) dễ sai
   * hơn là không nói gì, mà nói sai xưng hô trong một lá thiệp thì rất khó tha.
   */
  private async relationLabel(familyId: string, fromMemberId: string, toMemberId: string): Promise<string | null> {
    if (fromMemberId === toMemberId) return null;
    const edge = await this.prisma.relationship.findFirst({
      where: {
        familyId,
        OR: [
          { fromMemberId, toMemberId },
          { fromMemberId: toMemberId, toMemberId: fromMemberId },
        ],
      },
      select: { fromMemberId: true, type: true, label: true },
    });
    if (!edge) return null;
    if (edge.type === 'OTHER') return edge.label ?? null;
    const pair = RELATION_LABEL[edge.type];
    if (!pair) return null;
    // Cạnh PARENT được lưu theo hướng from=cha/mẹ → to=con
    return edge.fromMemberId === fromMemberId ? pair.forward : pair.backward;
  }
}
