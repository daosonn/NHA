/**
 * Border radius scale, in px.
 *
 * Buttons, pills, chips and avatars always use `full`.
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 18,
  '3xl': 20,
  '4xl': 22,
  '5xl': 24,
  '6xl': 26,
  '7xl': 28,
  /** Phone frame in the mockups. */
  card: 44,
  full: 9999,
} as const;

export type Radius = typeof radius;
