import { useMemo } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration, easing, PRESS_SCALE } from '../../theme/motion';

/**
 * Press feedback (`.nha-press` in the motion spec): anything tappable
 * shrinks slightly while held, so the finger gets an answer before the
 * navigation or mutation does.
 *
 * Usage — an `Animated` pressable, the style, and the two handlers:
 *
 *     const press = usePressScale();
 *     <AnimatedPressable
 *       style={[base, press.style]}
 *       onPressIn={press.onPressIn}
 *       onPressOut={press.onPressOut}
 *     >
 *
 * A hook rather than a wrapper component on purpose: half the app's
 * tappables are `Pressable`s with their own layout responsibilities, and
 * wrapping them in another view breaks flex parents. The hook composes;
 * a component would compete.
 */
export function usePressScale() {
  const pressed = useSharedValue(false);

  const style = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(pressed.value ? PRESS_SCALE : 1, {
          duration: duration.press,
          easing: easing.snap,
        }),
      },
    ],
  }));

  return useMemo(
    () => ({
      style,
      onPressIn: () => {
        pressed.value = true;
      },
      onPressOut: () => {
        pressed.value = false;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value and
    // animated style are stable references; recreating the handlers each
    // render would defeat the memo.
    [],
  );
}
