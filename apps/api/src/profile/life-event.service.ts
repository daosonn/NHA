import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeText, parseIsoDate, requireTrimmed } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { assertTaggedMembers, ownFamilyIds } from '../family/member-tags';
import { Prisma } from '../generated/prisma/client';
import { EditEntityType } from '../generated/prisma/enums';
import {
  assertAttachableMedia,
  attachMediaInTx,
  attachedMediaInclude,
  type AttachedMediaSummary,
} from '../media/attach-media';
import { StorageService } from '../storage/storage.service';
import { CreateLifeEventDto } from './dto/create-life-event.dto';
import { UpdateLifeEventDto } from './dto/update-life-event.dto';
import { ProfileService } from './profile.service';

export interface LifeEventDetail {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  eventDate: Date;
  place: string | null;
  type: string | null;
  taggedMemberIds: string[];
  media: AttachedMediaSummary[];
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventInclude = {
  memberTags: { select: { memberId: true } },
  media: attachedMediaInclude,
} as const;

type LifeEventRecord = Prisma.LifeEventGetPayload<{
  include: typeof eventInclude;
}>;

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
    // Tags may come from any family the author belongs to — a profile is one
    // person across all of them.
    const families = await ownFamilyIds(this.prisma, userId);
    return this.createEvent(profile.id, userId, dto, families);
  }

  async updateOwn(
    userId: string,
    eventId: string,
    dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.updateEvent(
      profile.id,
      eventId,
      userId,
      dto,
      await ownFamilyIds(this.prisma, userId),
    );
  }

  async removeOwn(
    userId: string,
    eventId: string,
  ): Promise<{ success: boolean }> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.removeEvent(profile.id, eventId);
  }

  /** A member's timeline inside one family — same profile resolution and
   *  wiki rule as GET .../profile (ProfileService.resolveForMember). */
  async listForMember(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<LifeEventDetail[]> {
    const { profile } = await this.profileService.resolveForMember(
      userId,
      familyId,
      memberId,
    );
    return this.listForProfile(profile.id);
  }

  async createForMember(
    userId: string,
    familyId: string,
    memberId: string,
    dto: CreateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const { profile } = await this.profileService.resolveForMember(
      userId,
      familyId,
      memberId,
      { forEdit: true },
    );
    // Tags stay inside the family being edited, so every viewer of that
    // family can resolve them — the same principle as post tags.
    return this.createEvent(profile.id, userId, dto, [familyId]);
  }

  async updateForMember(
    userId: string,
    familyId: string,
    memberId: string,
    eventId: string,
    dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    const { profile } = await this.profileService.resolveForMember(
      userId,
      familyId,
      memberId,
      { forEdit: true },
    );
    return this.updateEvent(profile.id, eventId, userId, dto, [familyId]);
  }

  async removeForMember(
    userId: string,
    familyId: string,
    memberId: string,
    eventId: string,
  ): Promise<{ success: boolean }> {
    const { profile } = await this.profileService.resolveForMember(
      userId,
      familyId,
      memberId,
      { forEdit: true },
    );
    return this.removeEvent(profile.id, eventId);
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
    allowedTagFamilyIds: string[],
  ): Promise<LifeEventDetail> {
    const title = requireTrimmed(dto.title, 'A life event needs a title');
    const eventDate = parseIsoDate(dto.eventDate, 'eventDate');
    const taggedMemberIds = dto.taggedMemberIds ?? [];
    await assertTaggedMembers(
      this.prisma,
      taggedMemberIds,
      allowedTagFamilyIds,
      'Tagged members must belong to the family this timeline is viewed in',
    );
    const mediaIds = dto.mediaIds ?? [];
    await assertAttachableMedia(this.prisma, editorUserId, mediaIds);

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

      // The milestone is recorded on the timeline ONLY. It used to be
      // announced in the feed as an EVENT post too (behind `shareToFeed`);
      // the owner turned that off on 2026-09-03 — a timeline edit is
      // record-keeping, not news.

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
    allowedTagFamilyIds: string[],
  ): Promise<LifeEventDetail> {
    const existing = await this.findEventInProfile(profileId, eventId);

    // PartialType applies @IsOptional, which skips every validator for an
    // explicit JSON null — handled here. Neither title nor eventDate is
    // clearable (the model requires both); without these guards
    // null.trim() is a 500 and new Date(null) silently rewrites the date
    // to 1970-01-01.
    if (dto.title !== undefined) {
      requireTrimmed(dto.title, 'A life event needs a title');
    }
    if (dto.eventDate !== undefined && !dto.eventDate) {
      throw new BadRequestException('eventDate cannot be cleared');
    }
    // null tags = unchanged, same as omitted (only an array replaces).
    const taggedMemberIds = dto.taggedMemberIds ?? undefined;
    if (taggedMemberIds) {
      await assertTaggedMembers(
        this.prisma,
        taggedMemberIds,
        allowedTagFamilyIds,
        'Tagged members must belong to the family this timeline is viewed in',
      );
    }

    // Same rule for media: null or omitted leaves the photos alone, an array
    // is the new set. Only the ids NEW to the set are checked as attachable —
    // one already on this event fails `attachableWhere` by definition
    // (`lifeEventId` is not null), so passing the whole set to the pre-flight
    // would reject every edit that keeps a photo.
    const mediaIds = dto.mediaIds ?? undefined;
    const existingMediaIds = existing.media.map((item) => item.id);
    const addedMediaIds =
      mediaIds?.filter((id) => !existingMediaIds.includes(id)) ?? [];
    const droppedMediaIds =
      mediaIds === undefined
        ? []
        : existingMediaIds.filter((id) => !mediaIds.includes(id));
    await assertAttachableMedia(this.prisma, editorUserId, addedMediaIds);

    // Build the write from values that actually differ, so a PATCH that
    // changes nothing (a client retry, a save with no edits) stamps no
    // editor and appends no EditHistory row — the wiki log records edits,
    // not requests (api-contract.md).
    const next = {
      title: dto.title !== undefined ? dto.title.trim() : existing.title,
      description:
        dto.description !== undefined
          ? normalizeText(dto.description)
          : existing.description,
      eventDate: dto.eventDate
        ? parseIsoDate(dto.eventDate, 'eventDate')
        : existing.eventDate,
      place:
        dto.place !== undefined ? normalizeText(dto.place) : existing.place,
      type: dto.type !== undefined ? normalizeText(dto.type) : existing.type,
    };
    const existingTagIds = existing.memberTags.map((tag) => tag.memberId);
    const nextTags =
      taggedMemberIds && !sameIdSet(taggedMemberIds, existingTagIds)
        ? taggedMemberIds
        : undefined;
    const mediaChanged = addedMediaIds.length > 0 || droppedMediaIds.length > 0;
    const data: Prisma.LifeEventUpdateInput = {
      ...(next.title !== existing.title && { title: next.title }),
      ...(next.description !== existing.description && {
        description: next.description,
      }),
      ...(next.eventDate.getTime() !== existing.eventDate.getTime() && {
        eventDate: next.eventDate,
      }),
      ...(next.place !== existing.place && { place: next.place }),
      ...(next.type !== existing.type && { type: next.type }),
      ...(nextTags && {
        memberTags: {
          deleteMany: {},
          create: nextTags.map((memberId) => ({ memberId })),
        },
      }),
    };
    // Media lives in its own rows, so a photo-only edit leaves `data`
    // empty — it still has to reach the transaction, stamp the editor and
    // append its history row.
    if (Object.keys(data).length === 0 && !mediaChanged) {
      return this.toDetail(existing);
    }

    const { event, orphanedKeys } = await this.prisma.$transaction(
      async (tx) => {
        // Dropped first: a photo leaving frees nothing the additions need,
        // but doing it before the attach keeps the row count honest if the
        // attach throws and rolls everything back.
        //
        // Deleted, not detached. A Media row may have exactly one parent, so
        // an unparented row is invisible to every reader and reattachable by
        // nobody but its uploader — an orphan with a file still on the disk.
        // Deleting the whole entry already deletes its photos this way, and
        // anyone editing here already has the power to do that.
        let keys: string[] = [];
        if (droppedMediaIds.length > 0) {
          const gone = await tx.media.findMany({
            // Scoped to this event as well as the ids: a request naming
            // someone else's media must not delete it.
            where: { id: { in: droppedMediaIds }, lifeEventId: eventId },
            select: { storageKey: true },
          });
          keys = gone.map((item) => item.storageKey);
          await tx.media.deleteMany({
            where: { id: { in: droppedMediaIds }, lifeEventId: eventId },
          });
        }
        await attachMediaInTx(tx, editorUserId, addedMediaIds, {
          lifeEventId: eventId,
        });

        const full = await tx.lifeEvent
          .update({
            where: { id: eventId },
            data: { ...data, updatedBy: { connect: { id: editorUserId } } },
            include: eventInclude,
          })
          .catch(rethrowMissingAs404);
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
              mediaIds: full.media.map((item) => item.id),
            },
          },
        });
        return { event: full, orphanedKeys: keys };
      },
    );
    // After the commit, and best-effort: a file left behind is waste, a file
    // removed under a transaction that then rolls back is a broken picture.
    // Same order `removeEvent` uses.
    await this.storage.removeAllBestEffort(orphanedKeys);
    return this.toDetail(event);
  }

  private async removeEvent(
    profileId: string,
    eventId: string,
  ): Promise<{ success: boolean }> {
    await this.findEventInProfile(profileId, eventId);
    const files = await this.prisma.media.findMany({
      where: { lifeEventId: eventId },
      select: { storageKey: true },
    });
    // Scoped delete: a concurrent delete makes count 0 → 404, never a
    // raw P2025 500. Cascades remove the media and tag rows.
    const deleted = await this.prisma.lifeEvent.deleteMany({
      where: { id: eventId, profileId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Life event not found');
    }
    await this.storage.removeAllBestEffort(files.map((f) => f.storageKey));
    return { success: true };
  }

  /** 404 unless the event belongs to this profile; returns the full
   *  record so update/remove need no second read. */
  private async findEventInProfile(
    profileId: string,
    eventId: string,
  ): Promise<LifeEventRecord> {
    const event = await this.prisma.lifeEvent.findFirst({
      where: { id: eventId, profileId },
      include: eventInclude,
    });
    if (!event) {
      throw new NotFoundException('Life event not found');
    }
    return event;
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

/** Order-insensitive id comparison for the tags-changed check. */
function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

/** A row deleted between the ownership check and the write is a 404,
 *  not a raw Prisma P2025 500. */
function rethrowMissingAs404(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException('Life event not found');
  }
  throw error;
}
