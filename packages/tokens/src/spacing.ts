/**
 * Spacing scale, in px.
 *
 * The named sizes at the top of the scale map to fixed UI dimensions:
 * `5xl` = button Large / touch target, `6xl` = large button, `7xl` = header
 * height.
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 44,
  '6xl': 52,
  '7xl': 56,
} as const;

/** Minimum interactive size, in px. Never go below this. */
export const MIN_TOUCH_TARGET = 44;

export type Spacing = typeof spacing;
