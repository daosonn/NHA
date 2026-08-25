/**
 * How wide things are allowed to get.
 *
 * Every screen used to be `viewport - two gutters` wide at any size. That is
 * correct on a phone and wrong from roughly 600px up: at 1440 a post card
 * measured 1400px across and a line of its text ran to about 200 characters.
 * So content lives in a column with a ceiling, centred in whatever space
 * there is, and the empty sides are the point rather than a mistake.
 *
 * The ceiling counts the gutters, because React Native and react-native-web
 * both measure `maxWidth` against the border box. Below the ceiling the
 * column is therefore exactly the width it always was, which is why nothing
 * about the phone layout changes.
 */
export const layout = {
  /**
   * A line of `body1` text lands near 65-75 characters at this width, which
   * is the range people read without losing the start of the next line. It
   * is a ceiling and not a width: a 375px phone never reaches it.
   */
  contentMaxWidth: 600,

  /**
   * The vertical navigation: what it always occupies, and what it grows to
   * under the pointer.
   *
   * `navRail` is glyphs only, and it is the resting state at every width —
   * a 240px panel of labels standing permanently open next to a 600px column
   * is most of a third of a 1920px window spent on four words. 76 puts a 22px
   * glyph dead centre of a 48px target.
   *
   * `navRailExpanded` is what a hover opens, over the content rather than
   * pushing it: reflowing a feed because a pointer crossed the left edge is
   * worse than the labels being a moment away.
   */
  navRail: 76,
  navRailExpanded: 240,

  /**
   * Air between the rail and the window edge, and between the rail and the
   * content beside it.
   *
   * The same 16 the bottom bar insets itself by, and for the same reason: a
   * floating bar has to be seen to float. The column it reserves is therefore
   * `navRail + navMargin * 2`, so the content next to it starts clear of the
   * bar rather than up against it.
   */
  navMargin: 16,
} as const;

/**
 * Width breakpoints, in px.
 *
 * Three, and deliberately not one per device. A breakpoint belongs here only
 * where the layout stops working — never because a popular screen happens to
 * be that wide. `sm` is absent for exactly that reason: `contentMaxWidth`
 * above already carries everything between a phone and a tablet without any
 * breakpoint at all.
 *
 * - `md` (768) — tablet. Nothing structural hangs off it; it exists so a
 *   component that already styles with classes can reach for `md:` locally.
 * - `lg` (1024) — the one structural break: the floating bottom bar stops
 *   making sense on a pointer device and becomes a side rail.
 * - `xl` (1280) — available for the same local use as `md`. Nothing branches
 *   on it: a second, wider sidebar was built here and removed the same day,
 *   because the rail's labelled state turned out to be a hover rather than a
 *   window size.
 *
 * The numbers match Tailwind's own defaults, so a `lg:` class and a
 * JavaScript comparison against `breakpoints.lg` can never disagree.
 */
export const breakpoints = {
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Layout = typeof layout;
export type Breakpoints = typeof breakpoints;
