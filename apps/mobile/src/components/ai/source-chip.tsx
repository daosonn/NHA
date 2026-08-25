import { Sparkles } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

export type SourceChipProps = {
  label: string;
  onPress?: () => void;
  /** Leading glyph. Defaults to a small sparkle — never a fake avatar. */
  renderIcon?: (props: { size: number; color: string }) => React.ReactNode;
};

/**
 * An evidence chip — "Photo · May", "Note · Apr" (11b/11d/11e). Tapping opens
 * "Where this came from".
 */
export function SourceChip({ label, onPress, renderIcon }: SourceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 28,
        paddingLeft: 9,
        paddingRight: 10,
        borderRadius: radius.full,
        backgroundColor: pressed ? colors.background.subtle : colors.background.card,
        borderWidth: 1,
        borderColor: colors.state.borderNeutral,
      })}
    >
      {renderIcon ? (
        renderIcon({ size: 13, color: colors.text.secondary })
      ) : (
        <Sparkles size={13} color={colors.text.secondary} strokeWidth={2.1} />
      )}
      <Text variant="badge" weight="medium" color={colors.text.secondary} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
