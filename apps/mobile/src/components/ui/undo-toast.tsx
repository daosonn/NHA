import { RotateCcw } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import { Text } from './text';

/** How long the offer stands before the action is simply done. */
const VISIBLE_MS = 5000;

export type UndoToastProps = {
  visible: boolean;
  message: string;
  actionLabel: string;
  onUndo: () => void;
  /** Fired when the window closes on its own. */
  onDismiss: () => void;
};

/**
 * A dark pill offering to put back what was just removed.
 *
 * It exists so destructive actions can be immediate instead of interrogative:
 * the alternative to an undo is a second confirmation dialog on every delete,
 * which trains people to dismiss dialogs without reading them.
 *
 * Positioned by the caller — this only draws the pill, because the safe place
 * for it depends on whether the screen has a bottom nav under it.
 */
export function UndoToast({ visible, message, actionLabel, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        {
          minHeight: 52,
          borderRadius: radius.xl,
          backgroundColor: colors.text.primary,
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        elevation.floating,
      ]}
    >
      <RotateCcw size={18} color={colors.text.white} strokeWidth={2} />

      <Text variant="body2" weight="medium" color={colors.text.white} style={{ flex: 1 }}>
        {message}
      </Text>

      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={{
          height: 34,
          paddingHorizontal: 14,
          borderRadius: radius.full,
          backgroundColor: 'rgba(255,255,255,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="caption" weight="semibold" color={colors.text.white}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
