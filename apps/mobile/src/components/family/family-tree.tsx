import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';
import { AddMemberButton, CanvasHint, ZoomControls } from './tree-controls';
import { layoutTree, type FamilyTreeData, type PositionedNode } from './tree-layout';
import { TreeNode } from './tree-node';
import { TreeThreads } from './tree-threads';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

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
  onAddMember?: () => void;
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
export function FamilyTree({ data, onSelectNode, onManageNode, onAddMember }: FamilyTreeProps) {
  const { t } = useTranslation();

  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const scale = useSharedValue(1);
  /** Scale when the current pinch began; a pinch reports a factor, not a size. */
  const pinchStart = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
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

  const clamp = (value: number, limit: number) => {
    'worklet';
    if (limit <= 0) return 0;
    return Math.min(limit, Math.max(-limit, value));
  };

  const limitX = (at: number) => {
    'worklet';
    return Math.max(0, (width * at - width) / 2);
  };

  const limitY = (at: number) => {
    'worklet';
    return Math.max(0, contentHeight * at - height);
  };

  const settle = (nextScale: number) => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextScale));
    scale.value = withTiming(next, { duration: SETTLE_MS });
    // Zooming out can leave the canvas outside its new, smaller bounds.
    panX.value = withTiming(clamp(panX.value, limitX(next)), { duration: SETTLE_MS });
    panY.value = withTiming(clamp(panY.value, limitY(next)), { duration: SETTLE_MS });
    setZoom(next);
  };

  const recenter = () => {
    scale.value = withTiming(1, { duration: SETTLE_MS });
    panX.value = withTiming(0, { duration: SETTLE_MS });
    panY.value = withTiming(0, { duration: SETTLE_MS });
    setZoom(1);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStart.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStart.value * event.scale));
    })
    .onEnd(() => {
      panX.value = clamp(panX.value, limitX(scale.value));
      panY.value = clamp(panY.value, limitY(scale.value));
    });

  const pan = Gesture.Pan()
    .minDistance(PAN_SLOP)
    .onStart(() => {
      panStartX.value = panX.value;
      panStartY.value = panY.value;
    })
    .onUpdate((event) => {
      panX.value = clamp(panStartX.value + event.translationX, limitX(scale.value));
      panY.value = clamp(panStartY.value + event.translationY, limitY(scale.value));
    });

  // Simultaneous, not exclusive: a pinch almost always drifts, and a canvas
  // that refuses to move while two fingers are down feels stuck.
  const gesture = Gesture.Simultaneous(pinch, pan);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      className="flex-1 overflow-hidden border bg-coral-light"
      style={{ borderRadius: radius['6xl'], borderColor: 'rgba(245,139,123,0.22)' }}
    >
      {width > 0 && height > 0 && <CanvasGlow width={width} height={height} />}

      <GestureDetector gesture={gesture}>
        <Animated.View
          className="flex-1"
          // Scaled from the top centre so zooming keeps the eldest generation
          // in view rather than drifting off the top of the canvas.
          style={[{ transformOrigin: 'top center' }, canvasStyle]}
        >
          <TreeThreads data={data} layout={layout} width={width} height={contentHeight} />

          {layout.rows.map((row) => (
            <GenerationLabel key={row.id} label={row.label} y={row.y} />
          ))}

          {[...layout.nodes.values()].map((node) => (
            <TreeNode key={node.id} node={node} onPress={onSelectNode} onLongPress={onManageNode} />
          ))}
        </Animated.View>
      </GestureDetector>

      <ZoomControls
        onZoomIn={() => settle(zoom + ZOOM_STEP)}
        onZoomOut={() => settle(zoom - ZOOM_STEP)}
        onRecenter={recenter}
        canZoomIn={zoom < ZOOM_MAX}
        canZoomOut={zoom > ZOOM_MIN}
      />

      <CanvasHint>{t('family.hint')}</CanvasHint>
      <AddMemberButton onPress={onAddMember} />
    </View>
  );
}
