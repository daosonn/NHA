import { useEffect, useRef } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import {
  Easing,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '../../theme';
import { easing } from '../../theme/motion';

/**
 * Scroll-linked motion for the Life Profile timeline
 * (`src/edit-timeline.html` — "TIMELINE — HIỆU ỨNG MOTION KHI LƯỚT").
 *
 * Everything is driven by scroll POSITION, not time. Per card:
 *
 *   t — entrance progress: 0 → 1 as the card rises from the bottom edge,
 *       complete once its top has travelled 30% of the viewport.
 *       Cubic ease-out: fast in, gentle stop.
 *   u — exit progress at the top: fades as the card leaves upward.
 *   o — min(t, u), the card's combined visibility.
 *   f — closeness to the "reading point" (42% of the viewport height):
 *       1 at the point, falling linearly to 0 — feeds every emphasis
 *       (opacity lift, scale 0.965 → 1).
 *
 * One card is ACTIVE at a time — the one with the highest f that is still
 * visible (o > 0.1). Its dot swells with a coral ring and a pulsing halo,
 * and the rail's coral fill reaches down to it. When the scroll hits the
 * end, the last card is forced active — it can never reach the reading
 * point on its own.
 *
 * Differences from the HTML handoff, all deliberate:
 * - No grayscale: React Native has no cross-platform `filter`; the opacity
 *   dim carries the de-emphasis alone.
 * - No momentum tail: native scrolling emits events through the fling
 *   already — the rAF tail exists for desktop wheels.
 * - Only transform and opacity are animated per frame (the rail fill
 *   scales rather than growing in height) — the motion README's rule.
 */

/** Entrance completes once the card top has crossed 30% of the viewport. */
const ENTER_BAND = 0.3;
/** Exit fade happens over the top 22% of the viewport. */
const EXIT_BAND = 0.22;
/** The reading point sits at 42% of the viewport height. */
const FOCUS_POINT = 0.42;
/** f falls to 0 at 55% of the viewport away from the reading point. */
const FOCUS_RANGE = 0.55;
/** Cards rise 24px while entering. */
const RISE = 24;
/** Scale span: 0.965 far from focus → 1 at it. */
const SCALE_MIN = 0.965;
/** Opacity floor for a visible but unfocused card. */
const DIM = 0.65;
/** Dot ring / emphasis transition. */
const ACTIVE_MS = 260;
/** Dot swell — overshooting curve, so it pops. */
const SWELL_MS = 300;
/** Rail fill slide between dots. */
const FILL_MS = 380;
/** Halo pulse loop. */
const PULSE_MS = 2600;
/** How close to the bottom counts as "at the end". */
const END_SLACK = 8;
/** Photo parallax amplitude — the image drifts slower than its card. */
const PARALLAX = 14;

/**
 * Card/rail geometry, straight from the handoff. Cards indent 52px; the
 * rail runs at x 25 (2px wide → centre 26); the dot hangs 32px left of the
 * card edge (52 − 32 = 20, 12px wide → centre 26, on the rail), 20px down
 * (centre 26). The triangle overlaps the card's left edge and points at
 * the dot. The progress fill starts where the rail does.
 */
export const TL = {
  cardInset: 52,
  railX: 25,
  railW: 2,
  railTop: 6,
  dot: 12,
  dotLeft: 20,
  dotTop: 20,
  /** Dot centre below the card top — the scale origin and the fill target. */
  dotCentreY: 26,
  triLeft: 41,
  triTop: 18,
} as const;

type RowBox = { y: number; h: number };

export type TimelineMotion = {
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
  /** Scroll content height — 0 until the first layout reports it. */
  contentH: SharedValue<number>;
  /** Derived: the visible end of the content has been reached. */
  atEnd: Readonly<SharedValue<boolean>>;
  /** The list root's offset within the scroll content. -1 = not yet known. */
  listTop: SharedValue<number>;
  /**
   * Re-runs the list-anchor measurement. Registered by the list, invoked
   * whenever the scroll content changes size — the profile hero and facts
   * above the timeline load asynchronously, and when they grow the list
   * moves down WITHOUT its own onLayout firing (its position relative to
   * its direct parent is unchanged). A stale anchor shifts every effect
   * upward by exactly that growth, which reads as rows vanishing
   * mid-screen.
   */
  remeasureList: { current: (() => void) | null };
  /**
   * Per-row re-measurers, keyed by row index, swept by the same
   * content-size trigger as `remeasureList` and handed the list root to
   * measure against. Rows report their own onLayout, but that only fires
   * when a row's OWN frame changes — a photo above finishing its load
   * (event photos size themselves to the picture) pushes the rows below
   * it without changing them, and on web a pure position shift fires no
   * onLayout at all. Stale boxes are exactly the rail fill stopping short
   * of the active dot and the dim bands landing on the wrong cards.
   */
  rowMeasurers: Map<number, (list: View) => void>;
  /** Row layouts relative to the list root, by index. */
  boxes: SharedValue<RowBox[]>;
  activeIndex: SharedValue<number>;
  /** One shared 0 → 1 loop clocking every halo. */
  pulse: SharedValue<number>;
  /** The view wrapping the scroll area — the viewport to measure against. */
  frameRef: React.RefObject<View | null>;
};

function cardMetrics(top: number, h: number, vh: number) {
  'worklet';
  const bot = top + h;
  let t = Math.min(1, Math.max(0, (vh - top) / (vh * ENTER_BAND)));
  t = 1 - Math.pow(1 - t, 3);
  const u = Math.min(1, Math.max(0, bot / (vh * EXIT_BAND)));
  const o = Math.min(t, u);
  const mid = (top + bot) / 2;
  const f = Math.max(0, 1 - Math.abs(mid - vh * FOCUS_POINT) / (vh * FOCUS_RANGE));
  return { t, o, f, mid };
}

/**
 * Owned by the route that owns the ScrollView. Spread `frameRef` +
 * `onFrameLayout` onto a plain View wrapping the scroller, attach
 * `scrollHandler` to an `Animated.ScrollView`, and hand `motion` down to
 * the timeline. `motion` is `undefined` under reduced motion — the OS
 * setting collapses scroll-linked effects the same way it collapses the
 * entrance presets.
 */
export function useTimelineScrollMotion() {
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const contentH = useSharedValue(0);
  // -1 = "not measured yet": until the anchor is known the effects hold
  // everything neutral, because computing them against a wrong origin
  // hides rows that are actually on screen.
  const listTop = useSharedValue(-1);
  const boxes = useSharedValue<RowBox[]>([]);
  const pulse = useSharedValue(0);
  const frameRef = useRef<View | null>(null);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [reduced, pulse]);

  // Derived rather than written from scroll events, because a timeline
  // short enough to fit the screen never scrolls at all — and it IS at its
  // end from the first frame.
  const atEnd = useDerivedValue(
    () => contentH.value > 0 && scrollY.value + viewportH.value >= contentH.value - END_SLACK,
  );

  const activeIndex = useDerivedValue(() => {
    const vh = viewportH.value;
    const rows = boxes.value;
    if (listTop.value < 0) return -1;
    let best = -1;
    if (vh > 0) {
      let bestF = -1;
      for (let i = 0; i < rows.length; i += 1) {
        const box = rows[i];
        if (box === undefined) continue;
        const m = cardMetrics(listTop.value + box.y - scrollY.value, box.h, vh);
        if (m.f > bestF && m.o > 0.1) {
          bestF = m.f;
          best = i;
        }
      }
    }
    if (atEnd.value && rows.length > 0) best = rows.length - 1;
    return best;
  });

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    viewportH.value = event.layoutMeasurement.height;
    contentH.value = event.contentSize.height;
  });

  const onFrameLayout = (event: LayoutChangeEvent) => {
    viewportH.value = event.nativeEvent.layout.height;
  };

  // Scroll events only fire on scrolling; this catches the content height
  // of a page that never scrolls, and every content change in between.
  // A size change also means something above the timeline grew or shrank,
  // so the list anchor is re-measured (see `remeasureList`).
  const onContentSizeChange = (_width: number, height: number) => {
    contentH.value = height;
    motionRef.current?.remeasureList.current?.();
  };

  // One stable object, so ProfileBody and the rows never re-render over it.
  const motionRef = useRef<TimelineMotion | null>(null);
  motionRef.current ??= {
    scrollY,
    viewportH,
    contentH,
    atEnd,
    listTop,
    remeasureList: { current: null },
    rowMeasurers: new Map(),
    boxes,
    activeIndex,
    pulse,
    frameRef,
  };

  return {
    motion: reduced ? undefined : motionRef.current,
    scrollHandler,
    frameRef,
    onFrameLayout,
    onContentSizeChange,
  };
}

