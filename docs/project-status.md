# Project Status

## Current Sprint

**Sprint 1 — Core Features** (in progress — PRs #1–#9 merged; the
"pending team review before start" note was stale and is removed
2026-08-18). **Backend has moved on to Sprint 2 (2026-08-19)**: sprint 1's
backend side is finished, so `apps/api` work now follows
`docs/sprints/sprint-02.md` while frontend wires the remaining sprint-1
screens.

- **Sprint 2's AI side delivered 2026-08-20** on branch
  `merge/ai-integration` (PR pending): groups 2.2–2.5 end-to-end —
  `apps/ai` (FastAPI), NestJS `src/ai` + `src/video`, mobile screens
  21-33. Per-task detail in `docs/sprints/sprint-02.md`; contract and
  measured latency in `docs/03-ai/architecture.md`.
- Active sprint docs: `docs/sprints/sprint-01.md` (frontend wiring),
  `docs/sprints/sprint-02.md` (backend + AI team)
- Later: `docs/sprints/sprint-03.md` (Notification / Settings / Release)
- Setup record (completed): `docs/sprints/00-setup.md`

## Current Focus

- **Frontend state re-verified against the code (2026-08-19).** Wired to the
  API: sign in / sign up, Home (families + family feed), create-or-join
  family, the family tree (read plus adding a member), New moment, post
  detail with comments and reactions, and **Omoide** — the shared photo
  shelf, wired 2026-08-18 but described as a placeholder in the docs until
  today. Still reading `src/fixtures/`: **Life Profile** (both routes), the
  AI tab and Gift ideas, the Invitation page, and Home's special-date widget
  and recommendation grid. Per-screen detail:
  `docs/01-frontend/architecture.md` § Wiring status.
