#!/usr/bin/env node
/**
 * Dumps the local Docker Postgres (`nha-postgres`) to backups/.
 *
 *   pnpm db:backup
 *
 * Uses pg_dump's custom format so pg_restore can restore selectively
 * (a single table) as well as the whole database. Dumps contain real
 * family data — backups/ is gitignored and must never be committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTAINER = 'nha-postgres';
const DB_USER = 'nha';
const DB_NAME = 'nha';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const dir = join(process.cwd(), 'backups');
const file = join(dir, `nha-${stamp}.dump`);

mkdirSync(dir, { recursive: true });

let dump;
try {
  dump = execFileSync(
    'docker',
    ['exec', CONTAINER, 'pg_dump', '-U', DB_USER, '-d', DB_NAME, '--format=custom'],
    { maxBuffer: 1024 * 1024 * 1024 },
  );
} catch (error) {
  console.error(
    `pg_dump failed — is Docker running and the ${CONTAINER} container up? (docker compose up -d)`,
  );
  console.error(String(error.stderr ?? error.message));
  process.exit(1);
}

writeFileSync(file, dump);
console.log(`Backup written: ${file} (${(dump.length / 1024).toFixed(1)} KB)`);
console.log('Restore with: pnpm db:restore <file> --force');
