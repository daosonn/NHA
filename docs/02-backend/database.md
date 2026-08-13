# Database Design

> Status: designed for **Sprint 1** in detail (2026-08-13); later sprints are
> sketched only. The actual Prisma schema is written when Sprint 1 starts —
> this document is the design reference, `apps/api/prisma/schema.prisma` is
> the source of truth once implemented. All schema changes go through Prisma
> migrations (`CLAUDE.md` § 9.8).

Grounded in the decisions of `docs/00-shared/domain-model.md`:
one global Life Profile per person, placeholder members (no account),
multi-family membership, wiki-editable placeholders, post-to-chosen-families
privacy.

## Sprint 1 Entities (detailed)

### User — authenticated account

| Field        | Type     | Notes                       |
| ------------ | -------- | --------------------------- |
| id           | uuid PK  |                             |
| email        | string   | unique                      |
| passwordHash | string   | argon2/bcrypt — never plain |
| name         | string   |                             |
| avatarKey    | string?  | Media storage key           |
| createdAt    | datetime | `@default(now())`           |
| updatedAt    | datetime | `@updatedAt`                |

Google OAuth is deferred (not in the 3-sprint WBS). When added, create a
separate `OAuthAccount` table (userId, provider, providerAccountId) — no
change to `User` needed.

### RefreshToken — JWT refresh tokens, revocable

| Field     | Type      | Notes                                 |
| --------- | --------- | ------------------------------------- |
| id        | uuid PK   |                                       |
| userId    | uuid FK   | → User, cascade delete                |
| tokenHash | string    | store hash, never the raw token       |
| expiresAt | datetime  |                                       |
| revokedAt | datetime? | set on logout / rotation / compromise |
| createdAt | datetime  |                                       |

Index on `userId`. Logout = revoke; refresh rotation recommended.

### Family — family space (group)

| Field                 | Type     | Notes                  |
| --------------------- | -------- | ---------------------- |
| id                    | uuid PK  |                        |
| name                  | string   |                        |
| inviteCode            | string   | unique — join via code |
| createdById           | uuid FK  | → User                 |
| createdAt / updatedAt | datetime |                        |

### FamilyMember — a person's node in one family's tree

| Field       | Type     | Notes                                                  |
| ----------- | -------- | ------------------------------------------------------ |
| id          | uuid PK  |                                                        |
| familyId    | uuid FK  | → Family, cascade delete                               |
| userId      | uuid? FK | → User. **null = placeholder** (no account)            |
| displayName | string   | shown in tree; for linked members may mirror User.name |
| avatarKey   | string?  |                                                        |
| birthDate   | date?    | needed for Sprint 3 birthday reminders                 |
| deathDate   | date?    | deceased members are placeholders                      |
| joinedAt    | datetime |                                                        |

Constraints: `unique(familyId, userId)` (a user appears once per family).
A user in N families has N `FamilyMember` rows — this is the decided
multi-family model.

