import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { InvitationStatus, RelationshipType } from '../generated/prisma/enums';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  FamilyService,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type JoinFamilyResult,
} from './family.service';

/** How long an invitation holds its spot. Resend starts the week over. */
const INVITATION_TTL_DAYS = 7;

/**
 * `EXPIRED` is derived from `expiresAt` at read time, never stored — the
 * same pattern as special-date occurrences. The DB only knows PENDING,
 * ACCEPTED and CANCELLED.
 */
export type InvitationDisplayStatus = InvitationStatus | 'EXPIRED';

export interface InvitationSummary {
  id: string;
  familyId: string;
  /** The reserved spot — a placeholder FamilyMember. */
  memberId: string;
  code: string;
  name: string;
  relationshipType: RelationshipType;
  kinshipKey: string | null;
  status: InvitationDisplayStatus;
  inviterName: string;
  expiresAt: Date;
  createdAt: Date;
}

/** What the invitation page may show before any authentication. */
export interface InvitationPreview {
  code: string;
  familyName: string;
  inviterName: string;
  /** What the inviter calls the invitee. */
  name: string;
  relationshipType: RelationshipType;
  kinshipKey: string | null;
  memberCount: number;
  /** Posts shared to this family. */
  momentCount: number;
  /** First names around the reserved spot, so the page can be specific. */
  parents: { name: string }[];
  siblings: { name: string }[];
  expiresAt: Date;
}

const invitationInclude = {
  inviter: { select: { name: true } },
} as const;

