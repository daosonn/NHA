import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeText, parseIsoDate } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { FamilyService } from '../family/family.service';
import { EditEntityType } from '../generated/prisma/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface ProfileDetail {
  id: string;
  /** Owner account for a global profile; null for a placeholder. */
  userId: string | null;
  /** Placeholder member; null for a global profile. */
  memberId: string | null;
  displayName: string;
  bio: string | null;
  interests: string[];
  birthDate: Date | null;
  /** Free text — mockup 7 prints it after the birth date. */
  birthPlace: string | null;
  /** Free text ("Carpenter, retired since 2021"), not a job title. */
  occupation: string | null;
  deathDate: Date | null;
  /** A Media id the app streams via GET /media/:id; null = no avatar
   *  (the app draws an initial). Stored on User/FamilyMember, not on
   *  LifeProfile — surfaced here because the profile is where it is
   *  edited (WBS 3.4.2). */
  avatarMediaId: string | null;
  /**
   * Whether this account can sign in with a password (WBS 3.4.3): false =
   * social-only (empty hash), so Settings offers "set a password" (the
   * password-reset flow) instead of the change-password form. Only the
   * owner's own route (`GET /me/profile`) carries a value — another
   * member's sign-in method is not the family's business, so the
   * family-scoped route always answers null.
   */
  hasPassword: boolean | null;
  updatedAt: Date;
}

interface ProfileRecord {
  id: string;
  userId: string | null;
  memberId: string | null;
  bio: string | null;
  interests: unknown;
  birthDate: Date | null;
  birthPlace: string | null;
  occupation: string | null;
  deathDate: Date | null;
  updatedAt: Date;
}

