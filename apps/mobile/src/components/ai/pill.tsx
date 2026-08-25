import { Pressable } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

export type PillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * The selectable pill: coral TINT with deep-coral text when chosen, white with
 * a hairline when not (11h kind chips, 11m filters, 11n moods, 11g message
 * lengths, 11f "Warmer / More formal").
 *
 * History: the mockups drew the chosen chip near-black; 19/08 (Sơn's call) it
 * became solid coral with white text. That pairing is 2.4:1 — below what the
 * design system allows on a label ("solid coral cannot carry a label"), and
 * unreadable in daylight for the grandparents this app is for. 24/08 it moved
 * to the doc's sanctioned branded fill: coral.deep on coral.light (4.6:1), the
 * same treatment as the active nav tab. Solid coral stays reserved for the
 * primary button. If the team prefers near-black, change it here only.
 */
export function Pill({ label, selected, onPress }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        height: 34,
        paddingHorizontal: 14,
        justifyContent: 'center',
        borderRadius: radius.full,
        backgroundColor: selected
          ? colors.coral.light
          : pressed
            ? colors.coral.soft
            : colors.background.card,
        borderWidth: 1,
        borderColor: selected ? colors.coral.border : colors.state.borderNeutral,
      })}
    >
      <Text
        variant="caption"
        weight="semibold"
        color={selected ? colors.coral.deep : colors.text.primary}
      >
        {label}
      </Text>
    </Pressable>
  );
}
