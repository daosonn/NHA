# Domain Model

> Status: core decisions settled (2026-08-13). Items under "Open Questions"
> are intentionally undecided; do not invent answers during implementation
> (see `CLAUDE.md` § 1).

Core domain terms are defined in `CLAUDE.md` § 2 (User, Family, Member,
Relationship, LifeProfile, LifeEvent, Memory, Media, Album). This document
records how those entities relate as decisions are made.

## Decided

### Family = group (decided 2026-08-13)

- A **Family** works like a group/workspace: created by a user, joined via
  invite code.
- A user can belong to **multiple families** (many-to-many).
- Each family has its own **family tree**; members are nodes in that tree.

### User ↔ Member (decided 2026-08-13)

- A **Member** (tree node) can exist without an account — created on behalf
  of people who may never log in (elderly relatives, young children,
  deceased family members). These are **placeholder members**.
- When a real person joins a family, they can be **linked** to an existing
  placeholder node (assigned their position in the tree), or added as a new
  node.

### Life Profile is global — one per person (decided 2026-08-13)

- A person has **one Life Profile**, owned by their account, displayed in
  every family they belong to.
- **On linking** an account to a placeholder: the placeholder's biography /
  profile info is **replaced** by the owner's canonical profile. Memories,
  photos, and posts that family members had attached to the placeholder are
  **kept** — no loss of contributed content.
- Placeholder members (no account) have a family-local profile until linked.
  The same person existing as placeholders in two families remains two
  separate placeholders (there is no account to unify them).

### Managing placeholder profiles — wiki-style (decided 2026-08-13)

- Any member of the family can edit a placeholder member's profile
  (biography, life events, etc.). No manager/ACL concept in the MVP.
- Once linked to an account, the profile belongs to that account's owner.
- **Edit history is stored from the start** (decided 2026-08-14): every
  profile/life-event edit writes an `EditHistory` row (editor + snapshot)
  so history display/undo can be added later; no history UI in the MVP.

### Relationships (decided 2026-08-13)

- Whoever adds a member sets their relationships. The tree renders
  automatically from the stored relationships.
- Base types: parent/child, spouse, sibling. **Exceptional types are
  allowed** (adopted child, step-parent, extended relatives, …).
- When a member leaves (or is removed from) a family, their node is removed
  from that family's tree.

### Content & privacy (decided 2026-08-13)

- Posting: the author chooses **which family/families** (one or more) a
  post/memory goes to. Re-confirmed 2026-08-14: arbitrary selection; the
  composer's "public to all groups" is a UI shortcut that selects all
  current groups (snapshot at post time — families joined later do not see
  older posts).
- Within a family, **all shared content is visible to all members** — no
  per-item permissions in the MVP.
- **Personal archive is private by default**; the owner explicitly moves or
  shares content out of it.

### Albums & photo surfaces (decided 2026-08-14)

Three distinct concepts:

- **Family memory library** ("kho ký ức gia đình") — one per family: all
  media aggregated from the posts shared to that family (screen 13). A
  derived view — content enters it by posting; no manual "add", no table.
  The **Omoide tab renders this library as "album books"** (decided
  2026-08-14): automatic grouping only (rule — by time/event — chosen at
  UI design); books are presentation, not a stored entity.
- **Personal albums** — **private to their owner**, never shown to anyone
  else: user-created collections, items added manually (`Album` +
  `AlbumItem` tables — see `database.md`).
- **Profile gallery / timeline photos** (screen 8) — derived from the
  member's shared content (posts authored/tagged + life events), visible
  according to each post's family scope. Not the private albums.

Personal albums contain **only media the owner uploaded** (decided
2026-08-14): to keep another member's shared photo, download and re-upload
it — no cross-owner references.

### Memo = private notes about a person (decided 2026-08-14)

- A memo is the author's **private note about a family member** (e.g.
  interests, stories, gift ideas), optionally with photos.
- **Only the author can view and edit** (decided 2026-08-14): memos are
  never shared — WBS task 1.6.6 (private/shared) is dropped. Distinct from
  posts — a memo annotates a person, it is not shared content. May feed AI
  gift/care suggestions later.

### Plans (decided 2026-08-14; **feature dropped 2026-08-20**)

**Not being built.** Quality Time (WBS 2.6) was dropped on 2026-08-20, and
a Plan only ever existed to hold its output — see `project-status.md` →
Important Decisions. Every AI suggestion the product ships is now
read-once. The rules below stand as the record of the decision, and as the
starting point if this is revived.

- AI-drafted plans (surprise / quality time) are **saved** — they are
  followed over days, not read-once suggestions like gift ideas.
- **Private to their creator**; only the creator can edit and choose to
  share. Sharing grants **view-only** access to chosen users (accounts) —
  e.g. the co-conspirators of a surprise; the target stays excluded by the
  owner's choice.

### Special dates & widgets (decided 2026-08-14)

- Upcoming special occasions render as **themed countdown widgets** on the
  family home (e.g. ANNIVERSARY · bunting · "in 3 days · 50th
  anniversary").
- **Birthdays and memorials are derived automatically** from
  `LifeProfile.birthDate` / `deathDate`; **anniversaries and custom
  occasions are user-created** (`SpecialDate` in `database.md`).
- Occasions recur annually; they feed reminders (Sprint 3) and the Special
  Date Detail screen (screen 17).
- Dates are **solar (Gregorian) only** — the product targets the Japanese
  market (decided 2026-08-14); no lunar-calendar support needed.
  **Reaffirmed 2026-08-18** after the Occasions mockups (9e/9f/9g) turned up
  showing lunar dates: the mockups are what changes, not the schema. The
  lunar toggle, the "Lunar" pill and the "lunar 10/2" line come out of the
  design before those screens are built.

## Open Questions

- **Leave semantics**: when a member's node is removed, what happens to
  (a) relationships that routed through them (e.g. the link between their
  parents and children), and (b) content they had posted to that family?
- **Time-capsule unlock semantics**: who can see that a locked box exists;
  what happens if the recipient has no account at unlock time.
- ~~**"Plan a surprise" data sources**~~ (AI hub mock, 2026-08-14) —
  **closed 2026-08-20 by dropping the feature.** The mock copy assumed
  known availability ("Lan and Minh are free on Sunday") and distances
  ("Grandma's house is 40 minutes away"), neither of which is stored
  anywhere; the options on the table were a `MemberAvailability` table, an
  `address` on profiles plus a maps API, or calendar integration. None is
  needed now — Quality Time is not being built, and the surprise-plan
  screen goes with it. Gift ideas and celebration-video cards never needed
  anything new (Memo counts, birthDate, media counts).

Fill in sections here as each question is decided, and update
`docs/project-status.md` → Important Decisions.
