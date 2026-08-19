import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeText } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { assertAttachableMedia, attachMediaInTx } from '../media/attach-media';
import { ProfileService } from '../profile/profile.service';
import { StorageService } from '../storage/storage.service';
import { CreateMemoDto } from './dto/create-memo.dto';
import { UpdateMemoDto } from './dto/update-memo.dto';

export interface MemoMediaSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MemoDetail {
  id: string;
  /** Who the note is about — stable through account-linking. */
  aboutMemberId: string;
  title: string;
  content: string | null;
  category: string | null;
  media: MemoMediaSummary[];
  createdAt: Date;
  updatedAt: Date;
}

const memoInclude = {
  media: {
    select: { id: true, mimeType: true, sizeBytes: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

interface MemoRecord {
  id: string;
  aboutMemberId: string;
  title: string;
  content: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  media: MemoMediaSummary[];
}

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
    const title = dto.title.trim();
    if (!title) {
      // @IsNotEmpty() lets "   " through — it only rejects ''.
      throw new BadRequestException('A memo needs a title');
    }
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
    await this.findOwn(userId, memoId);
    // PartialType admits explicit JSON null; the title is not clearable.
    if (dto.title !== undefined && !dto.title?.trim()) {
      throw new BadRequestException('A memo needs a title');
    }
    // A no-op PATCH must not bump updatedAt — the list is ordered by it.
    if (
      dto.title === undefined &&
      dto.content === undefined &&
      dto.category === undefined
    ) {
      return this.get(userId, memoId);
    }
    const updated = await this.prisma.memo.update({
      where: { id: memoId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.content !== undefined && {
          content: normalizeText(dto.content),
        }),
        ...(dto.category !== undefined && {
          category: normalizeText(dto.category),
        }),
      },
      include: memoInclude,
    });
    return this.toDetail(updated);
  }

  async remove(userId: string, memoId: string): Promise<{ success: boolean }> {
    await this.findOwn(userId, memoId);
    const media = await this.prisma.media.findMany({
      where: { memoId },
      select: { storageKey: true },
    });
    // Cascade removes the media rows; files go best-effort after commit.
    await this.prisma.memo.delete({ where: { id: memoId } });
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
