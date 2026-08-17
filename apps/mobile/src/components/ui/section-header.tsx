import { Pressable, View } from 'react-native';

import { colors } from '../../theme';
import { Text } from './text';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  /** `lg` names the thing you are looking at; `md` names a section of it. */
  size?: 'md' | 'lg';
};

/** Title on the left, an optional quiet link on the right. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  size = 'md',
}: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          variant={size === 'lg' ? 'h2' : 'subtitle'}
          weight="bold"
          style={{ letterSpacing: size === 'lg' ? -0.3 : -0.2 }}
        >
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text variant="caption" color={colors.text.subtle}>
            {subtitle}
          </Text>
        )}
      </View>

      {actionLabel !== undefined && (
        <Pressable onPress={onActionPress} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" weight="medium" color={colors.text.lightMuted}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
