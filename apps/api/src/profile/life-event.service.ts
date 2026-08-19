import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeText, parseIsoDate } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { EditEntityType } from '../generated/prisma/enums';
import { assertAttachableMedia, attachMediaInTx } from '../media/attach-media';
import { StorageService } from '../storage/storage.service';
import { CreateLifeEventDto } from './dto/create-life-event.dto';
import { UpdateLifeEventDto } from './dto/update-life-event.dto';
import { ProfileService } from './profile.service';

export interface LifeEventMediaSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LifeEventDetail {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  eventDate: Date;
  place: string | null;
  type: string | null;
  taggedMemberIds: string[];
  media: LifeEventMediaSummary[];
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventInclude = {
  memberTags: { select: { memberId: true } },
  media: {
    select: { id: true, mimeType: true, sizeBytes: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

interface LifeEventRecord {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  eventDate: Date;
  place: string | null;
  type: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  memberTags: { memberId: string }[];
  media: LifeEventMediaSummary[];
}

@Injectable()
export class LifeEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly storage: StorageService,
  ) {}

  /** The caller's own timeline (Profile tab — works with no family). */
  async listOwn(userId: string): Promise<LifeEventDetail[]> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.listForProfile(profile.id);
  }

  async createOwn(
    userId: string,
    dto: CreateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.createEvent(profile.id, userId, dto);
  }

  async updateOwn(
    userId: string,
    eventId: string,
    dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.updateEvent(profile.id, eventId, userId, dto);
  }

  async removeOwn(
    userId: string,
    eventId: string,
  ): Promise<{ success: boolean }> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.removeEvent(profile.id, eventId);
  }

  /** A member's timeline inside one family — same profile resolution as
   *  GET .../profile (linked → global, placeholder → family-local). */
  async listForMember(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<LifeEventDetail[]> {
    const profile = await this.resolveProfile(userId, familyId, memberId);
    return this.listForProfile(profile.id);
  }

  async createForMember(
    userId: string,
    familyId: string,
    memberId: string,
    dto: CreateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const profile = await this.resolveProfile(userId, familyId, memberId, {
      forEdit: true,
    });
    return this.createEvent(profile.id, userId, dto);
  }

  async updateForMember(
    userId: string,
    familyId: string,
    memberId: string,
    eventId: string,
    dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const profile = await this.resolveProfile(userId, familyId, memberId, {
      forEdit: true,
    });
    return this.updateEvent(profile.id, eventId, userId, dto);
  }

  async removeForMember(
    userId: string,
    familyId: string,
    memberId: string,
    eventId: string,
  ): Promise<{ success: boolean }> {
    const profile = await this.resolveProfile(userId, familyId, memberId, {
      forEdit: true,
    });
    return this.removeEvent(profile.id, eventId);
  }

  /**
   * The life-event media visibility rule, for MediaService: the owner of a
   * global profile and anyone who shares a family with them; for a
   * placeholder, its family's members. One home for the rule — never a
   * second copy in MediaService.
   */
  async canViewProfileMedia(
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
      // One query, same relation-join shape as the linked branch above:
      // the viewer's membership in the placeholder's family.
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

  /**
   * Wiki rule, same as the profile it hangs off (database.md): a
   * placeholder's events are editable by the whole family; a linked
   * member's events are managed by that member only.
   */
  private async resolveProfile(
    userId: string,
    familyId: string,
    memberId: string,
    options: { forEdit?: boolean } = {},
  ): Promise<{ id: string }> {
    const member = await this.profileService.findMember(
      userId,
      familyId,
      memberId,
    );
    if (options.forEdit && member.userId && member.userId !== userId) {
      throw new ForbiddenException('Linked members manage their own timeline');
    }
    return member.userId
      ? this.profileService.ensureGlobalProfile(member.userId)
      : this.profileService.ensurePlaceholderProfile(member.id);
  }

  /** Oldest first — a life timeline reads birth-to-now (screen 9). */
  private async listForProfile(profileId: string): Promise<LifeEventDetail[]> {
    const events = await this.prisma.lifeEvent.findMany({
      where: { profileId },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      include: eventInclude,
    });
    return events.map((event) => this.toDetail(event));
  }

  private async createEvent(
    profileId: string,
    editorUserId: string,
    dto: CreateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const eventDate = parseIsoDate(dto.eventDate, 'eventDate');
    const taggedMemberIds = dto.taggedMemberIds ?? [];
    await this.validateTags(editorUserId, taggedMemberIds);
    const mediaIds = dto.mediaIds ?? [];
    await assertAttachableMedia(this.prisma, editorUserId, mediaIds);

    const title = dto.title.trim();
    if (!title) {
      // @IsNotEmpty() lets "   " through — it only rejects ''.
      throw new BadRequestException('A life event needs a title');
    }

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lifeEvent.create({
        data: {
          profileId,
          title,
          description: normalizeText(dto.description),
          eventDate,
          place: normalizeText(dto.place),
          type: normalizeText(dto.type),
          createdById: editorUserId,
          memberTags: {
            create: taggedMemberIds.map((memberId) => ({ memberId })),
          },
        },
        select: { id: true },
      });
      await attachMediaInTx(tx, editorUserId, mediaIds, {
        lifeEventId: created.id,
      });
      return tx.lifeEvent.findUniqueOrThrow({
        where: { id: created.id },
        include: eventInclude,
      });
    });
    return this.toDetail(event);
  }

