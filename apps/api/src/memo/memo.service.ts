import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeText, requireTrimmed } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  assertAttachableMedia,
  attachMediaInTx,
  attachedMediaInclude,
  type AttachedMediaSummary,
} from '../media/attach-media';
import { ProfileService } from '../profile/profile.service';
import { StorageService } from '../storage/storage.service';
import { CreateMemoDto } from './dto/create-memo.dto';
import { UpdateMemoDto } from './dto/update-memo.dto';

export interface MemoDetail {
  id: string;
  /** Who the note is about — stable through account-linking. */
  aboutMemberId: string;
  title: string;
  content: string | null;
  category: string | null;
  media: AttachedMediaSummary[];
  createdAt: Date;
  updatedAt: Date;
}

const memoInclude = {
  media: attachedMediaInclude,
} as const;

type MemoRecord = Prisma.MemoGetPayload<{ include: typeof memoInclude }>;

/**
 * Private notes about a family member (database.md, WBS 1.6.5). Always
 * private: only the author views or edits — decided 2026-08-14, task 1.6.6
 * (sharing) dropped. That is why every lookup filters on ownerUserId and a
 * stranger's probe gets a 404, never a 403: a memo's existence is itself
 * private.
 */
@Injectable()
export class MemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly storage: StorageService,
  ) {}

  /** My notes about this member, most recently touched first (the note
   *  written today is the one being looked for). */
  async list(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<MemoDetail[]> {
    // findMember enforces family membership and member-in-family.
    await this.profileService.findMember(userId, familyId, memberId);
    const memos = await this.prisma.memo.findMany({
      where: { ownerUserId: userId, aboutMemberId: memberId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: memoInclude,
    });
    return memos.map((memo) => this.toDetail(memo));
  }

  async create(
    userId: string,
    familyId: string,
    memberId: string,
    dto: CreateMemoDto,
  ): Promise<MemoDetail> {
    await this.profileService.findMember(userId, familyId, memberId);
    const title = requireTrimmed(dto.title, 'A memo needs a title');
    const mediaIds = dto.mediaIds ?? [];
    await assertAttachableMedia(this.prisma, userId, mediaIds);

    const memo = await this.prisma.$transaction(async (tx) => {
      const created = await tx.memo.create({
        data: {
          ownerUserId: userId,
          aboutMemberId: memberId,
          title,
          content: normalizeText(dto.content),
          category: normalizeText(dto.category),
        },
        select: { id: true },
      });
      await attachMediaInTx(tx, userId, mediaIds, { memoId: created.id });
      return tx.memo.findUniqueOrThrow({
        where: { id: created.id },
        include: memoInclude,
      });
    });
    return this.toDetail(memo);
  }

  async get(userId: string, memoId: string): Promise<MemoDetail> {
    const memo = await this.findOwn(userId, memoId);
    return this.toDetail(memo);
  }

  async update(
    userId: string,
    memoId: string,
    dto: UpdateMemoDto,
  ): Promise<MemoDetail> {
    const existing = await this.findOwn(userId, memoId);
    // PartialType admits explicit JSON null; the title is not clearable.
    if (dto.title !== undefined) {
      requireTrimmed(dto.title, 'A memo needs a title');
    }
    // Write only values that actually differ: a PATCH that changes
    // nothing (a retry, a save with no edits) must not bump updatedAt —
    // the list is ordered by it and the memo would jump the queue.
    const next = {
      title: dto.title !== undefined ? dto.title.trim() : existing.title,
      content:
        dto.content !== undefined
          ? normalizeText(dto.content)
          : existing.content,
      category:
        dto.category !== undefined
          ? normalizeText(dto.category)
          : existing.category,
    };
    const data: Prisma.MemoUpdateInput = {
      ...(next.title !== existing.title && { title: next.title }),
      ...(next.content !== existing.content && { content: next.content }),
      ...(next.category !== existing.category && { category: next.category }),
    };
    if (Object.keys(data).length === 0) {
      return this.toDetail(existing);
    }
    const updated = await this.prisma.memo
      .update({
        where: { id: memoId },
        data,
        include: memoInclude,
      })
      .catch(rethrowMissingAs404);
    return this.toDetail(updated);
  }

  async remove(userId: string, memoId: string): Promise<{ success: boolean }> {
    await this.findOwn(userId, memoId);
    const media = await this.prisma.media.findMany({
      where: { memoId },
      select: { storageKey: true },
    });
    // Scoped delete: a concurrent duplicate DELETE makes count 0 → 404,
    // never a raw P2025 500. Cascade removes the media rows; files go
    // best-effort after commit.
    const deleted = await this.prisma.memo.deleteMany({
      where: { id: memoId, ownerUserId: userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Memo not found');
    }
    await this.storage.removeAllBestEffort(media.map((m) => m.storageKey));
    return { success: true };
  }

  /** 404 for anything that is not the caller's own memo — existence is
   *  private, so no 403. */
  private async findOwn(userId: string, memoId: string): Promise<MemoRecord> {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, ownerUserId: userId },
      include: memoInclude,
    });
    if (!memo) {
      throw new NotFoundException('Memo not found');
    }
    return memo;
  }

  private toDetail(memo: MemoRecord): MemoDetail {
    return {
      id: memo.id,
      aboutMemberId: memo.aboutMemberId,
      title: memo.title,
      content: memo.content,
      category: memo.category,
      media: memo.media,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    };
  }
}

/** A row deleted between the ownership check and the write is a 404,
 *  not a raw Prisma P2025 500. */
function rethrowMissingAs404(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException('Memo not found');
  }
  throw error;
}