/**
 * Anchors the list inside the scroll content. Rows report layout relative
 * to the list root; this measures where that root sits in the content, so
 * the two add up to a scroll offset. Both measurements happen in one
 * layout pass — no stored window coordinate to go stale.
 */
export function useTimelineListMotion(motion: TimelineMotion | undefined, count: number) {
  const listRef = useRef<View | null>(null);

  const measure = () => {
    if (motion === undefined) return;
    const frame = motion.frameRef.current;
    const list = listRef.current;
    if (frame === null || list === null) return;
    frame.measureInWindow((_frameX, frameY) => {
      list.measureInWindow((_listX, listY) => {
        motion.listTop.value = listY - frameY + motion.scrollY.value;
      });
    });
    // The rows too — their boxes go stale the same way the anchor does
    // (see `TimelineMotion.rowMeasurers`), and from the same causes.
    motion.rowMeasurers.forEach((measureRow) => measureRow(list));
  };

  // Kept in a ref so the registration below always calls the fresh closure.
  const measureRef = useRef(measure);
  measureRef.current = measure;

  const onListLayout = () => {
    measure();
  };

  /**
   * The rail's coral fill, sliding to the ACTIVE card's dot centre — the
   * handoff transitions `height` over 380ms; height is a layout prop, so
   * this scales a full-length bar from the top instead.
   *
   * The rail's length comes from `boxes` (the last card's bottom edge),
   * the same source every card effect uses — not from a separate layout
   * measurement that could go stale or never arrive.
   */
  const progress = useDerivedValue(() => {
    const zeroTiming = { duration: FILL_MS, easing: easing.settle };
    if (motion === undefined) return withTiming(0, zeroTiming);
    const rows = motion.boxes.value;
    const i = motion.activeIndex.value;
    const box = rows[i];
    const last = rows[rows.length - 1];
    if (i < 0 || box === undefined || last === undefined) return withTiming(0, zeroTiming);
    const railH = last.y + last.h - TL.railTop;
    if (railH <= 0) return withTiming(0, zeroTiming);
    const p = Math.min(1, Math.max(0, (box.y + TL.dotCentreY - TL.railTop) / railH));
    return withTiming(p, zeroTiming);
  });

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
  }));

  useEffect(() => {
    if (motion === undefined) return;
    // The route re-measures through this whenever the scroll content
    // changes size — the anchor's own onLayout does not fire when content
    // ABOVE the list grows (see `TimelineMotion.remeasureList`).
    motion.remeasureList.current = () => measureRef.current();
    return () => {
      motion.remeasureList.current = null;
      // Unmounting (tab switch) invalidates the anchor and the boxes.
      motion.listTop.value = -1;
    };
  }, [motion]);

  useEffect(() => {
    if (motion === undefined) return;
    // Rows unmounting leave their boxes behind; trim to what is rendered.
    if (motion.boxes.value.length > count) {
      motion.boxes.value = motion.boxes.value.slice(0, count);
    }
  }, [motion, count]);

  return { listRef, onListLayout, progressStyle };
}

