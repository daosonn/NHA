import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

interface IncomingFile {
  stream: Readable;
}

interface StoredFileInfo {
  path: string;
  size: number;
}

type HandleCallback = (error?: unknown, info?: StoredFileInfo) => void;

/**
 * Minimal multer storage engine that streams each upload to a temp file,
 * so memory use per request is one stream chunk instead of the whole
 * payload (multer's default is memory storage). Equivalent to multer's
 * diskStorage, written locally because multer is only a transitive
 * dependency without type definitions.
 *
 * Multer still enforces `limits.fileSize` and calls `_removeFile` for
 * files it aborts, so oversized uploads do not leave temp files behind.
 */
export function multerTempStorage(tempDir: string) {
  return {
    _handleFile(_req: unknown, file: IncomingFile, cb: HandleCallback): void {
      mkdir(tempDir, { recursive: true })
        .then(() => {
          const path = join(tempDir, randomUUID());
          const out = createWriteStream(path, { flags: 'wx' });
          out.on('error', (error) => cb(error));
          out.on('finish', () => cb(null, { path, size: out.bytesWritten }));
          file.stream.on('error', (error) => {
            out.destroy();
            cb(error);
          });
          file.stream.pipe(out);
        })
        .catch((error: unknown) => cb(error));
    },
    _removeFile(
      _req: unknown,
      file: StoredFileInfo,
      cb: (error?: unknown) => void,
    ): void {
      rm(file.path, { force: true }).then(() => cb(), cb);
    },
  };
}
