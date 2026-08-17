# Mockups

The approved UI mockup is a single self-contained HTML file (~1.5 MB —
fonts are embedded as base64). It is **not committed**: it bloats the repo
and diffs are meaningless.

Keep the file here locally and open it directly in a browser — no build
step:

```
docs/01-frontend/mockups/nha-ui-mockups.html   (gitignored)
```

Sections inside the file:

- **FLOW** — the screens to build, in order
- **BASE** — design system: icons, buttons, header, bottom nav
- **ARCHIVE** — superseded drafts, ignore

The implementable content has been distilled into `../design-system.md`
(tokens, component specs, family-tree rules) and `../screens.md` (screen
inventory). Those two documents are what implementation should read.

If the mockup is updated, update `design-system.md` in the same change —
the mockup is the source of truth for visuals, but only the markdown is
version-controlled.
