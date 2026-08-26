import { ChevronRight, Lock } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import { Text } from '../ui/text';

export type SelectRowProps = {
  /** Avatar / DateTile / icon tile on the left. */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  /** 'chevron' opens something, 'lock' is fixed (11a FROM row), 'none' is plain. */
  trailing?: 'chevron' | 'lock' | 'none' | React.ReactNode;
  onPress?: () => void;
  /** Stacked rows inside one card: only the outer container is a Card. */
  bare?: boolean;
};

/**
 * The white selector row of screens 11a/11e/11h: leading visual, a bold
 * title over a grey line, chevron on the right. Everything the mockups
 * call "tap to change" is this row.
 */
export function SelectRow({
  leading,
  title,
  subtitle,
  trailing = 'chevron',
  onPress,
  bare = false,
}: SelectRowProps) {
  const trailingNode =
    trailing === 'chevron' ? (
      <ChevronRight size={17} color={colors.text.lightMuted} strokeWidth={2.2} />
    ) : trailing === 'lock' ? (
      <Lock size={14} color={colors.text.lightMuted} strokeWidth={2.2} />
    ) : trailing === 'none' ? null : (
      trailing
    );

  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingVertical: bare ? 10 : 12,
          paddingHorizontal: bare ? 0 : 13,
        },
        !bare && {
          backgroundColor:
            pressed && onPress ? colors.background.surfaceSoft : colors.background.card,
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: colors.state.borderDefault,
          ...elevation.card,
        },
      ]}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="body2" weight="semibold" numberOfLines={1} style={{ letterSpacing: -0.1 }}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailingNode}
    </Pressable>
  );
}