const profileSelect = {
  id: true,
  userId: true,
  memberId: true,
  bio: true,
  interests: true,
  birthDate: true,
  birthPlace: true,
  occupation: true,
  deathDate: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  /** The caller's own global profile (screen 8 "About", WBS 1.6.2). */
  async getOwn(userId: string): Promise<ProfileDetail> {
    const [profile, user] = await Promise.all([
      this.ensureGlobalProfile(userId),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, avatarKey: true, passwordHash: true },
      }),
    ]);
    return this.toDetail(profile, user.name, user.avatarKey, {
      // Social-only accounts store an empty hash (architecture.md § social
      // login); setting a password via the reset flow flips this to true.
      hasPassword: user.passwordHash !== '',
    });
  }

  async updateOwn(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileDetail> {
    const profile = await this.ensureGlobalProfile(userId);
    await this.applyUpdate(profile, userId, dto);
    return this.getOwn(userId);
  }

  /**
   * A member's profile as seen inside one family. Display rule
   * (domain-model.md): a linked member shows their global profile, a
   * placeholder shows its family-local wiki profile.
   */
  async getForMember(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<ProfileDetail> {
    const member = await this.findMember(userId, familyId, memberId);
    if (member.userId) {
      const profile = await this.ensureGlobalProfile(member.userId);
      return this.toDetail(
        profile,
        member.user?.name ?? member.displayName,
        // A linked person has one avatar, wherever they appear — the
        // account's; the member row's copy only matters for placeholders.
        member.avatarKey ?? member.user?.avatarKey ?? null,
      );
    }
    const profile = await this.ensurePlaceholderProfile(member.id);
    return this.toDetail(profile, member.displayName, member.avatarKey);
  }

  /**
   * Placeholder profiles are wiki-editable by the whole family; a linked
   * member's profile is managed by that member only (domain-model.md).
   */
  async updateForMember(
    userId: string,
    familyId: string,
    memberId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileDetail> {
    const { profile } = await this.resolveForMember(
      userId,
      familyId,
      memberId,
      {
        forEdit: true,
      },
    );
    await this.applyUpdate(profile, userId, dto);
    return this.getForMember(userId, familyId, memberId);
  }

  /**
   * The one home of the member→profile resolution plus the wiki rule
   * (domain-model.md): linked member → global profile, editable only by
   * its owner; placeholder → family-local profile, wiki-editable by the
   * whole family. Everything hanging off a profile (life events, memos,
   * the coming gallery) resolves through here instead of re-assembling
   * the rule from the primitives.
   */
  async resolveForMember(
    userId: string,
    familyId: string,
    memberId: string,
    options: { forEdit?: boolean } = {},
  ): Promise<{
    profile: ProfileRecord;
    member: { id: string; userId: string | null; familyId: string };
  }> {
    const member = await this.findMember(userId, familyId, memberId);
    if (options.forEdit && member.userId && member.userId !== userId) {
      throw new ForbiddenException(
        'Linked members manage their own profile content',
      );
    }
    const profile = member.userId
      ? await this.ensureGlobalProfile(member.userId)
      : await this.ensurePlaceholderProfile(member.id);
    return {
      profile,
      member: { id: member.id, userId: member.userId, familyId },
    };
  }

  /**
   * Who may see content hanging off a profile (life-event media today,
   * the derived gallery next): the owner of a global profile and anyone
   * sharing a family with them; a placeholder's family's members. One
   * home for the rule — MediaService delegates, never copies.
   */
  async canViewProfileContent(
    userId: string,
    profile: { userId: string | null; memberId: string | null },
  ): Promise<boolean> {
    if (profile.userId === userId) {
      return true;
    }
    if (profile.userId) {
      const shared = await this.prisma.familyMember.findFirst({
        where: {
          userId: profile.userId,
          family: { members: { some: { userId } } },
        },
        select: { id: true },
      });
      return shared !== null;
    }
    if (profile.memberId) {
      const membership = await this.prisma.familyMember.findFirst({
        where: {
          userId,
          family: { members: { some: { id: profile.memberId } } },
        },
        select: { id: true },
      });
      return membership !== null;
    }
    return false;
  }

  /** Applies the edit, stamps the editor, and logs an EditHistory row. */
  private async applyUpdate(
    profile: ProfileRecord,
    editorUserId: string,
    dto: UpdateProfileDto,
  ): Promise<void> {
    // undefined = unchanged; null (dates) / '' (bio) = clear.
    const nextBirth =
      dto.birthDate === undefined
        ? profile.birthDate
        : dto.birthDate
          ? parseIsoDate(dto.birthDate, 'birthDate')
          : null;
    const nextDeath =
      dto.deathDate === undefined
        ? profile.deathDate
        : dto.deathDate
          ? parseIsoDate(dto.deathDate, 'deathDate')
          : null;
    if (nextBirth && nextDeath && nextDeath < nextBirth) {
      throw new BadRequestException('deathDate cannot precede birthDate');
    }

    // Avatar (WBS 3.4.2). The column lives on User (global profile) or
    // FamilyMember (placeholder), not on LifeProfile — but it is edited
    // here because the profile is the once-per-person object the app
    // edits, and the wiki rule above is exactly the authorization an
    // avatar needs. The media must be the *editor's* own upload — on a
    // placeholder the editor and the profile differ, and pointing at
    // somebody else's photo must not work. One message for "missing" and
    // "not yours": no existence oracle, same as attach-media.
    const nextAvatar = await this.resolveNextAvatar(profile, editorUserId, dto);

    await this.prisma.$transaction(async (tx) => {
      if (dto.avatarMediaId !== undefined) {
        if (profile.userId) {
          await tx.user.update({
            where: { id: profile.userId },
            data: { avatarKey: dto.avatarMediaId },
          });
        } else if (profile.memberId) {
          await tx.familyMember.update({
            where: { id: profile.memberId },
            data: { avatarKey: dto.avatarMediaId },
          });
        }
      }
      const updated = await tx.lifeProfile.update({
        where: { id: profile.id },
        data: {
          ...(dto.bio !== undefined && { bio: dto.bio.trim() || null }),
          ...(dto.interests !== undefined && { interests: dto.interests }),
          ...(dto.birthDate !== undefined && { birthDate: nextBirth }),
          ...(dto.birthPlace !== undefined && {
            birthPlace: normalizeText(dto.birthPlace),
          }),
          ...(dto.occupation !== undefined && {
            occupation: normalizeText(dto.occupation),
          }),
          ...(dto.deathDate !== undefined && { deathDate: nextDeath }),
          updatedById: editorUserId,
        },
        select: profileSelect,
      });
      // Wiki edits are logged from the start so history display/undo can
      // be added later without data loss (domain-model.md).
      await tx.editHistory.create({
        data: {
          entityType: EditEntityType.LIFE_PROFILE,
          entityId: profile.id,
          editorUserId,
          // Every editable field belongs here, or the history silently
          // stops being a full record — nothing fails when one is left
          // out. Add a field above, add it here.
          snapshot: {
            bio: updated.bio,
            interests: this.readInterests(updated.interests),
            birthDate: updated.birthDate?.toISOString() ?? null,
            birthPlace: updated.birthPlace,
            occupation: updated.occupation,
            deathDate: updated.deathDate?.toISOString() ?? null,
            avatarMediaId: nextAvatar,
          },
        },
      });
    });
  }

  /**
   * Validates an incoming avatar and answers what the avatar will be
   * after this edit — the snapshot above records the full post-edit
   * state, so an untouched avatar still has to be read.
   */
  private async resolveNextAvatar(
    profile: ProfileRecord,
    editorUserId: string,
    dto: UpdateProfileDto,
  ): Promise<string | null> {
    if (dto.avatarMediaId === undefined) {
      if (profile.userId) {
        const user = await this.prisma.user.findUniqueOrThrow({
          where: { id: profile.userId },
          select: { avatarKey: true },
        });
        return user.avatarKey;
      }
      if (profile.memberId) {
        const member = await this.prisma.familyMember.findUniqueOrThrow({
          where: { id: profile.memberId },
          select: { avatarKey: true },
        });
        return member.avatarKey;
      }
      return null;
    }
    if (dto.avatarMediaId === null) {
      return null;
    }
    const media = await this.prisma.media.findFirst({
      where: { id: dto.avatarMediaId, uploaderUserId: editorUserId },
      select: { mimeType: true },
    });
    if (!media) {
      throw new BadRequestException(
        'avatarMediaId must be an image you uploaded yourself',
      );
    }
    if (!media.mimeType.startsWith('image/')) {
      throw new BadRequestException('An avatar must be an image');
    }
    return dto.avatarMediaId;
  }

  /** Public because LifeEventService resolves members the same way. */
  async findMember(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<{
    id: string;
    userId: string | null;
    displayName: string;
    avatarKey: string | null;
    user: { name: string; avatarKey: string | null } | null;
  }> {
    await this.familyService.requireMembership(familyId, userId);
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
      select: {
        id: true,
        userId: true,
        displayName: true,
        avatarKey: true,
        user: { select: { name: true, avatarKey: true } },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this family');
    }
    return member;
  }

  /** Every account gets a profile at registration; self-heal if missing.
   *  Public so LifeEventService resolves profiles the same way. */
  ensureGlobalProfile(userId: string): Promise<ProfileRecord> {
    return this.prisma.lifeProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: profileSelect,
    });
  }

  /** addMember creates one; self-heal for rows that predate that.
   *  Public so LifeEventService resolves profiles the same way. */
  ensurePlaceholderProfile(memberId: string): Promise<ProfileRecord> {
    return this.prisma.lifeProfile.upsert({
      where: { memberId },
      create: { memberId },
      update: {},
      select: profileSelect,
    });
  }

  private toDetail(
    profile: ProfileRecord,
    displayName: string,
    avatarMediaId: string | null,
    options: { hasPassword: boolean | null } = { hasPassword: null },
  ): ProfileDetail {
    return {
      id: profile.id,
      userId: profile.userId,
      memberId: profile.memberId,
      displayName,
      bio: profile.bio,
      interests: this.readInterests(profile.interests),
      birthDate: profile.birthDate,
      birthPlace: profile.birthPlace,
      occupation: profile.occupation,
      deathDate: profile.deathDate,
      avatarMediaId,
      hasPassword: options.hasPassword,
      updatedAt: profile.updatedAt,
    };
  }

  /** interests is a Json column; anything unexpected reads as empty. */
  private readInterests(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }
}
