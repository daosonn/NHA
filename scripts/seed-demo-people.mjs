#!/usr/bin/env node
/**
 * Demo personas: an account, a Life Profile and a timeline for each.
 *
 * Deliberately does NOT touch families. A linked member's timeline IS their
 * global `/me` one (`api-contract.md` § Life events → Resolution), so
 * everything seeded here follows the person into whatever family they are
 * added to later — by hand, in the app, by whoever owns the demo tree. That
 * is the one ordering this seed does not have to care about.
 *
 * Everything goes through the public API with each persona's own login. It
 * writes nothing the app could not have written and touches no table
 * directly, which is what makes it safe against the SHARED Neon database
 * where `pnpm seed` is forbidden (CONTRIBUTING § 8).
 *
 * Idempotent, and it has to be: the API has no upsert, so every step is
 * list-then-match on a natural key. Re-running changes nothing.
 *
 *   - account   -> matched by email (register, or log in if taken)
 *   - profile   -> PATCH is a value-set, so it is safe to repeat
 *   - milestone -> matched by TITLE within the person's own timeline
 *
 * The natural key means titles must be unique per person and must never
 * change. Edit a title here after a run and the next run adds a second
 * milestone rather than renaming the first.
 *
 *   node scripts/seed-demo-people.mjs [--api=http://localhost:3000/api] [--dry]
 *   node scripts/seed-demo-people.mjs --only=otousan@gmail.com
 */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const API = args.api ?? process.env.NHA_API ?? 'http://localhost:3000/api';

/**
 * One password for every demo persona.
 *
 * The same class of thing as `DEMO_ACCOUNT` in the mobile client: not a
 * secret, existing to be typed into a demo. Nothing real must ever use it,
 * and no persona seeded here may hold anything personal.
 */
const PASSWORD = '12345678';

/** Deterministic stock photo by seed — same seed, same picture, every run. */
const API_PHOTO = (seed) => 'https://picsum.photos/seed/' + seed + '/1200/900';

/**
 * The parents and their youngest — generations 2 and 3, under
 * `ojisan@gmail.com`, who is already in the database.
 *
 * Written to MEET the grandfather's timeline rather than stand apart from
 * it: his is a Vietnamese life told in Japanese (study in Guangdong, home to
 * Vietnam, the army, meeting his wife), so the father is born while his own
 * father is still serving, grows up in the hard post-war years, and reaches
 * Japan in the 1990s as a technical intern. Names in Vietnamese, prose in
 * Japanese — the same split `son.demo@nha.com` already uses, and the right
 * one for a Vietnamese family shown to a Japanese audience.
 *
 * The dates are the part doing the work, because they are what makes three
 * separate timelines read as one family:
 *
 *   - the father is born inside the grandfather's army years, and his own
 *     first milestone says so;
 *   - the mother's "youngest child is born" and the son's own birth are the
 *     SAME DAY, 2005-01-11 — the one date that would look like a mistake if
 *     the two disagreed;
 *   - the father reaches Aichi as a technical intern in 1995, and the son
 *     lands in the same prefecture for a summer placement in 2026. Thirty-one
 *     years, same door. That echo is the point of the whole set.
 *
 * The son is born in Bắc Giang while the family lives in Hải Dương, which is
 * the owner's brief and also ordinary: his mother went back to her own
 * family to give birth, so that is what his papers say. His schooling is in
 * Hải Dương, where they actually live.
 */
