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
replaces it — visually near-identical at these sizes.

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

#### Japanese type — chosen, not yet bundled

Neither Inter nor Lora has Japanese glyphs, so this is a font swap, not a
fallback. React Native has no synthetic bolding: every weight is a
separate loaded family, so a face that ships fewer weights takes the whole
scale down with it.

| Slot                         | Face                             |
| ---------------------------- | -------------------------------- |
| Emotional headings (`serif`) | **Zen Maru Gothic** Bold/Black   |
| Body and UI                  | **Noto Sans JP** 400/500/600/700 |

Zen Maru Gothic replaces Lora: its rounded terminals answer the rounded
cards, pills and avatar rings the whole UI is built from, where a Mincho
would read as a newspaper.

The body face is Noto Sans JP rather than Zen Maru Gothic Regular for two
reasons. Its 400/500/600/700 statics map one-to-one onto the Inter roles
above, so nothing in the weight scale has to be re-tuned. And rounded
terminals lose definition at 12–14px once the glyphs are dense kanji —
this app is explicitly read by grandparents, and `caption` at 12px is
where that would show first.

So the pairing is warm where the app is being warm, and plain where it is
being read.

Until they are bundled, Japanese renders in the **device font** with a real
`fontWeight` — `theme/typeface.ts` makes that swap, and it is the only
place that decides a font family. The cost of bundling is ~30–50 MB of
TTF across the six weights, which is why it is a separate decision.

### Radius

Pills and buttons `9999`. Cards `20–24`. Media thumbnails `12–16`. Phone
frame `44`.

### Width and breakpoints

The design is drawn for a phone and that stays the base. What it must not do
is simply grow: every screen used to be `viewport - two gutters` wide at any
size, so at 1440 a post card measured 1400px across and a line of its text
ran to about 200 characters.

**Content lives in a column with a ceiling of 600px, centred.** Gutter stays
`spacing.xl` (20). The ceiling counts the gutters — React Native and
react-native-web both measure `maxWidth` against the border box — so a
window narrower than 600 is laid out exactly as before and the phone design
is untouched rather than re-derived. Above 600 the column is a constant
560px of content and the sides are empty on purpose.

| Window | Column | Content | Each side |
| ------ | ------ | ------- | --------- |
| 375    | 375    | 335     | 0         |
| 600    | 600    | 560     | 0         |
| 768    | 600    | 560     | 84        |
| 1024   | 600    | 560     | 212       |
| 1440   | 600    | 560     | 420       |

Two things stay full-bleed, and both are deliberate: **chrome** — the header's
blurred bar, a footer bar's surface and top border — because chrome that stops
short of the edge stops reading as chrome; and the **family tree canvas**,
which is a map, where more room is more tree. In both cases what sits _on_
them is still held to the column, so a wordmark, a bell or a group strip never
drifts away from the page it belongs to.

Breakpoints are `md` 768, `lg` 1024, `xl` 1280, matching Tailwind's own
defaults so a `lg:` class and a JavaScript comparison cannot disagree. There
is deliberately **no `sm`**: the ceiling above already carries everything
between a phone and a tablet with no breakpoint at all, and a breakpoint
belongs here only where the layout stops working — never because a popular
screen happens to be that wide.

`lg` is **the only breakpoint the layout actually branches on**: the floating
bottom bar becomes a side rail (§ Side navigation). `md` and `xl` exist for a
component that already styles with classes to reach for locally; nothing
structural hangs off either. `xl` briefly did — a second, wider sidebar — and
that turned out to be a hover, not a breakpoint.

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
| Neutral     | white bg, `#18181B` text, 1.5px `#E7E1DC` border       | `#F4F2EF` bg             | white bg, `#B5B1AB` text, `#E7E5E2` border |
| Ghost       | transparent, `#52525B` text                            | `rgba(24,24,27,0.06)` bg | `#C4C1BC` text                             |
| Destructive | white bg, `#C13B3B` text, `#EFB4B4` border             | `#FBEAEA` bg             | same as others                             |

Destructive also has a solid form: `#D14343` → pressed `#B93A3A`.

**Neutral** carries no brand opinion. It is for identity providers, whose
logos must keep their own colours, and for a secondary action standing
beside a primary one where coral would make them compete.

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