- **Two server routes the app's client mirror does not have (2026-08-19)**:
  `POST /auth/password-reset/{request,verify,confirm}` (PR #12) and
  `GET /families/:familyId/special-dates`. Neither is in
  `apps/mobile/src/lib/api/endpoints.ts`, so Forgot / Verify / Reset still
  only navigate between themselves and the Home widget still reads a
  fixture. Nothing blocks either — this is the cheapest frontend work
  available right now.
- **Three dead ends found while re-verifying (2026-08-19)**, two of them in
  the invite flow:
  `components/family/pending-banner.tsx` is rendered nowhere, because
  `tree-from-graph.ts` emits `state: 'active'` for every node and no pending
  spot can exist; and the Join button on `app/invite/[code].tsx` has no
  handler, which is the one place the app breaks its own "a button that
  leads nowhere is not rendered" rule. Both trace back to the missing
  per-spot invitation record, not to anything the frontend can fix alone.
  A third sits on the Life Profile: `MemoList` accepts an `onAddMemo`
  handler and `ProfileBody` never passes one, so the memo empty state draws
  an "Add memo" button that does nothing. That one is ours to fix.
- **The stack table listed three libraries that are not installed
  (2026-08-19)** — `@gorhom/bottom-sheet`, `d3-hierarchy`, and
  `react-hook-form`+`zod`. Sheets are a plain `Modal`, the tree layout is
  authored by hand in `tree-layout.ts`, and the forms use `useState`; the
  last one was a deliberate decision recorded below. `architecture.md` now
  says so rather than reading as a list of things already present.
- **Frontend platform switched to Expo (2026-08-17)** — see Important
  Decisions. Done: docs realigned, `packages/tokens` rebuilt,
  `apps/mobile` on Expo SDK 57, Inter/Lora, design-system primitives, app
  icons, and **the whole first-pass screen set against mock data**
  (2026-08-18) — all eight items in the `architecture.md` build order:
  **Home** (`app/(tabs)/index.tsx`), **Family tree** (`app/family.tsx`),
  **Life Profile** (`app/member/[id].tsx`) and the **Profile tab** sharing
  one body (`components/member/profile-body.tsx`), **New moment**
  (`app/(tabs)/new.tsx`), the **invite sheet** + **pending spot state** on
  the tree, and the **Invitation page** (`app/invite/[code].tsx`).
  Verified: `tsc --noEmit` clean, prettier clean, and a static web export
  prerendering all 16 routes with the expected copy and no nested
  `<button>`.
- **Second mobile pass done (2026-08-18)**: **auth** — Welcome, Sign in,
  Create account, Verify (6-digit code) and a three-step password reset,
  behind a mock in-memory session gate with Sign out in Settings; and
  **AI** — the calendar hub on the AI tab plus Gift ideas
  (`app/ai/gifts.tsx`). Profile hero reworked: "Add memory" removed and
  Edit moved to a badge on the avatar. Verified the same way — typecheck,
  prettier, 27-route static export grepped for content, and no nested or
  interactive-in-`<button>` markup. Those screens have since been wired one
  at a time — see `docs/01-frontend/architecture.md` § Wiring status for
  where that stands.
- **Deferred on the mobile app**: pinch-to-zoom / drag-to-pan on the family
  tree (the zoom buttons cover the same ground for now; needs
  `react-native-gesture-handler`), the web invite-acceptance page for
  someone without the app, which waits on the `apps/web` decision, and the
  remaining AI screens (Memory video, Surprise plan, Occasions list,
  Reminders, Add occasion — mockups 9c–9g).
- **Home is still styled with `StyleSheet`.** NativeWind arrived after it
  was written; converting it is a mechanical follow-up, not a rewrite.
  New screens use NativeWind.
- **API integration foundation landed (2026-08-18)**: real session on
  `expo-secure-store`, refresh-on-401 behind a single-flight gate,
  `QueryClientProvider`, and hooks for families / family tree / family
  feed. **Wired 2026-08-18**: Sign in, Create account, Home, create-or-join
  family, the **family tree** (read plus adding a member), **New moment**
  (pick media → upload → post), and a **moments list + post detail** with
  comments and reactions. Life Profile, Omoide and the AI tab still read
  `src/fixtures/` — per-screen status is in
  `docs/01-frontend/architecture.md` § Wiring status.
- **Client mirror caught up with PRs #7–#9 (2026-08-18)**: `types.ts` and
  `endpoints.ts` had fallen behind the ten routes those PRs added.
  `PostDetail` gained `commentCount` / `reactionCount` / `myReaction`, and
  comments, reactions and profiles now have endpoint groups. Replayed
  against a running server, including the case the optimistic reaction
  update depends on: changing LIKE to LOVE replaces the reaction rather
  than adding one.
- **`expo-image-picker` added (2026-08-18)** — the last thing standing
  between New moment and a working end-to-end post.
- **Sprint 1 stands at 30 of 39 tasks (2026-08-19; was 24/38 on
  2026-08-18 — 1.4.4 was added since).** One more (1.6.7, personal
  albums) lands with the open `feature/album` PR. **The backend side of
  the sprint is finished**: every remaining unticked item is UI wiring
  (1.1.7 reset screens, 1.2.5 widget, 1.6.1–1.6.3 Life Profile — all
  their endpoints exist), finishing 1.2.4's empty states, verifying
  Facebook E2E (1.1.9, needs the Meta tester-role invite accepted), and
  the 1.7 stabilization pass.
- **Two gaps in the sprint plan itself**, both worth a team decision rather
  than a silent fix:
  1. **Apple Sign In has no task.** It was decided on 2026-08-18 and is
     mandatory on iOS once any other third-party login ships, but 1.1.8 and
     1.1.9 cover only Google and Facebook.
  2. **Task 1.5.3 is marked backend-only** ("preview thuộc UI 1.5.1") while
     1.5.1 is described as "nhập nội dung". The media picker fell between
     the two; it was built on 2026-08-18 under 1.5.1, but the WBS should
     say who owns it.
- **Nothing has been run on a physical device yet.** Every ticked frontend
  task was verified by typecheck, prettier, `check:i18n`, a static export,
  and replaying the endpoints against a running server — not by a person
  using the app. The picker, blur, sheets and gestures only tell the truth
  on hardware (`docs/04-devops/mobile-development.md`).
- **Four blocking questions answered 2026-08-18** — see Important
  Decisions: solar-only stands, Apple joins Google and Facebook, Home gets
  a skippable empty state, kinship labels stay at the base relationships.
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
- **Invites are family-wide, but the tree design assumes per-person
  invites** (2026-08-17). `design-system.md` says a tree spot is reserved
  when an invite is sent and falls back to Empty if it is cancelled or
  expires — but `Family.inviteCode` is one permanent code for the whole
  family, with no record of who was invited to which spot. The `Pending`
  node state therefore cannot be told apart from an ordinary placeholder.
  Decided 2026-08-17 that the UI leads and the backend follows.
  **Resolved on the UI side 2026-08-18** — the invite sheet now defines the
  shape the backend has to grow into; see Important Decisions.
  **Backend done 2026-08-19** as task 1.4.4 (branch
  `feature/per-spot-invitations`) — `Invitation` model + endpoints, tree
  nodes carry `pending`; see `api-contract.md` → Invitations. Wiring the
  invite UI to it is the remaining half.

## For the backend owner

Raised by the frontend, neither actionable from `apps/mobile`.

- **Three gaps found building the Life Profile against mockup 7
  (2026-08-19).** Written up in full in `docs/00-shared/api-contract.md`
  § Requests from the app; in short: (1) a member's media can only be found
  by paging the whole family feed and filtering on `taggedMemberIds`, so the
  Album tab scans a bounded 200 moments and tells the reader when it stopped
  short — a `memberId` filter on the feed, or WBS 1.6.4's own route, fixes
  it; (2) `LifeProfile` has no `occupation` and no `birthPlace`, so one of
  the mockup's three fact rows is not drawn and the first is missing its
  place; (3) `PostMediaSummary` has no duration, so a video tile says
  "Video" where the mockup shows a running time. None block a screen — the
  app ships without them and says on screen what it does not know.

- **Profile editing narrowed to self, and the server still disagrees
  (2026-08-19).** The app now draws the Edit affordance only on your own
  profile: a life story written about someone by someone else is a different
  object from one they wrote themselves, and the screen could not tell the
  reader which they were reading. What the family edits about another person
  is their place in the tree, not their biography. **The server has not
  changed** — `PATCH /families/:familyId/members/:memberId/profile` still
  accepts an edit from any member of the family, so the rule is currently
  enforced only by the UI not offering it. **Asked for**: narrow that route to
  the profile's owner, or say the wiki rule stands and the app should put the
  affordance back. Decision recorded in
  `docs/01-frontend/architecture.md` § Life Profile; reversing it on the
  client is one function (`features/member/member-profile.ts` →
  `editability`).

- **Comment moderation is decided for now, but the permission is in the
  wrong place (2026-08-18).** Only a comment's author may edit or delete it;
  the post's author has no moderation power. That is accepted for the MVP —
  this is a family, not a public forum. The problem is that
  `CommentSummary` carries no permission flag, so the app decides what to
  render by comparing `authorUserId` against the signed-in user. The rule
  now exists in two places, and the day the server relaxes it the app will
  keep hiding a button the server would allow — or show one that 403s.
  **Asked for**: `canEdit` / `canDelete` on `CommentSummary` (and the same
  on `PostDetail` while the shape is being touched). The app then draws
  what it is told and never has to change when the rule does.
  — done 2026-08-19 (branch `fix/backend-owner-requests`): both shapes
  carry `canEdit`/`canDelete` (author-only today), see `api-contract.md`;
  verified by live smoke test with two users.
- **CORS is pinned to fixed ports and will break again (2026-08-18).** The
  allowlist in `apps/api/src/main.ts` names `http://localhost:8081` and
  `:19006`. Metro moves to the next free port whenever 8081 is taken, so a
  second dev server puts the app on `:8082` and every request fails
  preflight. It has already happened once. **Asked for**: in development,
  accept any `http://localhost:<port>` / `127.0.0.1` origin via an origin
  callback instead of a fixed list; production stays closed by default,
  since the product client is native and sends no `Origin`. Note also that
  the CORS code itself was written by the frontend session and rode in on
  commit `e895259` on `ui-sprint2` — it has not been reviewed by whoever
  owns `apps/api`.
  — done 2026-08-19 (branch `fix/backend-owner-requests`): dev now matches
  any `http://localhost:<port>` / `127.0.0.1` origin (regex, equivalent to
  the callback asked for); `CORS_ORIGINS` override and closed-by-default
  production kept. Backend review of the frontend-written CORS code done in
  the same pass — no other issues found. Verified by live preflight tests.

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
- Password reset API (2026-08-18): request/verify/confirm with an
  emailed 6-digit code — 15-minute expiry, 5-guess cap (new `attempts`
  column, migration `20260818073348`), single-use, revokes every
  session on success. Task 1.1.7 done, merged to `main` in PR #12;
  details in `api-contract.md`.
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
  Merged to `main` (2026-08-18) — closes the "no GET for relationships"
  gap flagged by the mobile API-contract pass.
- Post + Media modules (2026-08-18): `POST/GET/PATCH/DELETE /api/posts`
  (author-only edit/delete, EVENT requires title+date — content optional
  for events, visibility via `familyIds` — empty = private, tags must
  stay inside the shared families, private content returns 404 to
  non-viewers on every verb) + StorageService (local disk, `UPLOAD_DIR`,
  swappable for S3 later; uploads stream to a temp file, never buffered
  in memory) + `POST /api/media` and `GET /api/media/:id` (authorized
  streaming with HTTP Range/206 for video/audio playback). Uploads
  accept photo/video/audio per the MVP memory scope
  (jpeg/png/webp/gif/heic; mp4/mov; mp3/m4a/aac/wav) with a single
  100MB limit for every type (decided 2026-08-18). Tasks 1.5.2–1.5.5
  done. Verified by lint/build + manual live smoke tests (authorization
  matrix, Range, date-validation and ex-member cases); **no automated
  tests for these modules yet** — the jest suites are still the NestJS
  scaffold specs. Code-review round 2026-08-18 (9 review agents, 17
  findings): critical fixes applied — PATCH re-checks current
  membership (ex-member loses write access but can still un-share),
  PATCH/DELETE return 404 like GET for non-viewable posts (no existence
  oracle), `eventDate: null` and invalid ISO dates rejected as 400
  (were silent 1970-01-01 / 500), upload cleanup when the DB insert
  fails. Deferred to a follow-up branch before 1.5.6–7: dedupe
  canView/membership helpers, `UpdatePostDto` via PartialType, response
  shape hiding cross-family ids from non-authors. Merged to `main` in
  PR #5 (2026-08-18). Assumption to confirm: media set fixed at post
  creation (edit changes text/visibility/tags, not attachments).
- Life Profile API (2026-08-18): `GET/PATCH /api/me/profile` +
  `GET/PATCH /api/families/:familyId/members/:memberId/profile` — the
  display rule from domain-model.md (linked member → global profile,
  placeholder → family-local wiki profile), wiki editing by any family
  member for placeholders (linked profiles are owner-only), every edit
  logged to `EditHistory` with editor + snapshot, `updatedById`
  stamped. Fields: bio, interests (string list), birthDate/deathDate
  (strict ISO, death ≥ birth) — the single source the 1.2.5 widgets and
  Sprint-3 reminders derive from. Task 1.6.2 API side done; verified by
  lint/build + 11-case live smoke test incl. EditHistory rows in the
  DB. Merged to `main` in PR #9 (2026-08-18).
- Special-dates widget API (2026-08-18):
  `GET /api/families/:familyId/special-dates` — upcoming occasions for
  the family-home widgets (task 1.2.5 API side), soonest first, from
  both sources in `database.md`: birthdays/memorials derived from
  LifeProfile dates (no rows stored; deceased members get a memorial
  only — assumption to confirm) plus stored `SpecialDate` rows (CRUD
  stays in Sprint 3 task 3.2.3). Returns type/month/day/originYear/
  ordinal/theme/nextOccurrence/daysUntil/members; derived items carry
  no display text — the client labels them (i18n). Verified by
  lint/build + live smoke test (today-edge, ordinal, deceased rule,
  custom row, limit validation, 403). On branch
  `feature/special-dates`, uncommitted.
- Comments + Reactions API (2026-08-18): CRUD
  `/api/posts/:postId/comments` (oldest first, cursor-paginated; anyone
  who can view the post comments, only the comment author edits/deletes
  — post-author moderation is an open product call) and
  `PUT/DELETE /api/posts/:postId/reactions/me` (one reaction per user
  per post, upsert to change type, idempotent delete). `PostDetail`
  gained `commentCount` / `reactionCount` / `myReaction`, so feed cards
  and the post-detail screen need no extra calls. Ships with the
  deferred cleanup: FamilyService now exports the membership checks and
  PostService exports `canViewPost`/`assertViewable` — MediaService and
  the new comment/reaction services delegate instead of copying the
  privacy rule; `UpdatePostDto` collapsed to
  `PartialType(OmitType(CreatePostDto, ...))`. Tasks 1.5.6–1.5.7 API
  side done; verified by lint/build + 16-case live smoke test. On
  branch `feature/post-engagement`, uncommitted.
- Family feed API (2026-08-18): `GET /api/families/:familyId/posts` —
  the family's shared posts, newest first, cursor-paginated (`limit`
  1–50 default 20, `nextCursor`), membership-based authorization;
  private posts never appear. Unblocks wiring the Home feed (1.2.3 —
  API side done, UI not wired). Verified by lint/build + live smoke
  test (ordering, pagination, 403 non-member, 401, limit validation,
  new-member visibility). On branch `feature/post-feed`.
