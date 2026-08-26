# Local Environment

## Quick Start (new machine)

The database lives in **Neon Cloud** (managed PostgreSQL) and is **shared by
the whole team** — every machine points at the same database, so a family you
create on your laptop is already there on the next machine. Local PostgreSQL
via Docker still works, as an opt-in alternative for people who want a
database nobody else can see.

Pick one:

| Workflow                      | Database                                  | Use it when                                                                       |
| ----------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| **A — shared Neon (default)** | Neon Cloud, shared with the team          | normal day-to-day development                                                     |
| **B — local Docker (opt-in)** | `docker compose` Postgres on your machine | offline work, destructive experiments, trying a migration before the team sees it |

Commands below are PowerShell, run from the repo root.

### Workflow A — shared Neon Cloud (default)

```powershell
git clone https://github.com/daosonn/NHA.git
cd NHA
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and replace the placeholder `DATABASE_URL` with the real
Neon connection string. Ask the backend owner for it — it is deliberately not
in the repository, and it never will be:

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-example.region.aws.neon.tech/DATABASE?sslmode=require"
```

Then apply the schema and build:

```powershell
pnpm --filter api exec prisma migrate deploy   # apply pending migrations to Neon
pnpm --filter api exec prisma generate         # generate the client (src/generated is gitignored)
pnpm --filter api exec prisma migrate status   # expect: "Database schema is up to date!"
pnpm build:tokens
pnpm --filter api build
```

Run the app with the normal commands — `pnpm dev:api`, `pnpm dev:mobile`; see
`commands.md`.

Four things worth knowing before you start:

- **`pnpm bootstrap` is not part of this workflow.** It is no longer harmful —
  since 2026-08-26 `scripts/setup.mjs` reads `DATABASE_URL` first and skips
  Docker entirely when the host is not local — but the explicit Prisma
  commands above are what you actually need, and they make it obvious which
  database you are touching.
- **`prisma migrate deploy` only applies migrations to whatever `DATABASE_URL`
  points at.** It does not move data. Rows you created earlier in a local
  Docker database stay in Docker; on Neon you see whatever the team already
  put there. There is no sync between the two.
- **You are on a shared database.** Read § Neon rules below before your first
  migration, seed, or e2e run.
- **`.env` is gitignored and stays that way.** The real connection string does
  not belong in a commit, a doc, an issue, or a chat message.

### Workflow B — local PostgreSQL via Docker (opt-in)

