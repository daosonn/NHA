# Frontend Architecture

## Platform decision

The primary client is a **native mobile app** built with Expo, not a web
page. Decided 2026-08-17 (see `docs/project-status.md` → Important
Decisions).

Why not a Next.js PWA:

- iOS push notifications
- App-store presence
- Scroll and gesture quality — the audience includes older family members
- Every screen in `screens.md` is designed as a native screen: 5-tab
  bottom nav, bottom sheets, blurred headers, pinch/pan on the family tree

`apps/web` remains a bare Next.js scaffold. Its role is undecided; do not
put product features there without an explicit decision.

## Apps and packages

```
apps/mobile              Expo app — the product
apps/web                 Next.js scaffold — role TBD
packages/tokens          design tokens, plain TS, no React Native imports
```

`packages/contracts` and `packages/api-client` were planned and **dropped
2026-08-18**. The client lives fine in `apps/mobile/src/lib/api`, and
extracting it only pays off once `apps/web` has a role; a shared zod
package would fight the API's own class-validator DTOs rather than share
anything with them.

`packages/tokens` must stay framework-agnostic: `apps/mobile` uses
NativeWind (Tailwind 3.4) while `apps/web` uses Tailwind 4. Each app maps
the same tokens into its own Tailwind config.

## Stack

| Concern        | Library                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Routing / tabs | `expo-router`                                                                                                              |
| Styling        | `nativewind`                                                                                                               |
| Icons          | `lucide-react-native` — 24px, stroke 2, **no other icon set**                                                              |
| Bottom sheet   | `@gorhom/bottom-sheet` — chosen, **not installed**. Every sheet today is a plain `Modal`.                                  |
| Header blur    | `expo-blur`                                                                                                                |
| Images         | `expo-image`                                                                                                               |
| Image picking  | `expo-image-picker`                                                                                                        |
| Family tree    | `react-native-svg`. Layout is authored by hand in `components/family/tree-layout.ts`; `d3-hierarchy` is **not installed**. |
| Animation      | `react-native-reanimated`                                                                                                  |
| Server state   | `@tanstack/react-query`                                                                                                    |
| Client state   | `zustand`                                                                                                                  |
| Forms          | `useState`. `react-hook-form` and `zod` were considered and **not added** — see § State.                                   |
| Copy / i18n    | `i18next` + `react-i18next` + `expo-localization`                                                                          |

Do not add a library when the stack above already solves the problem.

## Directory layout (`apps/mobile`)

```
app/                      expo-router routes — file = route
  (auth)/                 signed-out half; the group carries the guard
    welcome.tsx           first launch
    sign-in.tsx           /  sign-up.tsx
    verify.tsx            6-digit code — sign-up and password reset both
    forgot.tsx            /  reset.tsx
  (tabs)/
    _layout.tsx           bottom nav, 5 tabs
    index.tsx             Home
    omoide.tsx            Omoide — shared album books
    new.tsx               New moment
    ai.tsx                AI suggestions
    profile.tsx           My profile
  create-family.tsx       Create or join — the way out of an empty account
  family.tsx              Family tree — pushed, not a tab
  member/[id].tsx         Life Profile (Timeline / Album / Memo)
  post/[id].tsx           Post detail — comments and reactions
  ai/gifts.tsx            Gift ideas — pushed from the AI tab
  invite/[code].tsx       Invitation — what an invite link opens
  settings.tsx            Account & Settings — pushed from the Profile tab
  _layout.tsx             providers: react-query, safe area, fonts
src/
  components/ui/          design-system primitives (Button, Card, ...)
  components/<feature>/   feature components
  components/layout/      app chrome (header, bottom nav)
  features/<feature>/     hooks + logic per feature
  theme/                  React Native mapping of @nha/tokens
  i18n/                   i18next setup and the stored-language helpers
  locales/                one JSON catalogue per language
  lib/                    api client, storage, helpers
  fixtures/               mock data used until the API is wired
scripts/
  check-i18n.mjs          `pnpm --filter mobile check:i18n`
```

The five tabs are **Home · Omoide · + · AI · Profile**, matching the
mockups and `design-system.md`. The family tree is _not_ a tab: it is
reached by tapping the group strip on Home, so the tab bar stays about
content rather than navigation structure.