  private async updateEvent(
    profileId: string,
    eventId: string,
    editorUserId: string,
    dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    await this.findEventInProfile(profileId, eventId);

    // PartialType applies @IsOptional, which skips every validator for an
    // explicit JSON null — so null reaches this far and must be handled
    // here. Neither title nor eventDate is clearable (the model requires
    // both); without these guards null.trim() is a 500 and new Date(null)
    // silently rewrites the date to 1970-01-01.
    if (dto.title !== undefined && !dto.title?.trim()) {
      throw new BadRequestException('A life event needs a title');
    }
    if (dto.eventDate !== undefined && !dto.eventDate) {
      throw new BadRequestException('eventDate cannot be cleared');
    }
    const nextDate = dto.eventDate
      ? parseIsoDate(dto.eventDate, 'eventDate')
      : undefined;
    // null tags = unchanged, same as omitted (only an array replaces).
    const taggedMemberIds = dto.taggedMemberIds ?? undefined;
    if (taggedMemberIds) {
      await this.validateTags(editorUserId, taggedMemberIds);
    }

    // A no-op PATCH must not stamp an editor or append an EditHistory
    // row — a client retry would otherwise fill the wiki log.
    const hasChanges =
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.eventDate !== undefined ||
      dto.place !== undefined ||
      dto.type !== undefined ||
      taggedMemberIds !== undefined;
    if (!hasChanges) {
      const unchanged = await this.prisma.lifeEvent.findUniqueOrThrow({
        where: { id: eventId },
        include: eventInclude,
      });
      return this.toDetail(unchanged);
    }

    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lifeEvent.update({
        where: { id: eventId },
        data: {
          // dto.title is non-null non-blank here (guarded above).
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.description !== undefined && {
            description: normalizeText(dto.description),
          }),
          ...(nextDate !== undefined && { eventDate: nextDate }),
          ...(dto.place !== undefined && {
            place: normalizeText(dto.place),
          }),
          ...(dto.type !== undefined && {
            type: normalizeText(dto.type),
          }),
          updatedById: editorUserId,
        },
        select: { id: true },
      });
      if (taggedMemberIds) {
        await tx.lifeEventMemberTag.deleteMany({
          where: { lifeEventId: eventId },
        });
        await tx.lifeEventMemberTag.createMany({
          data: taggedMemberIds.map((memberId) => ({
            lifeEventId: eventId,
            memberId,
          })),
        });
      }
      const full = await tx.lifeEvent.findUniqueOrThrow({
        where: { id: updated.id },
        include: eventInclude,
      });
      // Wiki edits are logged from the start so history display/undo can
      // be added later without data loss (domain-model.md).
      await tx.editHistory.create({
        data: {
          entityType: EditEntityType.LIFE_EVENT,
          entityId: eventId,
          editorUserId,
          snapshot: {
            title: full.title,
            description: full.description,
            eventDate: full.eventDate.toISOString(),
            place: full.place,
            type: full.type,
            taggedMemberIds: full.memberTags.map((tag) => tag.memberId),
          },
        },
      });
      return full;
    });
    return this.toDetail(event);
  }

  private async removeEvent(
    profileId: string,
    eventId: string,
  ): Promise<{ success: boolean }> {
    await this.findEventInProfile(profileId, eventId);
    const media = await this.prisma.media.findMany({
      where: { lifeEventId: eventId },
      select: { storageKey: true },
    });
    // Cascades remove the media and tag rows; files go best-effort after
    // the DB commit.
    await this.prisma.lifeEvent.delete({ where: { id: eventId } });
    await this.storage.removeAllBestEffort(media.map((m) => m.storageKey));
    return { success: true };
  }

  /** Existence guard: 404 unless the event belongs to this profile. */
  private async findEventInProfile(
    profileId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.prisma.lifeEvent.findFirst({
      where: { id: eventId, profileId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Life event not found');
    }
  }

  /** Tags must stay inside the editor's own families — the same boundary
   *  private posts use (post.service.ts). */
  private async validateTags(
    userId: string,
    taggedMemberIds: string[],
  ): Promise<void> {
    if (taggedMemberIds.length === 0) {
      return;
    }
    const members = await this.prisma.familyMember.findMany({
      where: { id: { in: taggedMemberIds } },
      select: { familyId: true },
    });
    if (members.length !== taggedMemberIds.length) {
      throw new NotFoundException('Some tagged members were not found');
    }
    const familyIds = [...new Set(members.map((member) => member.familyId))];
    const memberships = await this.prisma.familyMember.count({
      where: { userId, familyId: { in: familyIds } },
    });
    if (memberships !== familyIds.length) {
      throw new BadRequestException(
        'You can only tag members of your own families',
      );
    }
  }

  private toDetail(event: LifeEventRecord): LifeEventDetail {
    return {
      id: event.id,
      profileId: event.profileId,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
      place: event.place,
      type: event.type,
      taggedMemberIds: event.memberTags.map((tag) => tag.memberId),
      media: event.media,
      createdById: event.createdById,
      updatedById: event.updatedById,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
