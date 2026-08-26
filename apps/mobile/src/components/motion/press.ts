import { useMemo } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration, easing, PRESS_SCALE } from '../../theme/motion';

/**
 * Press feedback (`.nha-press` in the motion spec): anything tappable
 * shrinks slightly while held, so the finger gets an answer before the
 * navigation or mutation does. Pass `background` and the fill animates on
 * the same clock — the spec transitions transform and background together.
 *
 * Usage — an `Animated` pressable, the style, and the two handlers:
 *
 *     const press = usePressScale({ background: { rest: v.bg, pressed: v.bgPressed } });
 *     <AnimatedPressable
 *       style={[base, press.style]}
 *       onPressIn={press.onPressIn}
 *       onPressOut={press.onPressOut}
 *     >
 *
 * When `background` is given the hook owns `backgroundColor` — the static
 * styles must not set it too, or the two fight over the same prop. Cards
 * and rows pass `scale: CARD_PRESS_SCALE` for the shallower dip.
 *
 * A hook rather than a wrapper component on purpose: half the app's
 * tappables are `Pressable`s with their own layout responsibilities, and
 * wrapping them in another view breaks flex parents. The hook composes;
 * a component would compete.
 */
export function usePressScale(options?: {
  background?: { rest: string; pressed: string };
  scale?: number;
}) {
  const pressed = useSharedValue(false);
  const background = options?.background;
  const scaleTo = options?.scale ?? PRESS_SCALE;

  const style = useAnimatedStyle(() => {
    const timing = { duration: duration.press, easing: easing.snap };
    const scale = { transform: [{ scale: withTiming(pressed.value ? scaleTo : 1, timing) }] };

    if (background === undefined) return scale;
    return {
      ...scale,
      backgroundColor: withTiming(pressed.value ? background.pressed : background.rest, timing),
    };
  }, [background?.rest, background?.pressed, scaleTo]);

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