**Linking flow** (account claims a placeholder): set `userId` on the
placeholder row → its placeholder `LifeProfile` is deleted (bio replaced by
the user's global profile), while Posts/Media tagged to the member row are
kept — they reference `memberId`, which doesn't change.

### LifeProfile — one global profile per person; family-local for placeholders

| Field                 | Type     | Notes                                          |
| --------------------- | -------- | ---------------------------------------------- |
| id                    | uuid PK  |                                                |
| userId                | uuid? FK | global profile — exactly one per user          |
| memberId              | uuid? FK | placeholder profile — one per unlinked member  |
| bio                   | text?    |                                                |
| interests             | json?    | simple list for MVP; AI suggestions come later |
| createdAt / updatedAt | datetime |                                                |

Constraint: **exactly one of `userId` / `memberId` is set** (XOR — enforced
in service layer + a DB check constraint). Unique on each.
Display rule: linked member → show the user's global profile; placeholder →
show its member profile (wiki-editable by the family).

### Relationship — edges of the family tree

| Field        | Type    | Notes                                                       |
| ------------ | ------- | ----------------------------------------------------------- |
| id           | uuid PK |                                                             |
| familyId     | uuid FK | scoped per family tree                                      |
| fromMemberId | uuid FK | → FamilyMember                                              |
| toMemberId   | uuid FK | → FamilyMember                                              |
| type         | enum    | PARENT, SPOUSE, SIBLING, ADOPTED_PARENT, STEP_PARENT, OTHER |
| label        | string? | free text when type = OTHER (họ hàng xa, …)                 |

Constraints: `unique(familyId, fromMemberId, toMemberId, type)`;
`fromMemberId ≠ toMemberId`. Direction convention: PARENT means
_from is a parent of to_. SPOUSE/SIBLING are symmetric — store once,
normalize direction in service layer.
Removing a member from the family deletes their node and edges (decided
leave-behavior for the tree; content handling is still an open question in
`domain-model.md`).

### Post — content item (posts and events; reused by Memories in Sprint 2)

| Field                 | Type      | Notes                        |
| --------------------- | --------- | ---------------------------- |
| id                    | uuid PK   |                              |
| authorUserId          | uuid FK   | → User                       |
| type                  | enum      | POST, EVENT                  |
| content               | text?     |                              |
| eventDate             | datetime? | for type = EVENT (WBS 1.5.4) |
| eventTitle            | string?   | for type = EVENT             |
| createdAt / updatedAt | datetime  |                              |

**PostFamily** (junction): postId + familyId, unique pair — a post can be
shared to **multiple families** (decided). A post with **no** PostFamily
rows is private to its author (visibility "riêng tư", WBS 1.5.5).
Within a family, all members see all its posts — no per-item ACL (decided).

**PostMemberTag** (junction): postId + memberId — tagging members; content
attached to a member survives account-linking (see FamilyMember).

> Sprint 2 note: the Memories page (WBS 2.1) should **reuse this table**
> (filter/group by family, member tags, time), not create a separate
> `Memory` model — same content shown in multiple contexts without
> duplication (`product-overview.md` § 7).

### Media — uploaded files (storage-agnostic)

| Field          | Type     | Notes                                                    |
| -------------- | -------- | -------------------------------------------------------- |
| id             | uuid PK  |                                                          |
| uploaderUserId | uuid FK  | → User                                                   |
| postId         | uuid? FK | → Post, cascade — null = unattached (e.g. avatar)        |
| storageKey     | string   | key/path in the storage backend — never a hard-coded URL |
| mimeType       | string   |                                                          |
| sizeBytes      | int      |                                                          |
| createdAt      | datetime |                                                          |

**Storage backend**: access media only through a storage service module in
NestJS. Recommendation for the MVP demo: local disk on the API server;
swap to an S3-compatible bucket later without schema changes (only the
storage service changes). Final choice tracked in
`docs/04-devops/deployment.md`.

### Memo — personal archive item (WBS 1.6.5)

| Field                 | Type     | Notes                                        |
| --------------------- | -------- | -------------------------------------------- |
| id                    | uuid PK  |                                              |
| ownerUserId           | uuid FK  | → User                                       |
| content               | text     |                                              |
| isShared              | boolean  | default false — private by default (decided) |
| createdAt / updatedAt | datetime |                                              |

May later merge into `Post` (a private post ≈ a memo); kept separate for
Sprint 1 to match the WBS.

## Sprint 2–3 Sketch (tables only — design when the sprint starts)

- **VideoJob** (Sprint 2.2): requesterUserId, selected media ids, status
  (PENDING/PROCESSING/DONE/FAILED), resultStorageKey — async generate job.
- **MemoryBox** (deferred — time capsule not in WBS): box + items +
  unlockAt; see open question in `domain-model.md`.
- **Notification** (Sprint 3.1): recipientUserId, type, payload json,
  readAt? — list + badge.
- **Reminder** (Sprint 3.2–3.3): derived from FamilyMember.birthDate and
  Event.eventDate + care-reminder rules; likely generated into Notification
  rather than a big standalone model.
- AI suggestion features (Sprint 2.3–2.6) are request/response — no
  persistent tables required for MVP beyond logging, if desired.

## Design Rules

- Every schema change = Prisma migration, committed with the code.
- IDs are uuid (matches existing `User` model).
- Do not expose Prisma models directly as API contracts — map through DTOs
  (`CLAUDE.md` § 5).
