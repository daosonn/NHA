import { Pressable } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

export type PillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * The selectable pill: solid CORAL when chosen, white with a hairline when not
 * (11h kind chips, 11m filters, 11n moods, 11g message lengths, 11f
 * "Warmer / More formal").
 *
 * The mockups drew the chosen chip near-black; the app fills it with the brand
 * coral instead, so "what I picked" reads in the same colour as every other
 * committed choice in the product. Changed on Sơn's call, 19/08.
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
          ? pressed
            ? colors.coral.dark
            : colors.coral.primary
          : pressed
            ? colors.coral.soft
            : colors.background.card,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.state.borderNeutral,
      })}
    >
      <Text variant="caption" weight="semibold" color={selected ? colors.text.white : colors.text.primary}>
        {label}
      </Text>
    </Pressable>
  );
}
