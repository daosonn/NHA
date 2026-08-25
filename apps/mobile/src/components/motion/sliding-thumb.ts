import { useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration, easing } from '../../theme/motion';

/**
 * The segmented-pill effect (`docs/01-frontend/motion/segmented-pill.html`):
 * ONE thumb that slides between the options of a segmented control — 320ms
 * travel, width animating with it since options flex. Option positions come
 * from their own `onLayout`, so the thumb survives rotation and rescaling.
 *
 * `activeKey: null` fades the thumb out — for a control whose selection can
 * leave entirely (the bottom bar while the compose screen is up).
 *
 * The demo travels on `settle`; the bottom bar keeps `bounce` for the same
 * journey, so the curve is a parameter with the demo as the default.
 */
export function useSlidingThumb(activeKey: string | null, travelEasing = easing.settle) {
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const shown = useSharedValue(0);
  const placed = useRef(false);

  const place = (animated: boolean) => {
    const target = activeKey === null ? undefined : layouts.current[activeKey];
    if (target === undefined) {
      shown.value = withTiming(0, { duration: duration.select, easing: easing.snap });
      return;
    }
    if (!animated || !placed.current) {
      // First measurement, or a re-layout: appear in place, no travel.
      x.value = target.x;
      width.value = target.width;
      shown.value = 1;
      placed.current = true;
      return;
    }
    shown.value = withTiming(1, { duration: duration.select, easing: easing.snap });
    x.value = withTiming(target.x, { duration: duration.sheet, easing: travelEasing });
    width.value = withTiming(target.width, { duration: duration.sheet, easing: travelEasing });
  };

  useEffect(() => {
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on
    // selection change; layout updates re-place via each item's onLayout.
  }, [activeKey]);

  /** Attach to each option: `onLayout={itemLayout(key)}`. */
  const itemLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x: itemX, width: itemWidth } = event.nativeEvent.layout;
    layouts.current[key] = { x: itemX, width: itemWidth };
    // The active option moved or was measured for the first time: snap the
    // thumb onto it without a journey.
    if (key === activeKey) place(false);
  };

  /** Spread onto the absolutely-positioned thumb view. */
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  return { itemLayout, style };
}
