# API Contract

What `apps/mobile` may assume about `apps/api`, and — just as important —
what it may not.

The client-side mirror of this document is `apps/mobile/src/lib/api/`:
`types.ts` (the shapes), `endpoints.ts` (one function per route),
`client.ts` (fetch, bearer token, refresh, errors). Those files were written
from the NestJS controllers and DTOs, not from a wish list. When the server
changes, both move together.

Replayed against a running server on 2026-08-18, and matching `types.ts` as
of that date: register, refresh (including a deliberate replay of a spent
token), families list and create, tree, join, media upload, post create,
feed, comment create and list, and all three reaction calls. Anything added
after that date has not been replayed — say so when you add a row rather
than letting this paragraph imply otherwise.

## Ground rules

- Base URL is origin **plus the `/api` global prefix**
  (`main.ts` → `setGlobalPrefix('api')`). The app reads it from
  `EXPO_PUBLIC_API_URL`.
- `localhost` is the phone, not your machine. Use the LAN address on a
  device, `http://10.0.2.2:3000/api` on the Android emulator.
- **Dates cross the wire as ISO-8601 strings**, even where the service
  types say `Date`. `src/lib/date.ts` wants `YYYY-MM-DD`, so a timestamp
  has to be cut down before it is formatted.
- Errors are NestJS's default body. `message` is a string for a thrown
  exception and an **array** when `ValidationPipe` rejects a DTO. Both come
  out of the same endpoints; `ApiError` handles both.
- `ValidationPipe` runs with `whitelist: true`, so an unknown field in a
  request body is stripped rather than rejected — a typo'd key fails
  silently as a missing value.
- Authorization is the server's decision. The app must never grant itself
  access from what it finds in a token (`CLAUDE.md` § 3).

## What exists today

Every route below is verified against the source; the live inventory is
Swagger at `/api/docs` (no hand-maintained count here — it only causes
merge conflicts).

### Auth — `apps/api/src/auth/`

| Route                                | Auth | Returns       |
| ------------------------------------ | ---- | ------------- |
| `POST /auth/register`                | —    | `AuthResult`  |
| `POST /auth/login`                   | —    | `AuthResult`  |
| `POST /auth/refresh`                 | —    | `AuthResult`  |
| `POST /auth/logout`                  | ✔    | `{ success }` |
| `GET /auth/oauth/:provider`          | —    | redirect      |
| `GET /auth/oauth/:provider/callback` | —    | `AuthResult`  |
| `POST /auth/password-reset/request`  | —    | `{ success }` |
| `POST /auth/password-reset/verify`   | —    | `{ valid }`   |
| `POST /auth/password-reset/confirm`  | —    | `{ success }` |

`AuthResult` is `{ user: { id, email, name }, accessToken, refreshToken }`.

Refresh is **single-use rotation**: the old token is revoked as the new pair
is issued, so the response has to be stored before anything else is
attempted. A dropped response costs the session.

Social login is a browser redirect, not a fetch. Providers are Google and
Facebook; a provider with no client ID configured returns 503.

Password reset is the three-step flow of screen 3: `request` emails a
6-digit code and answers success **whether or not the email exists** (no
account enumeration). The code lives 15 minutes, dies after 5 wrong
guesses, and is single-use. `verify` checks it without consuming — the
middle UI step; `confirm` sets the new password and **revokes every
refresh token**, signing all devices out. Delivery is SMTP (Gmail app
password for the MVP); with SMTP unconfigured (local dev) the code is
logged to the API console instead of sent.

### Families — `apps/api/src/family/`

| Route                                                      | Returns               |
| ---------------------------------------------------------- | --------------------- |
| `POST /families`                                           | `FamilyDetail`        |
| `GET /families`                                            | `FamilySummary[]`     |
| `POST /families/join`                                      | `JoinFamilyResult`    |
| `GET /families/:familyId`                                  | `FamilyDetail`        |
| `GET /families/:familyId/tree`                             | `FamilyTree`          |
| `POST /families/:familyId/members`                         | `FamilyMemberSummary` |
| `PATCH /families/:familyId/members/:memberId`              | `FamilyMemberSummary` |
| `DELETE /families/:familyId/members/:memberId`             | `{ success }`         |
| `POST /families/:familyId/relationships`                   | `RelationshipSummary` |
| `DELETE /families/:familyId/relationships/:relationshipId` | `{ success }`         |

All require a bearer token and membership of the family.

A member with `userId: null` is a **placeholder** — a person in the tree
with no account. `POST /families/join` with `linkMemberId` attaches an
account to one, keeping everything already written about that person
(`domain-model.md`).

