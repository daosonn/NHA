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
packages/contracts       (planned) zod schemas shared with the API
packages/api-client      (planned) typed REST client
```

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

Do not add a library when the stack above already solves the problem.

## Directory layout (`apps/mobile`)

```
app/                      expo-router routes — file = route
  (tabs)/
    _layout.tsx           bottom nav, 5 tabs
    index.tsx             Home
    omoide.tsx            Omoide — shared album books
    new.tsx               New moment
    ai.tsx                AI suggestions
    profile.tsx           My profile
  family.tsx              Family tree — pushed, not a tab
  member/[id].tsx         Member profile (Timeline / Album / Memo)
  _dev/kitchen-sink.tsx   design-system preview, dev only
  _layout.tsx             providers: react-query, safe area, fonts
src/
  components/ui/          design-system primitives (Button, Card, ...)
  components/<feature>/   feature components
  components/layout/      app chrome (header, bottom nav)
  features/<feature>/     hooks + logic per feature
  theme/                  React Native mapping of @nha/tokens
  lib/                    api client, storage, helpers
  fixtures/               mock data used until the API is wired
```

The five tabs are **Home · Omoide · + · AI · Profile**, matching the
mockups and `design-system.md`. The family tree is _not_ a tab: it is
reached by tapping the group strip on Home, so the tab bar stays about
content rather than navigation structure.

Routes stay thin: they compose components and call hooks. Business logic
lives in `src/features/`.

## State

- **Server state** — `@tanstack/react-query`. One hook per endpoint,
  under `src/features/<feature>/`. No manual global cache.
- **Client state** — `zustand`, only for state that genuinely spans
  screens (active family, session). Everything else stays local.
- **Auth tokens** — `expo-secure-store`, never `AsyncStorage`.

Authorization is enforced by the API. The app must not decide permissions
from local state (`CLAUDE.md` § 3).

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

1. Home
2. New moment
3. Member profile — Timeline
4. Member profile — Album
5. Member profile — Memo
6. Family tree
7. Invite sheet
8. Pending spot state

The invite-acceptance page for someone who does not have the app yet is
deferred until the role of `apps/web` is decided.
