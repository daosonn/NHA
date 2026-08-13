# Local Environment

## Repository Layout

This is a pnpm workspace monorepo with three applications:

| App   | Path       | Stack                        | Status                         |
| ----- | ---------- | ---------------------------- | ------------------------------ |
| `api` | `apps/api` | NestJS + Prisma + PostgreSQL | Bootstrapped, one `User` model |
| `web` | `apps/web` | Next.js + Tailwind CSS       | Bootstrapped, default starter  |
| `ai`  | `apps/ai`  | Python + FastAPI (planned)   | Not yet created                |

## Prerequisites

- Node.js >=24 <25 (see root `package.json` → `engines`)
- pnpm 11.21.0 (see root `package.json` → `devEngines`)
- Docker (for local PostgreSQL)

## Database (PostgreSQL via Docker Compose)

Start the local database:

```bash
docker compose up -d
```

This starts `nha-postgres` (Postgres 17) on port `5432`. Credentials come from
`docker-compose.yml` and must match `apps/api/.env`:

```
POSTGRES_USER=nha
POSTGRES_PASSWORD=nha_password
POSTGRES_DB=nha
```

## Environment Variables

### Root (`.env.example`)

Used to configure the Docker Compose Postgres container:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
POSTGRES_PORT=5432
```

### `apps/api`

Requires a `.env` file (not committed) with:

```
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db>?schema=public"
```

Prisma does not load `.env` automatically in v7 — `apps/api/prisma.config.ts`
explicitly loads it via `dotenv/config`, and `AppModule` loads it into
`process.env` at runtime via `@nestjs/config`.

### `apps/web`

No environment variables required yet (default Next.js starter).

### `apps/ai`

Not yet scaffolded. Requirements TBD.

## Running the Apps

```bash
pnpm install          # install all workspace dependencies

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
- [ ] Should there be a single `docker compose up` that also runs the apps, or DB-only as today?
- [ ] Seed data strategy for local development?
