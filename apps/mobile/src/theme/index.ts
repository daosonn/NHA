/**
 * The app's single entry point to the design tokens.
 *
 * Screens and components import from here, never from `@nha/tokens`
 * directly, so the React Native mapping (font names, shadows) lives in one
 * place. Token values themselves stay framework-agnostic in the package.
 */
import { colors, radius, shadow, spacing, typography, MIN_TOUCH_TARGET } from '@nha/tokens';

export { colors, radius, spacing, typography, MIN_TOUCH_TARGET };

/**
 * Font family names as registered with `expo-font`.
 *
 * React Native has no synthetic bolding: every weight is a separate family,
 * so `fontWeight` must never be used on its own.
 */
export const fonts = {
  regular: typography.fontFamilyNative.sansRegular,
  medium: typography.fontFamilyNative.sansMedium,
  semibold: typography.fontFamilyNative.sansSemiBold,
  bold: typography.fontFamilyNative.sansBold,
  /** Emotional headings and year tags only — never UI controls. */
  serifMedium: typography.fontFamilyNative.serifMedium,
  serifSemiBold: typography.fontFamilyNative.serifSemiBold,
  serifBold: typography.fontFamilyNative.serifBold,
} as const;

/**
 * Shadow tokens as React Native styles.
 *
 * `boxShadow` is a real style prop on the New Architecture (RN 0.76+) and on
 * react-native-web, so the CSS string from the token is used directly rather
 * than being re-derived into shadowOffset/shadowRadius.
 */
export const elevation = {
  card: { boxShadow: shadow.card.css },
  header: { boxShadow: shadow.header.css },
  bottomNav: { boxShadow: shadow.bottomNav.css },
  floating: { boxShadow: shadow.floating.css },
  sheet: { boxShadow: shadow.sheet.css },
} as const;

export { shadow };
