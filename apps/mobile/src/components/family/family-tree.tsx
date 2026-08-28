import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';
import { CanvasHint, EditToggleButton, ZoomControls } from './tree-controls';
import {
  layoutTree,
  type FamilyTreeData,
  type PositionedNode,
  type TreeLayout,
} from './tree-layout';
import { TreeNode } from './tree-node';
import { TreeSlotMarker } from './tree-slot-marker';
import { slotsFor, type TreeSlot } from './tree-slots';
import { TreeThreads } from './tree-threads';
import { useAnimatedTreeLayout } from './use-animated-tree-layout';

// Ranges and feel are the prototype's numbers, not invented here:
// `src/Family Tree Canvas.dc.html` is the spec for this interaction
// (Đạt, 2026-08-27) — wide zoom range, ±0.35 buttons, focal-point zoom,
// double-tap toggle, elastic everything.
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.4;
const ZOOM_STEP = 0.35;

/** Double-tap toggles between fit (1) and this — below the threshold zooms in. */
const DOUBLE_TAP_SCALE = 1.7;
const DOUBLE_TAP_THRESHOLD = 1.1;

/**
 * How far a finger must travel before it counts as a drag.
 *
 * Without it the pan wins every touch and tapping a face stops opening
 * anybody: a tap is a press with a pixel or two of travel, and the canvas
 * would swallow it. Eight is enough to let a deliberate scroll through and
 * still leave taps alone.
 */
const PAN_SLOP = 8;

/** Eases the buttons and the recenter, so nothing teleports. */
const SETTLE_MS = 180;

/** How much one wheel tick zooms — the prototype's tuning. */
const WHEEL_ZOOM_SENSITIVITY = 0.0016;

/** Trailing sync of `scale` into React state, for the buttons' disabled ends. */
const WHEEL_SETTLE_MS = 120;

/** Past-the-edge drags move at this fraction of finger speed (iOS-style). */
const RESISTANCE = 0.45;

/**
 * Breathing room the pan may rest in beyond "content flush with the edge",
 * each side (owner's call 2026-08-28: "thêm không gian để vuốt cho thoải
 * mái"). Without it a tree that fits the viewport cannot be dragged at all
 * — only rubber-banded — and a bigger tree always stops dead exactly at its
 * own edge, so a border node sits pinned against the frame with no way to
 * pull it toward the middle to read or tap it comfortably.
 */
const PAN_MARGIN = 72;

/** Pinching past the scale range keeps moving too, at half speed. */
const SCALE_RESISTANCE = 0.5;

/** How long after a drag a click on a node is still the drag's fault. */
const CLICK_SUPPRESS_MS = 250;

