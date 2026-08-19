import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
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
 * opens that person's Life Profile.
 *
 * TODO: pinch-to-zoom and drag-to-pan. The buttons cover the same ground for
 * now, and gestures need `react-native-gesture-handler` wired into the layout
 * before they behave on both platforms.
 */
export function FamilyTree({ data, onSelectNode, onManageNode, onAddMember }: FamilyTreeProps) {
  const { t } = useTranslation();

  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
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

  return (
    <View
      onLayout={onLayout}
      className="flex-1 overflow-hidden border bg-coral-light"
      style={{ borderRadius: radius['6xl'], borderColor: 'rgba(245,139,123,0.22)' }}
    >
      {width > 0 && height > 0 && <CanvasGlow width={width} height={height} />}

      <View
        className="flex-1"
        // Scaled from the top centre so zooming keeps the eldest generation
        // in view rather than drifting off the top of the canvas.
        style={{ transform: [{ scale: zoom }], transformOrigin: 'top center' }}
      >
        <TreeThreads
          data={data}
          layout={layout}
          width={width}
          height={Math.max(layout.height, height)}
        />

        {layout.rows.map((row) => (
          <GenerationLabel key={row.id} label={row.label} y={row.y} />
        ))}

        {[...layout.nodes.values()].map((node) => (
          <TreeNode key={node.id} node={node} onPress={onSelectNode} onLongPress={onManageNode} />
        ))}
      </View>

      <ZoomControls
        onZoomIn={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
        onZoomOut={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
        onRecenter={() => setZoom(1)}
        canZoomIn={zoom < ZOOM_MAX}
        canZoomOut={zoom > ZOOM_MIN}
      />

      <CanvasHint>{t('family.hint')}</CanvasHint>
      <AddMemberButton onPress={onAddMember} />
    </View>
  );
}
