import { UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, radius } from '../../theme';
import type { Invitation } from '../../fixtures/invite';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

const HEIGHT = 164;
const NODE = 48;
const SPOT = 52;
const PARENT_Y = 36;
const CHILD_Y = 107;

/** Where the two columns sit, as a share of the canvas width. */
const LEFT = 0.307;
const RIGHT = 0.693;

/** Canvas width the mockup was drawn at — the first-frame guess only. */
const DESIGN_WIDTH = 313;

const RING = `0 0 0 3px ${colors.background.card}, 0 0 0 4px ${colors.state.borderDefault}`;

function NodeLabel({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <View
      style={{ position: 'absolute', left: x - 60, top: y, width: 120, alignItems: 'center' }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

/**
 * A four-node sketch of where the invitee lands.
 *
 * Not the real tree: it is the argument for accepting, so it shows only the
 * people that explain the spot — the couple above it and the sibling beside
 * it — with the empty place drawn in the same dashed language the tree uses.
 */
export function InvitePreview({ invitation }: { invitation: Invitation }) {
  const { t } = useTranslation();

  const [width, setWidth] = useState(DESIGN_WIDTH);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (current === next ? current : next));
  };

  const lx = width * LEFT;
  const rx = width * RIGHT;
  const mx = (lx + rx) / 2;
  const jointY = PARENT_Y + 6;

  const couple = `M${lx + NODE / 2} ${PARENT_Y} Q${mx} ${PARENT_Y + 12} ${rx - NODE / 2} ${PARENT_Y}`;
  const descent = (x: number) =>
    `M${mx} ${jointY + 1} C${mx} ${PARENT_Y + 40} ${x} ${CHILD_Y - 28} ${x} ${CHILD_Y}`;

  const [first, second] = invitation.parents;

  return (
    <View
      onLayout={onLayout}
      style={{
        height: HEIGHT,
        borderRadius: radius['3xl'],
        backgroundColor: colors.coral.light,
        overflow: 'hidden',
      }}
    >
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Path
          d={couple}
          stroke={colors.coral.borderLight}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={descent(lx)}
          stroke={colors.coral.borderLight}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
        {/* Dashed all the way to the empty spot — the same signal the tree
            uses for "someone is on the way". */}
        <Path
          d={descent(rx)}
          stroke={colors.coral.borderLight}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeDasharray="3 7"
          fill="none"
        />
        <Circle cx={mx} cy={jointY} r={3} fill={colors.coral.primary} />
      </Svg>

      {first !== undefined && (
        <>
          <View style={{ position: 'absolute', left: lx - NODE / 2, top: PARENT_Y - NODE / 2 }}>
            <Avatar size={NODE} tone={first.tone} ring={RING} />
          </View>
          <NodeLabel x={lx} y={PARENT_Y + NODE / 2 + 6}>
            <Text variant="caption" weight="semibold" numberOfLines={1}>
              {t('invite.preview.nodeLabel', { name: first.name, role: first.role })}
            </Text>
          </NodeLabel>
        </>
      )}

      {second !== undefined && (
        <>
          <View style={{ position: 'absolute', left: rx - NODE / 2, top: PARENT_Y - NODE / 2 }}>
            <Avatar size={NODE} tone={second.tone} ring={RING} />
          </View>
          <NodeLabel x={rx} y={PARENT_Y + NODE / 2 + 6}>
            <Text variant="caption" weight="semibold" numberOfLines={1}>
              {t('invite.preview.nodeLabel', { name: second.name, role: second.role })}
            </Text>
          </NodeLabel>
        </>
      )}

      <View style={{ position: 'absolute', left: lx - NODE / 2, top: CHILD_Y - NODE / 2 }}>
        <Avatar size={NODE} tone={invitation.sibling.tone} ring={RING} />
      </View>
      <NodeLabel x={lx} y={CHILD_Y + NODE / 2 + 6}>
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {invitation.sibling.name}
        </Text>
      </NodeLabel>

      <View
        style={{
          position: 'absolute',
          left: rx - SPOT / 2,
          top: CHILD_Y - SPOT / 2,
          width: SPOT,
          height: SPOT,
          borderRadius: radius.full,
          borderWidth: 1.8,
          borderStyle: 'dashed',
          borderColor: colors.coral.border,
          backgroundColor: 'rgba(255,255,255,0.65)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <UserRound size={21} color={colors.coral.dark} strokeWidth={2} />
      </View>
      <NodeLabel x={rx} y={CHILD_Y + SPOT / 2 + 6}>
        <View
          style={{
            height: 17,
            paddingHorizontal: 8,
            borderRadius: radius.full,
            backgroundColor: colors.coral.primary,
            justifyContent: 'center',
          }}
        >
          <Text
            variant="badge"
            weight="bold"
            color={colors.text.white}
            style={{ letterSpacing: 0.4 }}
          >
            {t('invite.preview.yourSpot')}
          </Text>
        </View>
      </NodeLabel>
    </View>
  );
}
