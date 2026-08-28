/**
 * Makes the small copy for photographs uploaded before thumbnails existed.
 *
 *   pnpm --filter api thumbs:backfill -- --dry-run
 *   pnpm --filter api thumbs:backfill
 *
 * The grid used to be served the originals — PNGs averaging 1.7 MB, some of
 * them 4.7 — to draw tiles about 120pt wide. Uploads generate a thumbnail
 * now; this catches up on everything already stored.
 *
 * Reads and writes the same bucket the API uses, so one person running it is
 * enough: the thumbnails are shared like the originals. Skips photos that
 * already have one, so re-running is nearly free, and skips originals that
 * are not in the bucket — those live on somebody else's disk and only that
 * machine can supply them (see r2-migrate.mjs).
 */
import 'dotenv/config';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Client } from 'pg';
import sharp from 'sharp';

/** Must match THUMB_EDGE in media.service.ts. */
const THUMB_EDGE = 480;

const dryRun = process.argv.includes('--dry-run');

const required = [
  'DATABASE_URL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing in apps/api/.env: ${missing.join(', ')}`);
  process.exit(1);
}

const bucket = process.env.R2_BUCKET;
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const root = isAbsolute(uploadDir)
  ? uploadDir
  : resolve(process.cwd(), uploadDir);
const tempDir = join(root, 'tmp');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/** Must match StorageService.thumbKeyFor. */
const thumbKeyFor = (key) => `thumb/${key.replace(/\.[^./]+$/, '')}.jpg`;

async function head(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query(
  `select "storageKey", "sizeBytes" from "Media" where "mimeType" like 'image/%' order by "sizeBytes" desc`,
);
await db.end();

console.log(
  `${rows.length} photos${dryRun ? '  (dry run — nothing will be written)' : ''}`,
);
await mkdir(tempDir, { recursive: true });

let made = 0;
let already = 0;
let absent = 0;
let sourceBytes = 0;
let thumbBytes = 0;

for (const { storageKey, sizeBytes } of rows) {
  const thumbKey = thumbKeyFor(storageKey);
  if (await head(thumbKey)) {
    already += 1;
    continue;
  }

  // Prefer the local original when this machine has it — no download, and
  // the bytes are identical either way.
  const localPath = resolve(root, storageKey);
  let source =
    localPath.startsWith(root) && existsSync(localPath) ? localPath : null;
  let downloaded = null;

  if (source === null) {
    if (!(await head(storageKey))) {
      absent += 1;
      continue;
    }
    if (dryRun) {
      made += 1;
      sourceBytes += sizeBytes;
      continue;
    }
    const object = await r2.send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
    downloaded = join(tempDir, `backfill-${randomUUID()}`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      downloaded,
      Buffer.from(await object.Body.transformToByteArray()),
    );
    source = downloaded;
  }

  if (dryRun) {
    made += 1;
    sourceBytes += sizeBytes;
    continue;
  }

  const target = join(tempDir, `thumb-${randomUUID()}.jpg`);
  try {
    await sharp(source)
      .rotate()
      .resize({
        width: THUMB_EDGE,
        height: THUMB_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 72 })
      .toFile(target);
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: createReadStream(target),
        ContentType: 'image/jpeg',
      }),
    );
    made += 1;
    sourceBytes += sizeBytes;
    thumbBytes += (await stat(target)).size;
    console.log(`  ↓ ${storageKey}`);
  } catch (error) {
    console.error(`  ✖ ${storageKey}: ${String(error).slice(0, 120)}`);
  } finally {
    await rm(target, { force: true });
    if (downloaded !== null) await rm(downloaded, { force: true });
  }
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
console.log(
  `\n${dryRun ? 'would make' : 'made'} ${made} · ${already} already had one · ` +
    `${absent} original not in the bucket`,
);
if (!dryRun && made > 0) {
  console.log(
    `the grid now fetches ${mb(thumbBytes)} MB where it fetched ${mb(sourceBytes)} MB`,
  );
}
