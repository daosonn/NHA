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

| Screen                  | State                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / Sign up       | **Wired.** The Google/Facebook buttons were removed on 2026-08-20 — the OAuth callback returns the token pair as JSON and an app cannot read it, so none of them could ever have had a handler. See `api-contract.md` § Requests from the app.                                                                                                    |
| Home                    | **Wired** — families, the family feed, and the special-date widget (2026-08-19). Only the recommendations are still a fixture, and those have no endpoint at all.                                                                                                                                                                                 |
| Create / join family    | **Wired** (`app/create-family.tsx`). 404 = unknown code, 409 = already a member.                                                                                                                                                                                                                                                                  |
| Family tree             | **Wired**, including invitations and pinch/pan (2026-08-20). See § Family tree below.                                                                                                                                                                                                                                                             |
| New moment              | **Wired** — pick media, upload, post, choose audience.                                                                                                                                                                                                                                                                                            |
| Post detail             | **Wired** — comments and reactions (`app/post/[id].tsx`). The separate `app/moments.tsx` was deleted when the feed moved into Home.                                                                                                                                                                                                               |
| Omoide                  | **Wired** (2026-08-18) — `GET /families/:id/posts`, every shared photo grouped by the day it was posted. One shelf, not albums; search and sort are deliberately absent until something is behind them.                                                                                                                                           |
| Life Profile            | **Wired** (2026-08-19), on both routes, with no fixture left. Identity and facts from `GET /me/profile` / `GET …/members/:memberId/profile`, the name and relation word from `GET …/tree`, Timeline from `LifeEvent`, Memo from the `Memo` routes, and Album derived from the family feed. Two mockup fields have no column — see § Life Profile. |
| AI tab + Gift ideas     | **Wired by the AI team** (merged from `main`, PR #25) against the FastAPI service in `apps/ai`. Not reviewed by this side yet; several of those screens have no error state, which is the open half of task 1.2.4.                                                                                                                                |
| Invitation page         | **Wired** (2026-08-19) — `GET /invitations/:code` unauthenticated, then `POST /invitations/:code/accept`. Signed out it offers registration instead and holds the code across the detour (`features/family/pending-invite.ts`).                                                                                                                   |
| Verify / Forgot / Reset | **Wired** (2026-08-19) — request, verify, confirm. Verify's _sign-up_ half still has no endpoint and is unreachable: registration returns a token pair straight away.                                                                                                                                                                             |

### Family tree

`GET /families/:id/tree` returns members and flat edges; the component takes
rows, partner links and descents. `features/family/tree-from-graph.ts` is the
piece between them.

Generations come from distance to a root, and partners are then pulled level
with each other — someone who married in has no parent in this family and
would otherwise sit in the top row while their spouse sits three rows down.

`pending` nodes are fed from the invitation list (2026-08-19). Creating an
invitation reserves a real placeholder member, so the caller passes
`pendingMemberIds` — the member ids of the outstanding invitations — and
`tree-from-graph.ts` marks those nodes. `components/family/pending-banner.tsx`
renders over the canvas for the newest one and counts the rest.

Outstanding is recomputed on the client as well as read from the server:
`EXPIRED` is derived from `expiresAt` at read time, so a list fetched before
the deadline can be stale on the wrong side of it.

`empty` is still never produced. An unreserved gap in a tree is a drawing
idea, not a row in the database.

Pinch and drag landed 2026-08-20, once `react-native-gesture-handler` arrived
with the AI merge. Both run on the UI thread through Reanimated — a canvas
redrawn from React state on every finger move stutters the moment there are a
dozen nodes and their threads.

Three details that are not obvious from the code:

- **Gestures and the zoom buttons share one value.** Pinch to 1.4 and the
  minus button takes you to 1.2, not back to a remembered 0.8.
- **The pan has an 8px slop.** Without it the pan wins every touch and tapping
  a face stops opening anybody — a tap is a press with a pixel or two of
  travel.
- **The drag is bounded** to whatever is actually off screen, and not at all
  on an axis that already fits. Recenter would rescue an unbounded canvas, but
  needing a button because a finger slipped is a poor trade for a gesture
  whose whole job is to feel direct.

`GestureHandlerRootView` is mounted at the app root rather than around this
screen: every handler in the tree resolves against it, and one mounted lower
only works for its own screen.

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

### Reactions — one heart (2026-08-20)

The bar used to draw five icons, one per `ReactionType`. It draws one.

`PostDetail` carries `reactionCount` — a single total — and `myReaction`,
which is only ever _your own_. There is no per-type breakdown on the wire. So
five buttons all fed one undifferentiated number: tapping the star raised the
total by one exactly as a heart would, and nobody could ever see that a star
had been left. Five ways to do the same invisible thing is a puzzle, not a
choice.

The app sends `LOVE`. A reaction set earlier by another client still lights
the heart, because "you have reacted" is the reading the count agrees with.
If the server ever returns a breakdown, the five come back and
`components/feed/like-button.tsx` is where they go.

The post card's own heart/comment counters are hidden on the detail screen
(`showStats={false}`) — both numbers are repeated immediately below, once by
the button and once by the comment divider. That duplication was the other
half of what made the screen confusing.

### Personal albums

`/me/albums` (WBS 1.6.7) — a shelf only its owner sees. **Not** the Album tab
on a Life Profile: that one is derived from posts and life events and nobody
curates it. Two screens, `app/albums/index.tsx` and `app/albums/[id].tsx`,
reached from the Omoide tab.

That entry point is the one product call made here, and it is worth knowing it
was a call: `screens.md` lists no "my albums" screen, and the only mention of
albums in the spec is "choose album" on screen 11 (Post a Moment). Omoide is
where somebody already goes to look at pictures, so the way in sits there — as
a card visually separated from the shelf below it, because that shelf is the
family's and this one is not, and they are one tap apart. Moving it is a
one-line change if the design says otherwise.

Photographs get in by being picked and uploaded, never by choosing from the
family's shared pictures. That is the server's rule: `POST …/items` accepts
only media this account uploaded, and nothing on the wire says who uploaded a
given picture — so an "add from the family photos" list could not tell in
advance which of them it was allowed to offer.

Two server behaviours the copy leans on, both checked against the running API:
removing the item that was the cover clears the cover rather than leaving it
dangling, and deleting an album leaves every photograph exactly where it came
from. The delete affordance is therefore two taps in the edit sheet rather
than a full dialog — the weight of one would overstate what happens.

### Password reset

Three screens, three calls, and one shape worth knowing about.

`POST /auth/password-reset/verify` **checks the code without spending it**,
which is the whole reason the middle screen exists: the person is told they
mistyped before choosing a password, and the same code still works on the next
screen. Verified against the running server — the same code verifies twice,
then `confirm` spends it and a third attempt is refused.

Two things the contract does not say out loud, both found by running it:

- **A wrong code is a 400, not `{ valid: false }`.** The response type allows
  the latter and the app handles both, but the real path is the error. Routed
  through the generic mapper it would have printed "check the fields" under a
  six-digit box with nothing else on the screen.
- **`request` answers `{ success: true }` for an address that has no
  account.** Deliberate on the server's part — a different answer would turn
  the form into a way to ask who is registered — so the screen moves on either
  way and never says "no such account".

Confirming revokes every refresh token the account has, so the flow ends on
sign-in rather than signing anybody in.

### Home — the occasion widget

`GET /families/:id/special-dates` (WBS 1.2.5). Birthdays and memorials are
**derived from `LifeProfile` dates at request time**, so the widget fills
itself in as people put their birth dates on their profiles, and a family who
have not is shown nothing rather than an empty celebration card.

Derived items arrive with **no text at all** — the server sends a type, an
ordinal and the member names and leaves the wording to the client, because
"turns 63" and 「63歳になります」 are not the same sentence with the words
exchanged. `features/home/occasion-label.ts` holds that wording as catalogue
keys.

Three things the mockup drew are gone, because `SpecialDateItem` has no field
behind any of them: a place (an occasion is a date, not a gathering), a "Join"
button (there is nothing to join), and paging dots (decoration pretending to
be a control — the count behind the first one is said in words instead). The
bunting stays for every theme: `CONFETTI_CANDLES` and `FLORAL_BORDER` have no
drawing yet, and a plain white box for a memorial would read as a widget that
failed to load.

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

**Only you edit your own profile (decided 2026-08-19).** This narrows
`docs/00-shared/domain-model.md`, which makes a placeholder wiki-editable by
the whole family. A life story written about someone by someone else is a
different kind of object from one they wrote themselves, and the screen gave
the reader no way to tell which they were looking at. What the family edits
about another person is their **place in the tree** — name, relationships —
on the family screen, not their biography.

Three things follow, and none of them are obvious from the table:

- The decision lives in one function, `features/member/member-profile.ts` →
  `editability`, so reversing it is one line rather than an archaeology
  exercise. `'wiki'` was dropped from the type on 2026-08-19: a value nothing
  can produce and nothing renders is not documentation, it is a trap.
- **The server has not narrowed.** `PATCH …/members/:memberId/profile` still
  accepts an edit from any member of the family. The app stopped offering it;
  making it impossible is a backend change to schedule.
- The default while the profile is in flight is `locked`. It used to come
  from a fixture, which drew an Edit pencil on a stranger's face for as long
  as the request took — and forever if it failed. Permissions are the
  server's to state (`CLAUDE.md` § 3); the honest default is no.

The Timeline follows the profile when `LifeEvent` arrives (task 1.6.8): a life
event is part of the profile it sits on. Nothing edits it today, so nothing
draws an affordance for it.

#### Layout (mockup 7, built 2026-08-19)

Identity card → coral facts block → tabs. `profile-hero.tsx` holds the
avatar, name, "relation · family" line and the biography; `profile-facts.tsx`
holds the short facts.

Two of the mockup's three fact rows are drawn. The third, occupation
("Carpenter, retired since 2021"), and the birthplace half of the first
("Born 14 March 1964, **Y Yen, Nam Dinh**") had no columns in the schema, so
they were not invented.

**The columns landed 2026-08-20** — `ProfileDetail` now carries `birthPlace`
and `occupation` (free text, nullable, max 200 chars; see `api-contract.md`).
Drawing the third row and the place after the birth date is now frontend
work: read the two fields, and drop the explanatory comment in
`profile-facts.tsx`. Both stay nullable, so the rows still have to survive
being absent.

The biography is in the identity card rather than the facts block. The mockup
draws no biography at all — its example person has none — but the field is
real and the edit screen writes it, so dropping it would quietly lose what
somebody wrote about their own life. A paragraph belongs beside the name, not
in a list of one-line facts.

#### Album

**Derived, not curated** — the family's posts that this person is tagged in
(`PostMemberTag`) **or posted themselves**, grouped by moment rather than
flattened into loose photographs. The private `Album` model in the schema is a
different thing and must not be conflated with this tab.

Authorship was added to the rule on 2026-08-19, hours after the tab shipped.
Built on tags alone it was empty for everybody, because **nothing in the app
ever wrote a tag** — the moment composer had no way to name anyone, so
`taggedMemberIds` was always `[]` and the grid was reading a field that only
ever got filled in over curl. Two fixes, and both were needed:

- `components/moment/member-tag-picker.tsx` — "Who's in this moment?" in the
  composer, offering the union of the members of the families the moment is
  going to. That union is not a nicety: the server refuses a tag outside the
  post's audience, so deselecting a family has to drop its people too.
- The album counts what the person posted as well as what they were named in.
  "My album" without my own photographs in it is not an album, and this half
  works for content that already exists.

A placeholder has no account and has posted nothing, so for them the rule
falls back to tags alone.

Life-event media is the third source `domain-model.md` names and is **not**
here yet. Those photographs are currently invisible everywhere — the Timeline
shows a count and nothing else — but a tile in this grid would have nowhere to
open, and there is no life-event detail screen to build one against.

`GET /me/gallery` and `GET …/members/:memberId/gallery` (WBS 1.6.4, landed
2026-08-19) do the work. The server assembles the media, includes life-event
photographs, and filters to what the viewer may see — all three of which the
client had been approximating.

This replaced a scan of the family feed the same morning it was written.
That scan read a bounded four pages of fifty and said so on screen, could not
see life-event media at all, and re-derived a visibility rule that was never
the client's to decide.

The endpoint returns loose media newest-first, so `use-member-gallery.ts`
groups it back into moments on `postId` / `lifeEventId` — exactly one of
which is set on every item. A post group opens the post; a milestone group
has no screen of its own and switches to the Timeline tab, which is where
that milestone is written down. Neither is a dead tile.

A tile shows the cover and a count when the moment has more than one
attachment. Two departures from the mockup, both for the same reason —
`GalleryMediaItem` is `{ id, mimeType, sizeBytes, createdAt, postId,
lifeEventId }` and carries nothing else:

- It writes an event's title across the cover ("TẾT 2019"). Fetching one post
  per tile to find that title would trade a legible grid for a burst of
  requests, so the tiles say how many and what kind instead.
- It puts a running time on a video cover. There is no duration, so a video
  tile says "Video" rather than a made-up number.

#### Faces

Every avatar in the app was the same grey stripe pattern, so a tree of nine
people was nine identical blobs. `components/ui/avatar.tsx` now draws the
person's initial on a tint derived from their name, and every call site says
whose face it is drawing.

Two decisions worth keeping:

- **Both ends of the name, not one.** Which end holds the given name cannot
  be told from the string: Vietnamese and Japanese write the family name first
  — Nguyễn Văn An, 山田 太郎 — but plenty of Vietnamese users type their own
  name the other way round, and this app has both. Either single-word rule
  collapses for half the cases and gives a whole family the same letter, which
  is the exact thing an avatar exists to prevent. First + last stays distinct
  under both orders: NA / NM / NH one way, XN / MN / HN the other.
- **The tint comes from the name, not a render index.** The same person
  appears in the tree, the feed, a comment and the album; a colour that
  changed between them would read as a different person. The palette is the
  five category themes, minus `destructive` — a person is not a warning.

There are still **no photographs**. `User.avatarKey` and
`FamilyMember.avatarKey` exist as columns and nothing writes or serves them,
so the app has no upload button: `PATCH …/members/:memberId` answers 200 and
silently drops the field (`whitelist: true` on the global `ValidationPipe`),
which is the worst kind of button — one that looks like it worked. See
`docs/00-shared/api-contract.md` § Requests from the app. When the endpoints
land, `Avatar` grows one prop and every caller is already passing the name it
needs.

#### Memo

The Memo tab is author-only (`Memo.ownerUserId`) and says so on screen,
because a private note that looks public is a privacy incident waiting to
happen.

Deleting confirms **inside the actions sheet** rather than in the separate
dialog mockup 1h draws. Two `Modal`s meant asking React Native to dismiss one
and present another on the same tick, and they overlapped on screen. The
dialog's weight — the coral circle, the title, "gone for good" with the photo
count — is kept as the sheet's second state. Note the memo rule is the
opposite of the album one: a memo's DELETE takes its media files with it,
which is why it is worth confirming at all.

Four pieces, matching mockup sections 1c–1g:

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

**Wired end to end 2026-08-19.** The sheet posts to
`POST /families/:id/invitations`, which creates the placeholder member, its
relationship edge and the invitation in **one transaction** — replacing an
add-member-then-add-edge pair that could leave an unconnected person in the
tree when the second call failed.

The sheet has two states: the form, then the code that comes back. The code
cannot exist before the request, which is why it is a second state rather
than something shown alongside the form.

**The sheet hands out a code, not a link** (2026-08-19, mockup 8a). It is now
the **invitation's own** code, not `Family.inviteCode` — same 8-character
alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no I/O/0/1, so it survives
being read aloud), shown split 4+4 and copied unspaced. That difference is
the whole point of the endpoint: a family code lets somebody in the door,
while this one carries the reserved spot, so the copy can finally promise
what the mockup always claimed — that the receiver lands where the inviter
put them. A link would need a web page that does not exist while the role of
`apps/web` is undecided; a code also works read down a phone line to someone
who does not have the app yet, which is most of the people this screen is
for.

The spot card describes **what the inviter has typed and picked**, not a
fixture. It used to read "Gen 3 · beside Minh · child of Mai & Hoang" on
every invite, whoever was being invited; the spot does not exist until the
request is sent, so the only honest thing to show beforehand is the form's
own contents — which is also the thing they might have got wrong.

Pending nodes and the banner are fed from `GET …/invitations`; outstanding is
recomputed on the client too, because `EXPIRED` is derived server-side at read
time and a cached `PENDING` can be stale on the wrong side of the deadline.

The receiver's page reads `GET /invitations/:code` **unauthenticated** — the
one public route in the API — so it can make its case before asking anyone to
register. Signed out, the Join button offers registration instead and the
code waits in `features/family/pending-invite.ts` until Home hands it back;
carrying it as a route param loses a race with the auth group's redirect.

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
