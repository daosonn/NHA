import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fonts, typography } from '../../theme';

type Variant = keyof typeof typography.fontSize;
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const SANS: Record<Weight, string> = {
  regular: fonts.regular,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
};

/** Lora ships no regular weight here — medium is the lightest it goes. */
const SERIF: Record<Weight, string> = {
  regular: fonts.serifMedium,
  medium: fonts.serifMedium,
  semibold: fonts.serifSemiBold,
  bold: fonts.serifBold,
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  weight?: Weight;
  color?: string;
  /** Lora. Emotional headings and year tags only — never UI controls. */
  serif?: boolean;
};

/**
 * The only way text enters the UI.
 *
 * React Native has no synthetic bolding, so weight selects a font family
 * rather than setting `fontWeight` — using the raw `Text` would silently
 * fall back to the system face on Android.
 */
export function Text({
  variant = 'body1',
  weight = 'regular',
  color = colors.text.primary,
  serif = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        typography.fontSize[variant],
        { fontFamily: serif ? SERIF[weight] : SANS[weight], color },
        style,
      ]}
    />
  );
}
