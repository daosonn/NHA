import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { FFMPEG } from '../video/engine/exec';
import { PostService } from '../post/post.service';
import { ProfileService } from '../profile/profile.service';
import { StorageService } from '../storage/storage.service';

/**
 * Longest edge of a thumbnail. The grid draws three across a phone, so
 * ~120pt a tile; 480 covers that at 3x and still leaves a usable picture
 * behind a fullscreen tap while the original loads.
 */
const THUMB_EDGE = 480;

/** Everything `canView` needs, in one place so its two callers agree. */
const mediaGateSelect = {
  id: true,
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
  lifeEvent: {
    select: {
      profile: { select: { userId: true, memberId: true } },
    },
  },
} as const;

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
  | { kind: 'full'; stream: Readable; mimeType: string; size: number }
  | {
      kind: 'partial';
      stream: Readable;
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
    private readonly postService: PostService,
    private readonly profileService: ProfileService,
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
    // Made from the temp file, before promote consumes it. A grid of
    // 100px tiles was downloading the originals — 1.7 MB on average for a
    // PNG, some of them 4.7 — which is most of why the app felt slow.
    const thumbTemp = await this.makeThumbnail(file.path, file.mimetype);

    const storageKey = await this.storage.promote(file.path, file.mimetype);

    if (thumbTemp !== null) {
      try {
        await this.storage.putDerived(
          this.storage.thumbKeyFor(storageKey),
          thumbTemp,
          'image/jpeg',
        );
      } catch (error) {
        // A missing thumbnail costs bandwidth, not correctness: the reader
        // still gets the original. Losing the upload over it would be worse.
        this.logger.warn(
          `Could not store a thumbnail for ${storageKey}: ${String(error)}`,
        );
      }
      await this.storage.discardTemp(thumbTemp);
    }

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

  /**
   * The small copy of a photograph, for a grid.
   *
   * Falls back to the original when there is no thumbnail — pictures
   * uploaded before thumbnails existed, and any whose generation failed.
   * The reader sees the picture either way; only the bytes differ.
   */
  async thumbForViewer(
    userId: string,
    mediaId: string,
  ): Promise<{ stream: Readable; mimeType: string }> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: mediaGateSelect,
    });
    if (!media || !(await this.canView(userId, media))) {
      throw new NotFoundException('Media not found');
    }

    const thumbKey = this.storage.thumbKeyFor(media.storageKey);
    if (await this.storage.exists(thumbKey)) {
      return {
        stream: this.storage.openRead(thumbKey),
        mimeType: 'image/jpeg',
      };
    }

    if (!(await this.storage.exists(media.storageKey))) {
      throw new NotFoundException('Media not found');
    }
    return {
      stream: this.storage.openRead(media.storageKey),
      mimeType: media.mimeType,
    };
  }

  /**
   * A small JPEG beside the original, or null when there is nothing to
   * shrink — video posters are a separate thing, made on demand from a file
   * ffmpeg has to open anyway.
   *
   * Never throws: an upload that succeeded must not fail because its
   * thumbnail did.
   */
  private async makeThumbnail(
    sourcePath: string,
    mimeType: string,
  ): Promise<string | null> {
    if (!mimeType.startsWith('image/')) return null;

    const target = path.join(this.storage.tempDir, `thumb-${randomUUID()}.jpg`);
    try {
      await mkdir(this.storage.tempDir, { recursive: true });
      await sharp(sourcePath)
        // rotate() first, or a portrait taken on a phone is thumbnailed
        // sideways — EXIF orientation is not applied by resize alone.
        .rotate()
        .resize({
          width: THUMB_EDGE,
          height: THUMB_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 72 })
        .toFile(target);
      return target;
    } catch (error) {
      this.logger.warn(`Could not make a thumbnail: ${String(error)}`);
      return null;
    }
  }

  /**
   * The batch form of the streaming gate: 404 unless every media exists
   * and the viewer may see it (same per-parent rules as openForViewer,
   * one message — no oracle about which failed). For building things out
   * of shared photos, e.g. video jobs. Returns the rows so the caller
   * needs no second read.
   */
  async assertViewableBatch(
    userId: string,
    mediaIds: string[],
  ): Promise<{ id: string; storageKey: string; mimeType: string }[]> {
    const media = await this.prisma.media.findMany({
      where: { id: { in: mediaIds } },
      select: {
        id: true,
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
        lifeEvent: {
          select: {
            profile: { select: { userId: true, memberId: true } },
          },
        },
      },
    });
    const visibility = await Promise.all(
      media.map((item) => this.canView(userId, item)),
    );
    if (media.length !== mediaIds.length || visibility.includes(false)) {
      throw new NotFoundException('Some media were not found');
    }
    // Return in the caller's order — for a video render, frame order is
    // the order the user tapped the photos, not DB insertion order. The
    // completeness check above proves every id resolves.
    const byId = new Map(
      media.map(({ id, storageKey, mimeType }) => [
        id,
        { id, storageKey, mimeType },
      ]),
    );
    return mediaIds.map((id) => byId.get(id)!);
  }

  /**
   * Ảnh xem trước của một video, cho người được phép xem video đó.
   *
   * Vì sao cần: thẻ bài đăng, lưới Omoide và album đều vẽ media bằng thành
   * phần ảnh — một file mp4 đưa vào đó chỉ ra ô trống. Khung đầu tiên được
   * trích một lần rồi để lại trên đĩa, nên lần sau chỉ là đọc file.
   *
   * Quyền: đi qua đúng cái chốt của luồng stream (`assertViewableBatch`), nên
   * không thể xem trước một video mà mình không được xem.
   */
  async posterForViewer(
    userId: string,
    mediaId: string,
  ): Promise<{ path: string }> {
    const [media] = await this.assertViewableBatch(userId, [mediaId]);
    if (!media.mimeType.startsWith('video/')) {
      throw new BadRequestException('Not a video');
    }

    const poster = this.storage.posterPathFor(media.storageKey);
    if (!existsSync(poster)) {
      // Same guard the stream path carries. Without it a video whose file is
      // not in the bucket — uploaded from a machine that has not migrated —
      // reached ffmpeg through withLocalCopy, the download threw, and the
      // browser got a 500 for every card that video appeared on. A file that
      // is somewhere else is not found here.
      if (!(await this.storage.exists(media.storageKey))) {
        throw new NotFoundException('Media not found');
      }
      mkdirSync(path.dirname(poster), { recursive: true });
      // -ss 0.5: khung đúng số 0 của video quay bằng điện thoại thường là
      // một khung xám lúc cảm biến chưa kịp phơi sáng.
      await this.storage.withLocalCopy(media.storageKey, (source) => {
        execFileSync(
          FFMPEG,
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-ss',
            '0.5',
            '-i',
            source,
            '-frames:v',
            '1',
            '-vf',
            "scale='min(1080,iw)':-2",
            '-q:v',
            '4',
            poster,
          ],
          { stdio: 'ignore' },
        );
      });
      this.logger.log(`đã trích ảnh xem trước cho video ${mediaId}`);
    }
    return { path: poster };
  }

  /** Streams a media file (optionally a byte range) to an allowed viewer. */
  async openForViewer(
    userId: string,
    mediaId: string,
    rangeHeader?: string,
  ): Promise<MediaStreamResult> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: mediaGateSelect,
    });
    // 404 in both cases — do not confirm that private content exists.
    if (!media || !(await this.canView(userId, media))) {
      throw new NotFoundException('Media not found');
    }
    // The row is shared through the database; the file is not (it sits in
    // UPLOAD_DIR on whichever machine took the upload). A file that is simply
    // somewhere else is **not found here** — sizeOf would raise a 500, and a
    // wall of those is what a teammate's avatar looked like in the console.
    // Posts already handle this through the `available` flag; avatars and
    // direct media links come through here with no such guard.
    if (!(await this.storage.exists(media.storageKey))) {
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
      id: string;
      uploaderUserId: string;
      memo: { ownerUserId: string } | null;
      post: { authorUserId: string; families: { familyId: string }[] } | null;
      lifeEvent: {
        profile: { userId: string | null; memberId: string | null };
      } | null;
    },
  ): Promise<boolean> {
    if (media.uploaderUserId === userId) {
      return true;
    }
    if (media.memo) {
      // Memos are always private to their author (domain-model.md).
      if (media.memo.ownerUserId === userId) {
        return true;
      }
    } else if (media.post) {
      // One home for the post-visibility rule — never a second copy here.
      if (await this.postService.canViewPost(userId, media.post)) {
        return true;
      }
    } else if (media.lifeEvent) {
      // Profile-attached content shares one visibility rule, homed on
      // ProfileService (the gallery task 1.6.4 will use the same one).
      if (
        await this.profileService.canViewProfileContent(
          userId,
          media.lifeEvent.profile,
        )
      ) {
        return true;
      }
    }
    // Not visible through its parent (or standalone, which stays
    // uploader-only) — but an avatar is as visible as the person it
    // belongs to (WBS 3.4.2): a user's to anyone sharing a family with
    // them, a placeholder's to that family's members. Setting a photo as
    // your avatar is the deliberate act that widens it this far.
    if (await this.isViewableAsAvatar(userId, media.id)) {
      return true;
    }
    // Same deliberate-act rule for a family's cover photo (2026-09-01):
    // choosing it as the face of the family is what widens it to every
    // member — without this branch a cover that is not also a shared post
    // (a seeded one, or an own-upload) 404s for everyone but its uploader.
    return this.isViewableAsFamilyCover(userId, media.id);
  }

  /** Cover của một nhà mà viewer là thành viên — cùng cỡ bảng và cùng chỗ
   *  đứng cuối hàng như isViewableAsAvatar. */
  private async isViewableAsFamilyCover(
    userId: string,
    mediaId: string,
  ): Promise<boolean> {
    const asCover = await this.prisma.family.findFirst({
      where: { coverMediaId: mediaId, members: { some: { userId } } },
      select: { id: true },
    });
    return asCover !== null;
  }

  /** No index sits on `avatarKey`; both tables are small (people, not
   *  content) and this only runs after every parent check said no. */
  private async isViewableAsAvatar(
    userId: string,
    mediaId: string,
  ): Promise<boolean> {
    const asUserAvatar = await this.prisma.user.findFirst({
      where: {
        avatarKey: mediaId,
        memberships: {
          some: { family: { members: { some: { userId } } } },
        },
      },
      select: { id: true },
    });
    if (asUserAvatar) {
      return true;
    }
    const asMemberAvatar = await this.prisma.familyMember.findFirst({
      where: {
        avatarKey: mediaId,
        family: { members: { some: { userId } } },
      },
      select: { id: true },
    });
    return asMemberAvatar !== null;
  }
}