A **floating pill**, 68px tall, inset from both edges and lifted 20px above
the home indicator. Translucent white over a 30 blur. Five items:
Home · Omoide · **+** · AI · Profile.

- Slots **flex evenly** — no fixed slot width. At the 390px reference they
  land near 70×52, with a 22px icon above a 10px label.
- Active: a `coral.light` block behind the whole slot, radius **`full`** — a
  pill inside a pill — with the icon and label both `coral.deep` (4.6:1) and
  the label semibold. It was `2xl` (18) until 2026-08-25, which pinched: the
  bar's own cap is a 34 radius, so an 18-radius chip clears it by only ~3px on
  the corner diagonal against 6px along the flat, and the selected slot read as
  both squarer than the bar containing it and crowded against its end. At
  `full` the two caps are concentric enough that the clearance is an even 6px
  the whole way round, and no padding had to change to get it.
- Inactive: icon and label `text.secondary`, label medium.
- **There is no raised centre button any more** (owner's calls, both
  2026-08-26, **deviating from the mockups — ratify or revert**). The
  mockups' centre was a raised coral + that posted, and it kept being
  misread as "add family" beside the strip's own +. It became the family
  tree for a few hours, still as a raised disc — and then the disc itself
  went: one slot dressed as a button among four destinations reads as an
  action, and the tree is not an action. The bar is now **five ordinary
  slots** — Home · Omoide · **Family tree** (`Network` glyph, a real tab,
  label 家系図) · AI · Profile — all sharing the same pill, pop and label
  treatment. Posting moved to a **compose bar on Home**
  (`home/compose-bar.tsx`: pen, "Share today's moment…", a 36px coral
  disc; one tap opens `/new`, a root Stack screen since 2026-08-26 that
  rises like a sheet and closes through its ✕ — see `architecture.md`
  § New moment). It
  started the day pinned above the feed and moved the same day into the
  scrolling intro, **right under the swipe cue**: pinned, it pushed the
  celebration card below the fold and read as chrome; under the cue it
  sits at the top of the moments it creates. The
  known cost, recorded: posting from another tab is now two taps (via
  Home) instead of one.

Redrawn 2026-08-21 from a full-width slab with a hairline top border. A slab
cuts the page in two; inset with a radius, content keeps running underneath
and the screen stays one thing. Screens reserve `BOTTOM_INSET` for it —
140, or 160 where the last row is tall.

**It is sized from the screen, not from a constant.** It used to be a fixed
294px that hugged its contents, which put the same absolute bar on every
phone: 78% of the width on an SE, 68% on a 15 Pro Max. Identical in points
and visibly meaner on the big screen, which is how it was reported. Two
things fix that together:

- The bar **spans the width it is given** — screen minus a 16px margin each
  side, capped at 460 — and the four destinations flex into what is left
  after the compose circle. It keeps its proportion (91–93% on every phone)
  instead of its pixel count.
- Everything on it **scales with the screen**, `width / 390` clamped to
  [1, 1.14]. Nothing shrinks below the reference — the small phones were
  right already, and fixing a big screen must not spoil them. A 15 Pro Max
  gets a 75px bar with 24px icons; a desktop browser stops at 78 and 25,
  because a tab bar that grows without limit becomes a remote control.

Scale is measured against the **screen**, not the bar: the bar is already
the screen minus two margins, so measuring against it keeps the ratio near 1
and the scale never engages. That was the first attempt, and it did nothing.

**The labels stay.** They were dropped and restored the same morning, so the
reasoning is worth keeping: dropping them borrows from apps whose icons
everybody learned a decade ago, and these are not those icons. `History`
for 思い出 and `Sparkles` for the AI tab name nothing anyone can guess — a
clock could as easily mean "recent", a sparkle "highlights" — and two
legible glyphs out of five is not enough to run a navigation bar on. This is
an app families use together, grandparents included, where an unlabelled
glyph is a quiz.

Tab words come from `nav.tab.*`, not `nav.*`: a 54px slot needs a shorter
word than a screen header does (プロフィール does not fit, マイページ does).
The visible label and the accessibility label are the **same string**, so
somebody using voice control can say what they see.

**It is only drawn below 1024px.** From there up the same destinations are a
side rail, below.

### Side navigation

