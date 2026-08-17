/**
 * Elevation.
 *
 * Shadows are soft and rare. Buttons are deliberately flat — no shadow, no
 * gradient. Only surfaces that float above content get one.
 *
 * Primitives are kept separate from the CSS string so React Native can map
 * them to `shadowOffset` / `shadowRadius` / `shadowOpacity` while the web
 * uses `css` directly.
 */
type Shadow = {
  color: string;
  offsetY: number;
  blur: number;
  opacity: number;
  css: string;
};

const SHADOW_COLOR = '#18181B';

export const shadow = {
  /** Cards. Pair with a 1px rgba(24,24,27,0.06) inset border. */
  card: {
    color: SHADOW_COLOR,
    offsetY: 8,
    blur: 24,
    opacity: 0.05,
    css: '0 8px 24px rgba(24,24,27,0.05)',
  },

  /** Blurred header — the only thing separating it from content. */
  header: {
    color: SHADOW_COLOR,
    offsetY: 2,
    blur: 10,
    opacity: 0.06,
    css: '0 2px 10px rgba(24,24,27,0.06)',
  },

  /** Bottom navigation, cast upward. */
  bottomNav: {
    color: SHADOW_COLOR,
    offsetY: -1,
    blur: 12,
    opacity: 0.04,
    css: '0 -1px 12px rgba(24,24,27,0.04)',
  },

  /** Floating controls over the family-tree canvas. */
  floating: {
    color: SHADOW_COLOR,
    offsetY: 2,
    blur: 10,
    opacity: 0.08,
    css: '0 2px 10px rgba(24,24,27,0.08)',
  },

  /** Bottom sheets, cast upward. */
  sheet: {
    color: SHADOW_COLOR,
    offsetY: -12,
    blur: 40,
    opacity: 0.16,
    css: '0 -12px 40px rgba(24,24,27,0.16)',
  },
} as const satisfies Record<string, Shadow>;

export type Shadows = typeof shadow;
