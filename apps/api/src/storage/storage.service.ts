import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import type { Readable } from 'node:stream';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Extensions derive from the validated MIME type — never from the
// client-supplied filename. Photo/video/audio per the MVP memory scope
// (docs/00-shared/mvp-scope.md); the mobile client produces mp4/mov
// video (expo-image-picker) and m4a recordings (expo-av).
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
};

/**
 * A borrowed on-disk path, valid until `dispose()`. See
 * `StorageService.newBorrow` for why callers never delete what they borrow.
 */
export interface MediaBorrow {
  path(storageKey: string): Promise<string>;
  dispose(): Promise<void>;
}

/**
 * Local-disk storage backend for the MVP demo. Swappable for an
 * S3-compatible backend later without schema changes — everything goes
 * through storage keys (docs/02-backend/database.md → Media).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 'r2';
  private readonly bucket?: string;
  private readonly r2?: S3Client;
  private readonly rootDir: string;
  /** Uploads stream here first; promote() renames them into place. */
  readonly tempDir: string;

  constructor(config: ConfigService) {
    // `||`, not `??`: a blank UPLOAD_DIR in .env must also fall back.
    // Relative paths resolve against the process working directory —
    // apps/api when started through the pnpm scripts.
    this.rootDir = resolve(config.get<string>('UPLOAD_DIR') || './uploads');
    this.tempDir = join(this.rootDir, 'tmp');
    this.driver =
      config.get<string>('STORAGE_DRIVER') === 'r2' ? 'r2' : 'local';

    if (this.driver === 'r2') {
      const accountId = config.get<string>('R2_ACCOUNT_ID');
      const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
      const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
      this.bucket = config.get<string>('R2_BUCKET');
      if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
        throw new Error(
          'R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET',
        );
      }
      this.r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`Using Cloudflare R2 bucket ${this.bucket}`);
    }
  }

  supportedMimeTypes(): string[] {
    return Object.keys(EXTENSION_BY_MIME);
  }

  supports(mimeType: string): boolean {
    return mimeType in EXTENSION_BY_MIME;
  }

  /**
   * Moves an uploaded temp file into its permanent location and returns
   * the storage key. rename() stays on the same volume as tempDir, so the
   * move is atomic and never re-copies the payload.
   */
  async promote(sourcePath: string, mimeType: string): Promise<string> {
    const extension = EXTENSION_BY_MIME[mimeType];
    if (!extension) {
      throw new InternalServerErrorException(
        'Unsupported media type reached storage',
      );
    }
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`;
    if (this.driver === 'r2') {
      await this.r2!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: createReadStream(sourcePath),
          ContentType: mimeType,
        }),
      );
      await this.discardTemp(sourcePath);
      return storageKey;
    }
    const target = this.resolvePath(storageKey);
    await mkdir(dirname(target), { recursive: true });
    await rename(sourcePath, target);
    return storageKey;
  }

  /** Size in bytes; fails loudly (with the real cause logged) otherwise. */
  async sizeOf(storageKey: string): Promise<number> {
    if (this.driver === 'r2') {
      try {
        const result = await this.r2!.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        );
        if (result.ContentLength === undefined) throw new Error('Missing size');
        return result.ContentLength;
      } catch (error) {
        this.logger.error(`R2 head failed for ${storageKey}: ${String(error)}`);
        throw new InternalServerErrorException('Stored file is unavailable');
      }
    }
    const path = this.resolvePath(storageKey);
    try {
      return (await stat(path)).size;
    } catch (error) {
      // Keep the real cause (ENOENT vs EPERM/EBUSY, ...) in the log.
      this.logger.error(`stat failed for ${storageKey}: ${String(error)}`);
      throw new InternalServerErrorException('Stored file is unavailable');
    }
  }

  /**
   * Opens a read stream; start/end are inclusive byte offsets.
   *
   * Declared as `Readable`, not fs's `ReadStream`: an object-store backend
   * hands back a network stream, and no caller should be written against a
   * type only the local-disk backend can satisfy.
   */
  openRead(storageKey: string, start?: number, end?: number): Readable {
    if (this.driver === 'r2') {
      const stream = new PassThrough();
      const range =
        start === undefined ? undefined : `bytes=${start}-${end ?? ''}`;
      void this.r2!.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Range: range,
        }),
      )
        .then((result) => {
          if (!result.Body) throw new Error('R2 object has no body');
          (result.Body as unknown as Readable).pipe(stream);
        })
        .catch((error: unknown) => stream.destroy(error as Error));
      return stream;
    }
    const path = this.resolvePath(storageKey);
    return start !== undefined
      ? createReadStream(path, { start, end })
      : createReadStream(path);
  }

  /**
   * Có file thật cho key này trên backend hiện tại không.
   *
   * Cần vì DB là Neon dùng chung còn file nằm trên máy TỪNG NGƯỜI (seed
   * media per machine, thiệp/video render ở máy khác): một Media row hoàn
   * toàn hợp lệ vẫn có thể không có file ở đây. 26/08 render video chết vì
   * ffmpeg mở đúng một file như vậy. Trên object store sau này đây là HEAD.
   */
  async exists(storageKey: string): Promise<boolean> {
    if (this.driver === 'r2') {
      try {
        await this.r2!.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        );
        return true;
      } catch {
        return false;
      }
    }
    try {
      await stat(this.resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  /** Missing files count as already removed. */
  async remove(storageKey: string): Promise<void> {
    if (this.driver === 'r2') {
      await this.r2!.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return;
    }
    await rm(this.resolvePath(storageKey), { force: true });
  }

  /**
   * Best-effort removal of many stored files, for after a DB commit that
   * orphaned them: an orphan file is recoverable noise, a dangling DB row
   * is not — so failures are logged, never thrown. One home for the
   * cleanup policy (extracted 2026-08-19; post/life-event/memo deletes
   * all use it).
   */
  async removeAllBestEffort(storageKeys: string[]): Promise<void> {
    await Promise.all(
      storageKeys.map(async (storageKey) => {
        try {
          await this.remove(storageKey);
        } catch (error) {
          this.logger.warn(
            `Could not delete stored file ${storageKey}: ${String(error)}`,
          );
        }
      }),
    );
  }

  /**
   * The whole object as bytes, for callers that want content rather than a
   * path (sharp, base64 encoding). One round trip on an object store, so
   * never use it on video.
   */
  async readAll(storageKey: string): Promise<Buffer> {
    if (this.driver === 'r2') {
      try {
        const result = await this.r2!.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        );
        if (!result.Body) throw new Error('R2 object has no body');
        return Buffer.from(await result.Body.transformToByteArray());
      } catch (error) {
        this.logger.error(`R2 read failed for ${storageKey}: ${String(error)}`);
        throw new InternalServerErrorException('Stored file is unavailable');
      }
    }
    try {
      return await readFile(this.resolvePath(storageKey));
    } catch (error) {
      this.logger.error(`read failed for ${storageKey}: ${String(error)}`);
      throw new InternalServerErrorException('Stored file is unavailable');
    }
  }

  /**
   * Borrows a real on-disk path for the duration of `fn`.
   *
   * ffmpeg and sharp cannot read a stream or a URL — they need a file. On the
   * local-disk backend the borrow *is* the stored file and costs nothing; on
   * an object store it becomes a download into tempDir. Either way the caller
   * must never delete the path it is given: on local disk that is the user's
   * only copy. Deleting belongs to the borrow, which is why cleanup lives
   * here and not at the call site.
   */
  async withLocalCopy<T>(
    storageKey: string,
    fn: (path: string) => Promise<T> | T,
  ): Promise<T> {
    const borrow = this.newBorrow();
    try {
      return await fn(await borrow.path(storageKey));
    } finally {
      await borrow.dispose();
    }
  }

  /**
   * A longer-lived borrow, for pipelines that need several files across
   * stages that cannot sit inside one callback — the video render is the
   * only such caller. Pair every `newBorrow()` with `dispose()` in a
   * `finally`, or on an object store the temp copies leak.
   *
   * `path()` is memoised per key, so asking twice downloads once.
   */
  newBorrow(): MediaBorrow {
    if (this.driver === 'r2') {
      const resolved = new Map<string, string>();
      return {
        path: async (storageKey: string): Promise<string> => {
          const cached = resolved.get(storageKey);
          if (cached) return cached;
          const path = join(this.tempDir, `borrow-${randomUUID()}`);
          await mkdir(this.tempDir, { recursive: true });
          await writeFile(path, await this.readAll(storageKey));
          resolved.set(storageKey, path);
          return path;
        },
        dispose: async (): Promise<void> => {
          await Promise.all(
            [...resolved.values()].map((path) => rm(path, { force: true })),
          );
          resolved.clear();
        },
      };
    }
    // Local disk has nothing to copy and nothing to clean up: the stored file
    // is already a real path. The seam exists so the call sites are written
    // against a borrow now, and only this method changes for object storage.
    const resolved = new Map<string, string>();
    return {
      path: (storageKey: string): Promise<string> => {
        const cached = resolved.get(storageKey);
        if (cached) {
          return Promise.resolve(cached);
        }
        const path = this.resolvePath(storageKey);
        resolved.set(storageKey, path);
        return Promise.resolve(path);
      },
      dispose: (): Promise<void> => {
        resolved.clear();
        return Promise.resolve();
      },
    };
  }

  /**
   * Nơi để ảnh xem trước của một video. Nằm dưới `posters/` chứ không cạnh
   * file gốc: nó là thứ dựng lại được, xoá lúc nào cũng an toàn, và không được
   * lẫn vào thư mục file người dùng tải lên.
   */
  posterPathFor(storageKey: string): string {
    return this.resolvePath(
      join('posters', `${storageKey.replace(/[\\/]/g, '_')}.jpg`),
    );
  }

  /** Best-effort removal of an upload temp file. */
  async discardTemp(path: string): Promise<void> {
    try {
      await rm(path, { force: true });
    } catch (error) {
      this.logger.warn(`Could not remove temp file ${path}: ${String(error)}`);
    }
  }

  /** Maps a storage key to an absolute path, rejecting traversal. */
  private resolvePath(storageKey: string): string {
    const path = resolve(this.rootDir, storageKey);
    const relPath = relative(this.rootDir, path);
    if (!relPath || relPath.startsWith('..') || isAbsolute(relPath)) {
      throw new InternalServerErrorException('Invalid storage key');
    }
    return path;
  }
}