`FamilyTree` is `{ id, name, members, relationships }` — nodes plus edges
in one payload; the client owns the layout (d3-hierarchy). This is the
read the tree screen needs (task 1.4.1, merged 2026-08-18).

### Posts — `apps/api/src/post/` (tasks 1.5.2–1.5.5, merged in PR #5)

| Route                           | Returns       |
| ------------------------------- | ------------- |
| `POST /posts`                   | `PostDetail`  |
| `GET /posts/:postId`            | `PostDetail`  |
| `PATCH /posts/:postId`          | `PostDetail`  |
| `DELETE /posts/:postId`         | `{ success }` |
| `GET /families/:familyId/posts` | `FamilyFeed`  |

`FamilyFeed` is `{ items: PostDetail[], nextCursor: string | null }` —
the family's shared posts, newest first. Query params: `limit` (1–50,
default 20) and `cursor` (echo back `nextCursor` for the next page;
`null` means the end). Requires membership of the family; the viewer's
own private posts are **not** in the feed — it shows only what was
shared to this family.

`PostDetail` is `{ id, authorUserId, authorName, type, content, eventDate,
eventTitle, place, familyIds, taggedMemberIds, media[], commentCount,
reactionCount, myReaction, createdAt, updatedAt }` with `media[]` items
`{ id, mimeType, sizeBytes }`. `myReaction` is the viewer's own reaction
(`null` when they have not reacted) — it differs per viewer.

Semantics the app must respect:

- **Visibility** is `familyIds` at create/edit; empty or omitted = private
  to the author. A post you may not view returns **404 on every verb** —
  never 403 — so "not found" and "not yours to see" are indistinguishable
  by design.
- Only the author edits/deletes. Editing re-checks the author's current
  membership: after leaving a family you can only pull the post back
  (`familyIds: []`, with `taggedMemberIds: []` if tags pointed there).
- `type: EVENT` requires `eventTitle` + `eventDate` (strict ISO 8601;
  content optional); plain `POST` forbids both and requires content or
  media.
- **Attachments are set at creation** via `mediaIds` (your own uploads,
  not attached elsewhere) and cannot be changed by PATCH — a `mediaIds`
  key in PATCH is silently stripped by the whitelist pipe.
- Tagged members must belong to the families the post is shared to.

### Comments & Reactions — `apps/api/src/post/` (tasks 1.5.6–1.5.7)

| Route                                       | Returns          |
| ------------------------------------------- | ---------------- |
| `POST /posts/:postId/comments`              | `CommentSummary` |
| `GET /posts/:postId/comments`               | `CommentList`    |
| `PATCH /posts/:postId/comments/:commentId`  | `CommentSummary` |
| `DELETE /posts/:postId/comments/:commentId` | `{ success }`    |
| `PUT /posts/:postId/reactions/me`           | `ReactionState`  |
| `DELETE /posts/:postId/reactions/me`        | `ReactionState`  |

`CommentSummary` is `{ id, postId, authorUserId, authorName, content,
createdAt, updatedAt }`; `CommentList` is `{ items, nextCursor }` with the
same `limit`/`cursor` params as the feed, **oldest first** (a thread reads
top-down). Anyone who can view the post can comment; only the comment's
author edits or deletes it (post-author moderation is an open product
call). All routes 404 on posts the caller cannot view — same rule as
everywhere else.

Reactions: one per user per post — `PUT .../reactions/me` with
`{ type: LIKE | LOVE | HAHA | WOW | SAD }` sets or changes it, `DELETE`
removes it (idempotent). Both return
`{ myReaction, reactionCount }` so the UI can update optimistically and
reconcile.

### Life Profiles — `apps/api/src/profile/` (task 1.6.2 API side)

| Route                                                 | Returns         |
| ----------------------------------------------------- | --------------- |
| `GET /me/profile`                                     | `ProfileDetail` |
| `PATCH /me/profile`                                   | `ProfileDetail` |
| `GET /families/:familyId/members/:memberId/profile`   | `ProfileDetail` |
| `PATCH /families/:familyId/members/:memberId/profile` | `ProfileDetail` |

`ProfileDetail` is `{ id, userId, memberId, displayName, bio,
interests: string[], birthDate, deathDate, updatedAt }`.

Display rule (domain-model.md): a **linked** member's route serves their
**global** profile — the same one `/me/profile` edits — while a
**placeholder** serves its family-local wiki profile (`memberId` set,
`userId` null).

Editing: placeholder profiles are wiki-editable by any member of the
family; a linked member's profile is editable only by that member (403
otherwise). Every successful PATCH writes an `EditHistory` row (editor +
snapshot) — no history UI yet, but the log exists from day one.