From `lg` up, the four destinations and compose move down the left. A floating
bar of five buttons at the bottom of a 1440px window reads as a remote control:
far from the content, far from the pointer, and spending 140–160px of every
screen's height on itself. Vertical it costs 76px of width the page had going
spare, and it stays on screen while a Life Profile or a post is open — which is
what separates a web app from a phone app being looked at through a window.

**It rests closed and opens under the pointer.** A 240px panel of labels
standing permanently open beside a 600px column spends most of a third of a
1920px window on four words; that was built on 2026-08-25 and read as top-heavy
on the first screenshot of it. So the resting state is glyphs only, and hover
reveals the words.

|                                                                     | Closed          | Open (hover)      |
| ------------------------------------------------------------------- | --------------- | ----------------- |
| Width                                                               | 76 (a pill)     | 240               |
| Brand                                                               | mark only, 26px | mark only         |
| (no disc — five plain rows since 2026-08-26; compose lives on Home) |                 |
| Destination                                                         | 48px glyph      | glyph, then label |

Three things make opening read as one object moving rather than two states
swapping:

- **It opens over the content, not into it.** The 76px is real layout — a flex
  sibling of the navigator — and only the opening is an overlay. Reflowing a
  feed because a pointer crossed the left edge would be worse than the labels
  being 170ms away. Out in 170ms, back in 130ms.
- **Nothing moves horizontally.** Every glyph sits 38px from the left edge,
  which is the centre of the closed rail by construction, so widening the panel
  only ever uncovers what was already beside it.
- **Labels are clipped and faded, and the glyph cannot shrink.** No second
  layout exists — which is why compose needs no second component: a square row
  with a `full` radius is a disc closed and a pill open. But two details in
  that row are load-bearing, and getting either wrong was what made the first
  build of this show four truncated _words_ where the icons belonged:
  - The glyph sits in a box with `flexShrink: 0`. On web `react-native-svg`
    renders a real `<svg>`, which does **not** inherit react-native-web's
    `flex-shrink: 0` the way a `View` or `Text` does — so in a row too narrow
    for its contents the icon was the only flexible thing in it, and collapsed
    to a sliver.
  - The label fades in from 45% of the opening, rather than relying on the clip
    alone. 76px of rail against a label that starts at 61px leaves 14px of the
    first character showing at the edge, which is what read as "ホ…".

**It is the bottom bar, stood up.** Same glass — 30 blur under 86% white —
inset 16 from the window edge, with the `floating` shadow, and a **38px corner
that never changes**: half the closed width, so it is a true vertical pill at
rest. Not `radius.full`, which the browser clamps to half the shorter side and
would therefore grow to 120 as the bar opens, turning a rounded panel into a
lozenge halfway through the animation.

It **hugs its contents** rather than running the height of the window, and it
is **centred down the window**, inside the safe area. A full-height panel with
a border is a piece of furniture; this is the same floating object the bottom
bar is, in a different position, and the two should not need explaining
separately. The column it reserves is `76 + 16 + 16`, so content beside it
starts clear of the glass rather than against it.

Centred, not top-aligned — which is what it was first built as, on 2026-08-25,
and it read as having slid up out of position. A bar hung from the top has no
edge up there to belong to, the way the bottom bar belongs to the bottom one;
and centred it also sits nearest where a pointer rests. It is centred by the
reserved column (`justifyContent: 'center'`) rather than by absolute
positioning, because a box cannot be centred on its own height without
measuring it first.

Active state is the same `coral.light` block with `coral.deep` glyph and label,
so a destination looks selected the same way in both navigations.

Only the exactly-matching destination is highlighted, so with a profile or a
post open nothing is — which is true, and better than implying the tab
underneath is where the reader is.

**The known cost.** A touch device wide enough for the rail — an iPad in
landscape — has no pointer, so it only ever sees glyphs, and § Bottom
navigation argues two sections up that these particular glyphs carry no meaning
on their own. The accessibility label is still the word, so voice control and
screen readers are unaffected; what those readers lose is the visible label.
Below 1024px — every phone, and a tablet in portrait — the labelled bottom bar
is untouched. If this proves to matter, the answer is a pinned-open state, not
a breakpoint.

Home keeps its wordmark in the header at every width. The rail rests as glyphs,
so the app needs one place that says its whole name, and without it the header
row on a wide window is a bell and 1500px of nothing.

