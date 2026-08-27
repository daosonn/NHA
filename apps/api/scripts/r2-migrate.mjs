/**
 * Uploads the media files this machine holds into the R2 bucket.
 *
 *   pnpm --filter api r2:migrate -- --dry-run
 *   pnpm --filter api r2:migrate
 *
 * Why this exists: `Media` rows are shared through Neon, but until now the
 * files behind them lived in `apps/api/uploads/` on whichever machine took
 * the upload. Switching `STORAGE_DRIVER` to `r2` without moving them would
 * turn every existing photo into a 404 — the row would resolve, the object
 * would not be there.
 *
 * So each machine runs this once. It walks the `Media` table, and for every
 * row whose file is present locally and absent from R2, uploads it under the
 * same storage key. Once everyone has run it, the bucket holds the full set
 * and every machine sees every photo.
 *
 * It never deletes anything, local or remote, and skips objects already in
 * the bucket — so re-running is safe and mostly a no-op.
 *
 * Rows this machine cannot help with are listed at the end: their files are
 * on somebody else's disk, and only that machine can supply them.
 */
import 'dotenv/config';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Client } from 'pg';

const dryRun = process.argv.includes('--dry-run');

const required = [
  'DATABASE_URL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];
const missingEnv = required.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing in apps/api/.env: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const bucket = process.env.R2_BUCKET;
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const root = isAbsolute(uploadDir)
  ? uploadDir
  : resolve(process.cwd(), uploadDir);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function inBucket(key) {
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
  'select "storageKey", "mimeType" from "Media" order by "storageKey"',
);
await db.end();

console.log(
  `${rows.length} media rows · bucket ${bucket} · local ${root}` +
    (dryRun ? '  (dry run — nothing will be uploaded)' : ''),
);

let uploaded = 0;
let already = 0;
let bytes = 0;
const elsewhere = [];

for (const { storageKey, mimeType } of rows) {
  if (await inBucket(storageKey)) {
    already += 1;
    continue;
  }

  // resolve(), then confirm it stayed under the root: a storage key comes
  // from the database, and this script runs with real credentials.
  const path = resolve(root, storageKey);
  if (!path.startsWith(root) || !existsSync(path)) {
    elsewhere.push(storageKey);
    continue;
  }

  if (dryRun) {
    uploaded += 1;
    bytes += (await stat(path)).size;
    continue;
  }

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: createReadStream(path),
        ContentType: mimeType,
      }),
    );
    uploaded += 1;
    bytes += (await stat(path)).size;
    console.log(`  ↑ ${storageKey}`);
  } catch (error) {
    console.error(`  ✖ ${storageKey}: ${String(error).slice(0, 120)}`);
  }
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(
  `\n${dryRun ? 'would upload' : 'uploaded'} ${uploaded} (${mb} MB) · ` +
    `${already} already in the bucket · ${elsewhere.length} on another machine`,
);

if (elsewhere.length > 0) {
  console.log(
    '\nThese rows have no file here. Whoever uploaded them runs this script\n' +
      'on their machine and the gap closes:',
  );
  for (const key of elsewhere.slice(0, 10)) console.log(`  ${key}`);
  if (elsewhere.length > 10)
    console.log(`  … and ${elsewhere.length - 10} more`);
}
