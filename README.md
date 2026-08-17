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

Prerequisites: Docker Desktop running. Node/pnpm are auto-downloaded if
missing (pinned in `package.json` → `devEngines`).

```bash
pnpm install
pnpm bootstrap   # one-shot: .env files, PostgreSQL, migrations, Prisma client

pnpm dev:api           # apps/api
pnpm dev:mobile        # apps/mobile — Expo dev server, scan QR with Expo Go
pnpm dev:mobile:web    # apps/mobile in a browser (fast layout iteration)
pnpm dev:web           # apps/web (Next.js scaffold)
```

Full command reference: `docs/04-devops/commands.md`.
Mobile setup on Windows: `docs/04-devops/mobile-development.md`.

`pnpm bootstrap` is safe to re-run anytime. Details:
`docs/04-devops/local-environment.md`.

## Contributing

Git workflow and commit conventions: `CONTRIBUTING.md`.