- Per-spot invitation API (2026-08-19): `Invitation` model (migration
  `20260819021946`) + `POST/GET /api/families/:familyId/invitations`,
  resend, cancel, **public** `GET /api/invitations/:code` for the invite
  page, and `POST /api/invitations/:code/accept` (joins on the reserved
  spot via the same link operation as join-with-`linkMemberId`). Sending
  reserves the spot in one transaction (placeholder + edge + invitation);
  tree members now carry `pending`. 7-day expiry (derived `EXPIRED`, never
  stored), one live invitation per spot, cancel deletes an untouched
  placeholder so the node falls back to Empty. Task 1.4.4 done; verified
  by lint/build/test + 28-case live smoke test. On branch
  `feature/per-spot-invitations`. Details in `api-contract.md`.
- Life Event API (2026-08-19): Timeline milestones for the Life Profile —
  `GET/POST/PATCH/DELETE /api/me/life-events` +
  `.../families/:familyId/members/:memberId/life-events` (no new tables:
  `LifeEvent` shipped in the sprint-0 schema). Same rules as the profile
  it hangs off: linked → global timeline, placeholder → family-local
  wiki-editable, every PATCH logged to `EditHistory`. Media attach via
  `mediaIds` at creation (fixed after, like posts) and **streaming now
  follows profile visibility** — the MediaService "uploader-only until
  1.6.8" gap is closed by delegating to LifeEventService. Lists oldest
  first; tags replace on PATCH. Task 1.6.8 done — first of the three
  Life Profile tab unlocks (next: Memo 1.6.5, then gallery 1.6.4).
  Verified by lint/build/test + 29-case live smoke test incl. EditHistory
  rows in the DB. On branch `feature/life-events`. Also rides along:
  **main was broken** by a PR #15 conflict resolution leftover
  (`origin: origins` in `main.ts`) — `nest build` failed on main from
  merge `e33e8a8` until this branch's fix. Code-review round 2026-08-19
  (8 review agents): fixes applied — PATCH `title`/`eventDate: null`
  (were a 500 and a silent 1970-01-01), whitespace-only title, `eventDate`
  restricted to date-only `YYYY-MM-DD` (a `+09:00` datetime shifted the
  stored day), no-op PATCH no longer writes EditHistory. **Deferred to the
  Memo branch (1.6.5), which would otherwise copy them a third time**:
  extract shared media-attach + tag-validation + parseDate/normalizeText +
  best-effort file cleanup + a `ProfileService.resolveForMember` for the
  wiki rule; also known: a tag-write FK race returns 500 (same window
  exists in PostService).
