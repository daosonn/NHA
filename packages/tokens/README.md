# @nha/tokens

Design tokens as plain TypeScript constants. **No framework imports** — no
React, no React Native, no Tailwind. Both clients consume the same values:

- `apps/mobile` — NativeWind (Tailwind 3.4)
- `apps/web` — Tailwind 4

Each app maps these tokens into its own `tailwind.config`; the two Tailwind
majors are not interchangeable, the tokens are.

```ts
import { colors, radius, shadow, spacing, typography } from '@nha/tokens';
```

Compiled to CommonJS so it can be `require`d from a `tailwind.config.js`.

```bash
pnpm build:tokens      # from the repo root
```

Visual rules that these values encode live in
`docs/01-frontend/design-system.md`. Change that document and this package
together.
