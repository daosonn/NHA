import { useWindowDimensions } from 'react-native';

import { breakpoints } from '@nha/tokens';

/**
 * Where the navigation lives at this window size.
 *
 * `bottom` is the floating pill the app was designed around and is right on a
 * phone. `rail` is the same four destinations turned vertical: a row of five
 * buttons floating at the bottom of a 1440px window is a remote control rather
 * than navigation, and every web app this one will be compared to puts them
 * down the left instead.
 *
 * There is no third mode. The rail's own labelled state is a hover, not a
 * breakpoint — see `side-nav.tsx`.
 */
export type NavMode = 'bottom' | 'rail';

export type Layout = {
  /** Window width in px. `0` during a prerender. */
  width: number;
  /** At or past `lg`: the navigation has moved to the side. */
  expanded: boolean;
  navMode: NavMode;
};

/**
 * The one place a width becomes a layout decision.
 *
 * Read here rather than through `lg:` class prefixes for two reasons: most of
 * this app styles with inline `style` objects, so a prefix would only reach a
 * quarter of it; and "which navigation" is a structural answer that several
 * unrelated components have to agree on, which a class cannot express.
 *
 * `contentColumn` deliberately does **not** come from here. A ceiling needs no
 * measurement, so the content column keeps working in a prerender — where
 * `Dimensions` reports zero — and costs no re-render when a window is dragged.
 */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();

  // A prerender reports 0, so this falls through to `bottom`. That is the right
  // default: it is what the narrowest reader gets, and what every check in
  // `docs/04-devops/commands.md` expects to find.
  const navMode: NavMode = width >= breakpoints.lg ? 'rail' : 'bottom';

  return { width, expanded: navMode === 'rail', navMode };
}