- Memo API (2026-08-19): private notes about a member —
  `GET/POST /api/families/:familyId/members/:memberId/memos` +
  `GET/PATCH/DELETE /api/memos/:memoId`. Always author-only (decision
  2026-08-14): everything not yours 404s, memo media streams to the owner
  only. List is `updatedAt` desc (matching the memo UI), so a no-op PATCH
  does not bump it. **Schema: Memo grew `title` + `category`, `content`
  optional** (migration `20260819042417`, UI-led — see `database.md`
  Decision Log). Ships with the deferred dedupe now that a third consumer
  arrived: shared `attach-media` helpers (the one-parent rule's write
  side), `common/input.ts` (`normalizeText`, `parseIsoDate`) and
  `StorageService.removeAllBestEffort` — PostService, LifeEventService,
  ProfileService and MemoService all delegate. Task 1.6.5 done; verified
  by lint/build/test + 16-case memo smoke + 29-case life-event regression
  smoke. On branch `feature/memo-api` (stacked on `feature/life-events`).
  Code-review round 2026-08-19 (8 agents) — fixes applied: life-event
  tags scoped to the family being edited (were leaking cross-family
  member ids), `removeMember` now cleans up cascaded memo/life-event
  media files (were orphaned on disk), no-op PATCHes value-checked
  (retries no longer spam EditHistory / reorder memos), concurrent
  delete races return 404 not 500, profile `birthDate`/`deathDate`
  restricted to date-only (same +09:00 day-shift as eventDate), Media
  gained `memoId`/`lifeEventId` indexes (migration `20260819045211`),
  and the wiki rule + profile-content visibility moved to one home on
  `ProfileService` (`resolveForMember`/`canViewProfileContent`), tag
  boundary to `family/member-tags.ts`, media summary shape to
  `attach-media.ts`. The memo-cascade question was then **decided
  2026-08-19: memos survive member removal** — `aboutMemberId` SetNull +
  `aboutName` snapshot (migration `20260819052340`, backfilled so it
  deploys on non-empty tables), new `GET /me/memos` lists orphaned notes;
  verified by 22-case memo smoke incl. the survival path. Remaining note
  for the team: the earlier `title` migration (`20260819042417`) has no
  backfill — fine while every Memo table predates the API.
