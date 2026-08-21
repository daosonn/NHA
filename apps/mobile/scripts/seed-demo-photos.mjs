#!/usr/bin/env node
/**
 * Puts the photographs in `assets/Duc` into the database as real moments.
 *
 * Why a script and not the app: the composer can only create a `POST`, which
 * is dated now. Home's "look what turned up" shelf resurfaces things from
 * *earlier years* — an anniversary, a busy month — so a database whose oldest
 * moment is today has nothing for it to find. `POST /posts` with
 * `type: 'EVENT'` takes an `eventDate`, and that is the only way to seed a
 * past.
 *
 * Everything it does goes through the public API with your own credentials.
 * It writes nothing the app could not have written, and touches no table
 * directly.
 *
 *   NHA_EMAIL=you@example.com NHA_PASSWORD=... node scripts/seed-demo-photos.mjs
 *
 * Options:
 *   --api=http://localhost:3000/api   where the server is
 *   --family=<uuid>                   which family to share with (default: the first)
 *   --dir=assets/Duc                  where the photographs are
 *   --dry                             say what it would do and stop
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const API = args.api ?? process.env.NHA_API ?? 'http://localhost:3000/api';
const DIR = args.dir ?? 'assets/Duc';
const EMAIL = process.env.NHA_EMAIL;
const PASSWORD = process.env.NHA_PASSWORD;

/**
 * One moment per photograph, spread across earlier years.
 *
 * The first is dated **today's month and day** in a previous year on purpose:
 * that is what makes the "On this day" tile appear the moment you open Home,
 * which is the whole thing worth demonstrating.
 */
const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
const onThisDay = (yearsAgo) =>
  `${today.getFullYear() - yearsAgo}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const MOMENTS = [
  { title: 'Ramen, the good place', date: onThisDay(1) },
  { title: 'Udon before the train', date: onThisDay(2) },
  { title: 'The shrine in summer', date: `${today.getFullYear() - 1}-07-14` },
  { title: 'Windmills at the gate', date: `${today.getFullYear() - 1}-07-15` },
  { title: 'A shop full of Totoro', date: `${today.getFullYear() - 1}-07-16` },
  { title: 'Walking back', date: `${today.getFullYear() - 2}-11-03` },
  { title: 'Somewhere quiet', date: `${today.getFullYear() - 2}-11-04` },
  { title: 'The last afternoon', date: `${today.getFullYear() - 3}-04-22` },
];

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function call(token, route, init = {}) {
  const response = await fetch(`${API}${route}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
    body: init.body instanceof FormData ? init.body : init.body && JSON.stringify(init.body),
  });

  const text = await response.text();
  const payload = text === '' ? null : JSON.parse(text);
  if (!response.ok) fail(`${init.method ?? 'GET'} ${route} → ${response.status} ${text}`);
  return payload;
}

const main = async () => {
  if (!EMAIL || !PASSWORD) {
    fail(
      'Set NHA_EMAIL and NHA_PASSWORD. They are read from the environment and\n' +
        '  never written anywhere — this signs in the same way the app does.',
    );
  }

  const files = (await readdir(DIR))
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort()
    .slice(0, MOMENTS.length);

  if (files.length === 0) fail(`No PNG or JPEG in ${DIR}. HEIC and MOV are not uploadable here.`);

  console.log(`\n  ${files.length} photographs from ${DIR}`);
  files.forEach((f, i) => console.log(`    ${f}  →  ${MOMENTS[i].date}  "${MOMENTS[i].title}"`));

  if (args.dry) {
    console.log('\n  --dry: nothing sent.\n');
    return;
  }

  const auth = await call(null, '/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = auth.accessToken;

  const families = await call(token, '/families');
  const familyId = args.family ?? families[0]?.id;
  if (!familyId) fail('This account is in no family yet — create or join one first.');
  console.log(`\n  sharing with: ${families.find((f) => f.id === familyId)?.name ?? familyId}\n`);

  const tree = await call(token, `/families/${familyId}/tree`);
  const me = tree.members.find((m) => m.userId === auth.user.id);

  for (const [i, file] of files.entries()) {
    const bytes = await readFile(path.join(DIR, file));
    const type = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';

    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), file);
    const media = await call(token, '/media', { method: 'POST', body: form });

    const moment = MOMENTS[i];
    await call(token, '/posts', {
      method: 'POST',
      body: {
        type: 'EVENT',
        eventTitle: moment.title,
        eventDate: moment.date,
        familyIds: [familyId],
        // Tagging yourself is what puts these on your own Life Profile's
        // Album tab as well as in the feed.
        ...(me ? { taggedMemberIds: [me.id] } : {}),
        mediaIds: [media.id],
      },
    });

    console.log(`  ✓ ${file}  →  ${moment.date}`);
  }

  console.log(`\n  Done. Open Home — "On this day" should be there.\n`);
};

main().catch((error) => fail(error.message));
