import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration, easing } from '../../theme/motion';

/**
 * A whole screen presented like a sheet — `.nha-sheet` at route scale.
 *
 * The panel rises from the bottom edge while a scrim fades in behind it,
 * and `dismiss()` reverses both before handing control back (to
 * navigation, usually). Driven by hand rather than left to the native
 * stack because `react-native-screens` does not animate route changes on
 * the web at all, and this entrance is the point of the screen — it has
 * to happen everywhere. The route must be a `transparentModal` with
 * `animation: 'none'` and a transparent `contentStyle`, so the screen
 * below stays visible behind the scrim and the stack adds no motion of
 * its own (see `app/_layout.tsx`).
 */
export function useScreenSheet(onDismissed: () => void) {
  const { height } = useWindowDimensions();

  // 0 = parked below the screen, 1 = presented. One value drives panel and
  // scrim together so the two can never fall out of step.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: duration.sheet, easing: easing.settle });
  }, [progress]);

  const dismiss = () => {
    progress.value = withTiming(
      0,
      { duration: duration.sheet, easing: easing.settle },
      (finished) => {
        'worklet';
        // Only a completed run leaves the screen — a second dismiss() while
        // one is playing cancels the first, whose callback still fires.
        if (finished === true) runOnJS(onDismissed)();
      },
    );
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height }],
  }));

  return { scrimStyle, panelStyle, dismiss };
}
