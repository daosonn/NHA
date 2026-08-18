# API Contract

What `apps/mobile` may assume about `apps/api`, and — just as important —
what it may not.

The client-side mirror of this document is `apps/mobile/src/lib/api/`:
`types.ts` (the shapes), `endpoints.ts` (one function per route),
`client.ts` (fetch, bearer token, errors). Those files were written from the
NestJS controllers and DTOs, not from a wish list. When the server changes,
both move together.

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

Twenty-two routes, all verified against the source.

### Auth — `apps/api/src/auth/`

| Route                                | Auth | Returns       |
| ------------------------------------ | ---- | ------------- |
| `POST /auth/register`                | —    | `AuthResult`  |
| `POST /auth/login`                   | —    | `AuthResult`  |
| `POST /auth/refresh`                 | —    | `AuthResult`  |
| `POST /auth/logout`                  | ✔    | `{ success }` |
| `GET /auth/oauth/:provider`          | —    | redirect      |
| `GET /auth/oauth/:provider/callback` | —    | `AuthResult`  |

`AuthResult` is `{ user: { id, email, name }, accessToken, refreshToken }`.

Refresh is **single-use rotation**: the old token is revoked as the new pair
is issued, so the response has to be stored before anything else is
attempted. A dropped response costs the session.

Social login is a browser redirect, not a fetch. Providers are Google and
Facebook; a provider with no client ID configured returns 503.

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
eventTitle, place, familyIds, taggedMemberIds, media[], createdAt,
updatedAt }` with `media[]` items `{ id, mimeType, sizeBytes }`.

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
| **Forgot + reset password**          | WBS 1.1.7, deferred pending an email-infrastructure decision.                                                                                                         |
| **Invitation** (`invite/[code].tsx`) | A public read of an invite code — who invited you, which family, which spot. `POST /families/join` both requires a token and joins immediately, so it cannot preview. |
| **Life Profile** (`member/[id].tsx`) | LifeProfile, LifeEvent, the derived gallery, Memo.                                                                                                                    |
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
English. Flagged in `docs/01-frontend/architecture.md` § Language; still
needs a decision before the tree is wired.

## Wiring order, when the time comes

1. `configureApi({ baseUrl, getAccessToken })` once in `app/_layout.tsx`.
2. Real session in `src/features/auth/session.tsx`: tokens to
   `expo-secure-store`, never `AsyncStorage` (`CLAUDE.md` § 5). Refresh on
   401, sign out when refresh itself fails.
3. `QueryClientProvider`, then one hook per endpoint under
   `src/features/<feature>/`.
4. Screens swap a fixture import for a hook, and gain the loading and
   error states they do not have yet.

Steps 1–2 are auth work and land with the AuthModule wiring. Step 4 is per
screen and is only possible for screens whose endpoints exist.