It is mounted in `app/_layout.tsx`, beside the whole `Stack`, **not** in
`(tabs)/_layout.tsx` where the bottom bar lives: a pushed screen sits above the
tab navigator, so a rail mounted inside it would vanish the moment somebody
opened a person's page. A plain flex row, so no screen has to know the rail
exists — the content column simply centres in a narrower space. It is hidden
while signed out, on the public invitation page, and while the keychain read is
still in flight.

Hover is `onPointerEnter` / `onPointerLeave` on the panel, never a `Pressable`
wrapper: `react-native-web` turns every `accessibilityRole="button"` into a real
`<button>`, and a button around four buttons swallows the presses inside it —
the same trap the group strip is written around.

### Auth on a wide window

From `lg` up, Welcome and the four password screens become **two halves of the
window**: the brand on the left, the form on the right, both full height, split
down the middle.

The content column alone was not enough here, and this is the one place in the
app where that is true. It kept the form at a readable 600 — nothing stretched
— but an auth screen is a full-height column by construction: hero at the top,
actions under it, the slack pushed to the bottom. At 1280 that reads as a coral
band the width of the window with a 58px mark alone in the middle of it, and a
form pinned to the top of an otherwise empty page. Correct, and not what
somebody signing in to a website is shown.

|            | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Split      | 50 / 50, both panes `flex: 1`, full height, no divider                |
| Brand pane | `coral.light`; mark 52, headline, subtitle, `CatHappy` 104, faces 32  |
| Form pane  | `background.card`; the form centred, footer as the tail of that group |
| Contents   | each pane centres a **420** column inside itself, padding 40          |

**It was a centred 960px card first, on 2026-08-25, and that was wrong in a
way worth keeping written down.** A card floating in the middle of a 1920px
window is a _dialog_, and a sign-in screen is not a dialog interrupting
something — it is the page. Filling the window is what makes it read as one.

The panes are full-bleed; their **contents are not**. Half of 1920 is 960, and
neither a headline nor a form belongs at that width, so each pane centres a
420px column — the same reasoning as the content column elsewhere, at the width
a form wants rather than the width a feed wants.

No divider: `coral.light` against white is already an edge, and a hairline on
top of a colour change is a line for its own sake.

**The footer is not pinned here.** `FormScreen` pins it on a phone for exactly
one reason — the software keyboard, which will cover a submit button that
scrolls. A physical keyboard covers nothing, and pinning it to the bottom of a
1080px pane would leave 400px of white between the last field and the button
that submits it. So submit and the social buttons are the tail of the same
centred group.

The brand pane says what the app is, from the **same copy Welcome already
uses** (`auth.welcome.title` / `.subtitle`, the mark, the avatar stack) — moved
into `layout/auth-shell.tsx` rather than copied, so arriving and signing in are
met by the same sentence. No new i18n keys.

The faces themselves were the exception to that, and were fixed on
2026-09-03: each screen held its own copy of the list, so one row of people
lived in two places. They now come from `fixtures/welcome-faces.ts`. They
also carry **names** now — without one `Avatar` falls to its last tier, the
striped placeholder, so the row read as four grey hatched circles, which
proves nothing about a family being there. Initials on a per-name tint, not
photographs: the point is not worth shipping a real family's private
pictures for. A `mediaId` on an item is all real pictures would need, since
`Avatar` already prefers a photograph over the letters.
Names live in a fixture rather than the catalogues on purpose —
`architecture.md` files a name under _the data_, beside a memo's content.

**The cat is here on purpose**, `CatHappy`, directly above the faces so it
reads as being _with_ the family rather than as a second illustration. That is
a deliberate reading of the motion kit's rule, not an oversight:
`motion/README.md` reserves the cats for one-time emotional moments and forbids
them in chrome and on daily actions, and this pane is neither — it is the app
introducing itself, on the screen whose whole job is that. `CatHappy` of the
four because the pane is a welcome, not a wait.

The header goes: a full-width blurred bar carrying one back arrow, above two
full-height panes, belongs to neither. Back sits absolutely at the top-left of
the form pane, so it cannot pull the form off centre.

**Below `lg` nothing changes at all.** Welcome keeps its edge-to-edge coral
hero, and `FormScreen` keeps the shape it has. That matters, because a centred,
shrunken Welcome card was tried and reverted on 2026-08-21 — this does not
reopen that: it applies only where there is a pointer and 1024px, which is not
what was reverted.

