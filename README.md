# NHA — Family Memories (MVP)

A family memory and relationship app for iOS and Android: preserve life
stories, memories, and relationships in one shared family space.

## What to pay attention to

Everything that matters lives in these folders:

- **`apps/`** — the actual code
  - `apps/mobile` — **the primary client** (Expo + expo-router + NativeWind)
  - `apps/api` — backend (NestJS + Prisma + PostgreSQL)
  - `apps/web` — Next.js scaffold; role not decided yet, no product code
  - `apps/ai` — AI service (not built yet)
- **`packages/`** — code shared across apps
  - `packages/tokens` — design tokens (colors, spacing, radius, typography)
- **`docs/`** — all specs and project status
  - `docs/project-status.md` — **start here**: current phase, what's done, what's next
  - `docs/00-shared/` — product overview, MVP scope, domain model
  - `docs/01-frontend/`, `docs/02-backend/`, `docs/03-ai/` — per-area specs
  - `docs/04-devops/` — local environment, CI/CD, deployment
  - `docs/sprints/` — sprint records

Other files at the repo root (configs, lockfiles, etc.) support these two
folders — you generally don't need to touch them directly.

## Before you start

Read in this order:

1. `CLAUDE.md` — rules and conventions (AI agents load this automatically)
2. `docs/project-status.md` — what's actually going on right now
3. `docs/00-shared/product-overview.md` — what we're building and why

## Running the project

The database is **Neon Cloud PostgreSQL, shared by the whole team** — one
database behind every machine. Node/pnpm are auto-downloaded if missing
(pinned in `package.json` → `devEngines`); Docker is needed only for the
opt-in local database.

First time on a machine (PowerShell, from the repo root):

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
# then put the Neon connection string into apps/api/.env → DATABASE_URL
pnpm --filter api exec prisma migrate deploy   # apply migrations to Neon
pnpm --filter api exec prisma generate         # generate the Prisma client
```

Then:

```powershell
pnpm dev:api           # apps/api
pnpm dev:mobile        # apps/mobile — Expo dev server, scan QR with Expo Go
pnpm dev:mobile:web    # apps/mobile in a browser (fast layout iteration)
pnpm dev:web           # apps/web (Next.js scaffold)
```

Want a private database instead of the shared one? That is Workflow B —
Docker Desktop plus `pnpm bootstrap`. Both workflows, and the rules for
working against a database your teammates share, are in
`docs/04-devops/local-environment.md`.

Full command reference: `docs/04-devops/commands.md`.
Mobile setup on Windows: `docs/04-devops/mobile-development.md`.

## Contributing

Git workflow and commit conventions: `CONTRIBUTING.md`.
