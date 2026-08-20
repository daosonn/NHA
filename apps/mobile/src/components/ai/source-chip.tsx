import { Pressable } from 'react-native';

import { colors, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

export type SourceChipProps = {
  label: string;
  onPress?: () => void;
};

/**
 * An evidence chip — "Photo · May", "Note · Apr" — with the tiny thumbnail
 * the mockups draw (11b/11d/11e). Tapping opens "Where this came from".
 */
export function SourceChip({ label, onPress }: SourceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 28,
        paddingLeft: 4,
        paddingRight: 10,
        borderRadius: radius.full,
        backgroundColor: pressed ? colors.background.subtle : colors.background.card,
        borderWidth: 1,
        borderColor: colors.state.borderNeutral,
      })}
    >
      <Avatar size={20} />
      <Text variant="badge" weight="medium" color={colors.text.secondary} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
