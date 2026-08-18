import type { ReadStream } from 'node:fs';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Shape of the multer file injected by FileInterceptor (memory storage). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface MediaSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface MediaFile {
  stream: ReadStream;
  mimeType: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Stores the file and creates a standalone Media row (no parent yet). */
  async upload(
    userId: string,
    file: UploadedImage | undefined,
  ): Promise<MediaSummary> {
    if (!file) {
      throw new BadRequestException(
        'A "file" field is required (multipart/form-data)',
      );
    }
    if (!this.storage.supports(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `Only ${this.storage.supportedMimeTypes().join(', ')} are supported`,
      );
    }
    const storageKey = await this.storage.save(file.buffer, file.mimetype);
    return this.prisma.media.create({
      data: {
        uploaderUserId: userId,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
  }

  /** Streams a media file if the viewer is allowed to see it. */
  async openForViewer(userId: string, mediaId: string): Promise<MediaFile> {
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
    return {
      stream: await this.storage.openRead(media.storageKey),
      mimeType: media.mimeType,
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
