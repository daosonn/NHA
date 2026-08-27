/**
 * Realigns a linked member's family name with their account name.
 *
 *   pnpm --filter api names:sync -- --dry-run
 *   pnpm --filter api names:sync
 *
 * `FamilyMember.displayName` is a copy of `User.name`, taken when the person
 * joins the family. Renaming the account updated only `User.name` until
 * 2026-08-27, so rows written before that fix can still disagree: Settings
 * showed one name while the tree, the feed and every tag showed the older
 * one. This is the one-time catch-up; the service writes through from now on.
 *
 * **Linked members only.** A placeholder's `displayName` is the name the
 * family gave someone who has no account, and it is the only name they have
 * — nothing here touches those rows.
 */
import 'dotenv/config';
import { Client } from 'pg';

const dryRun = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in apps/api/.env');
  process.exit(1);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const host = new URL(process.env.DATABASE_URL).hostname;
console.log(
  `database ${host}${dryRun ? '  (dry run — nothing will change)' : ''}`,
);

const { rows: drifted } = await db.query(`
  select fm.id, fm."displayName" as member_name, u.name as account_name, f.name as family
  from "FamilyMember" fm
  join "User" u on u.id = fm."userId"
  join "Family" f on f.id = fm."familyId"
  where fm."userId" is not null and fm."displayName" <> u.name
  order by f.name
`);

if (drifted.length === 0) {
  console.log(
    'Nothing to do — every linked member already matches its account.',
  );
  await db.end();
  process.exit(0);
}

console.log(`\n${drifted.length} member row(s) out of step:`);
for (const row of drifted) {
  console.log(
    `  "${row.member_name}"  →  "${row.account_name}"   (${row.family})`,
  );
}

if (dryRun) {
  console.log('\nRe-run without --dry-run to apply.');
  await db.end();
  process.exit(0);
}

// One statement, so a half-finished run cannot leave the table more mixed
// than it started.
const { rowCount } = await db.query(`
  update "FamilyMember" fm
  set "displayName" = u.name
  from "User" u
  where u.id = fm."userId" and fm."displayName" <> u.name
`);

console.log(`\nRealigned ${rowCount} row(s).`);
await db.end();
