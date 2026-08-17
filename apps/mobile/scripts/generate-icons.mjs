/**
 * Renders the app icons from the NHA mark.
 *
 * The mark is defined once here, as vector geometry, so the PNGs Expo needs
 * are always reproducible: `pnpm --filter mobile icons`. Do not hand-edit the
 * generated files in `assets/` — change the paths or palette below instead.
 *
 * Geometry is copied verbatim from the approved mockup (section 5c): a solid
 * house silhouette with the heart cut out in negative space, so the shape
 * reads like an envelope opening onto a note inside.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

/** The mark is drawn on a 96×96 grid. */
const VIEWBOX = 96;

const HOUSE =
  'M48 9 Q43.6 9 40.4 11.8 L13.6 36.6 Q9 40.8 9 47 V76 Q9 87 20 87 H76 Q87 87 87 76 ' +
  'V47 Q87 40.8 82.4 36.6 L55.6 11.8 Q52.4 9 48 9 Z';

const HEART =
  'M48 77.5 C62 66.5 70 59.5 70 52.5 C70 47 66 43.5 61.5 43.5 C56 43.5 51 47.5 48 52.5 ' +
  'C45 47.5 40 43.5 34.5 43.5 C30 43.5 26 47 26 52.5 C26 59.5 34 66.5 48 77.5 Z';

const CORAL = '#F58B7B';
const BLUSH = '#FDE7E2';
const INK = '#18181B';
const WARM_WHITE = '#FAF9F8';

/** The three treatments shown side by side in the mockup. */
const PALETTES = {
  blush: { background: BLUSH, house: CORAL, heart: BLUSH },
  coral: { background: CORAL, house: BLUSH, heart: CORAL },
  ink: { background: INK, house: WARM_WHITE, heart: INK },
};

/**
 * @param {{ palette: keyof typeof PALETTES, size: number, scale: number,
 *           transparent?: boolean }} options
 * `scale` is how much of the canvas the mark occupies. The mockup draws it at
 * 68%; Android's adaptive mask crops to a 66%-diameter circle, so its
 * foreground needs to sit well inside that.
 */
function markSvg({ palette, size, scale, transparent = false }) {
  const { background, house, heart } = PALETTES[palette];
  const inner = size * scale;
  const offset = (size - inner) / 2;
  const unit = inner / VIEWBOX;

  const plate = transparent ? '' : `<rect width="${size}" height="${size}" fill="${background}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${plate}
  <g transform="translate(${offset} ${offset}) scale(${unit})">
    <path d="${HOUSE}" fill="${house}"/>
    <path d="${HEART}" fill="${heart}"/>
  </g>
</svg>`;
}

const TARGETS = [
  // iOS masks the corners itself, so the artwork must be square and opaque.
  { file: 'icon.png', palette: 'coral', size: 1024, scale: 0.68 },
  { file: 'icon-dark.png', palette: 'ink', size: 1024, scale: 0.68 },
  { file: 'icon-blush.png', palette: 'blush', size: 1024, scale: 0.68 },
  // Android composites this over `adaptiveIcon.backgroundColor`.
  {
    file: 'adaptive-icon.png',
    palette: 'coral',
    size: 1024,
    scale: 0.46,
    transparent: true,
  },
  { file: 'favicon.png', palette: 'coral', size: 196, scale: 0.68 },
  // Splash art sits on `backgroundColor`, so it keeps its own plate off.
  {
    file: 'splash-icon.png',
    palette: 'coral',
    size: 512,
    scale: 0.72,
    transparent: true,
  },
];

await mkdir(ASSETS, { recursive: true });

for (const target of TARGETS) {
  const svg = markSvg(target);
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(ASSETS, target.file), png);
  console.log(`${target.file.padEnd(20)} ${target.size}px  ${png.length} bytes`);
}

// Keep the plain mark around for docs, slides and the web app.
await writeFile(
  join(ASSETS, 'nha-mark.svg'),
  markSvg({ palette: 'coral', size: VIEWBOX, scale: 1 }),
);
console.log('nha-mark.svg        vector source');
