import { useEffect, useRef, useState } from 'react';
import { Modal, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors } from '../../theme';
import { duration, sheet } from '../../theme/motion';
import { AnimatedPressable } from '../motion/animated-pressable';

export type SheetModalProps = {
  visible: boolean;
  /** Also fired by the scrim tap and the hardware back button. */
  onClose: () => void;
  /** Accessibility label for the scrim's close action. */
  scrimLabel: string;
  /** The panel. Brings its own background, radius and padding. */
  children: React.ReactNode;
  /**
   * Applied to the sliding wrapper. Needed when the panel is height-capped:
   * a percentage `maxHeight` resolves against a parent with a definite
   * height, and the wrapper's is auto — so `maxHeight: '92%'` belongs here
   * (against the screen), with `flexShrink: 1` on the panel itself.
   */
  style?: StyleProp<ViewStyle>;
};

/**
 * The one `Modal` wrapper every bottom sheet opens through — `.nha-sheet` +
 * `.nha-scrim` from the motion spec: the scrim fades while the panel slides
 * up from the bottom edge, and both reverse on the way out.
 *
 * RN's own `animationType="slide"` (what the sheets used before) slides the
 * scrim up along with the panel — a wall of darkness rising — and cannot be
 * given the spec's curve. So the Modal itself never animates; the two
 * children do, and the Modal stays mounted `duration.sheet` longer than
 * `visible` so their exit has time to play before the native modal vanishes.
 */
export function SheetModal({ visible, onClose, scrimLabel, children, style }: SheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      setMounted(true);
      return;
    }
    hideTimer.current = setTimeout(() => setMounted(false), duration.sheet);
    return () => {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    };
  }, [visible]);

  if (!mounted && !visible) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {visible && (
          <AnimatedPressable
            entering={sheet.scrimIn}
            exiting={sheet.scrimOut}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={scrimLabel}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.state.scrim,
            }}
          />
        )}

        {visible && (
          <Animated.View entering={sheet.in} exiting={sheet.out} style={style}>
            {children}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