- Local DB backup/restore (2026-08-19): `pnpm db:backup` (pg_dump custom
  format into gitignored `backups/`) and `pnpm db:restore <file> --force`
  (mandatory flag — restore replaces the database). Deletes stay hard
  deletes in the MVP; a dump before risky work is the way back. Verified
  by a real backup→restore round-trip (row counts intact, API healthy
  after). See `docs/04-devops/local-environment.md` § Backup & restore.
- Video job API (2026-08-19, sprint 2, task 2.2.2): the backend half of
  video generation — `POST/GET /api/video-jobs` (+ `GET /:id` to poll)
  and the internal completion callback
  `POST /api/internal/video-jobs/:jobId/complete` for the AI team.
  Sources are any images the requester may view
  (`MediaService.assertViewableBatch`, the same gate as streaming, now
  exported and returning selection order — the frame order). A definite
  dispatch refusal rolls the job back and answers 503 `AI_UNAVAILABLE`
  (no orphan rows) while a **timeout leaves the job PENDING** — the AI
  service may have accepted and its callback completes it late.
  Code-review round 2026-08-19 (8 agents) — fixes applied same-day:
  `resultMediaId` FK (unique, migration `20260819090000`) replaces the
  unindexed non-unique storageKey lookup that was an N+1 and could
  resolve to another user's row; every status transition is a
  conditional `updateMany` so a fast callback can't be dragged back to
  PROCESSING and concurrent callbacks settle exactly once; the callback
  validates mimeType against the storage whitelist and **measures size
  from disk** (path escapes and ghost files are 400s); `error` +
  `resultPath` together is a 400; comments got their own
  `PaginationQueryDto` (sharing FeedQueryDto had made Swagger advertise
  Memories filters the comments route ignores); the Memories `?memberId`
  filter now matches any of a linked member's rows (same identity rule
  as the gallery) and reuses `findMemberInFamily` + `parseIsoDate`; and
  the date-only guard became one `IsDateOnly()` decorator (was 4
  copies). Known notes: `?from`/`?to` bucket by **UTC day**, consistent
  with Omoide's grouping but off-by-one for JST evening posts — team
  question; a feed `nextCursor` is filter-bound (reuse it only with the
  same filters). The result is registered as the requester's own
  standalone Media, so it streams privately with Range/206. Verified by
  lint/build/test + 22-case live smoke against a **mock AI service**
  (dispatch payload, failure
  rollback, auth matrix, DONE/FAILED paths, result privacy). On branch
  `feature/video-jobs` (stacked on `feature/memory-list`). Render itself
  is the AI team's — seam in `docs/03-ai/architecture.md`.
- Memory list API (2026-08-19, sprint 2, tasks 2.1.1–2.1.2): Memories
  reuse `Post` as designed — no new model; `GET /families/:id/posts`
  gained optional filters `?memberId` (tagged-in plus authored-by when
  linked; 404 outside the family), `?from`/`?to` (calendar days on the
  posted date, same grouping choice as Omoide) and `?type`. Filters
  combine and pagination is unchanged, so the Home feed path is
  untouched. Verified by lint/build/test + 13-case live smoke (filters,
  combinations, cursor pagination under filter, 400/404 matrix). On
  branch `feature/memory-list`. Details in `api-contract.md`.
