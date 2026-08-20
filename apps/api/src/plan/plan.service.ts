import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseIsoDate, requireTrimmed } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { assertTaggedMembers, ownFamilyIds } from '../family/member-tags';
import { Prisma } from '../generated/prisma/client';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SharePlanDto } from './dto/share-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

export interface PlanShareSummary {
  userId: string;
  name: string;
  sharedAt: Date;
}

export interface PlanSummary {
  id: string;
  title: string;
  aboutMemberId: string | null;
  /** Null once that member is removed from the family — see the note below. */
  aboutMemberName: string | null;
  occasionDate: Date | null;
  ownerUserId: string;
  ownerName: string;
  /** Both false on a plan shared with you: sharing is view-only. */
  canEdit: boolean;
  canDelete: boolean;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanDetail extends PlanSummary {
  /**
   * The plan body. Values and array order come back exactly as sent;
   * **object key order does not** — the column is `jsonb`, which stores a
   * parsed value, not the text. Nothing should depend on key order.
   */
  content: unknown;
  /** Who it is shared with — **owner only**; null for a viewer. */
  sharedWith: PlanShareSummary[] | null;
}

/**
 * JSON with object keys sorted, arrays left alone. Used only to compare a
 * submitted body against the stored one: `jsonb` returns keys in its own
 * order, so a plain `JSON.stringify` comparison would see a change on
 * every retry and keep bumping `updatedAt`. Array order is meaningful
 * here — the steps of a plan are a sequence — so it is preserved.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeysDeep(source[key])]),
    );
  }
  return value;
}

const planInclude = {
  owner: { select: { name: true } },
  aboutMember: {
    select: { displayName: true, user: { select: { name: true } } },
  },
  shares: {
    select: {
      sharedWithUserId: true,
      sharedAt: true,
      sharedWith: { select: { name: true } },
    },
    orderBy: { sharedAt: 'asc' as const },
  },
} as const;

type PlanWithRelations = Prisma.PlanGetPayload<{
  include: typeof planInclude;
}>;

/**
 * Saved AI plans (database.md § Plan + PlanShare, decided 2026-08-14, WBS
 * 2.6.4). A quality-time suggestion is read once and gone; a plan is
 * followed over days, so this is the one AI output that is persisted —
 * gift ideas and messages stay request/response.
 *
 * The ownership rule is the whole feature: **only the creator edits and
 * shares; everyone else can only look**. That is what makes a surprise
 * work — the co-conspirators need to see the plan, and exactly one person
 * needs to be able to change it.
 *
 * No AI is involved here. The app posts whatever the owner decided to
 * keep, and `content` is stored verbatim: the server never reads inside
 * it, because the owner rewrites the AI's draft as the plan changes.
 */
@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Plans you own **and** plans shared with you, in one list, most
   * recently touched first (same convention as albums and memos). They
   * are one screen's worth of the same thing; `canEdit` is what tells
   * them apart, so the app draws what it is told rather than re-deriving
   * ownership (the rule the team settled on 2026-08-19 for comments).
   */
  async list(userId: string): Promise<PlanSummary[]> {
    const plans = await this.prisma.plan.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          { shares: { some: { sharedWithUserId: userId } } },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: planInclude,
    });
    return plans.map((plan) => this.toSummary(plan, userId));
  }

  async create(userId: string, dto: CreatePlanDto): Promise<PlanDetail> {
    const title = requireTrimmed(dto.title, 'A plan needs a title');
    await this.assertMemberReachable(userId, dto.aboutMemberId);
    const plan = await this.prisma.plan.create({
      data: {
        ownerUserId: userId,
        title,
        // @IsObject() guarantees a plain JSON object; the cast only
        // bridges Prisma's structural InputJsonValue type.
        content: dto.content as Prisma.InputJsonValue,
        aboutMemberId: dto.aboutMemberId ?? null,
        occasionDate: dto.occasionDate
          ? parseIsoDate(dto.occasionDate, 'occasionDate')
          : null,
      },
      include: planInclude,
    });
    return this.toDetail(plan, userId);
  }

  async get(userId: string, planId: string): Promise<PlanDetail> {
    const plan = await this.findViewable(userId, planId);
    return this.toDetail(plan, userId);
  }

  async update(
    userId: string,
    planId: string,
    dto: UpdatePlanDto,
  ): Promise<PlanDetail> {
    const existing = await this.findOwn(userId, planId);
    if (dto.title !== undefined) {
      requireTrimmed(dto.title, 'A plan needs a title');
    }
    if (dto.aboutMemberId) {
      await this.assertMemberReachable(userId, dto.aboutMemberId);
    }

    // Value-checked, not just key-checked: `updatedAt` orders the list, so
    // a retry that changes nothing must not push the plan back to the top
    // (the defect a review found in memos on 2026-08-19).
    const data: Prisma.PlanUpdateInput = {};
    if (dto.title !== undefined && dto.title.trim() !== existing.title) {
      data.title = dto.title.trim();
    }
    if (
      dto.content !== undefined &&
      canonicalJson(dto.content) !== canonicalJson(existing.content)
    ) {
      data.content = dto.content as Prisma.InputJsonValue;
    }
    if (dto.aboutMemberId !== undefined) {
      const next = dto.aboutMemberId ?? null;
      if (next !== existing.aboutMemberId) {
        data.aboutMember = next
          ? { connect: { id: next } }
          : { disconnect: true };
      }
    }
    if (dto.occasionDate !== undefined) {
      const next = dto.occasionDate
        ? parseIsoDate(dto.occasionDate, 'occasionDate')
        : null;
      if (next?.getTime() !== existing.occasionDate?.getTime()) {
        data.occasionDate = next;
      }
    }
    if (Object.keys(data).length === 0) {
      return this.toDetail(existing, userId);
    }

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data,
      include: planInclude,
    });
    return this.toDetail(updated, userId);
  }

  /** Owner only. Cascades the shares; nothing else hangs off a plan. */
  async remove(userId: string, planId: string): Promise<{ success: boolean }> {
    await this.findOwn(userId, planId);
    await this.prisma.plan.delete({ where: { id: planId } });
    return { success: true };
  }

  /**
   * Share view-only with someone in one of your families. Restricted to
   * that circle deliberately: a plan carries a member's name and an
   * occasion, and a bare `userId` from anywhere would otherwise let it be
   * pushed at a stranger. **Assumption to confirm with the team** —
   * `database.md` says "shared with users" without naming the boundary.
   *
   * Idempotent: sharing twice is the same state, not a 409. The caller is
   * picking people, not asserting a new fact (same reasoning as adding an
   * album item).
   */
  async share(
    userId: string,
    planId: string,
    dto: SharePlanDto,
  ): Promise<PlanDetail> {
    await this.findOwn(userId, planId);
    if (dto.userId === userId) {
      throw new BadRequestException('The plan is already yours');
    }
    const familyIds = await ownFamilyIds(this.prisma, userId);
    const shared =
      familyIds.length > 0 &&
      (await this.prisma.familyMember.count({
        where: { userId: dto.userId, familyId: { in: familyIds } },
      })) > 0;
    if (!shared) {
      // 404 rather than 403: whether that account exists at all is not
      // something this endpoint should confirm.
      throw new NotFoundException(
        'You can only share a plan with someone in one of your families',
      );
    }
    await this.prisma.planShare.createMany({
      data: [{ planId, sharedWithUserId: dto.userId }],
      skipDuplicates: true,
    });
    return this.get(userId, planId);
  }

  /** Idempotent — un-sharing what was never shared is still a success. */
  async unshare(
    userId: string,
    planId: string,
    sharedWithUserId: string,
  ): Promise<{ success: boolean }> {
    await this.findOwn(userId, planId);
    await this.prisma.planShare.deleteMany({
      where: { planId, sharedWithUserId },
    });
    return { success: true };
  }

  /** A plan you may look at: yours, or one shared with you. 404 otherwise
   *  — existence is private, same as a memo or an album. */
  private async findViewable(
    userId: string,
    planId: string,
  ): Promise<PlanWithRelations> {
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: planId,
        OR: [
          { ownerUserId: userId },
          { shares: { some: { sharedWithUserId: userId } } },
        ],
      },
      include: planInclude,
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  /** Writes go through here: 404 before 403, so a plan you cannot see
   *  never announces itself by answering "forbidden" (the order
   *  PostService settled on). */
  private async findOwn(
    userId: string,
    planId: string,
  ): Promise<PlanWithRelations> {
    const plan = await this.findViewable(userId, planId);
    if (plan.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the plan owner can change or share it',
      );
    }
    return plan;
  }

  /** A plan can only be about someone you actually share a family with —
   *  the same tag boundary posts and life events use. */
  private async assertMemberReachable(
    userId: string,
    memberId: string | undefined,
  ): Promise<void> {
    if (!memberId) {
      return;
    }
    const familyIds = await ownFamilyIds(this.prisma, userId);
    await assertTaggedMembers(
      this.prisma,
      [memberId],
      familyIds,
      'A plan can only be about a member of one of your families',
    );
  }

  private toSummary(plan: PlanWithRelations, viewerId: string): PlanSummary {
    const isOwner = plan.ownerUserId === viewerId;
    return {
      id: plan.id,
      title: plan.title,
      aboutMemberId: plan.aboutMemberId,
      aboutMemberName: plan.aboutMember
        ? (plan.aboutMember.user?.name ?? plan.aboutMember.displayName)
        : null,
      occasionDate: plan.occasionDate,
      ownerUserId: plan.ownerUserId,
      ownerName: plan.owner.name,
      canEdit: isOwner,
      canDelete: isOwner,
      shareCount: plan.shares.length,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private toDetail(plan: PlanWithRelations, viewerId: string): PlanDetail {
    const isOwner = plan.ownerUserId === viewerId;
    return {
      ...this.toSummary(plan, viewerId),
      content: plan.content,
      // Who else is in on it is the owner's business. A viewer was let in
      // on the plan, not on the guest list.
      sharedWith: isOwner
        ? plan.shares.map((share) => ({
            userId: share.sharedWithUserId,
            name: share.sharedWith.name,
            sharedAt: share.sharedAt,
          }))
        : null,
    };
  }
}
