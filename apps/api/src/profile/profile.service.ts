import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseIsoDate } from '../common/input';
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
  deathDate: Date | null;
  updatedAt: Date;
}

interface ProfileRecord {
  id: string;
  userId: string | null;
  memberId: string | null;
  bio: string | null;
  interests: unknown;
  birthDate: Date | null;
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
        select: { name: true },
      }),
    ]);
    return this.toDetail(profile, user.name);
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
      return this.toDetail(profile, member.user?.name ?? member.displayName);
    }
    const profile = await this.ensurePlaceholderProfile(member.id);
    return this.toDetail(profile, member.displayName);
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
    const member = await this.findMember(userId, familyId, memberId);
    if (member.userId && member.userId !== userId) {
      throw new ForbiddenException('Linked members manage their own profile');
    }
    const profile = member.userId
      ? await this.ensureGlobalProfile(member.userId)
      : await this.ensurePlaceholderProfile(member.id);
    await this.applyUpdate(profile, userId, dto);
    return this.getForMember(userId, familyId, memberId);
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

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lifeProfile.update({
        where: { id: profile.id },
        data: {
          ...(dto.bio !== undefined && { bio: dto.bio.trim() || null }),
          ...(dto.interests !== undefined && { interests: dto.interests }),
          ...(dto.birthDate !== undefined && { birthDate: nextBirth }),
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
          snapshot: {
            bio: updated.bio,
            interests: this.readInterests(updated.interests),
            birthDate: updated.birthDate?.toISOString() ?? null,
            deathDate: updated.deathDate?.toISOString() ?? null,
          },
        },
      });
    });
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
    user: { name: string } | null;
  }> {
    await this.familyService.requireMembership(familyId, userId);
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
      select: {
        id: true,
        userId: true,
        displayName: true,
        user: { select: { name: true } },
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

  private toDetail(profile: ProfileRecord, displayName: string): ProfileDetail {
    return {
      id: profile.id,
      userId: profile.userId,
      memberId: profile.memberId,
      displayName,
      bio: profile.bio,
      interests: this.readInterests(profile.interests),
      birthDate: profile.birthDate,
      deathDate: profile.deathDate,
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
