import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
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
 * Local-disk storage backend for the MVP demo. Swappable for an
 * S3-compatible backend later without schema changes — everything goes
 * through storage keys (docs/02-backend/database.md → Media).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly rootDir: string;
  /** Uploads stream here first; promote() renames them into place. */
  readonly tempDir: string;

  constructor(config: ConfigService) {
    // `||`, not `??`: a blank UPLOAD_DIR in .env must also fall back.
    // Relative paths resolve against the process working directory —
    // apps/api when started through the pnpm scripts.
    this.rootDir = resolve(config.get<string>('UPLOAD_DIR') || './uploads');
    this.tempDir = join(this.rootDir, 'tmp');
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
    const target = this.resolvePath(storageKey);
    await mkdir(dirname(target), { recursive: true });
    await rename(sourcePath, target);
    return storageKey;
  }

  /** Size in bytes; fails loudly (with the real cause logged) otherwise. */
  async sizeOf(storageKey: string): Promise<number> {
    const path = this.resolvePath(storageKey);
    try {
      return (await stat(path)).size;
    } catch (error) {
      // Keep the real cause (ENOENT vs EPERM/EBUSY, ...) in the log.
      this.logger.error(`stat failed for ${storageKey}: ${String(error)}`);
      throw new InternalServerErrorException('Stored file is unavailable');
    }
  }

  /** Opens a read stream; start/end are inclusive byte offsets. */
  openRead(storageKey: string, start?: number, end?: number): ReadStream {
    const path = this.resolvePath(storageKey);
    return start !== undefined
      ? createReadStream(path, { start, end })
      : createReadStream(path);
  }

  /** Missing files count as already removed. */
  async remove(storageKey: string): Promise<void> {
    await rm(this.resolvePath(storageKey), { force: true });
  }

  /**
   * Absolute path cho pipeline render video (ffmpeg cần đường dẫn file thật).
   * Vẫn đi qua resolvePath nên không thoát khỏi rootDir.
   */
  absolutePathOf(storageKey: string): string {
    return this.resolvePath(storageKey);
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
