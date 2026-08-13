// One-shot local setup. Run from the repo root:  pnpm bootstrap
// (after `pnpm install`)
//
// What it does:
//   1. Creates .env files from .env.example if missing (root + apps/api)
//   2. Starts local PostgreSQL via docker compose
//   3. Waits until the database is ready
//   4. Applies Prisma migrations and generates the Prisma client
//
// Safe to re-run at any time (idempotent).

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  // Single command string: shell:true is needed on Windows for pnpm/docker
  // shims, and passing args separately there is deprecated (DEP0190).
  const result = spawnSync([command, ...args].join(' '), {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...options,
  });
  return result.status ?? 1;
}

function runQuiet(command, args) {
  const result = spawnSync([command, ...args].join(' '), { cwd: root, shell: true });
  return result.status ?? 1;
}

function step(title) {
  console.log(`\n=== ${title} ===`);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

// --- 1. Env files -----------------------------------------------------------

step('Env files');
const envPairs = [
  { example: '.env.example', target: '.env' },
  { example: 'apps/api/.env.example', target: 'apps/api/.env' },
];
for (const { example, target } of envPairs) {
  const examplePath = join(root, example);
  const targetPath = join(root, target);
  if (!existsSync(targetPath)) {
    copyFileSync(examplePath, targetPath);
    console.log(`created ${target} (from ${example})`);
  } else {
    console.log(`${target} already exists — kept as-is`);
  }
}

// --- 2. Start PostgreSQL ----------------------------------------------------

step('PostgreSQL (docker compose)');
if (runQuiet('docker', ['--version']) !== 0) {
  fail('Docker is not available. Install/start Docker Desktop, then re-run: pnpm bootstrap');
}
if (run('docker', ['compose', 'up', '-d']) !== 0) {
  fail('docker compose up failed. Is Docker running?');
}

// --- 3. Wait for the database -----------------------------------------------

step('Waiting for database');
const rootEnv = readFileSync(join(root, '.env'), 'utf8');
const dbUser = /^POSTGRES_USER=(.*)$/m.exec(rootEnv)?.[1]?.trim() || 'nha';
const dbName = /^POSTGRES_DB=(.*)$/m.exec(rootEnv)?.[1]?.trim() || 'nha';

let ready = false;
for (let attempt = 1; attempt <= 30; attempt++) {
  if (
    runQuiet('docker', [
      'compose',
      'exec',
      '-T',
      'postgres',
      'pg_isready',
      '-U',
      dbUser,
      '-d',
      dbName,
    ]) === 0
  ) {
    ready = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!ready) fail('Database did not become ready within 60s. Check: docker compose logs postgres');
console.log('database is ready');

// --- 4. Prisma migrate + generate -------------------------------------------

step('Prisma migrations');
if (run('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy']) !== 0) {
  fail('prisma migrate deploy failed.');
}

step('Prisma client generation');
if (run('pnpm', ['--filter', 'api', 'exec', 'prisma', 'generate']) !== 0) {
  fail('prisma generate failed.');
}

// --- Done --------------------------------------------------------------------

console.log(`
✔ Setup complete. Start developing:

  pnpm dev:api   # backend  (NestJS,  http://localhost:3000)
  pnpm dev:web   # frontend (Next.js, http://localhost:3001 or as shown)
`);
