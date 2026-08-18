import { View } from 'react-native';

import { colors, fonts, radius } from '../../theme';
import { Text } from '../ui/text';

export type DateTileProps = {
  day: number;
  month: string;
  /** White on the coral card, subtle grey in a list. */
  tone?: 'card' | 'muted';
};

/** The day of the month, big, with its month underneath. */
export function DateTile({ day, month, tone = 'muted' }: DateTileProps) {
  return (
    <View
      style={{
        width: tone === 'card' ? 50 : 46,
        height: tone === 'card' ? 54 : 50,
        flexShrink: 0,
        borderRadius: radius.lg,
        backgroundColor: tone === 'card' ? colors.background.card : colors.background.subtle,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <Text serif weight="bold" style={{ fontSize: 17, lineHeight: 20, letterSpacing: -0.3 }}>
        {day}
      </Text>

      <Text
        weight="semibold"
        color={tone === 'card' ? colors.text.subtle : colors.text.muted}
        style={{
          fontSize: 9,
          lineHeight: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {month}
      </Text>
    </View>
  );
}
