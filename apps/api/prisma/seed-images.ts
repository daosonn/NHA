/**
 * Seed media — materialised per machine, never committed.
 *
 * Media rows live in the shared Neon database, but the files they point at
 * live on local disk (`UPLOAD_DIR`, gitignored). A row without its file is a
 * 404 when the app streams it, so the seed writes the files itself instead of
 * assuming they are there.
 *
 * Drop your own photos and videos into `prisma/seed-images/` (or set
 * SEED_IMAGES_DIR); subfolders are searched too, so dragging a whole folder in
 * works. They are read in path order and written to fixed storage keys —
 * `seed/01.jpg`, `seed/v01.mp4`, … — so every machine ends up with the same
 * keys even though the media differs. That is what keeps the shared Media rows
 * valid for everyone: whoever runs the seed fills those slots with whatever
 * they have.
 *
 * Both kinds are normalised so a key's extension is never a lie: images become
 * JPEG, videos become MP4. Without that, one person's `.MOV` and another's
 * `.mp4` would claim different keys for the same slot.
 *
 * No media? The seed says so and skips it. Nothing breaks.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

/** Fixed slot counts: the keys are shared, so keep them easy for anyone to fill. */
const MAX_IMAGES = 8;
const MAX_VIDEOS = 2;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v'];

/** Longest edge of a seeded photo. Enough for a phone screen, small on disk. */
const MAX_EDGE = 1600;

export interface SeedMedia {
  /** `seed/NN.jpg` or `seed/vNN.mp4` — the value stored in Media.storageKey. */
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'video';
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
  return resolve(process.env.UPLOAD_DIR || './uploads');
}

/** Every file under `dir`, including subfolders. */
async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(full)));
    } else {
      found.push(full);
    }
  }
  return found;
}

function pick(files: string[], extensions: string[], limit: number): string[] {
  return files
    .filter((f) => extensions.some((ext) => f.toLowerCase().endsWith(ext)))
    .slice(0, limit);
}

/**
 * Real footage is messier than "h264 in a .mov". A compact camera writes
 * `adpcm_ima_wav` audio, which MP4 cannot carry; an iPhone adds a spatial
 * audio track and half a dozen `mebx` metadata tracks it also cannot carry.
 * Both make a plain `-c copy` fail on streams nobody wants anyway.
 *
 * So: keep one video and one (optional) audio track, copy the video untouched,
 * and re-encode only the audio — cheap, and it fixes both cases. If even that
 * fails the video codec itself is the problem, so fall back to a real encode.
 * `+faststart` moves the index to the front, which is what lets a range
 * request seek instead of pulling the whole file.
 */
function toMp4(source: string, target: string): boolean {
  const base = ['-hide_banner', '-loglevel', 'error', '-y', '-i', source];
  const attempts = [
    ['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy', '-c:a', 'aac'],
    [
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
    ],
  ];
  for (const args of attempts) {
    try {
      execFileSync(
        ffmpegPath as unknown as string,
        [...base, ...args, '-movflags', '+faststart', target],
        { stdio: 'ignore' },
      );
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Writes the source media into the storage root under fixed keys and returns
 * one descriptor per slot actually filled.
 *
 * Re-running overwrites the same slots, which is the point: a teammate with
 * different media still satisfies the Media rows already in the database.
 */
export async function materialiseSeedImages(): Promise<SeedMedia[]> {
  const dir = sourceDir();
  const all = (await walk(dir)).sort((a, b) =>
    relative(dir, a).localeCompare(relative(dir, b)),
  );
  const images = pick(all, IMAGE_EXTENSIONS, MAX_IMAGES);
  const videos = pick(all, VIDEO_EXTENSIONS, MAX_VIDEOS);

  if (images.length === 0 && videos.length === 0) {
    console.log(
      [
        `No seed media found in ${dir} — skipping media.`,
        '  Drop a few photos (.jpg/.png/.webp/.heic) or videos (.mp4/.mov)',
        '  there — subfolders are fine — and re-run `pnpm seed`.',
      ].join('\n'),
    );
    return [];
  }

  const root = uploadRoot();
  await mkdir(join(root, 'seed'), { recursive: true });
  const written: SeedMedia[] = [];

  for (const [index, source] of images.entries()) {
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
    written.push({
      storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: (await stat(target)).size,
      kind: 'image',
    });
  }

  for (const [index, source] of videos.entries()) {
    const storageKey = `seed/v${String(index + 1).padStart(2, '0')}.mp4`;
    const target = join(root, storageKey);
    if (!toMp4(source, target)) {
      console.warn(`  skipped ${source}: could not be converted to mp4`);
      continue;
    }
    written.push({
      storageKey,
      mimeType: 'video/mp4',
      sizeBytes: (await stat(target)).size,
      kind: 'video',
    });
  }

  const photos = written.filter((m) => m.kind === 'image').length;
  console.log(
    `Seed media: ${photos} photo(s), ${written.length - photos} video(s) → ${join(root, 'seed')}`,
  );
  return written;
}