Routes stay thin: they compose components and call hooks. Business logic
lives in `src/features/`.

## Signed in, signed out

Two modules, split on purpose:

- `src/features/auth/session-store.ts` — the token pair, **outside React**.
  The API client has to read the access token synchronously on every
  request, from a plain function, and a hook cannot be called from there.
- `src/features/auth/session.tsx` — the React view of that store, via
  `useSyncExternalStore`. Not a second copy of it.

Persistence is `expo-secure-store`: the iOS keychain and the Android
keystore. On web the module is a stub whose calls throw, so the store falls
back to `localStorage` purely to keep the browser dev tier usable — nothing
that matters should be demonstrated there.

**Refresh is single-use rotation**, so at most one refresh may be in the air
at a time. Opening the app fires several queries at once; if the access
token has expired they all come back 401 together, and without a gate each
would spend the same refresh token and all but the first would fail —
taking the session down mid-use. `client.ts` collapses them onto one
promise (`refreshOnce`) and retries each request once with the result.
Verified against the running API on 2026-08-18: replaying a refresh token
returns 401.

`status` has three values, not two. `loading` covers the asynchronous read
from the keychain; a guard that treated it as signed out would bounce every
returning user through Welcome on every cold start.

The guard sits on the two route **groups**, not on individual screens —
`(tabs)/_layout.tsx` redirects to `/welcome` when there is no session, and
`(auth)/_layout.tsx` redirects to `/` when there is one. That is one gate
each way rather than one per screen.

One consequence for verification: both guards render `null` while the
session is still loading, and an effect never runs during a prerender, so
**every guarded route now prerenders empty**. The static-export check in
`docs/04-devops/commands.md` still proves the modules evaluate and the
bundle builds; it no longer proves a tab screen renders.

`invite/[code].tsx` deliberately sits outside both: an invitation link is
opened by someone who has no account yet.

When the API is wired, tokens go to `expo-secure-store` and never to
`AsyncStorage`, and the API stays the authority on what a session may do —
the app must not derive permissions from what it finds in the session
(`CLAUDE.md` § 3).

## State

- **Server state** — `@tanstack/react-query` (installed 2026-08-18). One
  hook per endpoint under `src/features/<feature>/`, keys from
  `src/lib/query-keys.ts`. Defaults live in `src/lib/query-client.ts`:
  retry only what retrying can fix (an offline request, never a 404), and
  never retry a mutation, because a retried "post moment" posts twice.
- **Client state** — React context, and only for what genuinely spans
  screens. **`zustand` was considered and not added**: the only candidate
  is the active family, and one value does not need a store. Revisit when
  there is a third.
- **Auth tokens** — `expo-secure-store` (installed 2026-08-18), never
  `AsyncStorage`.

Authorization is enforced by the API. The app must not decide permissions
from local state (`CLAUDE.md` § 3).

## Language

The app ships **English and Japanese**. Every user-visible string lives in
`src/locales/<locale>.json` and is read through `t()`; nothing user-facing
is written inline in a component.

The language follows the device by default and can be changed in Settings.
Each language names itself in that picker — `English`, `日本語` — because
someone who has put the app into a language they cannot read still has to
be able to find their way back out.

`src/i18n/index.ts` initialises i18next synchronously with the device
language, so the first paint is already right for almost everyone.
`src/i18n/locale.ts` then restores a stored choice from `AsyncStorage`
(key `nha.locale`) and swaps the language when it arrives. That restore is
deliberately **not** a render gate: blocking on storage blanks the screen
for a tick and prerenders to nothing at all on web.

The language is a preference, not a secret, so `AsyncStorage` is correct
here — `expo-secure-store` is for tokens.

### Where a string belongs

| Kind                                         | Lives in                    |
| -------------------------------------------- | --------------------------- |
| Anything the app says in its own voice       | `src/locales/*.json`        |
| A number, a name, a date the API will return | the data                    |
| Something a family member typed              | the data — never translated |

The fixtures follow the same split. `giftEvidence` is `{ notes, photos,
gifts }` and the sentence around it is a key, because the sentence is copy
and the counts are what the AI service will actually return. A memo's
`content` or an occasion's `title` stays a plain string in the fixture:
those stand in for rows in the database, and translating them would be
translating the family's own words.

