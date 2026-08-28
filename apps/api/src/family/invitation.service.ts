import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  InvitationStatus,
  NotificationType,
  RelationshipType,
} from '../generated/prisma/enums';
import { NotificationService } from '../notification/notification.service';
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
  /** Null when the code was meant to be handed over by hand. */
  inviteeUserId: string | null;
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
  family: { select: { name: true } },
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
  inviteeUserId: string | null;
  inviter: { name: string };
  family: { name: string };
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Turns the email the inviter typed into the account it belongs to.
   *
   * Delivery is an in-app notification, so an address with no account behind
   * it has nowhere to arrive: this build rejects it rather than leaving an
   * invitation nobody will ever see. Matching is exact, the same as login —
   * addresses are stored as typed, so normalising here would find accounts
   * their owners could not sign in to.
   */
  private async resolveInvitee(
    familyId: string,
    email: string,
  ): Promise<{ id: string; name: string }> {
    const invitee = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });
    if (!invitee) {
      throw new NotFoundException(
        'No account uses that email — ask them to sign up first, or invite ' +
          'them with a code instead',
      );
    }
    const already = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId: invitee.id } },
      select: { id: true },
    });
    if (already) {
      throw new ConflictException('They are already in this family');
    }
    return invitee;
  }

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
    const invitee = dto.email
      ? await this.resolveInvitee(familyId, dto.email)
      : null;
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
        // The edge attaches to the anchor: the tree's edit mode adds a spot
        // onto whichever node is selected (2026-08-28), so the anchor may be
        // anyone in the family — a placeholder included. Without one it is
        // the inviter's own node, as every invite was before.
        let anchorMember: { id: string } | null;
        if (dto.anchorMemberId) {
          anchorMember = await tx.familyMember.findFirst({
            where: { id: dto.anchorMemberId, familyId },
            select: { id: true },
          });
          if (!anchorMember) {
            throw new NotFoundException(
              'Anchor member not found in this family',
            );
          }
        } else {
          anchorMember = await tx.familyMember.findUnique({
            where: { familyId_userId: { familyId, userId } },
            select: { id: true },
          });
          if (!anchorMember) {
            // requireMembership passed above, so this is a race, not a 403.
            throw new NotFoundException('Your member record was not found');
          }
        }
        const member = await tx.familyMember.create({
          data: {
            familyId,
            displayName: dto.name,
            gender: dto.gender ?? null,
            placeholderProfile: { create: {} },
          },
          select: { id: true },
        });
        const newMemberIsFrom = dto.newMemberIsFrom ?? false;
        await tx.relationship.create({
          data: {
            familyId,
            fromMemberId: newMemberIsFrom ? member.id : anchorMember.id,
            toMemberId: newMemberIsFrom ? anchorMember.id : member.id,
            type: dto.relationshipType,
            label:
              dto.relationshipType === RelationshipType.OTHER
                ? (dto.relationshipLabel ?? null)
                : null,
          },
        });
        // A sibling with only a SIBLING edge floats unconnected in the tree:
        // threads are drawn from parent edges, and the sibling has none
        // (docs/01-frontend/family-tree-rendering.md). Siblings share
        // parents, so the anchor's are mirrored onto the new member here,
        // in the same transaction (decided 2026-08-27). Plain PARENT only —
        // an adoptive or step edge is the anchor's own story, and copying
        // it would assert something nobody said about the sibling.
        if (dto.relationshipType === RelationshipType.SIBLING) {
          const parentEdges = await tx.relationship.findMany({
            where: {
              familyId,
              toMemberId: anchorMember.id,
              type: RelationshipType.PARENT,
            },
            select: { fromMemberId: true },
          });
          for (const parentEdge of parentEdges) {
            await tx.relationship.create({
              data: {
                familyId,
                fromMemberId: parentEdge.fromMemberId,
                toMemberId: member.id,
                type: RelationshipType.PARENT,
              },
            });
          }
        }
        memberId = member.id;
      }

      return tx.invitation.create({
        data: {
          familyId,
          memberId,
          inviterId: userId,
          inviteeUserId: invitee?.id ?? null,
          code,
          name: dto.name,
          relationshipType: dto.relationshipType,
          kinshipKey: dto.kinshipKey ?? null,
          expiresAt,
        },
        include: invitationInclude,
      });
    });

    // After the commit, never inside it: a notification that cannot be
    // delivered must not roll back an invitation that was written fine.
    if (invitee) {
      await this.notifications.create({
        recipientUserId: invitee.id,
        type: NotificationType.FAMILY_INVITE,
        // camelCase keys: that is what every other notification writes and
        // what the client's payload parser reads. video.service is the one
        // exception, and the client carries a special case to cope with it —
        // not a precedent worth following.
        payload: {
          kind: 'family_invite',
          invitationId: invitation.id,
          code: invitation.code,
          familyId,
          familyName: invitation.family.name,
          inviterName: invitation.inviter.name,
          asName: invitation.name,
        },
      });
    }
    return this.toSummary(invitation);
  }

  /**
   * Invitations addressed to me and still live — the list behind "you have
   * been invited". Codes handed over by hand never appear here: nobody was
   * named, so there is no "me" to match.
   */
  async listMine(userId: string): Promise<InvitationSummary[]> {
    const rows = await this.prisma.invitation.findMany({
      where: {
        inviteeUserId: userId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: invitationInclude,
    });
    return rows.map((row) => this.toSummary(row));
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
        inviteeUserId: true,
        status: true,
        expiresAt: true,
        family: { select: { name: true } },
      },
    });
    if (!invitation || !this.isLive(invitation)) {
      throw new NotFoundException('Invitation not found');
    }
    // Named invitations belong to the person named. A code handed over by
    // hand (inviteeUserId null) stays open to whoever holds it, which is the
    // whole point of that flow — but once an email is on it, the code is no
    // longer a bearer token, and forwarding it must not give away the spot.
    if (invitation.inviteeUserId && invitation.inviteeUserId !== userId) {
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
      inviteeUserId: invitation.inviteeUserId,
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
