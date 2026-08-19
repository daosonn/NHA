import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { InvitationStatus } from '../generated/prisma/enums';
import type { Gender, RelationshipType } from '../generated/prisma/enums';
import { StorageService } from '../storage/storage.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

export interface FamilyMemberSummary {
  id: string;
  userId: string | null;
  displayName: string;
  gender: Gender | null;
  avatarKey: string | null;
  joinedAt: Date;
}

export interface FamilySummary {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  memberCount: number;
}

export interface FamilyDetail {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  members: FamilyMemberSummary[];
}

export interface JoinFamilyResult {
  familyId: string;
  familyName: string;
  member: FamilyMemberSummary;
}

export interface RelationshipSummary {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  type: RelationshipType;
  label: string | null;
}

/** A tree node: member plus whether a live invitation is holding the spot. */
export interface TreeMemberSummary extends FamilyMemberSummary {
  pending: boolean;
}

export interface FamilyTree {
  id: string;
  name: string;
  members: TreeMemberSummary[];
  relationships: RelationshipSummary[];
}

const memberSelect = {
  id: true,
  userId: true,
  displayName: true,
  gender: true,
  avatarKey: true,
  joinedAt: true,
} as const;

// No 0/O/1/I — invite codes are meant to be read aloud or retyped.
// Shared with per-spot invitation codes (invitation.service.ts).
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createFamily(
    userId: string,
    dto: CreateFamilyDto,
  ): Promise<FamilyDetail> {
    const user = await this.requireUser(userId);
    const inviteCode = await this.generateInviteCode();
    return this.prisma.family.create({
      data: {
        name: dto.name,
        inviteCode,
        createdById: userId,
        // The creator is the family's first member.
        members: { create: { userId, displayName: user.name } },
      },
      select: {
        id: true,
        name: true,
        inviteCode: true,
        createdAt: true,
        members: { select: memberSelect },
      },
    });
  }

  async listMyFamilies(userId: string): Promise<FamilySummary[]> {
    const families = await this.prisma.family.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        inviteCode: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    return families.map(({ _count, ...family }) => ({
      ...family,
      memberCount: _count.members,
    }));
  }

  async getFamily(userId: string, familyId: string): Promise<FamilyDetail> {
    await this.requireMembership(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        inviteCode: true,
        createdAt: true,
        members: { select: memberSelect, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!family) {
      throw new NotFoundException('Family not found');
    }
    return family;
  }

  /** Nodes + edges of one family's tree; the client lays them out. */
  async getTree(userId: string, familyId: string): Promise<FamilyTree> {
    await this.requireMembership(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        members: { select: memberSelect, orderBy: { joinedAt: 'asc' } },
        relationships: {
          select: {
            id: true,
            fromMemberId: true,
            toMemberId: true,
            type: true,
            label: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!family) {
      throw new NotFoundException('Family not found');
    }
    // A spot is Pending while a live invitation reserves it — the tree
    // draws that node dashed with a clock badge (design-system.md).
    const pendingInvitations = await this.prisma.invitation.findMany({
      where: {
        familyId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: { memberId: true },
    });
    const pendingMemberIds = new Set(
      pendingInvitations.map((invitation) => invitation.memberId),
    );
    return {
      ...family,
      members: family.members.map((member) => ({
        ...member,
        pending: pendingMemberIds.has(member.id),
      })),
    };
  }

  async join(userId: string, dto: JoinFamilyDto): Promise<JoinFamilyResult> {
    const family = await this.prisma.family.findUnique({
      where: { inviteCode: dto.inviteCode },
      select: { id: true, name: true },
    });
    if (!family) {
      throw new NotFoundException('Invalid invite code');
    }

    const existing = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: family.id, userId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('You are already a member of this family');
    }

    const user = await this.requireUser(userId);

    if (dto.linkMemberId) {
      const member = await this.linkToPlaceholder(
        family.id,
        dto.linkMemberId,
        userId,
        user.name,
      );
      return { familyId: family.id, familyName: family.name, member };
    }

    const member = await this.prisma.familyMember.create({
      data: { familyId: family.id, userId, displayName: user.name },
      select: memberSelect,
    });
    return { familyId: family.id, familyName: family.name, member };
  }

  async addMember(
    userId: string,
    familyId: string,
    dto: AddMemberDto,
  ): Promise<FamilyMemberSummary> {
    await this.requireMembership(familyId, userId);
    // Placeholder member (no account) — gets a family-local Life Profile
    // until an account links to it (docs/00-shared/domain-model.md).
    return this.prisma.familyMember.create({
      data: {
        familyId,
        displayName: dto.displayName,
        gender: dto.gender ?? null,
        placeholderProfile: { create: {} },
      },
      select: memberSelect,
    });
  }

  async updateMember(
    userId: string,
    familyId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<FamilyMemberSummary> {
    await this.requireMembership(familyId, userId);
    const member = await this.findMemberInFamily(familyId, memberId);
    // Placeholder info is wiki-editable by the whole family; a linked
    // member's info is managed by that member only.
    if (member.userId && member.userId !== userId) {
      throw new ForbiddenException(
        'Linked members manage their own information',
      );
    }
    return this.prisma.familyMember.update({
      where: { id: memberId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
      },
      select: memberSelect,
    });
  }

  async removeMember(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<{ success: boolean }> {
    await this.requireMembership(familyId, userId);
    const member = await this.findMemberInFamily(familyId, memberId);
    // A linked member can only be removed by themselves (= leaving the
    // family); placeholders can be removed by any member. Their node and
    // its relationships disappear from the tree (domain-model.md).
    if (member.userId && member.userId !== userId) {
      throw new ForbiddenException(
        'A linked member can only be removed by themselves',
      );
    }
    // The delete cascades memos about this member (and, for a
    // placeholder, its profile's life events) — and their Media rows.
    // Collect the storage keys first, or the files are orphaned with no
    // row left to find them by (storageKey only lives on Media).
    const media = await this.prisma.media.findMany({
      where: {
        OR: [
          { memo: { aboutMemberId: memberId } },
          { lifeEvent: { profile: { memberId } } },
        ],
      },
      select: { storageKey: true },
    });
    await this.prisma.familyMember.delete({ where: { id: memberId } });
    await this.storage.removeAllBestEffort(media.map((m) => m.storageKey));
    return { success: true };
  }

  async addRelationship(
    userId: string,
    familyId: string,
    dto: CreateRelationshipDto,
  ): Promise<RelationshipSummary> {
    await this.requireMembership(familyId, userId);
    if (dto.fromMemberId === dto.toMemberId) {
      throw new BadRequestException(
        'fromMemberId and toMemberId must be different members',
      );
    }
    const membersInFamily = await this.prisma.familyMember.count({
      where: { familyId, id: { in: [dto.fromMemberId, dto.toMemberId] } },
    });
    if (membersInFamily !== 2) {
      throw new NotFoundException('Both members must belong to this family');
    }
    const existing = await this.prisma.relationship.findUnique({
      where: {
        familyId_fromMemberId_toMemberId_type: {
          familyId,
          fromMemberId: dto.fromMemberId,
          toMemberId: dto.toMemberId,
          type: dto.type,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This relationship already exists');
    }
    return this.prisma.relationship.create({
      data: {
        familyId,
        fromMemberId: dto.fromMemberId,
        toMemberId: dto.toMemberId,
        type: dto.type,
        label: dto.label ?? null,
      },
      select: {
        id: true,
        fromMemberId: true,
        toMemberId: true,
        type: true,
        label: true,
      },
    });
  }

  async removeRelationship(
    userId: string,
    familyId: string,
    relationshipId: string,
  ): Promise<{ success: boolean }> {
    await this.requireMembership(familyId, userId);
    const relationship = await this.prisma.relationship.findFirst({
      where: { id: relationshipId, familyId },
      select: { id: true },
    });
    if (!relationship) {
      throw new NotFoundException('Relationship not found in this family');
    }
    await this.prisma.relationship.delete({ where: { id: relationshipId } });
    return { success: true };
  }

  /**
   * Membership-based authorization (docs/02-backend/architecture.md).
   * Public: the single home of the "is this user in this family" check —
   * other modules must call these instead of re-implementing them.
   */
  async requireMembership(familyId: string, userId: string): Promise<void> {
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this family');
    }
  }

  /** Membership in every listed family; empty list passes. */
  async requireMembershipInAll(
    userId: string,
    familyIds: string[],
    message = 'You are not a member of every listed family',
  ): Promise<void> {
    if (familyIds.length === 0) {
      return;
    }
    // familyIds are unique (DTO @ArrayUnique) and (familyId, userId) is
    // unique, so a simple count comparison is exact.
    const memberships = await this.prisma.familyMember.count({
      where: { userId, familyId: { in: familyIds } },
    });
    if (memberships !== familyIds.length) {
      throw new ForbiddenException(message);
    }
  }

  private async requireUser(userId: string): Promise<{ name: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return user;
  }

  private async findMemberInFamily(
    familyId: string,
    memberId: string,
  ): Promise<{ id: string; userId: string | null }> {
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
      select: { id: true, userId: true },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this family');
    }
    return member;
  }

  /**
   * Links this account to a placeholder member: the placeholder's local
   * profile is replaced by the account's canonical one, but content
   * attached to it (life events, tags) is kept (domain-model.md).
   * Public because accepting a per-spot invitation is the same link
   * operation (invitation.service.ts).
   */
  async linkToPlaceholder(
    familyId: string,
    memberId: string,
    userId: string,
    userName: string,
  ): Promise<FamilyMemberSummary> {
    const placeholder = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
      select: { id: true, userId: true },
    });
    if (!placeholder) {
      throw new NotFoundException(
        'Member to link was not found in this family',
      );
    }
    if (placeholder.userId) {
      throw new ConflictException(
        'That member is already linked to an account',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const placeholderProfile = await tx.lifeProfile.findUnique({
        where: { memberId },
        select: { id: true },
      });
      const ownProfile = await tx.lifeProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (placeholderProfile && ownProfile) {
        await tx.lifeEvent.updateMany({
          where: { profileId: placeholderProfile.id },
          data: { profileId: ownProfile.id },
        });
        await tx.lifeProfile.delete({ where: { id: placeholderProfile.id } });
      }
      return tx.familyMember.update({
        where: { id: memberId },
        data: { userId, displayName: userName },
        select: memberSelect,
      });
    });
  }

  private async generateInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = randomBytes(INVITE_CODE_LENGTH);
      let code = '';
      for (const byte of bytes) {
        code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
      }
      const existing = await this.prisma.family.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }
    throw new InternalServerErrorException(
      'Could not generate a unique invite code',
    );
  }
}