It is opt-in per screen, `FormScreen variant="auth"`, and only signing in and
out use it. `FormScreen` also serves "New family", "Change password" and
"Edit profile"; a marketing headline beside a form somebody already inside the
app opened on purpose would be a different mistake.

### Card

White, radius 20, padding 14–20, shadow
`0 8px 24px rgba(24,24,27,0.05)` plus a `1px rgba(24,24,27,0.06)` inset
border.

### Segmented tabs

A 4px-padded `#F4F2EF` track, radius `9999`, segments `flex-1` at height 44.
The active segment is a **white pill** with the card shadow — deliberately
not coral, which would be a sixth accent use. Active label 600 primary,
inactive 500 muted, optional count appended in the muted tone.

Used for Timeline / Album / Memo on the Life Profile and for Link / Contact
in the invite sheet.

### Form fields

Input is white, radius 14, 1.5px `#E7E5E2` border, 15px text. Focus swaps
the border to coral brand and adds `0 0 0 4px rgba(240,112,95,0.1)`.

The label **floats** (`motion/floating-label-input.html` and
`…-textarea.html`, 2026-08-25): it rests inside the box and rises on focus
or content, walking muted → coral as it goes. Only the AI screens' tiny
uppercase section style (`uppercaseLabel`) keeps a static label above.
Single-line fields with `maxLength` count up (`4/24`) inside the box;
textareas count **down** in the bottom corner, warning-coloured near the
limit.

React Native has no synthetic bolding, so every weight is a separate font
family — `TextInput` must set `fontFamily` explicitly or it falls back to
the system face.

Optional slots, all on the same component:

