import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography } from '../../theme';
import { useTypeface, type Weight } from '../../theme/typeface';

type Variant = keyof typeof typography.fontSize;

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
 *
 * Which family that is depends on the language: see `theme/typeface.ts`.
 */
export function Text({
  variant = 'body1',
  weight = 'regular',
  color = colors.text.primary,
  serif = false,
  style,
  ...rest
}: TextProps) {
  const typeface = useTypeface(weight, serif);

  return <RNText {...rest} style={[typography.fontSize[variant], typeface, { color }, style]} />;
}
