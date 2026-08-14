# Project Status

## Current Sprint

**Sprint 1 — Core Features** (drafted — pending team review before start)

- Active sprint doc: `docs/sprints/sprint-01.md`
- Later sprints: `docs/sprints/sprint-02.md` (Memories & AI),
  `docs/sprints/sprint-03.md` (Notification / Settings / Release)
- Setup record (completed): `docs/sprints/00-setup.md`

## Current Focus

- **Team review (2026-08-14)**: re-check the database design
  (`docs/02-backend/database.md`) and the 3-sprint plan, then decide when
  Sprint 1 starts. The DB design is a proposal only — nothing implemented;
  the actual Prisma schema is written once Sprint 1 begins.
- Scheduling gaps flagged in `mvp-scope.md` (items IN scope but not in any
  sprint: Google OAuth, time capsule, milestone timeline, auto albums,
  automatic interest analysis) — schedule or defer before release.
- Remaining domain questions (`docs/00-shared/domain-model.md`): leave
  semantics, wiki edit safety, time-capsule unlock semantics.

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
- One-shot machine setup: `pnpm bootstrap` (`scripts/setup.mjs`) — env files,
  Postgres, migrations, Prisma client
- `pnpm-lock.yaml` now committed (was gitignored); stray nested workspace in
  `apps/web` removed

### Planning Phase

- MVP scope decided (`docs/00-shared/mvp-scope.md`)
- Screen inventory documented (`docs/01-frontend/screens.md`, 21 screens)
- Core domain decisions recorded (`docs/00-shared/domain-model.md`)
- Database designed for Sprint 1 (`docs/02-backend/database.md`)
- Backend architecture / auth decided (`docs/02-backend/architecture.md`)
- 3-sprint plan documented (`docs/sprints/sprint-01..03.md`)

## In Progress

- Reviewing the DB design and sprint plan (Sprint 1 has NOT started —
  checklist in `docs/sprints/sprint-01.md` is all unchecked)

## Not Started

- `apps/ai` (FastAPI service — not yet created)
- All product features: auth, family, Life Profile, Life Timeline, Memories,
  Family Tree, memory boxes, personal archive, reminders, notifications,
  AI-assisted features

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
- **MVP scope decided (2026-08-13)**: Foundation + memory storage + AI
  features are IN; On This Day and Memory Map are OUT — see
  `docs/00-shared/mvp-scope.md`.
- **User ↔ Member (2026-08-13)**: Members exist independently of accounts;
  an account can link to an existing Member — see
  `docs/00-shared/domain-model.md`.
- **Multi-family (2026-08-13)**: a user can belong to multiple family
  spaces — see `docs/00-shared/domain-model.md`.
- **Life Profile is global (2026-08-13)**: one profile per person, shown in
  every family they join; on linking, the placeholder bio is replaced but
  attached memories are kept — see `docs/00-shared/domain-model.md`.
- **Placeholder profiles are wiki-editable (2026-08-13)**: any family member
  can edit; no manager ACL in MVP.
- **Relationships (2026-08-13)**: base types + exceptions (adopted, step,
  extended); set by whoever adds the member; node removed when leaving.
- **Privacy (2026-08-13)**: post to chosen families; everything shared is
  family-visible (no per-item ACL); personal archive private by default.
- **Auth (2026-08-13)**: JWT access + refresh tokens (refresh hashed in DB,
  revocable); email/password only for MVP, Google OAuth deferred — see
  `docs/02-backend/architecture.md`.
- **3-sprint plan (2026-08-13)**: Sprint 1 Core Features → Sprint 2
  Memories & AI → Sprint 3 Notification/Settings/Release — see
  `docs/sprints/`.
- **Memories reuse Post (2026-08-13)**: Sprint 2 Memories page reads the
  Sprint 1 `Post` table — no separate Memory model — see
  `docs/02-backend/database.md`.