| Slot       | Behaviour                                                       |
| ---------- | --------------------------------------------------------------- |
| Icon       | Leads the field, muted at rest and coral brand on focus         |
| `secure`   | Masks the value and adds an eye toggle at 44px effective target |
| `error`    | Red border, red message replacing the hint — never both at once |
| `trailing` | A control inside the box after the counter (chip-input's Add)   |

**The composer shape** (`maxHeight`, 2026-08-26) is the same component in a
different posture, built for the comment box: it starts **one line tall**
(~47px, matching the 44px send button beside it instead of towering over
it), grows with the text, and stops at the given height — five lines for
comments — scrolling inside rather than walling off the screen. Two rules
fall out of the scrolling: there is **no floating label** (once the text
scrolls it slides up under where the label sits, two texts in one spot — so
the label becomes the accessibility label only and the placeholder does the
talking), and the countdown appears **only near the limit**, because a
corner "2000" on an empty box is noise. The paragraph shape (bio, captions)
keeps its fixed 104px box.

### Checkbox

20px, radius 8. Off is white with a 1.5px `#E7E1DC` border; on is a coral
fill with a white check. **The label is part of the touch target**, and it
is plain text rather than a nested pressable — an interactive element
inside another one is invalid markup on the web, and a checkbox whose words
cannot be tapped is a small cruelty on a phone.

### One-time code

Six boxes, `flex-1`, 62px tall, gap 9. The active box takes the coral focus
border and shows a 1.8×24 coral caret when empty.

The boxes are a **drawing**; the input is one real field stretched over
them at zero opacity. Six separate inputs would each need focus juggling
and would break paste, autofill and the one-time-code suggestion strip —
all of which matter more than the illusion of six fields.

### Divider and text link

Divider is a 1px `#E7E1DC` hairline, optionally interrupted by a word.

A text link is coral `#DE5947`, semibold, no underline: the accent already
means "this is the way forward" everywhere else, and underlines would
compete with the timeline threads.

### Sheet

Bottom sheet: scrim `rgba(24,24,27,0.45)`, white panel with a 24px top
radius, a 36×4 grabber, then title / subtitle / body / actions. Slides up.

Currently a plain React Native `Modal`; `@gorhom/bottom-sheet` is still the
choice for anything that needs snap points or drag-to-dismiss.

### Action badge on an avatar

An action that changes a face belongs on that face. Edit on a Life Profile
is a 34px coral circle at the avatar's bottom-right with a 2.5px gap ring
in the page colour — the same construction as the Pending clock badge on a
tree node.

This is a badge, which is one of coral's five permitted uses. It also keeps
the space between the name and the section tabs empty, which is what makes
a profile read as a person rather than as a toolbar.

### Group strip

**On the family screen only since 2026-08-26** — it left Home when the
tree moved onto the bottom bar and posting became Home's compose bar
(§ Bottom navigation). Switching
families now happens where the trees are. The strip itself is unchanged:

The family switcher: 40px faces set 6px apart, a dashed
coral circle that starts an invite, then the way into the family tree.

That last one is a **filled cap** at the tray's right end: 44px tall,
`coral.light`, `coral.deep` label and `Network` glyph, no border.

**Grown from 34px on 2026-09-03**, with the selected face's ring changed
from `rgba(240,112,95,0.35)` at 3px — one pixel at 35% opacity over the gap
ring — to a solid 2px `coral.brand`. 34 was the size this row was given
when it was a _preview_ on Home; as the tree's switcher it is the only
control naming the tree on screen, and it was also below the 44pt touch
minimum.

Rings here are `boxShadow`, painted outside the element's own box, so the
horizontal scroller that keeps a long row reachable **must be padded by the
ring's bleed** or it shaves the faces: `overflow-y` is hidden and the
scroller is only as tall as the faces in it. Before that padding the
selected family read as a circle with a flat top and bottom.

It took three attempts on 2026-08-21, and the two failures are the useful
part:

1. A 12px `text.muted` word beside a white chevron in a white circle. It
   disappeared — muted grey is the colour of every caption on the screen.
2. A white pill with a coral **border**, inside the tray. Border inside
   border inside border: a button dropped in a drawer.
3. The pill moved out of the tray onto the page. The row then read as two
   unrelated objects.

A **fill** inside a container is ordinary — a chip in a bar — where a
second outline was not. That is the difference between (2) and what is
there now, and it is not a colour difference.

**The prominence is structural, not chromatic.** The strip was the feed's
first row and was gone after one flick, which no amount of contrast can
fix. It is now **pinned below the header on Home** and condenses to 86%
(52 → 45px tall) over the first 90px of scroll, the way a nav bar does. On
a pointer device the cap grows to 1.06 on hover; the fill cannot darken
instead, because that drops the label below 4.5:1.

Scroll position reaches the strip as a Reanimated `SharedValue`, never
React state — sixty re-renders a second of the feed to shrink a bar by
seven pixels is not a trade worth making. It is read once in a
`useDerivedValue`; a shared value read inside a helper that a worklet
merely _calls_ is not reliably picked up as a dependency.

The same `scrollY` fades the swipe cue underneath — the "swipe up for
moments" hint drops to nothing over the first 50px and drifts up 6px as it
goes. An instruction that stays up after it has been followed is no longer
an instruction; it is furniture, and this one sits directly above the
moments it was pointing at.

The rules that fixed it generalise:

- **A destination is a control.** If it navigates, give it the button
  shape, not caption styling with a chevron beside it.
- **Solid coral cannot carry a label.** `coral.primary` gives white text
  2.4:1 and `coral.brand` 2.9:1 — a filled brand pill with a readable
  label does not exist in this palette. `coral.deep` on `coral.light` is
  4.6:1 and on white 5.4:1; those are the two branded fills available. It
  also leaves solid coral to the primary action on the screen, which must
  stay the heaviest thing.
- **When it still reads too quietly, reach for size and position before
  colour.** Both were cheaper here than any tint, and both worked.
- **A fill nests; an outline does not.** Putting a bordered control inside
  a bordered container reads as a mistake at any colour. Filled chips
  inside bars are unremarkable.
- **Before spending more contrast, ask whether the thing is even on
  screen.** Pinning beat every colour change tried before it.
- **Pick a glyph that says something the neighbours don't.** `UsersRound`
  is the family tree's mark elsewhere, but beside a row of faces it reads
  as "more people". `Network` says structure.

### Join banner

The way into a group you were handed a code for, on the family screen
under the group strip (mockup 7a, 2026-08-26). One 44px row: white, radius
14, a warm inset border (`inset 0 0 0 1.4px #F0DCC5` — not a token, the
one warm-tan line in the app), `LockKeyhole` 17 in `coral.deep`, muted
"Have an invite code?" filling the middle, and "Join a group" semibold
`coral.deep` at the right. The whole row is one button; it opens
`/create-family` directly on its Join tab (`mode=join`).

It exists because the join screen was reachable only from Home's
no-family empty state: someone already in family A, read a code for
family B over the phone, had nowhere to type it — even though the code
alphabet (no I/O/0/1) was chosen for exactly that phone call. The strip's
`+` stays "create a new group" on purpose; joining is a different intent
with its own door.

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

Implementation note: the thread is data, not styling. A **Pending** child
has a descent entry that renders dashed; an **Empty** spot has no descent
entry at all, so no line is drawn to it. Nothing has been promised yet, and
the tree must not draw a line to a promise that was not made.

Tapping an Empty node opens the invite sheet with that node as the spot.

### Sent invitations

Outstanding invites used to be a white pill floating over the top-left of
the canvas ("Waiting for {name}" + Resend). **Removed 2026-08-26**: the
tree is a map, and a card parked on it covered the very people being
looked at — and the banner had no cancel, which is how a reserved spot
became unremovable (see the ghost-member story in `project-status.md`).

They are a screen now, `/family/invitations`, behind a **paper-plane at
the family screen's top right** carrying the waiting count as a badge (the
bell's badge anatomy exactly). Each row keeps the banner's shape — clock
chip, name, "Invited as {role} · {sent} · {expires}" — plus **Resend and
Cancel**. A lapsed invitation stays actionable (`EXPIRED` is derived; the
row is still PENDING underneath): Resend revives the same code, Cancel
frees the reserved spot. Accepted and cancelled rows stay listed as
history, dimmed, with a status word instead of actions.

**Tapping the name reveals the code** — the `InviteCodeCard` (grouped
`K7M2 QRXP`, Copy button), one row open at a time, with the expiry as its
subtitle (or "resend to make this code work again" on a lapsed one). This
is how a sender who closed the invite sheet without copying gets the code
back. The reveal is the name area's own button, not the whole row — a
row-wide button around Resend and Cancel would be the nested-`<button>`
trap. A resolved row reveals nothing; its code is dead.

The member sheet is the second door to the same cancel: long-press a
pending node and the destructive action reads "Cancel the invitation"
instead of Remove.

### Timeline editor

Your own Timeline tab carries a serif "Your journey" heading with an
**Edit** link (mockup `edit-timeline-view-edit.html`, 2026-08-26 — drawn
locally in `mockups/`, distilled here). It opens a pushed screen whose
header is **Cancel · Edit timeline · Done**, and whose whole point is that
it is **staged**: the banner under the header says "Entries sort by year
automatically. Changes are only visible to you until Done", and the screen
keeps that promise — edits live in a local draft, and Done sends the batch
(deletes, then edits, then additions). Cancel walks away and the drafts die
with the screen.

The pieces: a dashed **"Add an entry"** tile above the list; each entry as
a white card on the same rail-and-dot thread the read view draws, with a
serif year chip (`#FEF3F1`/`coral.deep`), pencil and trash at its top
right; a new, uncommitted entry rendered dimmed with a gray year chip and
"Draft · not saved yet". The entry form is a sheet: a date field that
accepts `1998` or `1998-06-12` (year-only lands on Jan 1), title
(required), story, place, and **photos** via the moment composer's own
`MediaStrip` + picker (2026-08-26).

Photos follow the staging rule all the way down: picked files stay LOCAL
in the draft, and `Done` uploads them (`uploadDrafts`, the shared upload)
just before writing each entry — an abandoned draft leaves no orphan
uploads.

**A saved entry's photos are editable too since 2026-09-03**, in the same
strip and with the same X, because `mediaIds` became replaceable on PATCH
(`api-contract.md` § Life events → Media). Until then the picker appeared
only on an unsaved entry and a saved one's form said "photos can't be
changed after saving" — honest about the API, but it meant a photo on the
wrong milestone could only be fixed by deleting the milestone.

One strip serves both because a tile says which it is: `DraftMedia.mediaId`
means the file is already on the server (draw the authenticated thumbnail,
send the id back), `uri` means it is a local pick (draw the file, upload
it). The editor used to hold those as two separate fields.

Removing a saved photo **deletes it, file and all**, when Done commits —
a `Media` row may have one parent, so an unparented row is invisible to
everyone and an orphan on disk. So the strip carries a line saying so
("Removing a photo deletes it for good when you press Done") rather than
only an X. A confirmation dialog on top of that is an open product call.

**The photos are drawn, not counted** (`member/event-photos.tsx`): one
photo runs the card's width at 110, several become a row of squares with
"+N" on the last — the mockup's layout — and the same component now draws
them on the READ timeline too, which until 2026-08-26 said "3 photos"
where the photographs belonged. Editor cards draw one list — a saved
photo through `thumbnailSource` and a just-picked one from its local
file, side by side, which is what an entry mid-edit actually is — so an
entry looks like the same entry with the tools out.

One limit stays: **own profile only** — the mockup is drawn on Dad's
page, but offering this on placeholder (wiki) profiles is the recorded
open question, and the editor is one `memberId` parameter away when the
team decides.

## Logo

Flat two-color mark: a solid coral house silhouette with a heart cut out
in blush negative space, reading like an envelope opening onto a note
inside. Coral `#F58B7B` on blush `#FDE7E2`. No gradients or shadows in the
mark. Holds together down to 16px.

## Motion

> Spec handed off from Claude Design 2026-08-24: `motion/nha-motion.css`
> (tokens + keyframes, written as web CSS), `motion/nha-cats.svg` (four
> mascot cats), `motion/README.md` (the designer's usage rules). The CSS
> does not run in React Native — it is the **reference**; the running
> implementation is the translation below. When they disagree, the spec
> wins: fix the translation, don't fork the values.

One vocabulary, three homes:

| Layer          | Where                                | What                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens         | `packages/tokens/src/motion.ts`      | Durations (press 120 · select 200 · sheet 320 · screen 420 · enter 520), stagger 55, 3 easings                                                                                                                                             |
| Reanimated map | `apps/mobile/src/theme/motion.ts`    | `easing.settle/bounce/snap`, `enter.up/fade(index)`, `exit.fade/down`, `toastIn`, `pop`, `screenTransition` (the stack's push-from-the-right preset)                                                                                       |
| Primitives     | `apps/mobile/src/components/motion/` | `usePressScale()` — press feedback for anything tappable; `useScreenSheet()` — a route that rises like a sheet (the compose screen; hand-driven because native-stack animations never run on web); more only as shipping screens need them |

Rules, from the handoff:

- **Calm motion for repeated actions** — presses, screen changes, sheets,
  tabs, chips, AI skeletons. Durations are named for the moment, never
  typed as numbers in a screen: a one-off `FadeInDown.duration(250)`
  inline is the motion equivalent of a hex color.
- **The cats appear only at one-time emotional moments**: waiting on AI
  for 10s+, empty states, and a just-sent/just-done screen. Never in
  chrome, never on daily actions. They are not built yet — when one of
  those moments is, author the needed cat as a `react-native-svg`
  component from `motion/nha-cats.svg`, animated with the same tokens.
- **Animate only `transform` and `opacity`** — width/height/top/left
  stutter on weak devices, which this audience owns.
- **Reduced motion costs nothing here**: Reanimated defaults every
  animation to `ReduceMotion.System`, so the OS switch collapses them all
  centrally. Never override that per-component.

## Copy

No component writes English into itself. Every user-visible string is a
key in `apps/mobile/src/locales/en.json`, read through `t()` — including
accessibility labels, which are read aloud and so are copy too.

Primitives split into two kinds:

- **Given its words** — `Button`, `EmptyState`, `SectionHeader`,
  `Chip`, `PlaceholderScreen`. These take `label` / `title` /
  `description` as props and stay ignorant of the catalogue; the caller
  passes an already-translated string.
- **Owns its words** — `TextField` (show/hide password), `SelectField`
  ("Close"), `OtpInput`. Their copy is part of the control, not of the
  screen, so they call `t()` themselves.

Counts always go through i18next plurals with `{ count }`, never a
ternary: Japanese has no plural form, and `n === 1 ? 'photo' : 'photos'`
bakes in the assumption that every language does.

See `architecture.md` § Language for the catalogue layout, the
content-versus-copy boundary, and `pnpm --filter mobile check:i18n`.

## Source

The original interactive mockup is an HTML file kept outside the repo; see
`mockups/README.md`. When the mockup and this document disagree, the
mockup wins — update this file rather than deviating silently.
