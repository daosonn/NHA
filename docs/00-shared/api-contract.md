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

Fourteen routes, all verified against the source.

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

## What does not exist yet

This is the part that decides what can actually be wired. Nothing below has
an endpoint, so no amount of frontend work will connect these screens.

### Blocking a screen that is already built

| Screen                               | Needs                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Family tree** (`family.tsx`)       | **`GET` for relationships.** There is `POST` and `DELETE` but no read, and `FamilyDetail` returns `members` only. The tree is drawn from edges, so it cannot be built from the API as it stands. |
| **Verify code** (`verify.tsx`)       | Send / confirm an email code. Registration returns tokens immediately today, so the screen has nothing to call.                                                                                  |
| **Forgot + reset password**          | WBS 1.1.7, deferred pending an email-infrastructure decision.                                                                                                                                    |
| **Invitation** (`invite/[code].tsx`) | A public read of an invite code — who invited you, which family, which spot. `POST /families/join` both requires a token and joins immediately, so it cannot preview.                            |
| **Life Profile** (`member/[id].tsx`) | LifeProfile, LifeEvent, the derived gallery, Memo.                                                                                                                                               |
| **New moment** (`(tabs)/new.tsx`)    | Post + PostFamily + media upload.                                                                                                                                                                |
| **Home**                             | SpecialDate widgets, recommendations, the moments feed.                                                                                                                                          |
| **AI tab + gift ideas**              | The whole of `apps/ai` — the FastAPI service does not exist.                                                                                                                                     |

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
