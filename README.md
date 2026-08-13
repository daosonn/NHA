# NHA — Family Memories (MVP)

A mobile-first family memory and relationship app: preserve life stories,
memories, and relationships in one shared family space.

## What to pay attention to

Everything that matters lives in two folders:

- **`apps/`** — the actual code
  - `apps/api` — backend (NestJS + Prisma + PostgreSQL)
  - `apps/web` — frontend (Next.js + Tailwind CSS)
  - `apps/ai` — AI service (not built yet)
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

```bash
pnpm install
docker compose up -d   # starts local PostgreSQL

pnpm dev:api            # apps/api
pnpm dev:web            # apps/web
```

Full environment setup, env vars, and verification commands:
`docs/04-devops/local-environment.md`.

## Contributing

Git workflow and commit conventions: `CONTRIBUTING.md`.
