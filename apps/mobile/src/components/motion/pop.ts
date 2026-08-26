import { useEffect, useRef } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing } from '../../theme/motion';

/**
 * `nhaPop` for state changes: the element springs past full size and back
 * (0.72 → 1.12 → 1) whenever `trigger` changes — a heart toggled, a tab
 * landed on. The initial mount never pops: a feed where every heart jumps
 * on first paint is a firework, not feedback.
 *
 * Pass `active: false` to swallow a change — a tab slot pops when it
 * becomes selected, not when it is abandoned.
 *
 * (`theme/motion.ts` exports the same keyframe as `pop` for
 * entering-animation use; this is its imperative twin.)
 */
export function usePop(trigger: unknown, active = true) {
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;

    scale.value = 0.72;
    scale.value = withSequence(
      withTiming(1.12, { duration: duration.select * 0.6, easing: easing.settle }),
      withTiming(1, { duration: duration.select * 0.4, easing: easing.settle }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `trigger` is the
    // event being watched; `active` gates it but must not fire a pop itself.
  }, [trigger]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}
