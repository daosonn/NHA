import { useId } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

/**
 * Diagonal-stripe stand-in for a photo that has not been wired up yet.
 *
 * These greys are deliberately NOT design tokens: they are scaffolding that
 * disappears once real media loads, so they must not leak into the design
 * language. Replace usages with `expo-image` as each screen gets real data.
 */
const TONES = {
  light: ['#EFEDEA', '#E4E1DC'],
  dark: ['#E9E6E2', '#DDD9D4'],
} as const;

export type PhotoPlaceholderProps = {
  tone?: keyof typeof TONES;
  /** Stripe period in px. The mockups use 16 for surfaces, 10 for avatars. */
  period?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function PhotoPlaceholder({
  tone = 'light',
  period = 16,
  style,
  children,
}: PhotoPlaceholderProps) {
  const [a, b] = TONES[tone];
  const half = period / 2;
  // On web react-native-svg emits real <defs>, so a shared id would make
  // every instance inherit the first one's stripe size.
  const patternId = `stripes-${useId()}`;

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: a }, style]}>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Defs>
          <Pattern
            id={patternId}
            width={period}
            height={period}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect width={half} height={period} fill={a} />
            <Rect x={half} width={half} height={period} fill={b} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
      {children}
    </View>
  );
}