/**
 * Everything one row animates. All styles are inert when `motion` is
 * undefined, so the static timeline renders exactly as before.
 */
export function useTimelineRowMotion(motion: TimelineMotion | undefined, index: number) {
  // Hooks run unconditionally; a dummy value stands in when motion is off.
  const zero = useSharedValue(0);
  const activeIdx = motion?.activeIndex ?? zero;

  /**
   * Attached to the row's OUTER, untransformed wrapper — `measureLayout`
   * against the list root gives the row's layout box regardless of scroll
   * position, and keeping the wrapper free of the entrance translate keeps
   * the web measurement (bounding rects, which include transforms) honest.
   */
  const rowRef = useRef<View | null>(null);

  useEffect(() => {
    if (motion === undefined) return;
    motion.rowMeasurers.set(index, (list) => {
      rowRef.current?.measureLayout(list, (_x, y, _width, height) => {
        const next = motion.boxes.value.slice();
        next[index] = { y, h: height };
        motion.boxes.value = next;
      });
    });
    return () => {
      motion.rowMeasurers.delete(index);
    };
  }, [motion, index]);

  const activeness = useDerivedValue(
    () =>
      withTiming(activeIdx.value === index ? 1 : 0, { duration: ACTIVE_MS, easing: easing.settle }),
    [index],
  );
  // The swell rides an overshooting curve — same spirit as the handoff's
  // cubic-bezier(.34,1.56,.64,1) — so the dot pops rather than grows.
  const swell = useDerivedValue(
    () =>
      withTiming(activeIdx.value === index ? 1 : 0, { duration: SWELL_MS, easing: easing.bounce }),
    [index],
  );

  const rowStyle = useAnimatedStyle(() => {
    if (motion === undefined) return {};
    const vh = motion.viewportH.value;
    const box = motion.boxes.value[index];
    // No metrics without the anchor: computed against a wrong origin, the
    // top fade band lands mid-screen and hides rows that are visible.
    if (vh <= 0 || box === undefined || motion.listTop.value < 0) return { opacity: 1 };
    // A page that cannot scroll has no scroll to link to — dimming rows
    // below a reading point nobody can reach would just look broken.
    const scrollable = motion.contentH.value > vh + END_SLACK;
    // The last card never reaches the reading point; at the end of the
    // scroll it is shown plainly instead of forever dimmed.
    if (!scrollable || (motion.atEnd.value && index === motion.boxes.value.length - 1)) {
      return { opacity: 1, transform: [{ translateY: 0 }] };
    }
    const m = cardMetrics(motion.listTop.value + box.y - motion.scrollY.value, box.h, vh);
    return {
      opacity: m.o * (DIM + (1 - DIM) * m.f),
      transform: [{ translateY: (1 - m.t) * RISE }],
    };
  });

  // Scale lives on the card, not the row — the dot and triangle sit outside
  // it, so they stay pinned to the rail. The origin ('0 26px', the dot's
  // height on the card's left edge) keeps the edge anchored beside the dot,
  // which is where the handoff put its origin too.
  const contentStyle = useAnimatedStyle(() => {
    if (motion === undefined) return {};
    const vh = motion.viewportH.value;
    const box = motion.boxes.value[index];
    if (vh <= 0 || box === undefined || motion.listTop.value < 0) return {};
    const scrollable = motion.contentH.value > vh + END_SLACK;
    if (!scrollable || (motion.atEnd.value && index === motion.boxes.value.length - 1)) {
      return { transform: [{ scale: 1 }] };
    }
    const m = cardMetrics(motion.listTop.value + box.y - motion.scrollY.value, box.h, vh);
    return { transform: [{ scale: SCALE_MIN + (1 - SCALE_MIN) * Math.min(m.o, m.f) }] };
  });

  // The handoff's dot: ring 3px gray → 3.5px coral, swelling to 1.5×.
  const dotStyle = useAnimatedStyle(() => {
    if (motion === undefined) return {};
    return {
      borderColor: interpolateColor(
        activeness.value,
        [0, 1],
        [colors.state.borderDashed, colors.coral.brand],
      ),
      borderWidth: 3 + 0.5 * activeness.value,
      transform: [{ scale: 1 + 0.5 * swell.value }],
    };
  });

  // The triangle pointing at the dot and the coral bar down the card's
  // left edge — both simply fade with active state (300ms in the handoff).
  const activeAccentStyle = useAnimatedStyle(() => ({
    opacity: motion === undefined ? 0 : activeness.value,
  }));

  const haloStyle = useAnimatedStyle(() => {
    if (motion === undefined) return { opacity: 0 };
    const p = motion.pulse.value;
    return {
      opacity: activeness.value * (1 - p) * 0.5,
      transform: [{ scale: 1 + p * 1.8 }],
    };
  });

  // The photo drifts against the scroll, slower than its card — the image
  // layer is taller than its frame, so the travel never shows an edge.
  const parallaxStyle = useAnimatedStyle(() => {
    if (motion === undefined) return {};
    const vh = motion.viewportH.value;
    const box = motion.boxes.value[index];
    if (vh <= 0 || box === undefined || motion.listTop.value < 0) return {};
    if (motion.contentH.value <= vh + END_SLACK) return { transform: [{ translateY: 0 }] };
    const m = cardMetrics(motion.listTop.value + box.y - motion.scrollY.value, box.h, vh);
    return { transform: [{ translateY: ((m.mid - vh / 2) / vh) * -PARALLAX }] };
  });

  const onRowLayout = (event: LayoutChangeEvent) => {
    if (motion === undefined) return;
    const { y, height } = event.nativeEvent.layout;
    const next = motion.boxes.value.slice();
    next[index] = { y, h: height };
    motion.boxes.value = next;
  };

  return {
    rowRef,
    rowStyle,
    contentStyle,
    dotStyle,
    haloStyle,
    activeAccentStyle,
    parallaxStyle,
    onRowLayout,
  };
}