/** Soft white bloom behind the tree, so the tint does not read as flat. */
function CanvasGlow({ width, height }: { width: number; height: number }) {
  const id = `glow-${useId()}`;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="32%" r="62%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** "GEN 1" run vertically down the left gutter. */
function GenerationLabel({ label, y }: { label: string; y: number }) {
  return (
    <View
      className="absolute left-[10px] items-center gap-[6px]"
      style={{ top: y - 26 }}
      pointerEvents="none"
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: radius.full,
          backgroundColor: colors.coral.borderLight,
        }}
      />
      <Text
        variant="badge"
        weight="semibold"
        color={colors.coral.borderLight}
        style={{ letterSpacing: 0.8, transform: [{ rotate: '90deg' }], width: 40, marginTop: 16 }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Screen padding either side of the canvas. Only used to guess a width for
 * the very first frame; `onLayout` corrects it immediately after.
 */
const CANVAS_INSET = 40;

/** The canvas width the mockups were drawn at, for when nothing is known yet. */
const DESIGN_WIDTH = 353;

export type FamilyTreeProps = {
  data: FamilyTreeData;
  onSelectNode?: (node: PositionedNode) => void;
  /** Long press: manage the person rather than open them. */
  onManageNode?: (node: PositionedNode) => void;
  /**
   * Edit mode (owner's prototype `src/family-tree-canvas.html`, 2026-08-28):
   * the pencil toggles it, tapping a person selects them, and dashed slots
   * appear for whoever is still missing around them. The screen owns the
   * state — it has to coordinate the sheet the slots open.
   */
  editing?: boolean;
  onToggleEditing?: () => void;
  /** The person the slots are drawn around; `null` = nobody chosen yet. */
  selectedId?: string | null;
  onPickSlot?: (slot: TreeSlot) => void;
};

/**
 * The relationship canvas. It is a navigation surface first: tapping a node
 * opens that person's Life Profile — pinching and dragging are how you get to
 * the node you want when the family outgrows one screenful.
 *
 * Gestures and the zoom buttons drive the **same** shared values, so the two
 * can never disagree: pinch to 1.4 and the minus button takes you to 1.2, not
 * back to some remembered 0.8.
 *
 * Everything runs on the UI thread through Reanimated. A tree redrawn from
 * React state on every finger move stutters on a mid-range Android the moment
 * there are a dozen nodes and their connecting threads.
 */
export function FamilyTree({
  data,
  onSelectNode,
  onManageNode,
  editing = false,
  onToggleEditing,
  selectedId = null,
  onPickSlot,
}: FamilyTreeProps) {
  const { t } = useTranslation();

  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  /**
   * The world model, straight from the prototype: the canvas content is a
   * plane placed at `(tx, ty)` and scaled about the TOP-LEFT corner, so a
   * screen point is always `tx + world · scale`. That one invariant is what
   * makes focal-point zoom a two-line calculation — keep the world point
   * under the fingers, solve for the new `tx` — where the old
   * top-centre-origin model needed none because it could only zoom to one
   * place.
   */
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  /** Scale when the current pinch began; a pinch reports a factor, not a size. */
  const pinchStart = useSharedValue(1);
  /** The world point under the fingers when the pinch began — the anchor. */
  const pinchWorldX = useSharedValue(0);
  const pinchWorldY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  /**
   * Mirrors `scale` back into React, only so the buttons can grey out at the
   * ends. Nothing about the drawing depends on it — that would put a
   * re-render inside every pinch frame, which is the thing Reanimated exists
   * to avoid.
   */
  const [zoom, setZoom] = useState(1);

  // Measuring is authoritative, but waiting for it would paint an empty
  // canvas for a frame — and never paint at all when prerendering, where
  // neither `onLayout` nor `Dimensions` report anything.
  const width = measured?.width ?? (window.width > 0 ? window.width - CANVAS_INSET : DESIGN_WIDTH);
  const height = measured?.height ?? 0;

  const layout = useMemo(() => layoutTree(data, width), [data, width]);

  /**
   * What is actually DRAWN this frame: the target layout, except while a
   * relayout slide is in flight — then everyone is somewhere on the way
   * (`use-animated-tree-layout.ts`). Sizes, bounds and the refit below stay
   * on the target `layout`, so the world resizes once and the camera aims
   * where things settle.
   */
  const { layout: drawn, progress } = useAnimatedTreeLayout(layout);

  /** Edit mode's dashed spots around the chosen person, in world coordinates.
      Computed from `drawn`, so the previews travel with the slide. */
  const slots = useMemo(
    () => (editing && selectedId !== null ? slotsFor(data, drawn, selectedId) : []),
    [editing, selectedId, data, drawn],
  );

  /**
   * Who was NOT in the previous arrangement — they pop in (the prototype's
   * `ftcPop`). Keyed to the target layout's identity, NOT recomputed per
   * render: the slide above re-renders every frame, and a new person only
   * mounts on the tween's first frame — one render after the payload — so a
   * per-render diff would have already forgotten they were new. The very
   * first payload plays no entrance; the whole tree draws at once.
   */
  const appearRef = useRef<{
    layout: TreeLayout | null;
    known: Set<string> | null;
    ids: Set<string>;
  }>({ layout: null, known: null, ids: new Set() });
  if (appearRef.current.layout !== layout) {
    const previouslyKnown = appearRef.current.known;
    appearRef.current = {
      layout,
      known: new Set(layout.nodes.keys()),
      ids:
        previouslyKnown === null
          ? new Set()
          : new Set([...layout.nodes.keys()].filter((id) => !previouslyKnown.has(id))),
    };
  }
  const appearedIds = appearRef.current.ids;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setMeasured((current) =>
      current !== null && current.width === next.width && current.height === next.height
        ? current
        : { width: next.width, height: next.height },
    );
  };

  /**
   * How far the canvas may be dragged: only as far as there is content off
   * screen, and never at all along an axis that already fits.
   *
   * Unbounded panning loses the tree. Recenter would bring it back, but
   * having to press a button because a finger slipped is a bad trade for a
   * gesture whose whole job is to feel direct.
   */
  const contentHeight = Math.max(layout.height, height);
  /** The world's width — wider than the viewport when a row needs the room. */
  const contentWidth = layout.width;

  /**
   * Where `tx`/`ty` may rest at a given scale — the prototype's `getBounds`,
   * widened by PAN_MARGIN each side so the tree can always be nudged past
   * flush. Content larger than the viewport pans between "far edge flush"
   * and "near edge flush" plus the margin; content that fits sits centred
   * and still moves within the margin instead of being pinned.
   */
  const boundsFor = (at: number) => {
    'worklet';
    const cw = contentWidth * at;
    const ch = contentHeight * at;
    const minX = (cw <= width ? (width - cw) / 2 : width - cw) - PAN_MARGIN;
    const maxX = (cw <= width ? (width - cw) / 2 : 0) + PAN_MARGIN;
    const minY = (ch <= height ? (height - ch) / 2 : height - ch) - PAN_MARGIN;
    const maxY = (ch <= height ? (height - ch) / 2 : 0) + PAN_MARGIN;
    return { minX, maxX, minY, maxY };
  };

  /**
   * Past-the-edge motion continues at a fraction of finger speed instead of
   * stopping dead — a hard clamp made the surface feel rigid, and on a tree
   * small enough to fit the screen it made dragging do nothing at all, which
   * read as "pan is broken" (Đạt, 2026-08-27). Release springs it back.
   */
  const elastic = (value: number, min: number, max: number, resist: number) => {
    'worklet';
    if (value < min) return min - (min - value) * resist;
    if (value > max) return max + (value - max) * resist;
    return value;
  };

  const within = (value: number, min: number, max: number) => {
    'worklet';
    return Math.min(max, Math.max(min, value));
  };

  /**
   * Animate to a scale while keeping the world point under `(focalX, focalY)`
   * exactly there — the zoom buttons aim at the canvas centre, a double tap
   * at the tap. The prototype's `animateTo`.
   */
  const zoomTo = (nextScale: number, focalX: number, focalY: number) => {
    const next = within(nextScale, ZOOM_MIN, ZOOM_MAX);
    const worldX = (focalX - tx.value) / scale.value;
    const worldY = (focalY - ty.value) / scale.value;
    const bounds = boundsFor(next);
    scale.value = withTiming(next, { duration: SETTLE_MS });
    tx.value = withTiming(within(focalX - worldX * next, bounds.minX, bounds.maxX), {
      duration: SETTLE_MS,
    });
    ty.value = withTiming(within(focalY - worldY * next, bounds.minY, bounds.maxY), {
      duration: SETTLE_MS,
    });
    setZoom(next);
  };

  /**
   * "Fit": the whole tree in view. 1 while the world fits the viewport; a
   * wide world opens zoomed out instead of opening cropped — the prototype
   * opens at its own fit (0.62) for the same reason.
   */
  const fitScale = Math.max(ZOOM_MIN, Math.min(1, width / contentWidth));

  const recenter = () => {
    scale.value = withTiming(fitScale, { duration: SETTLE_MS });
    // A world wider than the viewport centres; one that fits lands on 0.
    tx.value = withTiming((width - contentWidth * fitScale) / 2, { duration: SETTLE_MS });
    ty.value = withTiming(0, { duration: SETTLE_MS });
    setZoom(fitScale);
  };

  /**
   * When the world's size changes — a member arrived, a row widened — the
   * old view may point at nothing. Refit rather than clamp: the person just
   * added the member and wants to see where they landed anyway.
   */
  useEffect(() => {
    scale.value = fitScale;
    tx.value = (width - contentWidth * fitScale) / 2;
    ty.value = 0;
    setZoom(fitScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sizes only.
  }, [contentWidth, contentHeight, width, height]);

  /**
   * Whether a pan is (or just was) driving the pointer. On native, a gesture
   * activating cancels the touch the node Pressables were tracking; on web
   * the two systems do not talk, so a drag that started on a face ended by
   * OPENING that face's profile — the canvas moved, then navigated out from
   * under you (found driving headless Chromium, 2026-08-27). The click
   * suppressor in the web effect below is the stand-in for that missing
   * cancellation.
   */
  const dragGuard = useRef({ dragging: false, endedAt: 0 });
  const markPanStart = () => {
    dragGuard.current.dragging = true;
  };
  const markPanEnd = () => {
    if (!dragGuard.current.dragging) return;
    dragGuard.current.dragging = false;
    dragGuard.current.endedAt = Date.now();
  };

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      pinchStart.value = scale.value;
      // The world point between the fingers — the pinch zooms about THIS,
      // not about some fixed corner: the face being squinted at stays put.
      pinchWorldX.value = (event.focalX - tx.value) / scale.value;
      pinchWorldY.value = (event.focalY - ty.value) / scale.value;
    })
    .onUpdate((event) => {
      const next = elastic(pinchStart.value * event.scale, ZOOM_MIN, ZOOM_MAX, SCALE_RESISTANCE);
      scale.value = next;
      // Following the CURRENT focal keeps the anchor under the fingers and
      // lets a drifting pinch pan at the same time, like the prototype.
      tx.value = event.focalX - pinchWorldX.value * next;
      ty.value = event.focalY - pinchWorldY.value * next;
    })
    .onEnd(() => {
      // Eased, not snapped: fingers just left the glass mid-motion, possibly
      // in the elastic zone on either axis or on the scale itself.
      const next = within(scale.value, ZOOM_MIN, ZOOM_MAX);
      const bounds = boundsFor(next);
      scale.value = withTiming(next, { duration: SETTLE_MS });
      tx.value = withTiming(within(tx.value, bounds.minX, bounds.maxX), { duration: SETTLE_MS });
      ty.value = withTiming(within(ty.value, bounds.minY, bounds.maxY), { duration: SETTLE_MS });
      runOnJS(setZoom)(next);
    });

  const pan = Gesture.Pan()
    .minDistance(PAN_SLOP)
    .onStart(() => {
      panStartX.value = tx.value;
      panStartY.value = ty.value;
      runOnJS(markPanStart)();
    })
    .onUpdate((event) => {
      const bounds = boundsFor(scale.value);
      tx.value = elastic(
        panStartX.value + event.translationX,
        bounds.minX,
        bounds.maxX,
        RESISTANCE,
      );
      ty.value = elastic(
        panStartY.value + event.translationY,
        bounds.minY,
        bounds.maxY,
        RESISTANCE,
      );
    })
    .onEnd((event) => {
      // The fling: keep the finger's velocity and let friction spend it,
      // bouncing back inside the bounds if the drag ended in the rubber zone.
      const bounds = boundsFor(scale.value);
      tx.value = withDecay({
        velocity: event.velocityX,
        clamp: [bounds.minX, bounds.maxX],
        rubberBandEffect: true,
      });
      ty.value = withDecay({
        velocity: event.velocityY,
        clamp: [bounds.minY, bounds.maxY],
        rubberBandEffect: true,
      });
    })
    // Finalize, not end: it also fires when the gesture is cancelled, and a
    // guard that stays up after a cancelled drag would eat real taps.
    .onFinalize(() => {
      runOnJS(markPanEnd)();
    });

  /** Double-tap: quick look at a face, second double-tap steps back out. */
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (!success) return;
      const target = scale.value < DOUBLE_TAP_THRESHOLD ? DOUBLE_TAP_SCALE : fitScale;
      const worldX = (event.x - tx.value) / scale.value;
      const worldY = (event.y - ty.value) / scale.value;
      const bounds = boundsFor(target);
      scale.value = withTiming(target, { duration: SETTLE_MS });
      tx.value = withTiming(within(event.x - worldX * target, bounds.minX, bounds.maxX), {
        duration: SETTLE_MS,
      });
      ty.value = withTiming(within(event.y - worldY * target, bounds.minY, bounds.maxY), {
        duration: SETTLE_MS,
      });
      runOnJS(setZoom)(target);
    });

  // Simultaneous, not exclusive: a pinch almost always drifts, and a canvas
  // that refuses to move while two fingers are down feels stuck. The double
  // tap coexists too — pan's minDistance keeps it from ever being one.
  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const containerRef = useRef<View>(null);
  const wheelSettle = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The web leg of the same gestures. The team previews in a browser, where a
   * mouse can drag (gesture-handler covers that) but cannot pinch — so until
   * this, the only zoom on web was the +/- buttons. Per the prototype, the
   * wheel ZOOMS, at the cursor: the world point under the pointer stays under
   * it, which is what every map does. A trackpad pinch arrives as a wheel
   * event too, so it gets the same treatment for free. `preventDefault`
   * matters: without it ctrl+wheel zooms the whole page instead of the tree.
   * Native never attaches any of this.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // On react-native-web a View's ref is the underlying DOM element.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (node === null || typeof node.addEventListener !== 'function') return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Gesture-handler registers on the same element first and, once a pan
      // has completed, starts swallowing wheel events before bubble
      // listeners see them (found driving headless Chromium: the first wheel
      // zoomed, any wheel after a drag did nothing). Handled here in the
      // capture phase on the PARENT, and stopped, so neither side fights.
      event.stopPropagation();

      const rect = node.getBoundingClientRect();
      const focalX = event.clientX - rect.left;
      const focalY = event.clientY - rect.top;

      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, scale.value * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)),
      );
      const worldX = (focalX - tx.value) / scale.value;
      const worldY = (focalY - ty.value) / scale.value;
      const bounds = boundsFor(next);
      scale.value = next;
      tx.value = within(focalX - worldX * next, bounds.minX, bounds.maxX);
      ty.value = within(focalY - worldY * next, bounds.minY, bounds.maxY);

      // Trailing, not per-tick: mirroring into React on every wheel event
      // would re-render mid-zoom — the exact thing the shared values avoid.
      if (wheelSettle.current !== null) clearTimeout(wheelSettle.current);
      wheelSettle.current = setTimeout(() => setZoom(scale.value), WHEEL_SETTLE_MS);
    };

    // The browser's own double-click, because gesture-handler's two-tap
    // recognition proved unreliable under a mouse — same toggle as the
    // native double tap.
    const onDoubleClick = (event: MouseEvent) => {
      event.stopPropagation();
      const rect = node.getBoundingClientRect();
      const focalX = event.clientX - rect.left;
      const focalY = event.clientY - rect.top;
      const target = scale.value < DOUBLE_TAP_THRESHOLD ? DOUBLE_TAP_SCALE : fitScale;
      zoomTo(target, focalX, focalY);
    };

    // A drag that started on a face must not ALSO open that face: the click
    // the browser synthesises after the pan is swallowed while the guard is
    // up. Real taps never raise the guard — pan only activates past
    // PAN_SLOP.
    const onClick = (event: MouseEvent) => {
      const guard = dragGuard.current;
      if (guard.dragging || Date.now() - guard.endedAt < CLICK_SUPPRESS_MS) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // On the parent, capture phase: capture descends outside-in, so this
    // runs before anything gesture-handler holds on the wrapper itself.
    // `passive: false` is what allows the preventDefault above.
    const host = node.parentElement ?? node;
    host.addEventListener('wheel', onWheel, { passive: false, capture: true });
    host.addEventListener('dblclick', onDoubleClick, true);
    host.addEventListener('click', onClick, true);
    return () => {
      host.removeEventListener('wheel', onWheel, { capture: true });
      host.removeEventListener('dblclick', onDoubleClick, true);
      host.removeEventListener('click', onClick, true);
      if (wheelSettle.current !== null) clearTimeout(wheelSettle.current);
    };
    // The clamp limits close over the measured sizes — rebind when they move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, contentHeight]);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      className="flex-1 overflow-hidden border bg-coral-light"
      style={{ borderRadius: radius['6xl'], borderColor: 'rgba(245,139,123,0.22)' }}
    >
      {width > 0 && height > 0 && <CanvasGlow width={width} height={height} />}

      <GestureDetector gesture={gesture}>
        {/* Gestures land on THIS view — viewport-sized and never transformed,
            like the prototype's listeners on the viewport element. Attached
            to the world instead, the hit area shrinks and drifts with every
            zoom, and a drag that starts where the world no longer is hits
            nothing. The web styles stop the browser from claiming the
            pointer for scrolling or text selection before the pan sees it. */}
        <View
          // The wheel/dblclick ref lives HERE, on a plain View: the NativeWind
          // -wrapped container above does not hand its ref the DOM element,
          // which left the wheel listener silently unattached (found driving
          // headless Chromium, 2026-08-27).
          ref={containerRef}
          collapsable={false}
          style={[
            { flex: 1 },
            Platform.OS === 'web' &&
              ({ touchAction: 'none', userSelect: 'none', cursor: 'grab' } as object),
          ]}
        >
          <Animated.View
            // Top-LEFT origin, not top-centre: the world model above solves
            // `screen = tx + world · scale`, and that equation only holds
            // when scaling is anchored at the same corner the translation
            // measures from. Sized to the content, positioned by transform.
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                width: contentWidth,
                height: contentHeight,
                transformOrigin: 'top left',
              },
              canvasStyle,
            ]}
          >
            <TreeThreads
              data={data}
              layout={drawn}
              width={contentWidth}
              height={contentHeight}
              progress={progress}
              slotPaths={slots.flatMap((slot) => slot.paths)}
            />

            {drawn.rows.map((row) => (
              <GenerationLabel key={row.id} label={row.label} y={row.y} />
            ))}

            {[...drawn.nodes.values()].map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selected={editing && node.id === selectedId}
                appear={appearedIds.has(node.id)}
                onPress={onSelectNode}
                onLongPress={onManageNode}
              />
            ))}

            {slots.map((slot) => (
              <TreeSlotMarker
                key={`${selectedId}-${slot.kind}`}
                slot={slot}
                onPress={() => onPickSlot?.(slot)}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <ZoomControls
        onZoomIn={() => zoomTo(zoom + ZOOM_STEP, width / 2, height / 2)}
        onZoomOut={() => zoomTo(zoom - ZOOM_STEP, width / 2, height / 2)}
        onRecenter={recenter}
        canZoomIn={zoom < ZOOM_MAX}
        canZoomOut={zoom > ZOOM_MIN}
      />

      {/* The prototype's readout: the current zoom beside the how-to. In
          edit mode the how-to changes job — it teaches the selection step. */}
      <CanvasHint>
        {editing
          ? selectedId === null
            ? t('family.editHint')
            : t('family.editHintSlot')
          : `${t('family.hint')} · ${Math.round(zoom * 100)}%`}
      </CanvasHint>
      <EditToggleButton editing={editing} onPress={onToggleEditing} />
    </View>
  );
}
