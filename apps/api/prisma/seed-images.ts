/**
 * Seed images — materialised per machine, never committed.
 *
 * Media rows live in the shared Neon database, but the files they point at
 * live on local disk (`UPLOAD_DIR`, gitignored). A row without its file is a
 * 404 when the app streams it, so the seed writes the files itself instead of
 * assuming they are there.
 *
 * Drop your own photos into `prisma/seed-images/` (or set SEED_IMAGES_DIR).
 * They are read in filename order and written to fixed storage keys —
 * `seed/01.jpg`, `seed/02.jpg`, … — so every machine ends up with the same
 * keys even though the pictures differ. That is what keeps the shared Media
 * rows valid for everyone: whoever runs the seed fills those slots with
 * whatever photos they have.
 *
 * No images? The seed says so and skips media entirely. Nothing breaks.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import sharp from 'sharp';

/** Keep the demo small; the slots are fixed so the keys stay stable. */
const MAX_IMAGES = 8;

const SOURCE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

/** Longest edge of a seeded photo. Enough for a phone screen, small on disk. */
const MAX_EDGE = 1600;

export interface SeedImage {
  /** `seed/NN.jpg` — the value stored in Media.storageKey. */
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

function sourceDir(): string {
  const configured = process.env.SEED_IMAGES_DIR;
  if (configured) {
    return isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }
  // prisma db seed runs with apps/api as the working directory.
  return resolve(process.cwd(), 'prisma/seed-images');
}

function uploadRoot(): string {
  if (process.env.STORAGE_DRIVER === 'r2') {
    return resolve(process.env.UPLOAD_DIR || './uploads');
  }
  return resolve(process.env.UPLOAD_DIR || './uploads');
}

async function listSourceImages(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) =>
      SOURCE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
    )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_IMAGES)
    .map((name) => join(dir, name));
}

/**
 * Writes the source photos into the storage root under fixed keys and
 * returns one descriptor per slot actually filled.
 *
 * Re-running overwrites the same slots, which is the point: a teammate with
 * different photos still satisfies the Media rows already in the database.
 */
export async function materialiseSeedImages(): Promise<SeedImage[]> {
  const dir = sourceDir();
  const sources = await listSourceImages(dir);

  if (sources.length === 0) {
    console.log(
      [
        `No seed images found in ${dir} — skipping media.`,
        '  Drop a few .jpg/.png/.webp photos there and re-run `pnpm seed`',
        '  to fill the demo posts and album with pictures.',
      ].join('\n'),
    );
    return [];
  }

  const root = uploadRoot();
  await mkdir(join(root, 'seed'), { recursive: true });
  const images: SeedImage[] = [];

  for (const [index, source] of sources.entries()) {
    const storageKey = `seed/${String(index + 1).padStart(2, '0')}.jpg`;
    const target = join(root, storageKey);
    try {
      // rotate() applies the EXIF orientation, otherwise phone photos land
      // sideways. Everything becomes jpeg so the key's extension is honest.
      await sharp(source)
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toFile(target);
    } catch (error) {
      console.warn(`  skipped ${source}: ${String(error)}`);
      continue;
    }
    images.push({
      storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: (await stat(target)).size,
    });
  }

  console.log(`Seed images: ${images.length} written to ${join(root, 'seed')}`);
  return images;
}