interface InvitationRecord {
  id: string;
  familyId: string;
  memberId: string;
  code: string;
  name: string;
  relationshipType: RelationshipType;
  kinshipKey: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  inviter: { name: string };
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  /**
   * Send an invite: the spot is reserved the moment it is sent
   * (design-system.md) — placeholder member, relationship edge and
   * invitation row are created together, so accepting only attaches an
   * account. With `dto.memberId` an existing placeholder becomes the spot
   * and no edge is created (it is already placed in the tree).
   */
  async create(
    userId: string,
    familyId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationSummary> {
    await this.familyService.requireMembership(familyId, userId);
    const code = await this.generateCode();
    const expiresAt = this.nextExpiry();

    const invitation = await this.prisma.$transaction(async (tx) => {
      let memberId: string;
      if (dto.memberId) {
        const member = await tx.familyMember.findFirst({
          where: { id: dto.memberId, familyId },
          select: { id: true, userId: true },
        });
        if (!member) {
          throw new NotFoundException('Member not found in this family');
        }
        if (member.userId) {
          throw new ConflictException(
            'That member is already linked to an account',
          );
        }
        const active = await tx.invitation.findFirst({
          where: {
            memberId: member.id,
            status: InvitationStatus.PENDING,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (active) {
          throw new ConflictException(
            'That spot already has an outstanding invitation',
          );
        }
        memberId = member.id;
      } else {
        const inviterMember = await tx.familyMember.findUnique({
          where: { familyId_userId: { familyId, userId } },
          select: { id: true },
        });
        if (!inviterMember) {
          // requireMembership passed above, so this is a race, not a 403.
          throw new NotFoundException('Your member record was not found');
        }
        const member = await tx.familyMember.create({
          data: {
            familyId,
            displayName: dto.name,
            placeholderProfile: { create: {} },
          },
          select: { id: true },
        });
        // The edge is stored against the inviter — the sheet's kinship
        // options are all phrased "relative to you" (fixtures/invite.ts).
        const newMemberIsFrom = dto.newMemberIsFrom ?? false;
        await tx.relationship.create({
          data: {
            familyId,
            fromMemberId: newMemberIsFrom ? member.id : inviterMember.id,
            toMemberId: newMemberIsFrom ? inviterMember.id : member.id,
            type: dto.relationshipType,
            label:
              dto.relationshipType === RelationshipType.OTHER
                ? (dto.relationshipLabel ?? null)
                : null,
          },
        });
        memberId = member.id;
      }

      return tx.invitation.create({
        data: {
          familyId,
          memberId,
          inviterId: userId,
          code,
          name: dto.name,
          relationshipType: dto.relationshipType,
          kinshipKey: dto.kinshipKey ?? null,
          expiresAt,
        },
        include: invitationInclude,
      });
    });
    return this.toSummary(invitation);
  }

  /**
   * Public read for the invitation page — who invited you, as what, and
   * where you land. Only a live invitation answers; cancelled, accepted
   * and expired ones 404 so a dead link stops leaking names.
   */
  async preview(code: string): Promise<InvitationPreview> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { code },
      select: {
        code: true,
        memberId: true,
        name: true,
        relationshipType: true,
        kinshipKey: true,
        status: true,
        expiresAt: true,
        inviter: { select: { name: true } },
        family: {
          select: {
            name: true,
            _count: { select: { members: true, postShares: true } },
          },
        },
      },
    });
    if (!invitation || !this.isLive(invitation)) {
      throw new NotFoundException('Invitation not found');
    }

    // Immediate context of the spot, from direct edges only — kinship
    // stays basic (Important Decisions 2026-08-18), so no path walking.
    const edges = await this.prisma.relationship.findMany({
      where: {
        OR: [
          { toMemberId: invitation.memberId },
          { fromMemberId: invitation.memberId },
        ],
      },
      select: {
        type: true,
        fromMemberId: true,
        toMemberId: true,
        fromMember: { select: { displayName: true } },
        toMember: { select: { displayName: true } },
      },
    });
    const parentTypes: RelationshipType[] = [
      RelationshipType.PARENT,
      RelationshipType.ADOPTED_PARENT,
      RelationshipType.STEP_PARENT,
    ];
    const parents = edges
      .filter(
        (edge) =>
          parentTypes.includes(edge.type) &&
          edge.toMemberId === invitation.memberId,
      )
      .map((edge) => ({ name: edge.fromMember.displayName }));
    const siblings = edges
      .filter((edge) => edge.type === RelationshipType.SIBLING)
      .map((edge) => ({
        name:
          edge.fromMemberId === invitation.memberId
            ? edge.toMember.displayName
            : edge.fromMember.displayName,
      }));

    return {
      code: invitation.code,
      familyName: invitation.family.name,
      inviterName: invitation.inviter.name,
      name: invitation.name,
      relationshipType: invitation.relationshipType,
      kinshipKey: invitation.kinshipKey,
      memberCount: invitation.family._count.members,
      momentCount: invitation.family._count.postShares,
      parents,
      siblings,
      expiresAt: invitation.expiresAt,
    };
  }

  /** Join by taking the reserved spot; everything written about the
   *  placeholder is kept (same link operation as join-with-linkMemberId). */
  async accept(userId: string, code: string): Promise<JoinFamilyResult> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { code },
      select: {
        id: true,
        familyId: true,
        memberId: true,
        status: true,
        expiresAt: true,
        family: { select: { name: true } },
      },
    });
    if (!invitation || !this.isLive(invitation)) {
      throw new NotFoundException('Invitation not found');
    }
    const existing = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: { familyId: invitation.familyId, userId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('You are already a member of this family');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const member = await this.familyService.linkToPlaceholder(
      invitation.familyId,
      invitation.memberId,
      userId,
      user.name,
    );
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED },
    });
    return {
      familyId: invitation.familyId,
      familyName: invitation.family.name,
      member,
    };
  }

  /** Everything ever sent for this family, newest first — the pending
   *  banner filters on `status === 'PENDING'`. */
  async list(userId: string, familyId: string): Promise<InvitationSummary[]> {
    await this.familyService.requireMembership(familyId, userId);
    const invitations = await this.prisma.invitation.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: invitationInclude,
    });
    return invitations.map((invitation) => this.toSummary(invitation));
  }

  /** Same code, a fresh week — the banner's Resend action. */
  async resend(
    userId: string,
    familyId: string,
    invitationId: string,
  ): Promise<InvitationSummary> {
    await this.familyService.requireMembership(familyId, userId);
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, familyId },
      select: { id: true, status: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('This invitation is already resolved');
    }
    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt: this.nextExpiry() },
      include: invitationInclude,
    });
    return this.toSummary(updated);
  }

  /**
   * Cancel: the node falls back to Empty (design-system.md) — the
   * reserved placeholder is deleted when nothing else refers to it yet.
   * If content already attached (tags, memos, life events), the member
   * stays as an ordinary placeholder and only the invitation dies.
   * Any family member may cancel, consistent with wiki-editable
   * placeholders.
   */
  async cancel(
    userId: string,
    familyId: string,
    invitationId: string,
  ): Promise<{ success: boolean; memberRemoved: boolean }> {
    await this.familyService.requireMembership(familyId, userId);
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, familyId },
      select: {
        id: true,
        status: true,
        member: {
          select: {
            id: true,
            userId: true,
            _count: {
              select: {
                postTags: true,
                lifeEventTags: true,
                memosAbout: true,
                specialDateTags: true,
                plansFor: true,
              },
            },
            placeholderProfile: {
              select: { _count: { select: { lifeEvents: true } } },
            },
          },
        },
      },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('This invitation is already resolved');
    }

    const member = invitation.member;
    const counts = member._count;
    const untouched =
      member.userId === null &&
      counts.postTags === 0 &&
      counts.lifeEventTags === 0 &&
      counts.memosAbout === 0 &&
      counts.specialDateTags === 0 &&
      counts.plansFor === 0 &&
      (member.placeholderProfile?._count.lifeEvents ?? 0) === 0;

    if (untouched) {
      // Cascades take the invitation row and the member's edges with it.
      await this.prisma.familyMember.delete({ where: { id: member.id } });
      return { success: true, memberRemoved: true };
    }
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED },
    });
    return { success: true, memberRemoved: false };
  }

  private isLive(invitation: {
    status: InvitationStatus;
    expiresAt: Date;
  }): boolean {
    return (
      invitation.status === InvitationStatus.PENDING &&
      invitation.expiresAt.getTime() > Date.now()
    );
  }

  private nextExpiry(): Date {
    return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private toSummary(invitation: InvitationRecord): InvitationSummary {
    const expired =
      invitation.status === InvitationStatus.PENDING &&
      invitation.expiresAt.getTime() <= Date.now();
    return {
      id: invitation.id,
      familyId: invitation.familyId,
      memberId: invitation.memberId,
      code: invitation.code,
      name: invitation.name,
      relationshipType: invitation.relationshipType,
      kinshipKey: invitation.kinshipKey,
      status: expired ? 'EXPIRED' : invitation.status,
      inviterName: invitation.inviter.name,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  /** Same alphabet as Family.inviteCode — readable aloud, no 0/O/1/I. */
  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = randomBytes(INVITE_CODE_LENGTH);
      let code = '';
      for (const byte of bytes) {
        code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
      }
      const existing = await this.prisma.invitation.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }
    throw new InternalServerErrorException(
      'Could not generate a unique invitation code',
    );
  }
}
