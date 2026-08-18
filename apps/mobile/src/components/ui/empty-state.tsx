import { View } from 'react-native';

import { colors, radius } from '../../theme';
import { Button } from './button';
import { Text } from './text';

export type EmptyStateProps = {
  /** Lucide icon, given the size and colour to draw at. */
  renderIcon: (props: { size: number; color: string }) => React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

/**
 * Shown where content would be. States what is missing and what to do about
 * it — an empty section should never be a blank rectangle the reader has to
 * interpret.
 */
export function EmptyState({
  renderIcon,
  title,
  description,
  actionLabel,
  onActionPress,
}: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.full,
          backgroundColor: colors.background.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderIcon({ size: 22, color: colors.text.subtle })}
      </View>

      <View style={{ alignItems: 'center', gap: 3 }}>
        <Text variant="body1" weight="semibold">
          {title}
        </Text>

        {description !== undefined && (
          <Text variant="body2" color={colors.text.body} style={{ textAlign: 'center' }}>
            {description}
          </Text>
        )}
      </View>

      {actionLabel !== undefined && (
        <Button label={actionLabel} variant="secondary" size="small" onPress={onActionPress} />
      )}
    </View>
  );
}
