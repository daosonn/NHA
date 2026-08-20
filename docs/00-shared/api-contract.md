# API Contract

What `apps/mobile` may assume about `apps/api`, and — just as important —
what it may not.

The client-side mirror of this document is `apps/mobile/src/lib/api/`:
`types.ts` (the shapes), `endpoints.ts` (one function per route),
`client.ts` (fetch, bearer token, refresh, errors). Those files were written
from the NestJS controllers and DTOs, not from a wish list. When the server
changes, both move together.

**The mirror is two route groups behind as of 2026-08-19**: password reset
(three routes, PR #12) and `GET /families/:familyId/special-dates` are on the
server and absent from `endpoints.ts`. Both are documented below; neither is
callable from the app yet.

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

Password reset is the three-step flow of screen 3 (added 2026-08-18
after the replay above — verified by server-side smoke test, not yet
replayed from the mobile client). `request` emails a 6-digit code and
answers success **whether or not the email exists** (no
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
read the tree screen needs (task 1.4.1, merged 2026-08-18). Each member in
`members` carries `pending: boolean` (added 2026-08-19): `true` while a
live per-spot invitation reserves that node — the dashed-node-with-clock
state in `design-system.md`.

### Invitations — `apps/api/src/family/` (task 1.4.4, added 2026-08-19)

The per-spot invite flow (Important Decisions 2026-08-18): a specific
person is invited to a specific reserved tree node, so the receiving page
can say who invited them, as what, and where they land.
`Family.inviteCode` stays as the open "anyone with the link" join path;
invitation codes are separate, same 8-char alphabet.

| Route                                             | Auth | Returns                      |
| ------------------------------------------------- | ---- | ---------------------------- |
| `POST /families/:familyId/invitations`            | ✔    | `InvitationSummary`          |
| `GET /families/:familyId/invitations`             | ✔    | `InvitationSummary[]`        |
| `POST /families/:familyId/invitations/:id/resend` | ✔    | `InvitationSummary`          |
| `DELETE /families/:familyId/invitations/:id`      | ✔    | `{ success, memberRemoved }` |
| `GET /invitations/:code`                          | —    | `InvitationPreview`          |
| `POST /invitations/:code/accept`                  | ✔    | `JoinFamilyResult`           |

Create body: `{ name, relationshipType, kinshipKey?, newMemberIsFrom?,
relationshipLabel?, memberId? }`. Sending an invite **reserves the spot
immediately** (design-system.md): the server creates the placeholder
member and its relationship edge to the inviter in the same transaction —
the tree shows the node as `pending` from that moment. `newMemberIsFrom`
is the edge direction from `fixtures/invite.ts` (Mother `true`, Daughter
`false`). Pass `memberId` instead to invite an existing placeholder to
its spot (no new edge). One live invitation per spot — a second is a 409.

`InvitationSummary` is `{ id, familyId, memberId, code, name,
relationshipType, kinshipKey, status, inviterName, expiresAt, createdAt }`.
`status` is `PENDING | ACCEPTED | CANCELLED | EXPIRED`; `EXPIRED` is
derived from `expiresAt` at read time, never stored. Invitations live
**7 days**; resend starts the week over on the same code.

`GET /invitations/:code` is **public** — the invitation page is opened by
someone with no account. It answers only while the invitation is live
(pending and unexpired); accepted, cancelled and expired codes 404, so a
dead link stops leaking names. `InvitationPreview` is `{ code, familyName,
inviterName, name, relationshipType, kinshipKey, memberCount, momentCount,
parents[], siblings[], expiresAt }` — `parents`/`siblings` are display
names from the spot's direct edges only (kinship stays basic).
`kinshipKey` is the picker word ("sister") — display-only, the client
translates it; the stored edge is always the base `relationshipType`.

Accepting joins the family **on the reserved spot** — same link operation
as `POST /families/join` with `linkMemberId`, so everything written about
the placeholder is kept. Cancelling an untouched reserved spot deletes the
placeholder (the node falls back to Empty); a spot that already
accumulated content (tags, memos, life events) survives as an ordinary
placeholder and only the invitation dies — the response says which with
`memberRemoved`.

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

The same route is the **Memories API** (task 2.1.2, added 2026-08-19 —
Memories reuse `Post`, no separate model): three optional filters narrow
the same posts. `?memberId` = one member's memories — posts they are
tagged in (under **any** of their member rows when account-linked, the
same identity rule as the gallery), plus posts they authored (404 if the
member is not in this family). `?from` / `?to` = calendar days
(`YYYY-MM-DD`, 400 for datetimes; 400 when from > to), bounding the
**posted** date in **UTC** — the same grouping choice Omoide made,
because the server has no capture metadata. (Known consequence, flagged
as a team question: a JST evening post lands on the previous UTC day.)
`?type` = `POST | EVENT`. Filters combine, and pagination works
unchanged — but a `nextCursor` is **filter-bound**: reuse it only with
the same filter set, or pagination may end early.

`PostDetail` is `{ id, authorUserId, authorName, type, content, eventDate,
eventTitle, place, familyIds, taggedMemberIds, media[], commentCount,
reactionCount, myReaction, canEdit, canDelete, createdAt, updatedAt }` with
`media[]` items `{ id, mimeType, sizeBytes }`. `myReaction` is the viewer's
own reaction (`null` when they have not reacted) — it differs per viewer.
`canEdit`/`canDelete` (added 2026-08-19) say whether the requesting user may
edit/delete: the app renders these instead of comparing `authorUserId`
against the session, so a future rule change stays server-side.

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
canEdit, canDelete, createdAt, updatedAt }` — `canEdit`/`canDelete` carry
the server's permission verdict (author-only today), same rationale as on
`PostDetail`; `CommentList` is `{ items, nextCursor }` with the
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
the bio, `interests` replaces the whole list. Dates are **date-only
`YYYY-MM-DD`** (2026-08-19 — the columns are DATEs; an offset datetime
shifted the stored day, same guard as `LifeEvent.eventDate`);
`deathDate` before `birthDate` is a 400. `birthDate`/`deathDate` here are
the single source the special-date widgets (1.2.5) and Sprint-3 reminders
will derive from.

### Life Events — `apps/api/src/profile/` (task 1.6.8, added 2026-08-19)

The Timeline tab's data: milestones hanging off a LifeProfile, so they
follow the profile everywhere (a linked member's timeline is the same in
every family; a placeholder's is family-local).

| Route                                                               | Returns             |
| ------------------------------------------------------------------- | ------------------- |
| `GET /me/life-events`                                               | `LifeEventDetail[]` |
| `POST /me/life-events`                                              | `LifeEventDetail`   |
| `PATCH /me/life-events/:eventId`                                    | `LifeEventDetail`   |
| `DELETE /me/life-events/:eventId`                                   | `{ success }`       |
| `GET /families/:familyId/members/:memberId/life-events`             | `LifeEventDetail[]` |
| `POST /families/:familyId/members/:memberId/life-events`            | `LifeEventDetail`   |
| `PATCH /families/:familyId/members/:memberId/life-events/:eventId`  | `LifeEventDetail`   |
| `DELETE /families/:familyId/members/:memberId/life-events/:eventId` | `{ success }`       |

`LifeEventDetail` is `{ id, profileId, title, description, eventDate,
place, type, taggedMemberIds, media[], createdById, updatedById,
createdAt, updatedAt }` with `media[]` items `{ id, mimeType, sizeBytes }`.
Lists are **oldest first** (a life timeline reads birth-to-now). `type` is
free text — the taxonomy is still TBD (screen 9 filters). `eventDate` is
**date-only `YYYY-MM-DD`** (400 otherwise): the column is a DATE, and a
datetime with a timezone offset would shift the stored day — `08:00+09:00`
is yesterday in UTC. Title and eventDate are required and not clearable;
PATCHing either to `null` is a 400, and a PATCH that changes nothing
writes no `EditHistory` row.

Same rules as the profile it hangs off:

- **Resolution**: linked member → global timeline (the one `/me` edits),
  placeholder → family-local. Reading needs family membership; `/me`
  works with no family at all.
- **Editing**: placeholder events are wiki-editable by the whole family;
  a linked member's events are theirs alone (403). Every PATCH writes an
  `EditHistory` row; `updatedById` is the last editor.
- **Media**: attach your own unattached uploads via `mediaIds` at
  creation; fixed afterwards, exactly like posts. Deleting the event
  deletes its media rows and files.
- **Tags** (`taggedMemberIds`, "members involved" — screen 10): on the
  member-scoped routes they must belong to **that family** (so every
  viewer can resolve them — same principle as post tags); on `/me` routes,
  any family the editor belongs to. Editable on PATCH (replaces the list).
- **No-op PATCHes are value-checked**: a PATCH that changes nothing (a
  retry, a save with no edits) stamps no editor and writes no EditHistory
  row.

### Memos — `apps/api/src/memo/` (task 1.6.5, added 2026-08-19)

Private notes about a family member ("mẹ thích hoa cúc"). **Always
author-only** (decided 2026-08-14, sharing task 1.6.6 dropped): nobody
else ever sees them, and anything that is not yours 404s — never 403,
because a memo's existence is itself private.

| Route                                              | Returns        |
| -------------------------------------------------- | -------------- |
| `GET /families/:familyId/members/:memberId/memos`  | `MemoDetail[]` |
| `POST /families/:familyId/members/:memberId/memos` | `MemoDetail`   |
| `GET /me/memos`                                    | `MemoDetail[]` |
| `GET /memos/:memoId`                               | `MemoDetail`   |
| `PATCH /memos/:memoId`                             | `MemoDetail`   |
| `DELETE /memos/:memoId`                            | `{ success }`  |

`MemoDetail` is `{ id, aboutMemberId, aboutName, title, content, category,
media[], createdAt, updatedAt }` with `media[]` items
`{ id, mimeType, sizeBytes }`. **Memos survive the member** (decided
2026-08-19): deleting a member — or a linked member leaving — sets
`aboutMemberId` to `null` instead of destroying other people's notes, and
`aboutName` (the name snapshot from write time) keeps the orphaned note
readable. `GET /me/memos` is the home of every note the caller ever wrote,
orphaned ones included (their member route no longer exists).
The list is **most recently touched first** (`updatedAt` desc — the note
written today is the one being looked for), which is why a PATCH that
changes nothing does not bump `updatedAt`. `title` is required and not
clearable; `content` and `category` are nullable (`null` clears).
`category` is the client's vocabulary (hobbies/health/gift/memories/todo
today) stored as free text, like `LifeEvent.type` — the server never
validates the taxonomy. Media attach via `mediaIds` at creation, fixed
afterwards; memo media streams to the **owner only**. Listing requires
membership of the family in the route; the flat `/memos/:id` routes need
only ownership.

The schema grew `title` and `category` for this (migration
`20260819042417`) — the UI's memo cards were designed with a bold title
line and a category chip, and the backend follows the built UI
(same UI-leads principle as invitations).

### Video jobs — `apps/api/src/video-job/` (task 2.2.2, added 2026-08-19)

Generate a video from photos (WBS 2.2). Async: submit, poll, then stream
the result. The render itself is the AI team's, behind the seam in
`docs/03-ai/architecture.md` — the app only ever talks to NestJS.

| Route                 | Returns            |
| --------------------- | ------------------ |
| `POST /video-jobs`    | `VideoJobDetail`   |
| `GET /video-jobs`     | `VideoJobDetail[]` |
| `GET /video-jobs/:id` | `VideoJobDetail`   |

`VideoJobDetail` is `{ id, status, inputMediaIds, resultMediaId, error,
createdAt, updatedAt }`; `status` is
`PENDING | PROCESSING | DONE | FAILED`. Create body:
`{ mediaIds (1–50, order preserved into the render), style? }`.

Semantics:

- Source photos are any **images the requester may view** — own or
  family-shared, the same gate as media streaming (404 with no oracle
  when any is missing/unviewable; 400 for non-images).
- With the AI service unconfigured or **definitely refusing** (connection
  error, non-2xx), create answers `503 { code: "AI_UNAVAILABLE" }` and
  leaves no orphan job — retry is safe. A dispatch **timeout** instead
  returns the job as `PENDING`: submission may have succeeded and the
  callback can still complete it. Jobs and results are private to the
  requester (others 404).
- When `status` is `DONE`, stream the video via
  `GET /media/:resultMediaId` (Range/206 works as usual); the result is
  registered as the requester's own standalone media, so only they can
  play it. `FAILED` carries `error`.

### Gallery — `apps/api/src/gallery/` (task 1.6.4, added 2026-08-19)

The Album tab (screen 8). **Derived, no table** (`database.md` § Profile
gallery & timeline photos) — a different thing from the `Album` model
(screen 11, task 1.6.7, unscheduled), which is a private, user-curated
collection.

| Route                                               | Returns              |
| --------------------------------------------------- | -------------------- |
| `GET /me/gallery`                                   | `GalleryMediaItem[]` |
| `GET /families/:familyId/members/:memberId/gallery` | `GalleryMediaItem[]` |

`GalleryMediaItem` is `{ id, mimeType, sizeBytes, createdAt, postId,
lifeEventId }` — exactly one of `postId`/`lifeEventId` is set (the same
one-parent shape `Media` itself uses), so a tap can open the moment or
milestone a photo came from. Sources, newest first:

- Media of posts **authored by** the member, or **tagged with** them
  (`taggedMemberIds`) — filtered to what the viewer may actually see
  (the same author/private/shared-family rule `PostService.canViewPost`
  applies elsewhere, batched into one membership query here).
- Media attached to the member's **life events** — no extra filter beyond
  reaching the profile at all, since both routes already establish that
  (self, or a family shared with the member via
  `ProfileService.resolveForMember`/`canViewProfileContent`).

Same profile resolution as the rest of the Life Profile (linked → global
gallery across every family they are in, placeholder → family-local).
**Not paginated** — one person's own history, the same choice already
made for their life-event timeline (unlike the family feed, which is
shared and high-volume).

### Albums — `apps/api/src/album/` (task 1.6.7, added 2026-08-19)

Personal, user-curated, **always private** collections (decided
2026-08-14) — never shown on any profile. A different thing from the
derived gallery above. No screen exists yet (screens.md #11 sketches only
a "choose album" step inside Post a Moment); this ships from the spec.

| Route                                       | Returns          |
| ------------------------------------------- | ---------------- |
| `GET /me/albums`                            | `AlbumSummary[]` |
| `POST /me/albums`                           | `AlbumDetail`    |
| `GET /me/albums/:albumId`                   | `AlbumDetail`    |
| `PATCH /me/albums/:albumId`                 | `AlbumDetail`    |
| `DELETE /me/albums/:albumId`                | `{ success }`    |
| `POST /me/albums/:albumId/items`            | `AlbumDetail`    |
| `DELETE /me/albums/:albumId/items/:mediaId` | `{ success }`    |

`AlbumSummary` is `{ id, name, description, coverMediaId, itemCount,
createdAt, updatedAt }`; `AlbumDetail` adds `items[]` of
`{ mediaId, mimeType, sizeBytes, addedAt }`, newest-added first. Lists
are most recently touched first (same convention as memos). Anything not
yours 404s — existence is private, like a memo.

Semantics:

- **Items are your own uploads only** (database.md content rule): a
  post's photo or a standalone upload; another member's shared photo must
  be downloaded and re-uploaded. Unlike posts/memos/life-events, an
  album is **not** an exclusive media parent — already-attached media can
  be added, and one media can sit in many albums.
- Adding an item already in the album is a **no-op**, not a 409; removing
  an item not in the album is still a success (reaction-style
  idempotency).
- `coverMediaId` must be one of the album's items (400 otherwise), and is
  cleared automatically when that item is removed. `null` clears it.
- Deleting an album deletes only the organization — the underlying media
  rows and files are untouched.

### Special dates — `apps/api/src/special-date/` (task 1.2.5 API side)

| Route                                   | Returns                |
| --------------------------------------- | ---------------------- |
| `GET /families/:familyId/special-dates` | `UpcomingSpecialDates` |

`UpcomingSpecialDates` is `{ items: SpecialDateItem[] }`, soonest first,
`?limit` 1–50 (default 10). Each item:
`{ source: 'DERIVED'|'CUSTOM', type, title, month, day, originYear,
ordinal, theme, nextOccurrence, daysUntil, members[] }` with `members[]`
items `{ memberId, displayName }`.

- **DERIVED** items come from LifeProfile dates: a birthday per living
  member with a `birthDate` (theme `CONFETTI_CANDLES`), a memorial per
  member with a `deathDate` (theme `FLORAL_BORDER`). A deceased member
  gets a memorial only, no birthday. No rows are stored.
- **CUSTOM** items are `SpecialDate` rows (anniversaries etc.). Their
  CRUD ships with Sprint 3 (task 3.2.3) — until then the table is
  normally empty.
- `title` is only set on CUSTOM items. **Derived items carry no text**:
  build the label client-side from `type`, `members` and `ordinal`
  ("Dad turns 63", 三回忌) — i18n lives in the app, per the
  relationship-label principle.
- `nextOccurrence` (YYYY-MM-DD) and `daysUntil`/`ordinal` are computed
  at request time, never stored. Feb 29 occurrences roll to Mar 1 in
  non-leap years.

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
video/audio player. Life-event media (2026-08-19) follows the profile it
hangs off: the owner and anyone sharing a family with them for a global
profile, the family's members for a placeholder.

## What does not exist yet

This is the part that decides what can actually be wired. Nothing below has
an endpoint, so no amount of frontend work will connect these screens.

### Blocking a screen that is already built

| Screen                               | Needs                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Family tree** (`family.tsx`)       | ~~`GET` for relationships~~ — **resolved**: `GET /families/:familyId/tree` returns nodes + edges (task 1.4.1). Remaining: the kinship-label derivation below.                                                                                                                                 |
| **Verify code** (`verify.tsx`)       | Send / confirm an email code for **sign-up**. Registration returns tokens immediately today, so that half of the screen has nothing to call. The reset half now has endpoints — see the row below.                                                                                            |
| **Forgot + reset password**          | ~~WBS 1.1.7~~ — **resolved on the server**: `POST /auth/password-reset/{request,verify,confirm}` (email infrastructure decided 2026-08-18: SMTP/Gmail). **The app is not wired to them**: `endpoints.ts` has no password-reset group, and the three screens only navigate between themselves. |
| <<<<<<< HEAD                         |
| **Invitation** (`invite/[code].tsx`) | ~~A public read of an invite code~~ — **resolved** (task 1.4.4, PR #16) **and wired 2026-08-19**: preview, accept, create, list and resend. Nothing outstanding.                                                                                                                              |
| **Life Profile** (`member/[id].tsx`) | ~~LifeProfile~~, ~~LifeEvent~~, ~~Memo~~ — all **resolved and wired 2026-08-19**. The gallery (1.6.4) is built from the family feed instead; see § Requests from the app below for what that costs and what two profile fields the design needs.                                              |
| =======                              |
| **Invitation** (`invite/[code].tsx`) | ~~A public read of an invite code~~ — **resolved**: `GET /invitations/:code` previews and `POST /invitations/:code/accept` joins on the reserved spot (task 1.4.4, PR #16). The app is not wired to them yet.                                                                                 |
| **Life Profile** (`member/[id].tsx`) | ~~LifeProfile~~ — **resolved** (task 1.6.2). ~~LifeEvent~~ — **resolved** (task 1.6.8). ~~Memo~~ — **resolved** (task 1.6.5). ~~Gallery~~ — **resolved** (task 1.6.4). All three tabs plus the header now have an endpoint; none of it is wired.                                              |

> > > > > > > main
> > > > > > > | **New moment** (`(tabs)/new.tsx`) | ~~Post + media upload~~ — **resolved**: `POST /media` then `POST /posts` (tasks 1.5.2–1.5.5, PR #5). |
> > > > > > > | **Home** | ~~moments feed~~ — **resolved and wired**. `GET .../special-dates` exists but the app does not call it, so the widget is still a fixture. Recommendations have no endpoint at all. |
> > > > > > > | **AI tab + gift ideas** | The whole of `apps/ai` — the FastAPI service does not exist. |

### Requests from the app (added 2026-08-19)

Three gaps found while building the Life Profile against mockup 7. None
block a screen — the app ships without them and says on screen what it does
not know — but each costs something visible.

**1. ~~A member's media has to be found by reading the whole feed.~~ —
resolved on the server, twice (noted 2026-08-20).** The ask was for either
shape; **both now exist**:

- `GET /families/:familyId/members/:memberId/gallery` — the dedicated
  route (task 1.6.4, PR #19). Not paginated, and it already includes
  life-event media, which the feed scan never saw.
- `?memberId` on `GET /families/:familyId/posts` — the feed filter (task
  2.1.2, PR #22), matching any of a linked member's rows.

**The app has not switched yet**: the Album tab still pages the feed and
filters on `taggedMemberIds` client-side, bounded at four pages of fifty,
telling the reader when it stopped short. Moving it to the gallery route
removes both the bound and the warning.

**2. `LifeProfile` has no occupation and no birthplace.**
Mockup 7 draws three fact rows: born _with a place_ ("Born 14 March 1964, Y
Yen, Nam Dinh"), occupation ("Carpenter, retired since 2021"), and interests.
Only the date and the interests have columns, so the app draws two rows and
leaves the third out rather than inventing fields. Two nullable strings on
`LifeProfile` — `birthPlace`, `occupation` — would complete the design.

**3. `PostMediaSummary` has no duration.**
The mockup puts a running time on a video cover ("0:24"). The summary is
`{ id, mimeType, sizeBytes }`, so a video tile says "Video" instead. A
`durationSeconds` on video media would let the tile say what the design says.

Also still open from an earlier decision, and worth grouping here: **the
profile PATCH is wider than the app.** `PATCH …/members/:memberId/profile`
accepts an edit from any member of the family, while the app has offered
self-only editing since 2026-08-19. The UI restriction is not a security
boundary; narrowing the server is the real fix.

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