- AI insight pipe (2026-08-19, sprint 2): the backend half of the
  two-phase photo pipeline — `MediaInsight` hidden store (migration
  `20260819071710`, table 26) + internal routes
  `GET /api/internal/ai/media/pending` and
  `PUT /api/internal/ai/media/:mediaId/insight` behind
  `X-AI-Service-Token` (timing-safe compare; user JWTs do not open them;
  unset token = 503 `AI_UNAVAILABLE`, core unaffected). Env
  `AI_SERVICE_TOKEN`/`AI_SERVICE_URL` added to `.env.example`. Verified
  by lint/build/test + 13-case live smoke (503 unconfigured, 401 matrix,
  pending→ingest→drop-out, upsert re-analysis, 404/400) + DB-level
  cascade check (delete photo → insight gone). On branch
  `feature/ai-insight-pipe`. Contract: `docs/03-ai/architecture.md`.
- Gallery API (2026-08-19): the Album tab, derived — `GET /api/me/gallery` +
  `GET /api/families/:familyId/members/:memberId/gallery`. No new
  table: media from posts authored by or tagged with the member, plus
  their life-event media, filtered to what the viewer may see (the same
  author/private/shared-family rule `PostService.canViewPost` applies
  elsewhere, batched into one membership query instead of one call per
  post — a code-review finding, fixed same-day). Not paginated, same
  choice as the life-event timeline. Task 1.6.4 done — **closes group
  1.6's Life Profile blocker**: About + all three tabs now have an
  endpoint; wiring is what remains. Verified by lint/build/test + 21-case
  live smoke test (own/tagged/private/life-event sources, cross-family
  isolation, placeholder scoping, stranger 403) + full life-event (29) and
  memo (22) regression smoke. On branch `feature/gallery` (stacked on
  `feature/memo-api`).
- Personal Album API (2026-08-19): `GET/POST/PATCH/DELETE /api/me/albums`
  - `POST .../items` / `DELETE .../items/:mediaId`. No migration — `Album`
  - `AlbumItem` shipped in the sprint-0 schema. Always private (never on a
    profile), items are the owner's own uploads only, an album is a second
    index onto media (not an exclusive parent — already-attached media can
    be added, one media can sit in many albums), add/remove are idempotent,
    cover must be an item and auto-clears when that item is removed,
    deleting an album never touches the media. Task 1.6.7 done — **group
    1.6 backend is now fully closed**. Verified by lint/build/test +
    19-case live smoke test. No UI exists yet (screens.md #11 sketches only
    a "choose album" step in Post a Moment). On branch `feature/album`
    (stacked on `feature/gallery`).

### Sprint 2 — AI team (branch `merge/ai-integration`, PR pending)

- AI integration for screens 21-33 (2026-08-20): `apps/ai` (FastAPI,
  gpt-5.6-luna, structured outputs strict, `AI_MOCK=1` for token-free
  tests), NestJS `src/ai` (gift / message / card / evidence / two-tier
  profile pipeline: `InterestSignal` → versioned `MemberProfile`, rollup
  after every post) + `src/video` (storyboard + 0-token ffmpeg render:
  6 intro styles, Ken Burns, music ducking under clip voices), and the
  full mobile flow (AI hub → gift ask/results/sources → message → card →
  video setup/photos/music/style/plan/making/done). Provenance is
  end-to-end: every suggestion cites `memo_…`/`sig_…` ids that resolve
  back to the real note or post. Privacy rule tightened 2026-08-20:
  suggestion context uses only the requester's own memos. Perf pass
  measured on real calls (gift 12.3s→~8-9s cold / 43ms repeat, message
  3.6s / 38ms repeat, storyboard 5.7s, render 49s→~25s) — numbers and
  method in `docs/03-ai/architecture.md`. Verified: e2e 10/10 (real
  render), pytest 7/7, tsc/eslint/check:i18n clean. Sprint tasks
  2.2.1–2.5.2 ticked in `sprint-02.md`; 2.6 (Quality Time) not started.

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

- ~~`apps/ai` (FastAPI service — not yet created)~~ — created 2026-08-20 on
  branch `merge/ai-integration` (see Current Sprint)
- Sprint-2 group 2.6 (AI Quality Time) and Sprint 3 (notifications /
  reminders / settings / release)

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
- **State libraries reviewed (2026-08-18)**: `@tanstack/react-query` and
  `expo-secure-store` added because each solves a problem the app has
  today (cursor pagination and cache sharing; tokens surviving a restart).
  **`zustand`, `react-hook-form` and `zod` deliberately not added** — the
  only cross-screen state is the active family, and the six existing forms
  are simple enough for `useState` while the server already validates and
  returns per-field messages. `packages/api-client` and
  `packages/contracts` are dropped from the plan: the client lives fine in
  `apps/mobile`, and a shared zod package would fight the API's
  class-validator DTOs. Revisit each when a second case appears.
