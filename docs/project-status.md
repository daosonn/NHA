# Project Status

## Current Sprint

**Sprint 1 — Core Features** (drafted — pending team review before start)

- Active sprint doc: `docs/sprints/sprint-01.md`
- Later sprints: `docs/sprints/sprint-02.md` (Memories & AI),
  `docs/sprints/sprint-03.md` (Notification / Settings / Release)
- Setup record (completed): `docs/sprints/00-setup.md`

## Current Focus

- **Frontend platform switched to Expo (2026-08-17)** — see Important
  Decisions. Done: docs realigned, `packages/tokens` rebuilt,
  `apps/mobile` on Expo SDK 57, Inter/Lora, design-system primitives, app
  icons, and two screens against mock data — **Home**
  (`app/(tabs)/index.tsx`) and **Family tree** (`app/family.tsx`).
  Next per the build order in `architecture.md`: New moment, then Member
  profile (Timeline / Album / Memo).
- **Home is still styled with `StyleSheet`.** NativeWind arrived after it
  was written; converting it is a mechanical follow-up, not a rewrite.
  New screens use NativeWind.
- **DB design finalized at sprint 0 (2026-08-14)**: full-MVP design — 25
  tables, 2 ER diagrams, decision log — in `docs/02-backend/database.md`;
  domain decisions recorded in `docs/00-shared/domain-model.md`. Team
  should ratify the day's decisions and sanity-check Sprint 1's added
  tasks (1.1.7, 1.2.5, 1.5.6–7, 1.6.7–8; 1.6.6 dropped), then decide when
  Sprint 1 starts. Next code step: `schema.prisma` + first migration.
- Scheduling gaps flagged in `mvp-scope.md` (items IN scope but not in any
  sprint: LINE + X social login (deferred — see Important Decisions), time
  capsule, auto albums, automatic interest analysis) — schedule or defer
  before release. Google + Facebook login scheduled 2026-08-17 as tasks
  1.1.8–1.1.9. Milestone timeline was scheduled 2026-08-14 as task 1.6.8.
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

### Sprint 1

- Full-MVP Prisma schema: 25 models + migration
  `20260814063321_full_mvp_schema` (incl. 3 CHECK constraints) — merged to
  `main` in PR #1 (2026-08-14). Task 1.3.1 done.
- AuthModule: register / login / refresh (single-use rotation) / logout,
  global JWT guard + `@Public`, Swagger at `/api/docs` — merged to `main`
  in PR #2 (2026-08-17). Tasks 1.1.2 / 1.1.3 / 1.1.5 / 1.1.6 done.
  Task 1.1.7 (password recovery) deferred: needs an email-infrastructure
  decision.
- FamilyModule: create family + invite code, join via code (incl. linking
  an account to a placeholder member), placeholder member CRUD,
  relationships CRUD, membership-based authorization — merged to `main`
  in `107acb1` (2026-08-17). Tasks 1.3.3–1.3.6 done; verified by
  format/lint/build/test + 20-step live smoke test. Assumptions to confirm
  with the team: linked members' info is editable/removable only by
  themselves (placeholders stay wiki-editable); "add member with account"
  happens via invite-code join rather than direct add.
- Family tree API: `GET /api/families/:familyId/tree` — member nodes +
  relationship edges in one payload for the tree screen (2026-08-18).
  Task 1.4.1 done; verified by lint/test/build + live smoke test
  (200 with nodes+edges / 401 unauthenticated / 403 non-member).
  On branch `feature/family-tree-api` — pending PR.
- Post + Media modules (2026-08-18): `POST/GET/PATCH/DELETE /api/posts`
  (author-only edit/delete, EVENT requires title+date, visibility via
  `familyIds` — empty = private, tags must stay inside the shared
  families, private content returns 404 to non-viewers) + StorageService
  (local disk, `UPLOAD_DIR`, swappable for S3 later) + `POST /api/media`
  (multipart photo ≤10MB) and `GET /api/media/:id` (authorized
  streaming). Tasks 1.5.2–1.5.5 done; verified by lint/test/e2e/build +
  15-case live smoke test. On branch `feature/family-tree-api`,
  uncommitted. Assumptions to confirm: photos only for MVP upload
  (jpeg/png/webp/gif/heic), media set fixed at post creation (edit
  changes text/visibility/tags, not attachments).

### Planning Phase

- MVP scope decided (`docs/00-shared/mvp-scope.md`)
- Screen inventory documented (`docs/01-frontend/screens.md`, 21 screens)
- Core domain decisions recorded (`docs/00-shared/domain-model.md`)
- Database designed for the **full MVP** — 25 tables, sprint-0 revision
  2026-08-14 (`docs/02-backend/database.md`)
- Backend architecture / auth decided (`docs/02-backend/architecture.md`)
- 3-sprint plan documented (`docs/sprints/sprint-01..03.md`)

## In Progress

- **Social login (Google + Facebook)** (2026-08-17): backend merged to
  `main` in PR #3 — `OAuthAccount` table + OAuth authorization-code
  endpoints in the AuthModule. **Google verified end-to-end 2026-08-18**
  (task 1.1.8 done — consent screen switched to External + test users).
  Facebook (1.1.9) stays unticked until its happy path is verified —
  needs the tester-role invite accepted on the Meta app. Frontend
  buttons come with the auth UI (1.1.1/1.1.4).

## Not Started

- `apps/ai` (FastAPI service — not yet created)
- All product features: auth, family, Life Profile, Life Timeline, Memories,
  Family Tree, memory boxes, personal archive, reminders, notifications,
  AI-assisted features

## Important Decisions

- PostgreSQL is the primary database.
- Prisma is used for database access, via the `pg` driver adapter (required
  for SQL providers in Prisma 7).
- **Frontend is a native mobile app (2026-08-17)**: `apps/mobile` built with
  Expo + expo-router + NativeWind is the primary client, replacing the
  earlier "Next.js mobile-first web" decision. Reasons: iOS push
  notifications, app-store presence, and scroll/gesture quality — the last
  one matters because the audience includes older family members. All 21
  screens in `screens.md` are designed as native screens (bottom nav,
  bottom sheets, blurred headers, gestures). `apps/web` stays as a bare
  Next.js scaffold with no decided role. See
  `docs/01-frontend/architecture.md`.
- **NativeWind confirmed (2026-08-17)**: `nativewind@4.2.6` +
  `tailwindcss@3.4` verified working on Expo SDK 57 / RN 0.86 / React 19.
  `tailwind.config.js` derives every colour, size, radius and font family
  from `@nha/tokens` — Tailwind is a consumer of the tokens, never a
  second source of truth. Off-scale mockup numbers (353px, 171.5px) are
  _derived_, not intended: they are `393 − 20×2` and `(353 − 10)/2`, so
  they are expressed as `flex-1` + padding + gap, never hardcoded.
  `darkMode: 'class'` — the palette is a fixed warm light one, so dark
  styles must never arrive from the OS setting.
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
- **Social login (2026-08-17)**: customer requires social login for the
  Japanese market. Phase 1 **Google + Facebook**, scheduled into Sprint 1
  as tasks 1.1.8–1.1.9. **LINE deferred** (needs an email-permission
  application; highest-value provider in Japan — re-confirm with the
  customer). Phase 2 candidate: X. Instagram infeasible (Basic Display API
  shut down; no consumer SSO). Policies: no auto-linking (409 if email
  already registered), email required from the provider (reject if absent
  or unverified). Schema impact: add `OAuthAccount` only — see
  `docs/02-backend/architecture.md`.
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