Relation words (`Grandmother`, `Sister`) are the open question. They are
fixture strings today because the API will return them; when it does, they
need to arrive as a relationship **type** the app can label, not as an
English noun. Flagged rather than decided — it is a domain question, not a
UI one.

### Rules

- Plurals go through i18next (`key_one` / `key_other`) and `{ count }`.
  Never `n === 1 ? 'photo' : 'photos'` — Japanese has no plural form, and
  the ternary bakes in the assumption that every language does.
- Dates go through `src/lib/date.ts`, which reads the month name and the
  order of the parts from the catalogue. Japanese writes the month before
  the day.
- A primitive that receives its copy as a prop (`Button`, `EmptyState`,
  `SectionHeader`) stays dumb and is handed an already-translated string.
  A primitive with copy of its own (`TextField`'s show/hide password,
  `SelectField`'s close) calls `t()` itself.
- A sentence with one bold word inside it is split into two or three keys
  rather than interpolated, so a translator can move the emphasis without
  the surrounding words following it.

### Checking

`pnpm --filter mobile check:i18n` diffs every `t('…')` call site against
every catalogue, in both directions. A missing key is invisible at
runtime — i18next renders the key itself, so a screen quietly reads
`member.albumEmpty` instead of "No photos yet".

Keys reached by a computed name (`date.months.4`) are listed in the
script's `DYNAMIC` allowlist.

### The font swap

Inter and Lora are Latin-only. Asking them for a kanji gets tofu on Android
and a silent per-glyph substitution on iOS — worse than it sounds, because
the substituted face has different metrics and the line ends up a different
height from the one beside it.

So `theme/typeface.ts` hands back the **device's own font** outside the
Latin languages, with a real `fontWeight` instead of a family name.
Synthetic bolding is only missing for _custom_ families, so the weight
scale survives the swap even though the shapes change. `Text` and the one
raw `TextInput` both go through it; no component sets `fontFamily` itself.

This is the interim. Zen Maru Gothic and Noto Sans JP are chosen but not
bundled — they are ~30–50 MB of TTF, which is a decision about app size
rather than about design. See `design-system.md`.

### Still open

- `lineBreakStrategyIOS` / `textBreakStrategy` — Japanese has no spaces,
  so the default breaking rules put a line break in the wrong place.
- `Intl.DateTimeFormat` may replace the hand-built date strings, now that
  there is a second locale to justify it.
- Relation words, above.

## Conventions

- Components and types `PascalCase`; files `kebab-case`; hooks
  `use-<name>.ts`.
- Style with NativeWind classes. Reach for `StyleSheet` only for things
  Tailwind cannot express (animated values, shadows on Android).
- Never hardcode a hex value in a component — use a token via the
  Tailwind config.
- Minimum touch target 44px.
- Every list needs an explicit empty state and loading state.

## Development loop (Windows)

Two tiers:

1. `pnpm dev:mobile:web` — runs the app in a browser through
   `react-native-web`. Fast hot reload; use it for layout and styling.
2. `pnpm dev:mobile` — Expo dev server; scan the QR code with Expo Go on
   a physical iPhone. Use it to verify gestures, bottom sheets, blur and
   scrolling.

The browser tier is an approximation: `expo-blur` only partially renders
on web and `@gorhom/bottom-sheet` behaves differently. Anything involving
blur, sheets or gestures must be checked on the device before it is
considered done.

Setup details: `docs/04-devops/mobile-development.md`.

## Wiring status

Which screens talk to the server, and what holds the rest back. Kept here
rather than in `docs/00-shared/api-contract.md`, which several people write
to — that document describes what the API offers, this one describes what
this app does with it.

| Screen                  | State                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign in / Sign up       | **Wired.** Social buttons still render without handlers, pending the OAuth redirect in the app.                                                                                                                                                                                                                                |
| Home                    | **Wired** — families and the family feed, with loading, error and a "no family yet" empty state. The special-date widget and the recommendations still read `src/fixtures/home.ts`: recommendations have no endpoint, and `GET /families/:id/special-dates` exists on the server but is not in `src/lib/api/endpoints.ts` yet. |
| Create / join family    | **Wired** (`app/create-family.tsx`). 404 = unknown code, 409 = already a member.                                                                                                                                                                                                                                               |
| Family tree             | **Wired**, including adding a member. See § Family tree below.                                                                                                                                                                                                                                                                 |
| New moment              | **Wired** — pick media, upload, post, choose audience.                                                                                                                                                                                                                                                                         |
| Post detail             | **Wired** — comments and reactions (`app/post/[id].tsx`). The separate `app/moments.tsx` was deleted when the feed moved into Home.                                                                                                                                                                                            |
| Omoide                  | **Wired** (2026-08-18) — `GET /families/:id/posts`, every shared photo grouped by the day it was posted. One shelf, not albums; search and sort are deliberately absent until something is behind them.                                                                                                                        |
| Life Profile            | **Fixtures**, on both routes. Header and About could be wired (`GET /me/profile`, `GET .../members/:memberId/profile`); Timeline and Album have no endpoint. **Memo is a complete UI** — list, detail, editor, delete with undo — running on `features/member/memo-store.ts` until a `Memo` endpoint exists.                   |
| AI tab + Gift ideas     | **Fixtures.** `apps/ai` does not exist.                                                                                                                                                                                                                                                                                        |
| Invitation page         | **Fixtures.** Needs a public read of an invite code; `POST /families/join` requires a token and joins immediately, so it cannot preview. Its Join button currently has no handler — the one place the app breaks its own "a button that leads nowhere is not rendered" rule.                                                   |
| Verify / Forgot / Reset | **Not wired.** The three screens only navigate. `POST /auth/password-reset/{request,verify,confirm}` landed on the server in PR #12, but `src/lib/api/endpoints.ts` does not mirror them yet. Verify's sign-up half still has no endpoint at all.                                                                              |

### Family tree

`GET /families/:id/tree` returns members and flat edges; the component takes
rows, partner links and descents. `features/family/tree-from-graph.ts` is the
piece between them.

Generations come from distance to a root, and partners are then pulled level
with each other — someone who married in has no parent in this family and
would otherwise sit in the top row while their spouse sits three rows down.

Two things it cannot produce, both for the same reason: `empty` and
`pending` nodes describe a spot reserved for a named invitee, and the server
has one invite code per family rather than per spot. The component still
supports both states; nothing feeds them — `tree-from-graph.ts` emits
`state: 'active'` for every node, and `components/family/pending-banner.tsx`
is therefore written but rendered nowhere. It waits on the invitation record,
not on a design decision.

Kinship words are base relationships only (decided 2026-08-18). A node with
no direct edge to the viewer — a grandparent, a cousin — shows its name with
no role line underneath.

**Adding a member is two calls**, because there is no "add a related member"
route: create the placeholder, then create the edge. If the edge fails the
member is left behind rather than rolled back — the server owns transactions
and the client must not pretend to.

### Avatars

A face is a way into a Life Profile, everywhere it appears: tree nodes, post
authors, comment authors. Posts identify their author by `authorUserId` and
profiles are opened by member id, so `features/family/use-member-for-user.ts`
resolves one to the other through the family on screen. It returns `null`
when the author is not in that family, and the avatar stays inert rather than
leading somewhere that does not exist.

## Screens

Inventory: `screens.md`. Visual spec: `design-system.md`.

Build order for the first pass (mock data, no API):

1. ~~Home~~ — done
2. ~~New moment~~ — done
3. ~~Life Profile — Timeline~~ — done
4. ~~Life Profile — Album~~ — done
5. ~~Life Profile — Memo~~ — done
6. ~~Family tree~~ — done
7. ~~Invite sheet~~ — done
8. ~~Pending spot state~~ — done

Actual order differed: the family tree (6) was built before the profile
(3–5), because the tree is what opens a profile and a screen with no way
into it cannot be reviewed.

The first pass is complete. It was drawn against `src/fixtures/`; most of
those screens have since been wired — § Wiring status is the current picture.

Second pass, in order: auth (Welcome, Sign in, Create account, Verify,
Forgot/Reset), then AI (hub, Gift ideas). Both done.

The invite-acceptance page for someone who does **not** have the app yet is
deferred until the role of `apps/web` is decided. `invite/[code].tsx` is
the in-app half only.

### Life Profile

The screen body lives in `components/member/profile-body.tsx` and is
rendered by two routes: `member/[id].tsx` for anyone else, and the
Profile tab for yourself. They differ only in chrome — your own profile
is the same object your family reads, so it must not be a second design.

Who may edit is carried by the data rather than by the screen, as
`MemberProfile.editability`:

| Value    | Who is being viewed                        | Edit affordance |
| -------- | ------------------------------------------ | --------------- |
| `self`   | you                                        | **Edit**        |
| `locked` | anybody else, and anybody not yet resolved | none            |
| `wiki`   | unused by the client — see below           | **Add details** |

**Only you edit your own profile (decided 2026-08-19).** This narrows
`docs/00-shared/domain-model.md`, which makes a placeholder wiki-editable by
the whole family. A life story written about someone by someone else is a
different kind of object from one they wrote themselves, and the screen gave
the reader no way to tell which they were looking at. What the family edits
about another person is their **place in the tree** — name, relationships —
on the family screen, not their biography.

Three things follow, and none of them are obvious from the table:

- `'wiki'` stays in the type and `ProfileHero` still renders it. The decision
  lives in one function, `features/member/profile-overlay.ts` → `editability`,
  so reversing it is one line rather than an archaeology exercise.
- **The server has not narrowed.** `PATCH …/members/:memberId/profile` still
  accepts an edit from any member of the family. The app stopped offering it;
  making it impossible is a backend change to schedule.
- The default when the profile has not loaded is `locked`, not whatever the
  fixture says. It used to be the fixture, which drew an Edit pencil on a
  stranger's face for as long as the request took — and forever if it failed.
  Permissions are the server's to state (`CLAUDE.md` § 3); the honest default
  is no.

The Timeline follows the profile when `LifeEvent` arrives (task 1.6.8): a life
event is part of the profile it sits on. Nothing edits it today, so nothing
draws an affordance for it.

The Album tab is **derived** — media from posts tagging the member — not
the private `Album` model. The Memo tab is author-only (`Memo.ownerUserId`)
and says so on screen, because a private note that looks public is a
privacy incident waiting to happen.

#### Memo

Five pieces, matching mockup sections 1c–1h:

| Piece                      | File                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| Two-column grid + Add tile | `components/member/memo-list.tsx`                                     |
| One card                   | `components/member/memo-card.tsx`                                     |
| Detail                     | `app/memo/[id].tsx`                                                   |
| Editor (add **and** edit)  | `app/memo/edit.tsx`                                                   |
| Actions / delete / undo    | `components/member/memo-{actions-sheet,delete-dialog,undo-toast}.tsx` |

There is no `Memo` endpoint, so `features/member/memo-store.ts` holds the
notes in memory, seeded from the fixtures — plain module state plus
`useSyncExternalStore`, the same shape as `features/auth/session-store.ts`.
The three screens that write a note are separate routes and cannot share React
state through props; this is what a react-query hook replaces later.

The undo lives in the store rather than in the screen that pressed Delete,
because those are two different screens: the detail screen deletes and pops,
so the offer has to outlive it and surface on the profile. It expires after
five seconds whether or not anyone was watching.

Three things the mockups draw that are **not** built, all for the same reason —
a memo is private to its author (`docs/00-shared/domain-model.md`, 2026-08-14):
the author line under each card, the "Share with family" action, and the
"visible to the family" row in the editor. The delete dialog says the note
goes for good rather than that it disappears "for everyone". Revisiting that
is a domain change, not a UI one.

### New moment

`app/(tabs)/new.tsx`. Three parts in a fixed order: caption, media strip,
audience. The audience picker is last but must never be pushed off screen —
it is the only control on the screen with a privacy consequence — so the
media strip scrolls horizontally instead of wrapping.

The audience maps directly onto `PostFamily`: each circle is one family the
author belongs to, and a post with **zero** `PostFamily` rows is private to
its author (`docs/02-backend/database.md`). That rule is not left implicit —
a line under the button always states the outcome in words:

| Selection | Line                                           |
| --------- | ---------------------------------------------- |
| none      | stays private to you                           |
| all       | everyone you share a family with will see this |
| some      | names the excluded families as skipped         |

and the button label counts along ("Post privately" / "Post to 3 families").
Unselected circles are dimmed with opacity rather than grayscale, because
the placeholder avatars are already gray; revisit when real photos land.

### Invite flow

Four pieces, matching mockup sections 8a–8d:

| Piece                              | File                                   |
| ---------------------------------- | -------------------------------------- |
| Invite sheet (sender)              | `components/family/invite-sheet.tsx`   |
| Pending banner over the tree       | `components/family/pending-banner.tsx` |
| Spot preview inside the invitation | `components/family/invite-preview.tsx` |
| Invitation page (receiver)         | `app/invite/[code].tsx`                |

**What it does today is add a member, not send an invitation.** The sheet's
submit runs `features/family/use-add-member.ts` — create the placeholder,
then create the edge — so the spot card, the delivery tabs and the link are
drawn from `src/fixtures/invite.ts` while only the name and the kinship
option reach the server. The receiver's page (`app/invite/[code].tsx`) is
fixtures end to end. Both stay that way until the invitation record exists.

The sheet is opened two ways from `app/family.tsx`: the floating
add-member button (spot chosen for you) and tapping an **Empty** node (that
node becomes the spot). Both feed the same `TreeSpot`, so the sheet always
knows which position it is filling and can say so in words —
"Gen 3 · beside Minh · child of Mai & Hoang".

**The sheet hands out a code, not a link** (2026-08-19, mockup 8a). The code
is the 8-character `Family.inviteCode` (alphabet
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no I/O/0/1, so it survives being read
aloud), shown split 4+4 and copied unspaced. A link would have to open a web
page that does not exist while the role of `apps/web` is undecided; a code
also works read down a phone line to someone who does not have the app yet,
which is most of the people this screen is for. Copy uses `expo-clipboard`;
share uses the RN `Share` API and carries the code.

The line under the card says what the code actually does — joins the family —
and **not** what the mockup promised, that the receiver lands in the reserved
spot. A family-wide code cannot do that: `POST /families/join` takes a
`linkMemberId`, but a bare code does not carry one.

Two deviations from this document's stack table, both deliberate:

- The sheet is a plain `Modal`, not `@gorhom/bottom-sheet` — nothing here
  needs snap points or a drag gesture, and the dependency can be added when
  a sheet actually does.
- The relationship control is a modal option list rather than a native
  picker, because each option needs a second line explaining which base
  relationship it maps to.

The last point is the load-bearing one. A kinship word ("Sister") is a
**derived label**, never a stored enum value (`docs/00-shared/domain-model.md`);
the sheet therefore carries `{ label, type, hint }` per option and sends the
`RelationshipType` while showing the word.

### Auth

Five screens and one shared shape. `components/layout/form-screen.tsx`
pins the submit action under the fields and above the keyboard: on a phone,
the button vanishing behind the keyboard is the most common way a form goes
wrong, and a shared layout fixes it for every screen at once.

Sign in and Create account are one control, not two destinations — the
segmented switch between them uses `replace`, so going back leaves the
flow instead of walking through every change of mind.

**Verify serves both flows.** Confirming an address and proving you own it
before a reset are the same act to the person typing, so `intent` changes
only where they land afterwards. Reset is three steps (email → code → new
password) rather than an emailed link, because a link has to open
somewhere and the role of `apps/web` is still undecided. The server grew
those three steps in PR #12; the screens have not been connected to them
yet.

The six OTP boxes are a drawing over one real input. Six separate fields
would each need focus juggling and would break paste, autofill and the
one-time-code suggestion strip.

### AI

The tab opens on the **calendar**, not on a prompt: what the app actually
knows is which dates the family keeps, and an idea is only worth anything
while there is still time to act on it.

Two rules are encoded in `fixtures/ai.ts` rather than in the screens:

- Some dates follow the lunar calendar, so the Gregorian day drifts every
  year and cannot be stored as a fixed date (`docs/00-shared/domain-model.md`).
- **Every suggestion carries `why` and `source`.** A gift idea nobody can
  trace back to a memo, a photo or the timeline is a guess wearing the
  family's clothes, and the reader has no way to tell the difference. The
  evidence line ("Read 12 notes, 248 photos…") comes _before_ the first
  idea for the same reason.

Actions that lead nowhere are not rendered. `FeaturedOccasion` draws a
button only when it is given a handler, so Plan a surprise and Video are
simply absent until those screens exist — a dead button costs more trust
than a missing feature.