- **Invites are per-spot, not per-family (2026-08-18)** — UI-led decision,
  backend to follow. — backend done 2026-08-19 (task 1.4.4, see
  `api-contract.md` → Invitations). The invite sheet sends a specific person to a specific
  tree node: it captures the spot id, a display name and a relationship, and
  only then produces a link. The receiver's page can therefore say who
  invited them, as what, and where they land, which is what makes a cold
  invite trustworthy. What the backend needs to add: an invitation record
  carrying `{ familyId, memberId (the reserved spot), inviterId, name,
relationshipType, status, expiresAt }`. `Family.inviteCode` stays as the
  open "anyone with the link" path; it is not enough on its own, because a
  single permanent family-wide code cannot distinguish a Pending node from
  an ordinary placeholder. Kinship words shown in the sheet ("Sister",
  "Step-parent") stay **derived labels** and must not become
  `RelationshipType` enum values — each option carries the base type it maps
  to (`docs/00-shared/domain-model.md`).
- **A moment's audience is its privacy control (2026-08-18)** — the New
  moment screen models `PostFamily` directly: each selected family circle is
  one row, and selecting none means the post is private to its author, per
  `docs/02-backend/database.md`. Because that rule is invisible in the
  control itself, the screen always states the consequence in words under
  the button rather than relying on the user to infer it.
- **AI suggestions must show their working (2026-08-18)** — every
  suggestion carries `why` and `source`, and the amount of evidence read is
  stated before the first idea, not after. A recommendation nobody can
  trace back to a memo, a photo or the timeline is a guess wearing the
  family's clothes, and the reader has no way to tell the difference. This
  constrains the AI service too: the FastAPI contract has to return the
  provenance alongside the suggestion, not just the suggestion.
- **A button that leads nowhere is not rendered (2026-08-18)** —
  `FeaturedOccasion` draws an action only when given a handler, so Plan a
  surprise and Video are absent until those screens exist. A dead control
  costs more trust than a visibly missing feature.
- ~~**Auth session is a stand-in (2026-08-18)**~~ — **superseded the same
  day; corrected here 2026-08-19.** The session is real: tokens live in
  `expo-secure-store`, refresh-on-401 is collapsed onto one promise in
  `src/lib/api/client.ts`, and `status` carries a third `loading` value for
  the keychain read so a returning user is not bounced through Welcome on
  every cold start. What survives from the original decision is where the
  guard sits: on the `(auth)` and `(tabs)` route groups, one gate each way.
- **Solar-only reaffirmed (2026-08-18)**: the Occasions mockups showing
  lunar dates are what changes, not the schema. See `domain-model.md`.
- **Social login is Apple + Google + Facebook (2026-08-18)**: Apple is
  added because App Store guideline 4.8 makes it mandatory on iOS once any
  other third-party login ships. Apple's flow differs from the other two
  (an identity token, not a plain authorization-code redirect), so it is
  its own backend task. The mockups need a third button.
- **No mandatory family step (2026-08-18)**: registration lands on Home,
  which shows an empty state with a way to create or join a family. Every
  screen therefore has to survive `familyId === null` — that is a
  first-class state now, not an edge case.
- **Apple Sign In dropped (2026-08-18)** — reversing the decision taken
  earlier the same day. Social login is **Google + Facebook only**. The
  trade-off is understood and accepted: App Store guideline 4.8 requires
  Sign in with Apple on iOS once any other third-party login ships, so an
  iOS build carrying Google or Facebook risks rejection at review. That is
  acceptable while the MVP is a demo rather than a store submission. Before
  any App Store submission the team must either add Apple or drop the other
  two from the iOS build. `AppleMark` was removed from the code rather than
  left unused, so putting it back is a deliberate act.
- **Omoide is one shelf, not albums, for the MVP (2026-08-18)** — every
  photo and video shared with the family, grouped by the day it was posted
  (mockup 10b). This needs **no new endpoint**:
  `GET /families/:id/posts` already returns each post with its media and
  already excludes private posts, which is exactly the boundary a shared
  memory shelf should have. Grouping is by _posted_ date, not capture date,
  because the server returns no capture metadata. Mockup 10a — albums by
  occasion — waits for an album endpoint and for the still-open question of
  what an album is derived from. **Built and wired the same day**
  (`app/(tabs)/omoide.tsx`, `features/omoide/`); search and the sort menu
  from the mockup are deliberately absent until something is behind them.
- **Home is 3a then 2a (2026-08-18)** — the family strip, the special-date
  widget and the recommendations sit above the fold exactly as in mockup 3a;
  scrolling past the "swipe up for moments" cue continues into the feed of
  mockup 2a. One `FlatList` with the 3a block as its header, because on a
  phone "swipe up" _is_ scrolling — a gesture library would reimplement what
  the list already does. The separate `/moments` screen built earlier the
  same day is deleted: two feeds is one too many.
