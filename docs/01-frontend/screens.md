# Screen Inventory

> Source: original product specification (画面一覧, 21 screens), translated
> and mapped to the decided MVP scope (`docs/00-shared/mvp-scope.md`).
> Feature IDs (#N) refer to the original spec's feature list (機能一覧).
>
> Mobile-first: target viewport ≈ 375–430px (`product-overview.md` § 14).

| ID  | Screen                      | Features           | MVP     | Summary                                                                                                                                          |
| --- | --------------------------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Splash                      | #12                | IN      | Logo, app name, brand message, family imagery. Start and login buttons.                                                                          |
| 2   | Introduction                | #12                | IN      | Short intro of the core values: personal Life Profile, family memory sharing, AI-assisted care.                                                  |
| 3   | Login / Register            | #12                | IN      | Login, register, password recovery, Google login, join via family code.                                                                          |
| 4   | Create / Join Family        | #4, #12            | IN      | Create a new family space, join via invite code, or link to a previously created Member profile.                                                 |
| 5   | Family Home                 | #3, #4, #5, #9     | IN      | First screen after login. Near-user family diagram on top; swiping down reveals new posts, photos/videos, special dates. (On This Day part: OUT) |
| 6   | Family Tree                 | #4                 | IN      | Full multi-generation structure. Zoom, pan across branches, select a member.                                                                     |
| 7   | Edit Family Relationships   | #4                 | IN      | Edit member positions, relations, and connections (parents, spouses, children, siblings).                                                        |
| 8   | Life Profile                | #1, #2, #5, #7, #9 | IN      | **Central screen of the product.** Personal info, family relations, biography, interests, timeline, albums, notes, related memories.             |
| 9   | Life Timeline               | #2                 | IN      | Life milestones in chronological order. Filter by year, life stage, or event type.                                                               |
| 10  | Milestone Detail            | #2                 | IN      | Time, place, description, photos, videos, retellings, and members involved in a milestone.                                                       |
| 11  | Post a Moment               | #3, #5             | IN      | Post photos, videos, audio, messages, or stories. Tag members, choose album, set sharing scope.                                                  |
| 12  | Post Detail                 | #3, #5             | IN      | Post content, media, tagged members, time, place, comments, reactions, sharing permissions.                                                      |
| 13  | Family Media Library        | #5                 | IN      | All shared photos/videos/audio/stories. Search and filter by member, time, event, or place.                                                      |
| 14  | Personal Archive            | #6                 | IN      | Private photos, videos, journals, letters, audio, documents. Keep private or move to profile/timeline/family space.                              |
| 15  | Interests & Preferences     | #7                 | IN      | Interests, wishes, favorite colors/foods/places/activities — user-entered or AI-suggested.                                                       |
| 16  | AI Hub                      | #7, #8, #9         | IN      | Aggregated AI suggestions: who needs attention, upcoming special dates, greetings, gifts, family activities, commemorative videos.               |
| 17  | Special Date Detail         | #7, #9             | IN      | Countdown to a special date, related person's info and interests, suggested greetings/gifts/places/activities.                                   |
| 18  | Create Album / Video        | #8                 | IN      | Pick members, events, time range, media, messages, music, and style to auto-generate an album or video.                                          |
| 19  | Notifications               | #3, #5, #9         | IN      | New posts, tags, comments, family invites, special dates, opened memory boxes, AI suggestions. (On This Day items: OUT)                          |
| 20  | Account, Privacy & Settings | #1, #6, #7, #12    | IN      | Account, password, language, notifications, sharing scope, profile visibility, personal-archive access, AI permissions.                          |
| 21  | Memory Map                  | #11                | **OUT** | Memories pinned to places on a map. Post-MVP (Memory Map is out of MVP scope).                                                                   |

## Notes

- Screens 5 and 19 are IN, but their "On This Day" elements are out of MVP
  scope — design those areas so the section can be added later without
  restructuring the screen.
- Screen 21 (Memory Map) is fully post-MVP; listed here so the inventory
  matches the original spec.
- Detailed UI specs per screen belong in separate files in this folder as
  they are designed.
