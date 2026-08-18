import type { ReadStream } from 'node:fs';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Multer file injected by FileInterceptor (streamed to a temp file). */
export interface UploadedMediaFile {
  path: string;
  mimetype: string;
  size: number;
}

export interface MediaSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export type MediaStreamResult =
  | { kind: 'full'; stream: ReadStream; mimeType: string; size: number }
  | {
      kind: 'partial';
      stream: ReadStream;
      mimeType: string;
      size: number;
      start: number;
      end: number;
    }
  | { kind: 'unsatisfiable'; size: number };

/**
 * Single-range `bytes=` parser. Malformed or multi-range headers fall
 * back to a full response (RFC 9110 lets servers ignore Range); a
 * syntactically valid but unsatisfiable range reports 416.
 */
function parseByteRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) {
    return null;
  }
  if (size === 0) {
    return 'unsatisfiable';
  }
  if (match[1] === '') {
    // Suffix form "bytes=-N": the last N bytes.
    const suffix = Number(match[2]);
    if (suffix === 0) {
      return 'unsatisfiable';
    }
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  if (start >= size) {
    return 'unsatisfiable';
  }
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (end < start) {
    return null;
  }
  return { start, end };
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Stores the file and creates a standalone Media row (no parent yet). */
  async upload(
    userId: string,
    file: UploadedMediaFile | undefined,
  ): Promise<MediaSummary> {
    if (!file) {
      throw new BadRequestException(
        'A "file" field is required (multipart/form-data)',
      );
    }
    if (!this.storage.supports(file.mimetype)) {
      await this.storage.discardTemp(file.path);
      throw new UnsupportedMediaTypeException(
        `Only ${this.storage.supportedMimeTypes().join(', ')} are supported`,
      );
    }
    const storageKey = await this.storage.promote(file.path, file.mimetype);
    try {
      return await this.prisma.media.create({
        data: {
          uploaderUserId: userId,
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
    } catch (error) {
      // Don't leave an unreferenced file behind when the row can't be
      // written — storageKey is only discoverable through the Media table.
      try {
        await this.storage.remove(storageKey);
      } catch (cleanupError) {
        this.logger.warn(
          `Could not clean up ${storageKey} after a failed insert: ${String(cleanupError)}`,
        );
      }
      throw error;
    }
  }

  /** Streams a media file (optionally a byte range) to an allowed viewer. */
  async openForViewer(
    userId: string,
    mediaId: string,
    rangeHeader?: string,
  ): Promise<MediaStreamResult> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: {
        storageKey: true,
        mimeType: true,
        uploaderUserId: true,
        memo: { select: { ownerUserId: true } },
        post: {
          select: {
            authorUserId: true,
            families: { select: { familyId: true } },
          },
        },
      },
    });
    // 404 in both cases — do not confirm that private content exists.
    if (!media || !(await this.canView(userId, media))) {
      throw new NotFoundException('Media not found');
    }
    const size = await this.storage.sizeOf(media.storageKey);
    const range = parseByteRange(rangeHeader, size);
    if (range === 'unsatisfiable') {
      return { kind: 'unsatisfiable', size };
    }
    if (range) {
      return {
        kind: 'partial',
        stream: this.storage.openRead(media.storageKey, range.start, range.end),
        mimeType: media.mimeType,
        size,
        start: range.start,
        end: range.end,
      };
    }
    return {
      kind: 'full',
      stream: this.storage.openRead(media.storageKey),
      mimeType: media.mimeType,
      size,
    };
  }

  private async canView(
    userId: string,
    media: {
      uploaderUserId: string;
      memo: { ownerUserId: string } | null;
      post: { authorUserId: string; families: { familyId: string }[] } | null;
    },
  ): Promise<boolean> {
    if (media.uploaderUserId === userId) {
      return true;
    }
    if (media.memo) {
      // Memos are always private to their author (domain-model.md).
      return media.memo.ownerUserId === userId;
    }
    if (media.post) {
      if (media.post.authorUserId === userId) {
        return true;
      }
      const familyIds = media.post.families.map((f) => f.familyId);
      if (familyIds.length === 0) {
        return false; // private post
      }
      const membership = await this.prisma.familyMember.findFirst({
        where: { userId, familyId: { in: familyIds } },
        select: { id: true },
      });
      return membership !== null;
    }
    // Standalone or life-event media stays uploader-only until the
    // life-event flows land (WBS 1.6.8).
    return false;
  }
}
