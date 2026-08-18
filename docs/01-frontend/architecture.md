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

| Concern        | Library                                                       |
| -------------- | ------------------------------------------------------------- |
| Routing / tabs | `expo-router`                                                 |
| Styling        | `nativewind`                                                  |
| Icons          | `lucide-react-native` — 24px, stroke 2, **no other icon set** |
| Bottom sheet   | `@gorhom/bottom-sheet`                                        |
| Header blur    | `expo-blur`                                                   |
| Images         | `expo-image`                                                  |
| Image picking  | `expo-image-picker`                                           |
| Family tree    | `react-native-svg` + `d3-hierarchy`                           |
| Animation      | `react-native-reanimated`                                     |
| Server state   | `@tanstack/react-query`                                       |
| Client state   | `zustand`                                                     |
| Forms          | `react-hook-form` + `zod`                                     |
| Copy / i18n    | `i18next` + `react-i18next` + `expo-localization`             |

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
  ai/gifts.tsx            Gift ideas — pushed from the AI tab
  invite/[code].tsx       Invitation — what an invite link opens
  settings.tsx            Account & Settings — pushed from the Profile tab
  _dev/kitchen-sink.tsx   design-system preview, dev only
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

The first pass is complete. Everything runs on `src/fixtures/`; no screen
talks to the API yet.

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

Three rules from `docs/00-shared/domain-model.md` are encoded in the data
rather than in the screen, as `MemberProfile.editability`:

| Value    | Who is being viewed           | Edit affordance |
| -------- | ----------------------------- | --------------- |
| `self`   | you                           | **Edit**        |
| `wiki`   | a placeholder with no account | **Add details** |
| `locked` | someone else's linked account | none            |

The Album tab is **derived** — media from posts tagging the member — not
the private `Album` model. The Memo tab is author-only (`Memo.ownerUserId`)
and says so on screen, because a private note that looks public is a
privacy incident waiting to happen.

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

The sheet is opened two ways from `app/family.tsx`: the floating
add-member button (spot chosen for you) and tapping an **Empty** node (that
node becomes the spot). Both feed the same `TreeSpot`, so the sheet always
knows which position it is filling and can say so in words —
"Gen 3 · beside Minh · child of Mai & Hoang".

Two delivery modes share the sheet: a copyable link and, later, a contact
pick. The code is the 8-character `Family.inviteCode` (alphabet
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no I/O/0/1, so it survives being read
aloud). Copy uses `expo-clipboard`; share uses the RN `Share` API.

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
somewhere and the role of `apps/web` is still undecided.

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
