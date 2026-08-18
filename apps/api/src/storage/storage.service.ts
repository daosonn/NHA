import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Extensions derive from the validated MIME type — never from the
// client-supplied filename.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

/**
 * Local-disk storage backend for the MVP demo. Swappable for an
 * S3-compatible backend later without schema changes — everything goes
 * through storage keys (docs/02-backend/database.md → Media).
 */
@Injectable()
export class StorageService {
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    this.rootDir = resolve(config.get<string>('UPLOAD_DIR') ?? './uploads');
  }

  supportedMimeTypes(): string[] {
    return Object.keys(EXTENSION_BY_MIME);
  }

  supports(mimeType: string): boolean {
    return mimeType in EXTENSION_BY_MIME;
  }

  async save(buffer: Buffer, mimeType: string): Promise<string> {
    const extension = EXTENSION_BY_MIME[mimeType];
    if (!extension) {
      throw new InternalServerErrorException(
        'Unsupported media type reached storage',
      );
    }
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`;
    const path = this.resolvePath(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return storageKey;
  }

  async openRead(storageKey: string): Promise<ReadStream> {
    const path = this.resolvePath(storageKey);
    try {
      await stat(path);
    } catch {
      // The DB row exists but the file is gone — server-side inconsistency.
      throw new InternalServerErrorException('Stored file is missing');
    }
    return createReadStream(path);
  }

  /** Missing files count as already removed. */
  async remove(storageKey: string): Promise<void> {
    await rm(this.resolvePath(storageKey), { force: true });
  }

  /** Maps a storage key to an absolute path, rejecting traversal. */
  private resolvePath(storageKey: string): string {
    const path = resolve(this.rootDir, storageKey);
    if (!path.startsWith(this.rootDir + sep)) {
      throw new InternalServerErrorException('Invalid storage key');
    }
    return path;
  }
}