const PEOPLE = [
  {
    email: 'otousan@gmail.com',
    name: 'Nguyễn Văn Bình',
    role: 'bo',
    profile: {
      bio: '父の代からこの土地にいます。工場で長く働き、今は小さな機械修理店を。壊れたものは、たいてい直せます。',
      birthDate: '1962-03-15',
      birthPlace: 'ベトナム・ハイズオン省',
      occupation: '機械修理店を営む',
      interests: ['釣り', '盆栽', 'ラジオ'],
    },
    events: [
      {
        title: '父が兵役にいた年に生まれる',
        photo: 'fam-17',
        eventDate: '1962-03-15',
        place: 'ハイズオン省',
        description: '父は輸送の任務で家におらず、祖母が取り上げてくれたと聞いています。',
      },
      {
        title: '中学を出て、畑を手伝う',
        photo: 'fam-11',
        eventDate: '1977-06-01',
        description: '戦争が終わって二年。学校より、田んぼに人手が要る時期でした。',
      },
      {
        title: '町の工場で働きはじめる',
        photo: 'nha-9',
        eventDate: '1986-11-10',
        place: 'ハイズオン省',
        description: 'ドイモイの年。機械の音がする場所で働くのが、はじめて面白いと思えた。',
      },
      { title: '結婚', eventDate: '1991-02-09', place: 'ハイズオン省', photo: 'nha-13' },
      {
        title: '技能実習生として来日',
        photo: 'nha-3',
        eventDate: '1995-04-20',
        place: '愛知県',
        description: '三年の約束で。言葉はわからなかったが、機械の言うことはわかった。',
      },
      {
        title: '帰国して、修理店をひらく',
        photo: 'nha-14',
        eventDate: '2003-08-01',
        place: 'ハイズオン省',
        description: '日本で覚えたことを、そのまま看板にした。',
      },
    ],
  },
  {
    email: 'okaasan@gmail.com',
    name: 'Lê Thị Hạnh',
    role: 'me',
    profile: {
      bio: '市場のはしにある小さな食堂をやっています。家族の写真は、だいたい私が撮ったものです。',
      birthDate: '1966-09-02',
      birthPlace: 'ベトナム・ハイズオン省',
      occupation: '市場で食堂を営む',
      interests: ['料理', '市場めぐり', '写真'],
    },
    events: [
      { title: '生まれる',
        photo: 'fam-3', eventDate: '1966-09-02', place: 'ハイズオン省' },
      {
        title: '高校を卒業し、縫製所へ',
        photo: 'nha-7',
        eventDate: '1984-07-15',
        description: '同じ班に十四人。今も三人とは連絡が続いています。',
      },
      { title: '結婚', eventDate: '1991-02-09', place: 'ハイズオン省', photo: 'nha-4' },
      { title: '長男が生まれる',
        photo: 'fam-16', eventDate: '1993-05-22' },
      {
        title: '夫の渡日中、家を守る',
        photo: 'fam-4',
        eventDate: '1995-04-21',
        description: '三年は長かった。手紙が月に一度だけ届きました。',
      },
      { title: '末の子が生まれる',
        photo: 'nha-10', eventDate: '2005-01-11' },
      {
        title: '市場に自分の食堂をひらく',
        photo: 'fam-2',
        eventDate: '2010-03-06',
        place: 'ハイズオン省',
        description: '席は六つだけ。朝は近所の人ばかりです。',
      },
    ],
  },
  {
    /**
     * The public demo login itself — the account the welcome CTA prefills.
     * The grandchild is who a first-time visitor arrives as, so this is the
     * one profile that has to be furnished; an empty one is the first thing
     * a stranger sees.
     *
     * `name` is only ever sent at REGISTER, and this account already exists,
     * so running this leaves the name the owner set (ダット) alone. It is
     * here for a fresh database, nothing else — do not expect edits to it to
     * reach the live account.
     */
    email: 'user.alphaclub@gmail.com',
    name: 'ダット',
    role: 'chau',
    profile: {
      bio: '大学で情報技術を。父の店で工具を渡していた子どもが、いまは画面の前にいます。この夏、父が三十年前に降りた国へ行きました。',
      birthDate: '2005-01-11',
      birthPlace: 'ベトナム・バクザン省',
      occupation: '大学生（情報技術）',
      interests: ['プログラミング', 'バスケットボール', '日本語'],
    },
    events: [
      {
        title: '母の里帰り先、バクザン省で生まれる',
        photo: 'fam-9',
        eventDate: '2005-01-11',
        place: 'バクザン省',
        description: '母が実家に帰って産んだので、戸籍の生まれはバクザンになっています。',
      },
      {
        title: '小学校に入学',
        photo: 'fam-8',
        eventDate: '2011-09-05',
        place: 'ハイズオン省',
      },
      {
        title: '父の店で工具の名前を覚える',
        photo: 'nha-19',
        eventDate: '2017-06-20',
        place: 'ハイズオン省',
        description: '渡すのが遅いと怒られた。おかげで今でも名前だけは全部言えます。',
      },
      {
        title: '高校に入学',
        photo: 'fam-10',
        eventDate: '2020-09-07',
        place: 'ハイズオン省',
      },
      {
        title: '大学に入学（情報技術）',
        photo: 'nha-16',
        eventDate: '2023-09-11',
        place: 'ハノイ',
        description: '家を出た日。母は食堂を閉めて駅まで来ました。',
      },
      {
        title: '夏の実習で来日',
        photo: 'nha-15',
        eventDate: '2026-07-06',
        place: '愛知県',
        description:
          '父が技能実習生として立ったのと同じ県。三十一年あいて、この家から二人目が同じ場所に立ちました。',
      },
    ],
  },
];

const fail = (m) => {
  console.error(`\n  ${m}\n`);
  process.exit(1);
};

