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
  /** Ai lập ra nhà này — chỉ người đó xóa được (xem `remove`). */
  createdById: string;
  memberCount: number;
  /** Ảnh đại diện gia đình (id Media) — mặt cả nhà trong dải chuyển gia đình */
  coverMediaId: string | null;
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
  /**
   * ISO date (YYYY-MM-DD) from their Life Profile, null when unknown.
   * Tree-only: the layout orders siblings oldest-to-youngest with it
   * (added 2026-08-27).
   */
  birthDate: string | null;
}

export interface FamilyTree {
  id: string;
  name: string;
  /** Ảnh cả nhà — id Media, stream qua `GET /media/:id` như mọi ảnh khác */
  coverMediaId: string | null;
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
  // Only for the avatar fallback below — never returned raw.
  user: { select: { avatarKey: true } },
} as const;

type MemberRow = FamilyMemberSummary & {
  user: { avatarKey: string | null } | null;
};

/**
 * A linked person has one avatar wherever they appear — the account's
 * (set via PATCH /me/profile, WBS 3.4.2). The member row's own column
 * only matters for placeholders, whose avatar is wiki-set through the
 * member profile route. The value is a Media id; GET /media/:id serves it.
 */
function toMemberSummary({ user, ...member }: MemberRow): FamilyMemberSummary {
  // Người ĐÃ liên kết tài khoản: avatar của TÀI KHOẢN thắng — nút đổi ảnh
  // (PATCH /me/profile) chỉ ghi User.avatarKey, nên để bản sao trên member
  // row thắng là mặt cũ ở cây/feed không bao giờ đổi theo (đã dính 26/08:
  // hero hồ sơ một mặt, mọi nơi khác một mặt). Placeholder thì member row
  // là tất cả những gì có.
  return {
    ...member,
    avatarKey: member.userId
      ? (user?.avatarKey ?? member.avatarKey ?? null)
      : (member.avatarKey ?? null),
  };
}

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
    const family = await this.prisma.family.create({
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
    return { ...family, members: family.members.map(toMemberSummary) };
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
        createdById: true,
        coverMediaId: true,
        _count: { select: { members: true } },
      },
    });
    return families.map(({ _count, ...family }) => ({
      ...family,
      memberCount: _count.members,
    }));
  }

  /**
   * Xóa cả gia đình — cho trường hợp tạo nhầm (26/08 Sơn có 15 nhà rác).
   *
   * Hai cổng gác: chỉ NGƯỜI TẠO, và chỉ khi không còn tài khoản nào khác đang
   * là thành viên (placeholder thì không sao) — một nhà mà người khác đã vào
   * là không gian chung, không phải của riêng ai để xóa; họ phải rời trước.
   *
   * Bài đăng KHÔNG mất: bài thuộc tác giả, chỉ mối "đã chia sẻ tới nhà này"
   * (PostFamily) rơi theo cascade — bài chỉ chia sẻ mỗi nhà này thành riêng
   * tư của tác giả. Media của mốc đời placeholder trong nhà thì dọn file như
   * `removeMember`, vì storageKey chỉ sống trên Media row sắp mất.
   */
  async remove(
    userId: string,
    familyId: string,
  ): Promise<{ success: boolean }> {
    await this.requireMembership(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { createdById: true },
    });
    if (!family) {
      throw new NotFoundException('Family not found');
    }
    if (family.createdById !== userId) {
      throw new ForbiddenException(
        'Only the person who created the family can delete it',
      );
    }
    const others = await this.prisma.familyMember.count({
      where: { familyId, NOT: [{ userId: null }, { userId }] },
    });
    if (others > 0) {
      throw new ConflictException(
        'Other members still belong to this family — they need to leave first',
      );
    }
    const media = await this.prisma.media.findMany({
      where: { lifeEvent: { profile: { member: { familyId } } } },
      select: { storageKey: true },
    });
    await this.prisma.family.delete({ where: { id: familyId } });
    await this.storage.removeAllBestEffort(media.map((m) => m.storageKey));
    return { success: true };
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
    return { ...family, members: family.members.map(toMemberSummary) };
  }

  /** Nodes + edges of one family's tree; the client lays them out. */
  async getTree(userId: string, familyId: string): Promise<FamilyTree> {
    await this.requireMembership(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        coverMediaId: true,
        members: {
          select: {
            ...memberSelect,
            // Birth dates live on the Life Profile — the placeholder's own,
            // or the account's for a linked member (LifeProfile is XOR).
            placeholderProfile: { select: { birthDate: true } },
            user: {
              select: {
                avatarKey: true,
                lifeProfile: { select: { birthDate: true } },
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
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
      members: family.members.map(({ placeholderProfile, ...member }) => {
        const birthDate = member.userId
          ? (member.user?.lifeProfile?.birthDate ?? null)
          : (placeholderProfile?.birthDate ?? null);
        return {
          ...toMemberSummary(member),
          pending: pendingMemberIds.has(member.id),
          birthDate:
            birthDate === null ? null : birthDate.toISOString().slice(0, 10),
        };
      }),
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
    return {
      familyId: family.id,
      familyName: family.name,
      member: toMemberSummary(member),
    };
  }

  async addMember(
    userId: string,
    familyId: string,
    dto: AddMemberDto,
  ): Promise<FamilyMemberSummary> {
    await this.requireMembership(familyId, userId);
    // Placeholder member (no account) — gets a family-local Life Profile
    // until an account links to it (docs/00-shared/domain-model.md).
    const created = await this.prisma.familyMember.create({
      data: {
        familyId,
        displayName: dto.displayName,
        gender: dto.gender ?? null,
        placeholderProfile: { create: {} },
      },
      select: memberSelect,
    });
    return toMemberSummary(created);
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
    const updated = await this.prisma.familyMember.update({
      where: { id: memberId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
      },
      select: memberSelect,
    });
    return toMemberSummary(updated);
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
    // For a placeholder, the delete cascades its profile's life events —
    // and their Media rows. Collect the storage keys first, or the files
    // are orphaned with no row left to find them by (storageKey only
    // lives on Media). Memos survive the member (aboutMemberId SetNull,
    // decided 2026-08-19), so their media stay untouched.
    const media = await this.prisma.media.findMany({
      where: { lifeEvent: { profile: { memberId } } },
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

  /** Public since 2026-08-19: PostService's ?memberId Memories filter
   *  resolves members the same way (one home for the 404 semantics). */
  async findMemberInFamily(
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
    const linked = await this.prisma.$transaction(async (tx) => {
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
    return toMemberSummary(linked);
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
