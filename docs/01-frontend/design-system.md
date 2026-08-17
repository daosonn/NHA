# Design System

Distilled from the approved UI mockups. Values here are authoritative for
implementation; `packages/tokens` is the machine-readable copy.

## Foundations

### Color

Page background `#FAF9F8`. Cards pure white. Coral is the only accent and
is reserved for: the primary button, the active nav tab, the "You" node in
the family tree, badges, and the active timeline node. It must not be used
for decoration.

| Role                         | Value                 |
| ---------------------------- | --------------------- |
| Page                         | `#FAF9F8`             |
| Card                         | `#FFFFFF`             |
| Subtle surface               | `#F4F2EF`             |
| Header (translucent)         | `#FAF9F8B8`           |
| Text primary                 | `#18181B`             |
| Text secondary               | `#52525B`             |
| Text muted                   | `#8A857E`             |
| Coral primary (fills)        | `#F58B7B`             |
| Coral brand (strokes, rings) | `#F0705F`             |
| Coral pressed                | `#E4776A`             |
| Coral deep (text on tint)    | `#B8422F`             |
| Coral tint                   | `#FDE7E2`             |
| Coral border                 | `#F5A497`             |
| Disabled surface / text      | `#F1EFEC` / `#B5B1AB` |

Category themes (memo tags, event widgets) each have `bg` / `text` / `dot`:
hobbies green, health violet, gift pink, memories amber, todo blue,
destructive red. Full values in `packages/tokens/src/colors.ts`.

### Typography

- **Inter** — all UI text.
- **Lora** — emotional headings and year tags only (`Dad's journey`,
  `1998`). Never for UI controls.

The mockups were drawn in Be Vietnam Pro. The product ships English first
and Japanese second, and Be Vietnam Pro has no Japanese glyphs, so Inter
replaces it — visually near-identical at these sizes. When Japanese lands,
add Noto Sans JP as a fallback instead of swapping the primary face.

| Token    | Size / line height |
| -------- | ------------------ |
| badge    | 10 / 12            |
| caption  | 12 / 16            |
| body2    | 13 / 20            |
| body1    | 15 / 21            |
| subtitle | 17 / 24            |
| h2       | 20 / 26            |
| h1       | 24 / 32            |
| display  | 26 / 34            |

Weights: 400 / 500 / 600 / 700.

### Radius

Pills and buttons `9999`. Cards `20–24`. Media thumbnails `12–16`. Phone
frame `44`.

### Icons

Lucide only, 24px, stroke 2 (2.2 at 16px so it survives). No hand-drawn
decorative icons. Mapping: House=Home, Network=Family tree,
History=Omoide, Sparkles=AI, UserRound=Profile, UserRoundPlus=Add member,
Bell=Notifications, ChevronLeft=Back, Ellipsis=More.

## Components

### Button

4 variants × 4 states × 3 sizes. Radius always `9999`. **Flat colors — no
shadow, no gradient.**

| Variant     | Default                                                | Pressed                  | Disabled                                   |
| ----------- | ------------------------------------------------------ | ------------------------ | ------------------------------------------ |
| Primary     | `#F58B7B` bg, white text                               | `#E4776A`                | `#F1EFEC` bg, `#B5B1AB` text               |
| Secondary   | white bg, `#B8422F` text, 1.5px `#F5A497` inset border | `#FDE7E2` bg             | white bg, `#B5B1AB` text, `#E7E5E2` border |
| Ghost       | transparent, `#52525B` text                            | `rgba(24,24,27,0.06)` bg | `#C4C1BC` text                             |
| Destructive | white bg, `#C13B3B` text, `#EFB4B4` border             | `#FBEAEA` bg             | same as others                             |

Destructive also has a solid form: `#D14343` → pressed `#B93A3A`.

Sizes: Large 52 (font 16, padding 26), Medium 44 (font 15, padding 22),
Small 32 (font 13, padding 14). Icon sits left of the label, gap 8, 20px
at medium and 16px at small.

Loading keeps the label and replaces the leading slot with a 16px spinner
ring. Disabled is always the neutral gray — never a faded coral.

Full-width for form submit and post actions; hugging width inside cards
and sheets.

### Header

56px tall, side padding 20 (16 when the right slot is a 40px icon button).
Background is the translucent page color `#FAF9F8B8` with a 20px blur and
**no border** — separated from content only by
`0 2px 10px rgba(24,24,27,0.06)`. Same treatment on every screen.

Three layouts: back + title, close + title, and brand wordmark + bell.

### Bottom navigation

98px tall, translucent white with 20px blur and a hairline top border.
Five items: Home · Omoide · **+** · AI · Profile.

- Active: icon in `#F58B7B` inside a 44×26 `#FDE7E2` pill, label 600 in
  `#18181B`.
- Inactive: icon and label in `#A1A1AA`, weight 500.
- The center **+** is a 44px coral circle raised 6px above the row.

### Card

White, radius 20, padding 14–20, shadow
`0 8px 24px rgba(24,24,27,0.05)` plus a `1px rgba(24,24,27,0.06)` inset
border.

## Family tree

- Nodes are 60px avatars with a 3px warm-white ring.
- The current user is 68px with a coral ring, a soft coral halo, and a
  `YOU` pill below the name.
- Connections are a **single 2.2px curved coral-tinted stroke** that
  leaves the couple joint (a small coral dot) and enters the child's
  avatar edge — organic bezier threads, never right-angle branch lines.
- Labels sit below the avatar: name 600/11.5, relationship 400/10 muted.
- Canvas background is coral tint `#FDE7E2` with a soft white radial
  highlight, radius 26.
- Zoom / recenter controls float top-right; the add-member button floats
  bottom-right.

### Node lifecycle

| State      | Appearance                                                        |
| ---------- | ----------------------------------------------------------------- |
| Empty spot | dashed coral border, translucent fill, `+` icon, label "Add here" |
| Pending    | dashed border, clock badge, dashed thread, muted name + "pending" |
| Active     | real photo, solid ring, solid thread, green check badge for 24h   |
| Settled    | plain node, badge gone                                            |

The spot is reserved the moment an invite is sent — node id, relationship
and generation are already fixed, so accepting only attaches a profile. If
the invite is cancelled or expires the node falls back to Empty and the
thread disappears.

## Logo

Flat two-color mark: a solid coral house silhouette with a heart cut out
in blush negative space, reading like an envelope opening onto a note
inside. Coral `#F58B7B` on blush `#FDE7E2`. No gradients or shadows in the
mark. Holds together down to 16px.

## Source

The original interactive mockup is an HTML file kept outside the repo; see
`mockups/README.md`. When the mockup and this document disagree, the
mockup wins — update this file rather than deviating silently.