PATCH semantics: omitted = unchanged, `null` clears a date, `''` clears
the bio, `interests` replaces the whole list. Dates are strict ISO 8601;
`deathDate` before `birthDate` is a 400. `birthDate`/`deathDate` here are
the single source the special-date widgets (1.2.5) and Sprint-3 reminders
will derive from.

### Media — `apps/api/src/media/` (task 1.5.3, merged in PR #5)

| Route                 | Returns        |
| --------------------- | -------------- |
| `POST /media`         | `MediaSummary` |
| `GET /media/:mediaId` | file stream    |

Upload is `multipart/form-data` with a single `file` field. Accepted:
jpeg/png/webp/gif/heic, mp4/mov, mp3/m4a/aac/wav — **100MB max for any
type** (413 beyond, 415 for other types). `MediaSummary` is
`{ id, mimeType, sizeBytes, createdAt }`; upload first, then pass the ids
as `mediaIds` when creating the post.

Download requires a bearer token and the same visibility as the parent
post (uploader always allowed; standalone media is uploader-only), and
supports **HTTP Range / 206** — hand the URL plus the auth header to the
video/audio player.

## What does not exist yet

This is the part that decides what can actually be wired. Nothing below has
an endpoint, so no amount of frontend work will connect these screens.

### Blocking a screen that is already built

| Screen                               | Needs                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Family tree** (`family.tsx`)       | ~~`GET` for relationships~~ — **resolved**: `GET /families/:familyId/tree` returns nodes + edges (task 1.4.1). Remaining: the kinship-label derivation below.         |
| **Verify code** (`verify.tsx`)       | Send / confirm an email code. Registration returns tokens immediately today, so the screen has nothing to call.                                                       |
| **Forgot + reset password**          | ~~WBS 1.1.7~~ — **resolved**: `POST /auth/password-reset/{request,verify,confirm}` (email infrastructure decided 2026-08-18: SMTP/Gmail).                             |
| **Invitation** (`invite/[code].tsx`) | A public read of an invite code — who invited you, which family, which spot. `POST /families/join` both requires a token and joins immediately, so it cannot preview. |
| **Life Profile** (`member/[id].tsx`) | ~~LifeProfile~~ — **resolved** (profile routes above, task 1.6.2). Still missing: LifeEvent (1.6.8), the derived gallery (1.6.4), Memo (1.6.5).                       |
| **New moment** (`(tabs)/new.tsx`)    | ~~Post + media upload~~ — **resolved**: `POST /media` then `POST /posts` (tasks 1.5.2–1.5.5, PR #5).                                                                  |
| **Home**                             | ~~moments feed~~ — **resolved**: `GET /families/:familyId/posts` (task 1.2.3). Still missing: SpecialDate widgets and recommendations.                                |
| **AI tab + gift ideas**              | The whole of `apps/ai` — the FastAPI service does not exist.                                                                                                          |

### The relationship-label question

`RelationshipType` is `PARENT | SPOUSE | SIBLING | ADOPTED_PARENT |
STEP_PARENT | OTHER`. The UI shows kinship words — "Grandmother",
"Sister" — which are **derived** from those edges plus the direction of
travel and the viewer's position. They are not stored and the API does not
return them.

So the app owns that derivation, and it has to be done in the catalogue
rather than in English: `祖母` is not a translation of "grandmother" that a
string table can reach if the noun arrives from the server already in
English.

**Decided 2026-08-18**: the MVP shows the **base relationship only** —
parent, child, spouse, sibling and the exception types — translated
directly from `RelationshipType` plus the direction of the edge. It does
not walk the graph, so "Grandmother", "Aunt" and "Cousin" do not appear.
The consequence to accept is that a node with no direct edge to the viewer
shows its name with no role line under it. Revisit once a real family has
used the tree.

## Wiring order

1. ~~`configureApi` once in `app/_layout.tsx`~~ — **done 2026-08-18**, at
   module scope, because a child's effect can fire a request before the
   root component's own effects run.
2. ~~Real session~~ — **done 2026-08-18**. Tokens in `expo-secure-store`;
   refresh on 401 behind a single-flight gate; sign out when refresh itself
   fails.
3. ~~`QueryClientProvider` + hooks~~ — **done 2026-08-18** for families,
   family tree and the family feed.
4. Screens swap a fixture import for a hook, and gain the loading and
   error states they did not have. **In progress** — per-screen status lives
   in `docs/01-frontend/architecture.md` § Wiring status, so it stays next
   to the code it describes instead of in this shared file.
