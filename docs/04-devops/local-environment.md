# Local Environment

## Quick Start (new machine)

```bash
git clone https://github.com/daosonn/NHA.git
cd NHA
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` (script: `scripts/setup.mjs`) does everything in one shot:

1. Creates `.env` files from `.env.example` if missing (root + `apps/api`)
2. Starts local PostgreSQL via `docker compose up -d`
3. Waits until the database is ready
4. Applies Prisma migrations (`prisma migrate deploy`) and generates the
   Prisma client (required — `apps/api/src/generated` is gitignored)

It is idempotent — safe to re-run anytime (e.g. after pulling new
migrations). Only prerequisite: **Docker Desktop running**. Node/pnpm are
auto-downloaded if missing (pinned in root `package.json` → `devEngines`).

## Repository Layout

This is a pnpm workspace monorepo with three applications:

| App   | Path       | Stack                        | Status                         |
| ----- | ---------- | ---------------------------- | ------------------------------ |
| `api` | `apps/api` | NestJS + Prisma + PostgreSQL | Bootstrapped, one `User` model |
| `web` | `apps/web` | Next.js + Tailwind CSS       | Bootstrapped, default starter  |
| `ai`  | `apps/ai`  | Python + FastAPI (planned)   | Not yet created                |

## Database (PostgreSQL via Docker Compose)

`docker-compose.yml` starts `nha-postgres` (Postgres 17). Credentials and
port come from the root `.env` (defaults work out of the box):

```
POSTGRES_USER=nha
POSTGRES_PASSWORD=nha_password
POSTGRES_DB=nha
POSTGRES_PORT=5432
```

## Environment Variables

### Root (`.env`)

Configures the Docker Compose Postgres container (see above). Created from
`.env.example` by `pnpm bootstrap`.

### `apps/api` (`.env`)

```
DATABASE_URL="postgresql://nha:nha_password@localhost:5432/nha?schema=public"
```

Created from `apps/api/.env.example` by `pnpm bootstrap`. Must match the
root Postgres credentials.

Prisma does not load `.env` automatically in v7 — `apps/api/prisma.config.ts`
explicitly loads it via `dotenv/config`, and `AppModule` loads it into
`process.env` at runtime via `@nestjs/config`.

### `apps/web`

No environment variables required yet (default Next.js starter).

### `apps/ai`

Not yet scaffolded. Requirements TBD.

## Running the Apps

```bash
pnpm dev:api          # apps/api, NestJS in watch mode
pnpm dev:web          # apps/web, Next.js dev server

# apps/ai — not yet available
```

## Verification Commands

Run before considering backend changes complete (see `CLAUDE.md` § 7):

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
```

## Open Questions

- [ ] What does `apps/ai` need locally (Python version, venv/poetry, env vars)?
- [ ] Seed data strategy for local development?