async function call(token, route, init = {}, allow = []) {
  const response = await fetch(`${API}${route}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch(() => fail(`Cannot reach ${API} — is the API running?`));

  const text = await response.text();
  const payload = text === '' ? null : JSON.parse(text);
  if (!response.ok) {
    if (allow.includes(response.status)) return { __status: response.status };
    fail(`${init.method ?? 'GET'} ${route} → ${response.status} ${text}`);
  }
  return payload;
}

/** Register, or log in if the address is already taken. */
async function signIn(person) {
  const created = await call(
    null,
    '/auth/register',
    { method: 'POST', body: { email: person.email, password: PASSWORD, name: person.name } },
    [400, 409],
  );
  if (!created.__status) return { token: created.accessToken, fresh: true };

  const auth = await call(null, '/auth/login', {
    method: 'POST',
    body: { email: person.email, password: PASSWORD },
  });
  return { token: auth.accessToken, fresh: false };
}

/**
 * A photograph for one milestone.
 *
 * Lorem Picsum, which serves a fixed catalogue under the Unsplash licence —
 * free to use commercially, no attribution required. A seed always returns
 * the SAME picture, which is what makes this reproducible: the seeds in
 * PEOPLE were each looked at on a contact sheet and chosen to suit the
 * milestone they sit on, so re-running never shuffles the pictures around.
 *
 * They are stock photographs, NOT this family's. They set a mood and prove
 * the photo features work; they record nothing. To use real pictures, read a
 * local file here instead of fetching.
 */
async function uploadPhoto(token, seed) {
  const source = await fetch(API_PHOTO(seed), { redirect: 'follow' }).catch(() =>
    fail('Could not download the photo for seed "' + seed + '".'),
  );
  if (!source.ok) fail('picsum ' + seed + ' -> ' + source.status);

  const form = new FormData();
  const blob = new Blob([await source.arrayBuffer()], { type: 'image/jpeg' });
  form.append('file', blob, seed + '.jpg');

  // No Content-Type of our own: fetch must set the multipart boundary.
  const media = await fetch(API + '/media', {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
    body: form,
  });
  const text = await media.text();
  if (!media.ok) fail('POST /media -> ' + media.status + ' ' + text);
  return JSON.parse(text).id;
}

async function seed(person) {
  const { token, fresh } = await signIn(person);
  console.log('\n  ' + person.role.padEnd(3) + ' ' + person.name + ' <' + person.email + '>');
  console.log('      account   ' + (fresh ? 'created' : 'already existed, signed in'));

  await call(token, '/me/profile', { method: 'PATCH', body: person.profile });
  console.log('      profile   set (' + person.profile.occupation + ')');

  const before = await call(token, '/me/life-events');
  const have = new Set(before.map((e) => e.title));

  let added = 0;
  for (const event of person.events) {
    if (have.has(event.title)) continue;
    // The photo key is ours, not the API's. The whitelist pipe would strip it,
    // but sending a key the server never declared lies about the contract.
    const { photo, ...body } = event;
    void photo;
    await call(token, '/me/life-events', { method: 'POST', body });
    added += 1;
  }
  console.log('      timeline  ' + added + ' added, ' + (person.events.length - added) + ' already there');

  // Photos second, against the SAVED milestones: a photograph needs a media
  // id, and a media id needs an upload. A milestone that already carries one
  // is left alone — that is the whole idempotency guard here, and it is why
  // re-running does not pile up duplicate pictures.
  const saved = await call(token, '/me/life-events');
  const wanted = new Map(person.events.filter((e) => e.photo).map((e) => [e.title, e.photo]));

  let photos = 0;
  let kept = 0;
  for (const event of saved) {
    const seedName = wanted.get(event.title);
    if (seedName === undefined) continue;
    if (event.media.length > 0) {
      kept += 1;
      continue;
    }
    const mediaId = await uploadPhoto(token, seedName);
    await call(token, '/me/life-events/' + event.id, {
      method: 'PATCH',
      body: { mediaIds: [mediaId] },
    });
    photos += 1;
  }
  console.log('      photos    ' + photos + ' uploaded, ' + kept + ' already had one');
}

const main = async () => {
  const wanted = args.only ? PEOPLE.filter((p) => p.email === args.only) : PEOPLE;
  if (wanted.length === 0) fail(`--only=${args.only} matches nobody in this file.`);

  console.log(`\n  API: ${API}`);
  console.log(`  ${wanted.length} persona(s), password "${PASSWORD}" for all of them`);
  console.log('  No family is touched — add them to one in the app afterwards.');

  if (args.dry) {
    for (const p of wanted) {
      console.log(`\n  ${p.role.padEnd(3)} ${p.name} <${p.email}>`);
      console.log(`      ${p.profile.occupation}, ${p.profile.birthDate}`);
      for (const e of p.events) console.log(`      ${e.eventDate}  ${e.title}`);
    }
    console.log('\n  --dry: nothing sent.\n');
    return;
  }

  for (const person of wanted) await seed(person);
  console.log('\n  Done. Sign in as either address to add them to a family.\n');
};

main();
