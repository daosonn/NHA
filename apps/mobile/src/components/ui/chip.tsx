import { View } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from './text';

export type ChipTheme = keyof typeof colors.themes | 'neutral';

const NEUTRAL = { bg: colors.background.subtle, text: colors.text.secondary, dot: undefined };

function resolve(theme: ChipTheme) {
  if (theme === 'neutral') return NEUTRAL;
  const t = colors.themes[theme];
  return { bg: t.bg, text: t.text, dot: 'dot' in t ? t.dot : undefined };
}

export type ChipProps = {
  label: string;
  /** Category themes exist for memo tags and event widgets — see colors.ts. */
  theme?: ChipTheme;
  /** Draws the theme's dot before the label. Off for plain tags. */
  showDot?: boolean;
};

/** A small read-only tag: an interest, a memo category, an event type. */
export function Chip({ label, theme = 'neutral', showDot = false }: ChipProps) {
  const { bg, text, dot } = resolve(theme);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 26,
        paddingHorizontal: 10,
        borderRadius: radius.full,
        backgroundColor: bg,
      }}
    >
      {showDot && dot !== undefined && (
        <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: dot }} />
      )}
      <Text variant="caption" weight="medium" color={text}>
        {label}
      </Text>
    </View>
  );
}
