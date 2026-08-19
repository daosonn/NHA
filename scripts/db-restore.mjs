#!/usr/bin/env node
/**
 * Restores a backups/*.dump file into the local Docker Postgres,
 * REPLACING the current contents of the `nha` database.
 *
 *   pnpm db:restore backups/nha-2026-08-19_05-00-00.dump --force
 *
 * `--force` is mandatory: restoring destroys whatever is in the database
 * right now, so the destructive step never happens by accident. Take a
 * fresh backup first if the current state might still matter.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const CONTAINER = 'nha-postgres';
const DB_USER = 'nha';
const DB_NAME = 'nha';

const args = process.argv.slice(2);
const force = args.includes('--force');
const file = args.find((arg) => arg !== '--force');

if (!file || !existsSync(file)) {
  console.error('Usage: pnpm db:restore <backups/file.dump> --force');
  process.exit(1);
}
if (!force) {
  console.error(`This REPLACES everything currently in the "${DB_NAME}" database with ${file}.`);
  console.error('Re-run with --force to proceed.');
  process.exit(1);
}

try {
  execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'pg_restore', '-U', DB_USER, '-d', DB_NAME, '--clean', '--if-exists'],
    { input: readFileSync(file), stdio: ['pipe', 'inherit', 'inherit'] },
  );
} catch {
  // pg_restore exits non-zero on ignorable errors too (e.g. missing
  // extensions); the stderr above says what actually happened.
  console.error('pg_restore reported errors — read the output above.');
  process.exit(1);
}
console.log(`Restored ${file} into ${DB_NAME}.`);
console.log(
  'If the dump predates recent migrations, run: pnpm --filter api exec prisma migrate dev',
);
