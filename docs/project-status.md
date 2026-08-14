# Project Status

## Current Sprint

**Sprint 1 — Core Features** (drafted — pending team review before start)

- Active sprint doc: `docs/sprints/sprint-01.md`
- Later sprints: `docs/sprints/sprint-02.md` (Memories & AI),
  `docs/sprints/sprint-03.md` (Notification / Settings / Release)
- Setup record (completed): `docs/sprints/00-setup.md`

## Current Focus

- **DB design finalized at sprint 0 (2026-08-14)**: full-MVP design — 25
  tables, 2 ER diagrams, decision log — in `docs/02-backend/database.md`;
  domain decisions recorded in `docs/00-shared/domain-model.md`. Team
  should ratify the day's decisions and sanity-check Sprint 1's added
  tasks (1.1.7, 1.2.5, 1.5.6–7, 1.6.7–8; 1.6.6 dropped), then decide when
  Sprint 1 starts. Next code step: `schema.prisma` + first migration.
- Scheduling gaps flagged in `mvp-scope.md` (items IN scope but not in any
  sprint: Google OAuth, time capsule, auto albums, automatic interest
  analysis) — schedule or defer before release. Milestone timeline was
  scheduled 2026-08-14 as task 1.6.8.
- Remaining domain questions (`docs/00-shared/domain-model.md`): leave
  semantics, time-capsule unlock semantics, "plan a surprise" data
  sources (manual context vs availability/address data).

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
- Database designed for the **full MVP** — 25 tables, sprint-0 revision
  2026-08-14 (`docs/02-backend/database.md`)
- Backend architecture / auth decided (`docs/02-backend/architecture.md`)
- 3-sprint plan documented (`docs/sprints/sprint-01..03.md`)

## In Progress

- **Prisma schema for the full MVP implemented** (2026-08-14, branch
  `feature/prisma-schema-mvp`): 25 models + migration
  `20260814063321_full_mvp_schema` (incl. 3 CHECK constraints), applied to
  the local DB; `prisma validate` + generate + `nest build` all pass.
  Pending review/PR — tick task 1.3.1 when merged.
- Reviewing the sprint plan (Sprint 1 checklist in
  `docs/sprints/sprint-01.md` is otherwise unchecked)

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
- **Full-MVP DB design + domain decisions (2026-08-14)**: 25 tables.
  Albums split (family library = derived, rendered as Omoide "books" /
  personal albums private / profile gallery derived); Memo = private
  notes about a member (author-only, always); AI plans are saved
  (`Plan` + `PlanShare` — owner edits, view-only sharing); birth/death
  dates live on LifeProfile; wiki edits logged (`EditHistory`); diverse
  reactions (base LIKE/LOVE/HAHA/WOW/SAD); solar-only dates (product
  targets the Japanese market); special-date widgets (`SpecialDate`).
  Comment/Reaction, password recovery, personal albums, LifeEvent
  timeline, special-date widgets and `SpecialDate` CRUD scheduled into
  sprint sub-tasks — full log in `database.md` → Decision Log.