- **Kinship labels stay basic for the MVP (2026-08-18)**: the app shows the
  base relationship translated from `RelationshipType`, and does **not**
  derive "Grandmother" or "Aunt" from paths through the graph. Consequence
  to accept: a node with no direct edge to the viewer — a grandparent, a
  cousin — shows its name with no role line under it. Revisit once the tree
  has been used by a real family.
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
- **Photo-insight pipeline is a two-phase design (2026-08-19)**: the AI
  team's service analyses photos in the background (vision) and the
  extracted facts live in **`MediaInsight`, a hidden store** no
  user-facing API exposes; suggestion requests then combine those
  insights with the requester's own memos. An insight inherits the
  visibility of its source photo and is filtered per requester at bundle
  time (anti-laundering rule), and it cascade-deletes with the photo.
  **Comments are excluded** from AI context for now. This supersedes the
  "manual context only" scope note **for photos**; consequence to
  confirm with the customer: family photos leave the server for the
  Claude API during analysis. See `docs/03-ai/architecture.md`.
- **AI work is owned by a separate AI team (2026-08-19)**: `apps/ai`
  (FastAPI), provider calls, prompts and the video render are theirs;
  backend supplies the API side — the NestJS proxy, auth, context
  gathering and the `docs/03-ai/architecture.md` contract both teams
  build against (drafted 2026-08-19). Provider direction: **Claude API**
  (AI team makes final model-level calls). Hard lines restated in the
  contract: FastAPI stateless and never touches Postgres, app never
  calls AI directly, core works when AI is down, every suggestion
  carries `why`/`source`, and the context only ever contains the
  requesting user's own private memos.
- **Email infrastructure (2026-08-18)**: SMTP behind the `MailService`
  seam — Gmail SMTP with an app password for the MVP (env
  `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`); with SMTP unconfigured
  (local dev) the message is logged to the API console instead of sent.
  Unblocked 1.1.7; the signup email-verification screen remains a
  separate product decision.
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
- **Media uploads (2026-08-18)**: uploads accept photo, video, and audio
  (per the MVP memory scope) with a **single 100MB limit for every
  type**; local-disk storage behind the storage service module for the
  MVP demo, streamed to disk (never buffered in memory). Client-declared
  MIME type is trusted for now (no content sniffing) — revisit before
  release, together with automated tests for the post/media
  authorization matrix.
- **App copy centralised (2026-08-18)**: every user-visible string in
  `apps/mobile` — accessibility labels included — moved to
  `src/locales/en.json` and read through `t()` (`i18next` +
  `react-i18next` + `expo-localization`, language remembered in
  `AsyncStorage` under `nha.locale`). The app is still English-only; this
  is the step that makes Japanese a JSON file rather than a second pass
  over 36 components. Counts go through i18next plurals, and month names
  and date order come from the catalogue, because Japanese has no plural
  form and writes the month before the day.
  `pnpm --filter mobile check:i18n` diffs call sites against catalogues in
  both directions. Boundary held: copy is translated, data is not — a
  memo's text and an occasion's title stay fixture strings. **Open**:
  relation words (`Grandmother`, `Sister`) are English nouns in the
  fixtures today; the API should return a relationship type the app
  labels, which is a domain question — see `architecture.md` § Language.
- **Japanese type faces (2026-08-18)**: Zen Maru Gothic Bold/Black takes
  the Lora slot (emotional headings) and Noto Sans JP 400/500/600/700
  takes the Inter slot (body and UI). Neither Inter nor Lora has Japanese
  glyphs, so this is a swap rather than a fallback. Noto Sans JP for body
  because its statics map one-to-one onto the existing weight scale, and
  because rounded terminals lose definition at 12–14px with dense kanji —
  the app is explicitly read by grandparents. Decided, not yet built —
  see `docs/01-frontend/design-system.md`.
- **Japanese shipped, fonts deferred (2026-08-18)**: `ja.json` translated in
  full (197 keys), language follows the device and is switchable in
  Settings, choice remembered in `AsyncStorage`. Japanese plurals collapse
  to `_other` and dates flip order (`4月12日` vs `12 Apr`) — both verified.
  **Zen Maru Gothic and Noto Sans JP are chosen but not bundled**: ~30–50 MB
  of TTF across six weights is an app-size decision, not a design one. Until
  then `theme/typeface.ts` hands Japanese the device font with a real
  `fontWeight`; verified by prerender that English renders
  `font-family:Inter_600SemiBold` and Japanese renders `font-weight:600`
  with no Latin face applied.
- **API contract written from the server, not invented (2026-08-18)**:
  `apps/mobile/src/lib/api/` (types, endpoints, fetch client, `ApiError`)
  mirrors the 14 routes that actually exist in `apps/api` — auth and
  families. Screens are untouched and still read fixtures; this is the seam
  react-query hooks will sit on. Full map in `docs/00-shared/api-contract.md`.
  **Blocking gap found: there is no `GET` for relationships.** `POST` and
  `DELETE` exist and `FamilyDetail` returns `members` only, so the family
  tree cannot be built from the API as it stands — the tree is drawn from
  edges. Also missing for screens already built: email verification codes,
  password reset (1.1.7, deferred), a public read of an invite code,
  LifeProfile/LifeEvent/Memo, Post, and the whole of `apps/ai`.