Prerequisite: **Docker Desktop running**. Node/pnpm are auto-downloaded if
missing (pinned in root `package.json` → `devEngines`).

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
```

In `apps/api/.env`, use the local line instead of the Neon one (it is already
there, commented out):

```env
DATABASE_URL="postgresql://nha:nha_password@localhost:5432/nha?schema=public"
```

Then:

```powershell
pnpm bootstrap
```

`pnpm bootstrap` (script: `scripts/setup.mjs`) does the rest in one shot:

1. Creates `.env` files from `.env.example` if missing (root + `apps/api`)
2. Reads `DATABASE_URL` and prints the host it is about to use
3. Starts local PostgreSQL via `docker compose up -d` and waits for it —
   **only when that host is local**; a Neon URL skips this step
4. Applies Prisma migrations (`prisma migrate deploy`) and generates the
   Prisma client (required — `apps/api/src/generated` is gitignored)

It is idempotent — safe to re-run anytime (e.g. after pulling new migrations).
If `DATABASE_URL` is still the placeholder from `.env.example`, it stops and
tells you which line to fix rather than failing deep inside Prisma.

This database is yours alone. Nothing you do in it reaches the team, and
nothing the team does reaches you.

## Repository Layout

This is a pnpm workspace monorepo with four applications:

| App      | Path          | Stack                           | Status                                                          |
| -------- | ------------- | ------------------------------- | --------------------------------------------------------------- |
| `mobile` | `apps/mobile` | Expo + expo-router + NativeWind | **The primary client.** Auth, Home and the family screens built |
| `api`    | `apps/api`    | NestJS + Prisma + PostgreSQL    | 25 models; auth, families, posts and media modules merged       |
| `web`    | `apps/web`    | Next.js + Tailwind CSS          | Bootstrapped starter; role undecided, no product code           |
| `ai`     | `apps/ai`     | Python + FastAPI (planned)      | Not yet created                                                 |

## Database

Two independent PostgreSQL databases exist. They share a schema — the same
Prisma migrations apply to both — and nothing else. No data ever crosses
between them.

### Neon Cloud (shared, the default)

Neon hosts managed PostgreSQL. Neon owns the server, the storage, uptime and
the database infrastructure, backup/recovery to the extent its plan provides,
and the connection/branch model. This project keeps owning everything above
that line: `apps/api/prisma/schema.prisma`, the migrations in
`apps/api/prisma/migrations`, all query logic through Prisma, and the
application data itself (users, families, posts).

**Neon Auth is not used and is not integrated.** Authentication is this
project's own: `User`, `RefreshToken`, `PasswordResetToken` and `OAuthAccount`
are Prisma models served by the NestJS `AuthModule`. Neon supplies PostgreSQL
and nothing more; the application still reaches the database only through
Prisma.

Nothing in the code knows the word "Neon". The wiring is
`apps/api/.env` → `DATABASE_URL` → `apps/api/prisma.config.ts`
(`env('DATABASE_URL')`, loaded via `dotenv/config`) → Prisma; `schema.prisma`
declares no `url` of its own. Pointing at Neon is a one-line `.env` change.

**Pooled vs direct connection strings.** Neon offers both: a pooled endpoint
(hostname contains `-pooler`, PgBouncer in front, sized for many short-lived
application connections) and a direct endpoint. This project uses **one
connection string only** — `DATABASE_URL`, currently a direct endpoint. There
is no `DIRECT_URL` and no `shadowDatabaseUrl` in `prisma.config.ts`, and none
is needed as things stand. If `DATABASE_URL` is ever switched to a pooled
endpoint, remember that migrations still need a direct connection: add the
second variable explicitly and update this section in the same PR, rather than
leaving the team to guess which endpoint is in use.

### Handing out the connection string, and rotating it

The string lives in the Neon project and in each developer's `apps/api/.env`,
nowhere else — nothing in this repository hardcodes it, so distributing and
replacing it is purely an `.env` operation.

**Treat it as the database password, because that is what it is.** It grants
read, write and delete on the whole shared database; there is no read-only
mode in it. So:

- Hand it over in a channel that only developers can read, and keep it out of
  any room that includes people outside the team. Chat history is permanent
  and searchable — assume anyone who joins that room later can still read it.
- Never put it in a commit, a PR description, an issue, a doc, a log, or a
  screenshot of a terminal. `apps/api/.env` is gitignored; keep it that way.
- New machine: paste it into `apps/api/.env` → `DATABASE_URL`, nothing else to
  configure.

**If it leaks — or when someone leaves the team — rotate it.** In the Neon
console, reset the password of the database role. The old string stops working
the moment you do, which is the point: a leaked string that is still valid is
the actual problem, not the leak itself.

After rotating, send the new string round; everyone replaces the line in
`apps/api/.env` and restarts `pnpm dev:api`. Running processes hold an open
connection and will fail on the next reconnect, so expect to restart the API
even on machines that looked fine. No migration, no code change, no
`prisma generate` — the schema is untouched.

For per-person revocation, Neon can issue **one role per developer**, so a
single person can be cut off without disturbing anyone else. For a team this
size one shared role plus rotation is usually enough; the choice is the
backend owner's.

### Neon rules

The shared database is the one piece of state a single careless command can
break for everybody at once.

- **Neon Cloud and the local Docker PostgreSQL are two independent
  databases.** Same schema, different data, no synchronisation in either
  direction. Migrating or seeding one does nothing to the other.
- **Everyone pointed at the same Neon branch sees the same rows.** Your test
  family is everyone's test family. Deletes in this product are hard deletes
  (no soft-delete in the MVP), so removing "your" data removes it for the team,
  permanently.
- **Never run a destructive migration or `prisma migrate reset` on a shared
  branch.** `reset` drops and recreates the database — on shared Neon that is
  everyone's work, not yours.
- **Do not reach for `prisma migrate dev` on the shared database.** It is the
  authoring command: it diffs state and, on drift, offers to reset. Author new
  migrations against a local Docker database (Workflow B) or against your own
  Neon branch, then apply them to shared with `prisma migrate deploy`.
- **A new migration gets written and reviewed before it reaches shared.**
  Commit `schema.prisma` and the migration together, get the PR reviewed, then
  run `prisma migrate deploy` (`CONTRIBUTING.md` § 8).
- **Use a separate Neon branch for a feature or an experimental migration.** A
  branch is a copy-on-write clone of the shared data: point your `DATABASE_URL`
  at it, break whatever you like, delete it when you are done.
- **`pnpm test:e2e` writes real rows through `DATABASE_URL`.** It drives the
  real API and creates users, families, media, posts and video jobs, none of
  which it cleans up. Run it on Workflow B or on your own Neon branch — never
  on the shared branch. `pnpm seed` is the opposite case and _is_ safe here:
  it only upserts, deletes nothing, and filling the shared demo data is its
  purpose (§ Seeding demo data).
- **`pnpm db:backup` and `pnpm db:restore` do not touch Neon.** They
  `docker exec` into the `nha-postgres` container, so they only ever see the
  local database (§ Backup & restore below). Neon's backup/recovery is whatever
  its plan provides, plus branches used as restore points.
- **Never put a real connection string, password or API key** into
  documentation, a commit, an issue, a log or command output. Placeholders
  only, exactly as in `apps/api/.env.example`.

### Local PostgreSQL via Docker Compose (opt-in)

`docker-compose.yml` starts `nha-postgres` (Postgres 17). Credentials and
port come from the root `.env` (defaults work out of the box):

```
POSTGRES_USER=nha
POSTGRES_PASSWORD=nha_password
POSTGRES_DB=nha
POSTGRES_PORT=5432
```

These are used only by the container. `apps/api/.env` → `DATABASE_URL` is what
decides which database the API and Prisma actually talk to; a running container
that nothing points at is simply idle.

### Backup & restore — local Docker only (added 2026-08-19)

Both scripts `docker exec` into the `nha-postgres` container, so they see the
**local** database and nothing else. They cannot back up Neon, and running
them while `DATABASE_URL` points at Neon backs up a database the API is not
even using. Neon's own backup/recovery (per plan) plus a branch taken as a
restore point are the equivalent there.

Deletes in the product are hard deletes (no soft-delete in the MVP), so a
dump taken before risky work is the only way back:

```
pnpm db:backup                       # -> backups/nha-<timestamp>.dump
pnpm db:restore backups/<file> --force
```

`db:backup` runs `pg_dump --format=custom` inside the container; restore
**replaces** the database's current contents, which is why `--force` is
mandatory. If the dump predates newer migrations, run
`pnpm --filter api exec prisma migrate dev` afterwards. `backups/` is
gitignored — dumps contain real family data and must never be committed.
Take one before destructive experiments (mass deletes, migration surgery)
and before `prisma migrate reset`. Production backups (managed PITR) are a
deployment decision for later — this covers the local Docker database and
the demo box.

## Seeding demo data

```powershell
pnpm seed
```

Creates the demo dataset: twelve accounts (§ Accounts below), two families,
members and relationships for the family tree, posts, life profiles with bio
and birth date, life events for the timeline, and — when you supply media —
photos and video clips attached to the posts, plus one album.

**It is idempotent.** Every write is an upsert or guarded by an existence
check, and it deletes nothing, so re-running adds nothing and breaks nothing.
That is what makes it safe on the shared Neon database: filling the team's
demo data is the job it exists for.

### Accounts

Every seeded account uses the same password, **`password-123`**. These exist
only in development seeds — nothing here may ever reach a real environment.

| Email                       | Name      | Family                              |
| --------------------------- | --------- | ----------------------------------- |
| `hanako@example.com`        | 山田 花子 | 山田家 (owner)                      |
| `taro@example.com`          | 山田 太郎 | 山田家 + 鈴木家 (multi-family case) |
| `sato@example.com`          | 佐藤 健   | none                                |
| `suzuki.misaki@example.com` | 鈴木 美咲 | none                                |
| `takahashi@example.com`     | 高橋 大輔 | none                                |
| `tanaka@example.com`        | 田中 由紀 | none                                |
| `ito@example.com`           | 伊藤 翔   | none                                |
| `watanabe@example.com`      | 渡辺 彩   | none                                |
| `nakamura@example.com`      | 中村 陸   | none                                |
| `kobayashi@example.com`     | 小林 花音 | none                                |
| `kato@example.com`          | 加藤 誠   | none                                |
| `yoshida@example.com`       | 吉田 結衣 | none                                |

The ten below `taro` are **deliberately blank**: no family, no members, no
relationships, no posts. That is what makes them useful — they are the only
way to test what a real new user sees, and the only way to exercise joining
by invite code with someone who is genuinely a stranger to the tree. Putting
them in 山田家 would also bury the family-tree demo under ten loose nodes.

Invite codes to join with: **`YAMADA22`** (山田家), **`SUZUKI22`** (鈴木家).

Two accounts signed in at once is the minimum for testing anything shared —
posting to a family the other can see, wiki edits, notifications. Ten means a
whole team can each hold their own without stepping on each other.

### Photos and video

Media files are the one part that cannot be shared through the database. `Media`
rows live in Neon; the files they name live in `apps/api/uploads/`, which is
local to each machine. A row whose file is missing is a 404 when the app
streams it.

So the seed writes the files itself, from photos you supply:

```
apps/api/prisma/seed-images/     ← drop photos and clips here (subfolders fine)
```

Read in path order — subfolders included, so dragging a whole folder in works
— up to **8 photos** and **2 videos**. Photos are resized to 1600px on the long
edge and converted to JPEG; videos are converted to MP4 with `+faststart` so
range requests can seek. Both land on **fixed storage keys** — `seed/01.jpg`,
`seed/v01.mp4`, … — which is what keeps the shared rows valid everywhere: each
person fills the same slots with their own media. Set `SEED_IMAGES_DIR` to read
from somewhere else.

Conversion keeps the video stream untouched and re-encodes only the audio,
because real footage carries things MP4 cannot: a compact camera writes
`adpcm_ima_wav` audio, an iPhone adds a spatial-audio track and several
`mebx` metadata tracks. A clip whose video codec itself cannot go into MP4
falls back to a real re-encode.

The photos are gitignored on purpose; only
`apps/api/prisma/seed-images/README.md` is committed. Consequences worth
knowing before someone reports a bug:

- **No photos on your machine** → the seed says so and skips media entirely.
  Everything else still seeds.
- **Fewer photos than whoever seeded first** → the extra rows are already in
  Neon and their files are missing on your machine, so those specific images
  404 until you add more.
- **Different photos than a teammate** → same rows, different pictures. Not a
  bug; the slots are shared, the contents are not.

Media in a shared dev database is only really solved by object storage (S3/R2)
behind `StorageService`, which is designed to be swapped without a schema
change. Until that decision is made (`deployment.md`), this is the workaround.

## Environment Variables

### Root (`.env`)

Configures the Docker Compose Postgres container (see above) and is read by
nothing else. Created from `.env.example` by `pnpm bootstrap`. Irrelevant in
Workflow A — no container runs there.

### `apps/api` (`.env`)

The one variable that decides which database everything talks to:

```
# Workflow A — shared Neon Cloud (team default; real value comes from Neon)
DATABASE_URL="postgresql://USER:PASSWORD@ep-example.region.aws.neon.tech/DATABASE?sslmode=require"

