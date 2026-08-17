# Mobile Development (Windows)

`apps/mobile` is an Expo app. On Windows there is no iOS Simulator, so the
development loop has two tiers.

## Tier 1 — browser preview (fast)

```bash
pnpm dev:mobile:web
```

Runs the app through `react-native-web` at http://localhost:8081. Hot
reload is near-instant. Use it for layout, spacing, typography and the
design-system components.

Limits — do not trust the browser for:

- `expo-blur` (header blur renders only approximately)
- `@gorhom/bottom-sheet` (gesture behaviour differs)
- scroll momentum and press feedback

## Tier 2 — physical iPhone (truth)

1. Install **Expo Go** from the App Store.
2. Put the iPhone and the PC on the **same Wi-Fi network**.
3. Run:

   ```bash
   pnpm dev:mobile
   ```

4. Scan the QR code with the iPhone Camera app.

### Windows Firewall

The first run pops up a Windows Defender prompt for `node.exe`. Allow it
on **Private networks**. If it was dismissed, the QR code will load
forever — re-allow it under Windows Security → Firewall & network
protection → Allow an app through firewall.

### If the LAN is blocked

Corporate or guest Wi-Fi often isolates clients. Use a tunnel:

```bash
pnpm dev:mobile --tunnel
```

Slower, but works across networks.

## Stop the dev server before installing anything

On Windows, Metro holds open handles across `node_modules`. Running
`pnpm add` or `pnpm install` while `pnpm dev:mobile` is up either hangs
for tens of minutes or fails with
`ERR_PNPM_ENOENT ... scandir '...expo_tmp_<pid>_1/node_modules'`.

```bash
# Ctrl+C the dev server first, then:
pnpm add <package>
```

If an install has already wedged, kill every `node` process before
retrying — a half-finished install leaves a second pnpm waiting on the
store lock, which looks identical to a slow network:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## Notes

- No Xcode and no Android Studio are required for either tier. Everything
  in the stack (`docs/01-frontend/architecture.md`) runs inside Expo Go —
  no custom development build is needed.
- Native iOS/Android builds require EAS Build (cloud) — out of scope until
  release.
- pnpm's default isolated `node_modules` breaks Metro. `pnpm-workspace.yaml`
  sets `nodeLinker: hoisted` for this reason; do not remove it. Note that
  pnpm 11 reads these settings from `pnpm-workspace.yaml`, **not** from
  `.npmrc` — putting `node-linker` in `.npmrc` silently does nothing.
- `metro.config.js` keeps `disableHierarchicalLookup: false` **on purpose**.
  A hoisted layout does not mean a flat one: dependencies that pin their own
  version still get a nested `node_modules`. `@expo/metro-runtime` pins
  `pretty-format@29` while `apps/api`'s jest hoists `pretty-format@30` to the
  root. Disabling the lookup makes Metro resolve the root v30 ESM build,
  whose interop shape crashes the dev-only HMR client with
  `Cannot read properties of undefined (reading 'default')` — a blank white
  page on web, while `expo export` keeps working because the HMR client is
  not in a production bundle. Do not re-enable it.
