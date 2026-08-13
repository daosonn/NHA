# Project Status

## Current Sprint

None yet — the project is in the **setup / planning phase**.

- Setup record (completed): `docs/sprints/00-setup.md`
- Sprint 1: not yet defined. It will be written after MVP scope planning is
  finished, with scope pulled from `docs/00-shared/mvp-scope.md`.

## Current Focus

- Deciding MVP scope in `docs/00-shared/mvp-scope.md` — this must be decided
  before Sprint 1 can be defined.

## Completed

### Setup Phase

- Monorepo setup (pnpm workspace)
- Next.js + Tailwind CSS bootstrap (`apps/web`)
- NestJS bootstrap + bug fixes (`apps/api`)
- PostgreSQL via Docker Compose
- Prisma ORM (schema, migration, CJS-compatible generated client)
- ESLint + Prettier
- Husky (`pre-commit` + `commit-msg`/commitlint)
- Documentation structure scaffolded (`docs/00-shared`, `01-frontend`,
  `02-backend`, `03-ai`, `04-devops`)

## In Progress

- MVP scope decisions (`docs/00-shared/mvp-scope.md` — all items currently
  `TBD`)

## Not Started

- Sprint 1 (cannot be defined until MVP scope is decided)
- `apps/ai` (FastAPI service — not yet created)
- All product features: auth, family, Life Profile, Life Timeline, Memories,
  Family Tree, albums, AI-assisted features

## Important Decisions

- PostgreSQL is the primary database.
- Prisma is used for database access, via the `pg` driver adapter (required
  for SQL providers in Prisma 7).
- Frontend uses Next.js + Tailwind CSS.
- Backend uses NestJS; prefer a modular monolith (see `CLAUDE.md` § 3).
- pnpm workspace monorepo.
- Conventional Commits are enforced via commitlint (husky `commit-msg` hook).
- Documentation may be committed directly to `main`; code changes require a
  branch + PR (team decision, not yet a hard rule in `CLAUDE.md`).