# Workflow B — local Docker Postgres; must match the root .env credentials
DATABASE_URL="postgresql://nha:nha_password@localhost:5432/nha?schema=public"
```

`apps/api/.env.example` ships the Neon placeholder as the default and carries
the local line commented out underneath. `pnpm bootstrap` copies the example
across when `.env` is missing — it never overwrites an existing one, so your
real connection string survives every re-run. The file is gitignored; keep the
real value out of commits, docs, issues and logs.

Prisma does not load `.env` automatically in v7 — `apps/api/prisma.config.ts`
explicitly loads it via `dotenv/config`, and `AppModule` loads it into
`process.env` at runtime via `@nestjs/config`.

### After changing `schema.prisma`, run `prisma generate` yourself

`prisma migrate dev` writes and applies the migration but **did not
regenerate the client** here (observed 2026-08-20 on Prisma 7.9.1). Nothing
warns you, and the gap survives every check the repo runs:

```
pnpm --filter api exec prisma migrate dev --name <name>
pnpm --filter api exec prisma generate   # ← do not skip this
```

Author the migration against a local Docker database (Workflow B) or your own
Neon branch — `migrate dev` is not a command to point at the shared database
(§ Neon rules). Once the migration is committed and reviewed, the shared
database gets it via `prisma migrate deploy`.

Why lint, build and tests all stay green with a stale client: services pass
Prisma an **extracted `as const` select object** (`profileSelect` in
`profile.service.ts` is the pattern). TypeScript only applies
excess-property checking to _fresh_ object literals, so a select naming a
column the generated client has never heard of type-checks fine and then
throws `Unknown field ... for select statement` at runtime — a 500 on the
first real request, not a build error. If a brand-new column 500s, this is
the first thing to check.

### `apps/web`

No environment variables required yet (default Next.js starter).

### `apps/ai`

Not yet scaffolded. Requirements TBD.

## Running the Apps

```bash
pnpm dev:mobile       # apps/mobile, Expo dev server — scan the QR with Expo Go
pnpm dev:mobile:web   # apps/mobile in a browser, for fast layout iteration
pnpm dev:api          # apps/api, NestJS in watch mode
pnpm dev:web          # apps/web, Next.js dev server

# apps/ai — not yet available
```

Mobile needs the API reachable from the device, not just from your machine:
set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the LAN address. See
`mobile-development.md`.

## Verification Commands

Run before considering backend changes complete (see `CLAUDE.md` § 7):

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
```

`test:e2e` drives the real API and writes real rows through `DATABASE_URL`.
Point it at a local Docker database (Workflow B) or your own Neon branch — not
at the shared branch (§ Neon rules).

For the mobile app:

```bash
pnpm --filter mobile typecheck
pnpm --filter mobile check:i18n
pnpm exec prettier --check apps/mobile/src apps/mobile/app
```

## Open Questions

- [ ] What does `apps/ai` need locally (Python version, venv/poetry, env vars)?
- [ ] Seed data strategy for local development?
- [ ] Neon branch policy: one shared branch for the whole team, or one per
      developer plus a shared integration branch?
