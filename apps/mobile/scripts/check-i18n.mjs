/**
 * Every `t('…')` in the app must resolve to a key in every catalogue, and
 * every key must be reached by something.
 *
 * A missing key is invisible at runtime — i18next renders the key itself, so
 * a screen quietly says `member.albumEmpty` instead of "No photos yet". This
 * catches that before a reviewer has to.
 *
 * Run with: node scripts/check-i18n.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = join(ROOT, 'src/locales');
const SOURCES = ['app', 'src'];

/** Keys written as `t('a.b')` or handed to `t()` through a constant. */
const LITERAL = /\bt\(\s*'([A-Za-z0-9_.]+)'/g;
const INDIRECT =
  /'((?:common|nav|auth|home|family|invite|member|moment|ai|settings|date|video)\.[A-Za-z0-9_.]+)'/g;

/** Plural keys live in the catalogue as `key_one` / `key_other`. */
const SUFFIXES = ['', '_one', '_other'];

/**
 * Groups whose keys are reached by a computed name, so no literal call site
 * exists to match them against. `date.months.4` is built from the month
 * number in `src/lib/date.ts`.
 */
// Reached by a computed key, so no `t('…')` call site names them:
// `date.months.<n>` from src/lib/date.ts, the error keys from
// src/features/auth/auth-error.ts.
const DYNAMIC = [
  'date.months.',
  'errors.',
  'auth.errors.',
  'createFamily.errors.',
  // src/features/family/relationship-label.ts picks one of these by edge type.
  'family.relation.',
  // src/features/moment/moment-error.ts maps an upload status to one of these.
  'moment.errors.',
  // src/components/feed/reaction-bar.tsx picks one per reaction type.
  'post.reactions.',
  // app/profile/edit.tsx picks one per failed field, and one per API status.
  'profileEdit.errors.',
  // app/ai/card.tsx picks one per template id.
  'ai.card.template.',
  // app/video/setup.tsx picks one per video kind.
  'video.kind.',
  // app/video/style.tsx + setup.tsx pick one per opening style.
  'video.style.',
  'video.styleDesc.',
  // setup.tsx + story.tsx pick "Album opening"… by the draft's style id.
  'video.styleOpening.',
  // app/(tabs)/ai.tsx builds `date.weekdays.<getDay()>` for the featured date.
  'date.weekdays.',
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

function flatten(value, prefix = '') {
  const keys = new Set();
  for (const [name, child] of Object.entries(value)) {
    const path = prefix === '' ? name : `${prefix}.${name}`;
    if (typeof child === 'object' && child !== null) {
      for (const nested of flatten(child, path)) keys.add(nested);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

const catalogues = new Map();
for (const file of readdirSync(LOCALES)) {
  if (!file.endsWith('.json')) continue;
  catalogues.set(
    file.replace('.json', ''),
    flatten(JSON.parse(readFileSync(join(LOCALES, file), 'utf8'))),
  );
}

const used = new Map();
for (const dir of SOURCES) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of [LITERAL, INDIRECT]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const key = match[1];
        if (!used.has(key)) used.set(key, relative(ROOT, file));
      }
    }
  }
}

const problems = [];

for (const [locale, keys] of catalogues) {
  for (const [key, file] of used) {
    if (!SUFFIXES.some((suffix) => keys.has(`${key}${suffix}`))) {
      problems.push(`missing in ${locale}.json: ${key}  (${file})`);
    }
  }

  for (const key of keys) {
    const base = key.replace(/_(one|other)$/, '');
    if (DYNAMIC.some((prefix) => key.startsWith(prefix))) continue;
    if (!used.has(base) && !used.has(key)) {
      problems.push(`unused in ${locale}.json: ${key}`);
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems.sort()) console.error(problem);
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}

console.log(`i18n ok — ${used.size} keys used across ${catalogues.size} catalogue(s)`);
