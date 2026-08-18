import { Pressable } from 'react-native';

import { colors } from '../../theme';
import { Text, type TextProps } from './text';

export type TextLinkProps = {
  label: string;
  onPress?: () => void;
  variant?: TextProps['variant'];
};

/**
 * A word that navigates.
 *
 * Coral text rather than an underline: the accent already means "this is the
 * way forward" everywhere else in the app, and underlines would compete with
 * the timeline threads.
 */
export function TextLink({ label, onPress, variant = 'caption' }: TextLinkProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
      <Text variant={variant} weight="semibold" color={colors.coral.hover}>
        {label}
      </Text>
    </Pressable>
  );
}
