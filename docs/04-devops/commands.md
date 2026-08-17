# Commands

Canonical commands for this repo. If a command is not listed here, it
probably does not exist — check before inventing one.

Run everything from the **repo root** unless stated otherwise.

## First time on a machine

```bash
pnpm install
pnpm bootstrap          # .env files, PostgreSQL, migrations, Prisma client
pnpm build:tokens       # compile @nha/tokens (apps import the build output)
```

`pnpm bootstrap` needs Docker Desktop running. Safe to re-run anytime.

## Running things

| Command               | What it does                                             |
| --------------------- | -------------------------------------------------------- |
| `pnpm dev:mobile`     | Expo dev server. Scan the QR with Expo Go on the iPhone. |
| `pnpm dev:mobile:web` | Same app in the browser at http://localhost:8081         |
| `pnpm dev:api`        | NestJS with watch mode                                   |
| `pnpm dev:web`        | Next.js scaffold                                         |

Stop any of them with `Ctrl+C`.

## After every UI change — the loop

1. Keep `pnpm dev:mobile:web` running. Save a file; the browser reloads
   itself. This is the fast feedback loop for layout, spacing and color.
2. When the piece looks right, check it on the phone with
   `pnpm dev:mobile`. Blur, bottom sheets, gestures and scroll momentum
   **only tell the truth on the device**.
3. Before considering the change done:

```bash
pnpm --filter mobile typecheck     # TypeScript
pnpm format:check                  # Prettier (see the note below)
```

`pnpm format:check` currently reports ~127 pre-existing failures caused by
CRLF line endings. Until that is cleaned up in its own commit, check only
what you touched:

```bash
pnpm exec prettier --check apps/mobile/app apps/mobile/src
pnpm exec prettier --write  apps/mobile/app apps/mobile/src   # to fix
```

## Verifying the whole repo

```bash
pnpm --filter mobile typecheck    # mobile
pnpm --filter @nha/tokens build   # tokens must compile
pnpm lint:api && pnpm --filter api build
pnpm lint:web && pnpm --filter web build
```

## Design tokens

`apps/mobile` imports the **compiled** output of `@nha/tokens`, so after
editing anything in `packages/tokens/src`:

```bash
pnpm build:tokens
```

Or leave a watcher running in a second terminal:

```bash
pnpm --filter @nha/tokens dev
```

Forgetting this is the most likely reason a token change "does nothing".

`tailwind.config.js` reads the same compiled output, so a token change
reaches both the `className` utilities and `src/theme`.

## App icons

The icons are generated from vector geometry, never hand-edited:

```bash
pnpm --filter mobile icons
```

Edit `apps/mobile/scripts/generate-icons.mjs` to change the mark or the
palette, then re-run and commit the PNGs.

## Checking a bundle without a device

Proves Metro can actually build the app — useful when a dependency or
config change might have broken resolution:

```bash
cd apps/mobile
pnpm exec expo export --platform web --output-dir .expo/export-test
pnpm exec expo export --platform ios --output-dir .expo/export-test-ios
rm -rf .expo/export-test .expo/export-test-ios
```

## Checking a screen actually renders, without a browser

A bundle containing your code does **not** mean the screen renders — a
route can be shadowed, or the tree can throw at runtime. Temporarily
switch `app.json` → `expo.web.output` from `single` to `static`, export,
and read the prerendered HTML: Expo renders every route in Node, so a
component that throws fails the export, and one that renders nothing
shows up as a suspiciously small file.

```bash
cd apps/mobile
pnpm exec expo export --platform web --output-dir .expo/ssr-test
grep -c "Some text only that screen renders" .expo/ssr-test/family.html
rm -rf .expo/ssr-test          # then set `output` back to "single"
```

Caveat: `onLayout` never fires and `Dimensions` reports zero, so anything
that waits for measurement renders empty here. That is a useful signal in
itself — it is also an empty first frame on a real device.

## Troubleshooting

| Symptom                                                                | Fix                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stale bundle, weird resolution errors                                  | `cd apps/mobile && pnpm start --clear`                                                                                                                                                                                                                                               |
| Blank white page on web, console shows a `TypeError` inside the bundle | The page is served but the JS crashed. Find the module: open the bundle URL from `index.html`, look at the reported line, then read the file path Metro records at the end of that module. A duplicated package across the monorepo is the usual cause — see `mobile-development.md` |
| `Unable to resolve module <pkg>` after installing something            | Install it with `pnpm exec expo install <pkg>` from `apps/mobile`, not plain `pnpm add` — Expo picks the SDK-compatible version                                                                                                                                                      |
| Port 8081 already in use                                               | `pnpm dev:mobile --port 8082`, or kill the listener: `Get-NetTCPConnection -LocalPort 8081 -State Listen \| Stop-Process -Id { $_.OwningProcess } -Force` in PowerShell                                                                                                              |
| QR scans but never loads                                               | Windows Firewall — allow `node.exe` on Private networks. See `mobile-development.md`                                                                                                                                                                                                 |
| Phone and PC on different networks                                     | `pnpm dev:mobile --tunnel`                                                                                                                                                                                                                                                           |
| Dependency versions look wrong                                         | `cd apps/mobile && pnpm doctor`                                                                                                                                                                                                                                                      |
| Anything unexplained after changing deps                               | `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`                                                                                                                                                                                                    |

## Adding a dependency to the mobile app

Always from `apps/mobile`, and always through Expo so the version matches
the SDK:

```bash
cd apps/mobile
pnpm exec expo install <package>
```

Use plain `pnpm add <package>` only for packages that have no native side
and are not in Expo's version map.
