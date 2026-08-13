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

### Relationships (decided 2026-08-13)

- Whoever adds a member sets their relationships. The tree renders
  automatically from the stored relationships.
- Base types: parent/child, spouse, sibling. **Exceptional types are
  allowed** (adopted child, step-parent, extended relatives, …).
- When a member leaves (or is removed from) a family, their node is removed
  from that family's tree.

### Content & privacy (decided 2026-08-13)

- Posting: the author chooses **which family/families** (one or more) a
  post/memory goes to.
- Within a family, **all shared content is visible to all members** — no
  per-item permissions in the MVP.
- **Personal archive is private by default**; the owner explicitly moves or
  shares content out of it.

## Open Questions

- **Leave semantics**: when a member's node is removed, what happens to
  (a) relationships that routed through them (e.g. the link between their
  parents and children), and (b) content they had posted to that family?
- **Wiki edit safety**: does placeholder editing need history/undo, or is
  raw trust acceptable for the MVP?
- **Time-capsule unlock semantics**: who can see that a locked box exists;
  what happens if the recipient has no account at unlock time.

Fill in sections here as each question is decided, and update
`docs/project-status.md` → Important Decisions.
