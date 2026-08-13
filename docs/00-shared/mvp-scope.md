# MVP Scope

> Status: **decided** (2026-08-13) — based on the original product
> specification (12 features / 21 screens) and team discussion. Feature IDs
> (#N) below refer to the original spec's 機能一覧 (feature list).

This document defines what is actually being built for the first release
(MVP), based on the capability list in `product-overview.md` § 16.

## How to use this file

- This scope is decided. Changing a row is a product decision — discuss it
  first, don't edit silently.
- Suggested internal build order: **Foundation → Memory storage → AI**. If
  time runs short, cut from the tail (AI features degrade gracefully — the
  core product must work without them, see `product-overview.md` § 14).
- The 3-sprint plan lives in `docs/sprints/`. Rows marked **"not scheduled
  in Sprints 1–3"** are IN the product scope but have no sprint slot yet —
  the team must either schedule or explicitly defer them before release.

---

## Core

| Capability                         | IN / OUT | Notes                                                                                                                                |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication (register/login)    | IN       | Spec #12. Incl. join-by-invite-code and linking account to existing Member. Google OAuth: **not scheduled in Sprints 1–3 — revisit** |
| Family creation / joining          | IN       | Spec #12, screen 4                                                                                                                   |
| Family members                     | IN       | Members can exist without accounts (created on their behalf) — see `domain-model.md`                                                 |
| Life Profile                       | IN       | Spec #1 — **the core product value**; everything else feeds it                                                                       |
| Life Timeline                      | IN       | Spec #2. Milestone-based timeline **not scheduled in Sprints 1–3** (WBS has content-by-time on profile only) — revisit               |
| Memories (photo/video/audio/story) | IN       | Spec #3 — daily-moment posting                                                                                                       |
| Family Tree                        | IN       | Spec #4 — visualization + navigation to Life Profiles                                                                                |

## Supporting

| Capability                                | IN / OUT | Notes                                                                     |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Albums                                    | IN       | Part of spec #5 (family memory box classification)                        |
| Shared family memory space (Family Space) | IN       | Spec #5 + family home screen (screen 5); incl. collaborative memory boxes |
| Time-capsule memory boxes                 | IN       | Spec #5 — scheduled unlock. **Not scheduled in Sprints 1–3 — revisit**    |
| Personal archive                          | IN       | Spec #6 — private by default, owner decides sharing                       |
| Important-date reminders                  | IN       | Spec #9 — the reminder part needs no AI; suggestions (AI) listed below    |
| On This Day                               | **OUT**  | Spec #10 — post-MVP                                                       |
| Notifications                             | IN       | Needed by posting (solution #1: notify new content) and reminders (#9)    |
| Memory Map                                | **OUT**  | Spec #11 — post-MVP                                                       |

## AI-Assisted

| Capability                     | IN / OUT | Notes                                                                                                 |
| ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| Interest/preference analysis   | IN       | Spec #7. MVP (WBS): user enters context manually; automatic analysis **not scheduled in Sprints 1–3** |
| Greeting suggestions           | IN       | Spec #9                                                                                               |
| Gift suggestions               | IN       | Spec #9                                                                                               |
| Story assistance               | OUT      | Not among the original spec's 12 features — re-confirm if wanted                                      |
| Automatic albums               | IN       | Spec #8. **Not scheduled in Sprints 1–3** (only video generation is) — revisit                        |
| Automatic commemorative videos | IN       | Spec #8                                                                                               |

---

## Related Open Decisions

These affect scope but are tracked separately (see `product-overview.md` § 18
and `domain-model.md`):

- [x] User ↔ Member relationship model — **decided**: Members exist
      independently of accounts; an account can link to an existing Member.
      One Life Profile per person, global across families. Details in
      `domain-model.md`.
- [x] Multi-family membership — **decided**: a user can belong to multiple
      family spaces. Consequences tracked in `domain-model.md`.
- [x] Permission roles — **decided for MVP**: single "User" role; placeholder
      profiles are wiki-editable by the whole family. See `domain-model.md`.
- [x] Privacy rules — **decided for MVP**: post to chosen families; all
      shared content visible to the whole family (no per-item ACL); personal
      archive private by default. See `domain-model.md`.
- [x] Family relationship model — **decided**: base types + exceptional
      types allowed (adopted, step, extended); set by whoever adds the
      member; tree auto-renders. See `domain-model.md`.
- [ ] Media storage strategy
- [ ] Notification delivery method
- [ ] AI providers and models
- [ ] Final UI design system

## Out of Scope for MVP (explicit)

Intentionally excluded — do not re-propose mid-build without a product
discussion:

- On This Day (spec #10)
- Memory Map (spec #11)
- AI story assistance (not in the original 12-feature spec)
