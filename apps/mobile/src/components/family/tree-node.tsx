import { Clock, Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';
import type { PositionedNode } from './tree-layout';

/** Warm-white ring plus the faintest outline, so nodes lift off the tint. */
const RING = `0 0 0 3px ${colors.background.card}, 0 0 0 4px ${colors.state.borderDefault}`;
/** The viewer also gets a coral halo — the only coral on the canvas. */
const RING_VIEWER = `0 0 0 3px ${colors.background.card}, 0 0 0 5.5px ${colors.coral.primary}, 0 0 0 12px rgba(245,139,123,0.14)`;
/** Edit mode's chosen person — deeper than the viewer's coral, so the two read apart. */
const RING_SELECTED = `0 0 0 3px ${colors.background.card}, 0 0 0 5.5px ${colors.coral.deep}, 0 0 0 12px rgba(184,66,47,0.18)`;

/** Labels are centred under the node and allowed to be wider than it. */
const LABEL_WIDTH = 104;

export type TreeNodeProps = {
  /** Long press opens what can be changed about this person. */
  node: PositionedNode;
  /** Edit mode's chosen person — drawn with the deep-coral ring. */
  selected?: boolean;
  /** True for a person who was not in the previous payload: they pop in. */
  appear?: boolean;
  onPress?: (node: PositionedNode) => void;
  onLongPress?: (node: PositionedNode) => void;
};

function NodeBody({ node, selected }: { node: PositionedNode; selected: boolean }) {
  const { size, state } = node;

  if (state === 'empty') {
    return (
      <View
        className="items-center justify-center border-[1.5px] border-dashed border-coral-border"
        style={{
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: 'rgba(255,255,255,0.5)',
        }}
      >
        <Plus size={22} color={colors.coral.dark} strokeWidth={2} />
      </View>
    );
  }

  if (state === 'pending') {
    return (
      <View
        className="items-center justify-center border-[1.8px] border-dashed border-coral-border bg-coral-subtle"
        style={{
          width: size,
          height: size,
          borderRadius: radius.full,
          boxShadow: selected ? RING_SELECTED : undefined,
        }}
      >
        <Clock size={22} color={colors.coral.dark} strokeWidth={2} />
      </View>
    );
  }

  return (
    <Avatar
      size={size}
      name={node.name}
      mediaId={node.avatarMediaId}
      tone={node.tone ?? 'light'}
      ring={selected ? RING_SELECTED : node.isViewer === true ? RING_VIEWER : RING}
    />
  );
}

/** The clock badge that marks a spot as reserved but not yet claimed. */
function PendingBadge() {
  return (
    <View
      className="absolute items-center justify-center border-2"
      style={{
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: radius.full,
        backgroundColor: colors.coral.primary,
        borderColor: colors.coral.light,
      }}
    >
      <Clock size={11} color={colors.text.white} strokeWidth={2.6} />
    </View>
  );
}

function NodeLabel({ node }: { node: PositionedNode }) {
  const { t } = useTranslation();

  if (node.state === 'empty') {
    return (
      <Text variant="caption" weight="medium" color={colors.text.subtle}>
        {t('family.addHere')}
      </Text>
    );
  }

  const pending = node.state === 'pending';

  return (
    <>
      <Text
        variant="caption"
        weight="semibold"
        color={pending ? colors.text.muted : colors.text.primary}
        numberOfLines={1}
      >
        {node.name}
      </Text>

      {node.isViewer === true ? (
        <View
          className="px-[7px]"
          style={{ height: 16, borderRadius: radius.full, backgroundColor: colors.coral.primary }}
        >
          <Text
            variant="badge"
            weight="bold"
            color={colors.text.white}
            style={{ lineHeight: 16, letterSpacing: 0.4 }}
          >
            {t('family.you')}
          </Text>
        </View>
      ) : (
        <Text
          variant="badge"
          color={pending ? colors.coral.dark : colors.text.subtle}
          numberOfLines={1}
        >
          {pending ? t('family.pendingRole', { role: node.role }) : node.role}
        </Text>
      )}
    </>
  );
}

/**
 * One person in the tree: the avatar, its state ring, and the name block
 * underneath. Positioned absolutely from the computed layout.
 *
 * `appear` plays the prototype's arrival: the avatar springs up from small
 * (an overshooting scale, `ftcPop`) while the whole block fades in.
 */
export function TreeNode({
  node,
  selected = false,
  appear = false,
  onPress,
  onLongPress,
}: TreeNodeProps) {
  const { t } = useTranslation();

  const scale = useSharedValue(appear ? 0.5 : 1);
  const opacity = useSharedValue(appear ? 0 : 1);

  useEffect(() => {
    if (!appear) return;
    scale.value = withSpring(1, { damping: 12, stiffness: 190 });
    opacity.value = withTiming(1, { duration: 220 });
    // Play once, on arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const label =
    node.state === 'empty'
      ? t('family.addMemberHere')
      : t('family.nodeLabel', { name: node.name, role: node.role });

  return (
    <Pressable
      onPress={() => onPress?.(node)}
      onLongPress={() => onLongPress?.(node)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={onLongPress === undefined ? undefined : t('family.nodeHint')}
      accessibilityState={selected ? { selected: true } : undefined}
      className="absolute items-center"
      style={{
        left: node.x - LABEL_WIDTH / 2,
        top: node.y - node.size / 2,
        width: LABEL_WIDTH,
      }}
    >
      <Animated.View style={[{ alignItems: 'center' }, popStyle]}>
        <View>
          <NodeBody node={node} selected={selected} />
          {node.state === 'pending' && <PendingBadge />}
        </View>

        <View className="mt-[5px] items-center gap-[1px]">
          <NodeLabel node={node} />
        </View>
      </Animated.View>
    </Pressable>
  );
}
