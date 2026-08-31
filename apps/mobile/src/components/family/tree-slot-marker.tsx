import { Plus } from 'lucide-react-native';
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
import { Text } from '../ui/text';
import type { TreeSlot } from './tree-slots';

/** Slightly under NODE_SIZE, like the prototype's 64-in-a-76 world. */
const SLOT_SIZE = 56;
const LABEL_WIDTH = 104;

/**
 * One dashed "add here" circle of edit mode. It pops in with a quick, small
 * spring — a hint of the arrival it promises. The first cut used the full
 * new-person spring (0.5→1, damping 13/220) and read as fussy when four
 * slots bounced at once (owner's call 2026-08-31: "ngắn hơn nhưng vẫn hay"),
 * so the travel is shorter and the settle firmer.
 */
export function TreeSlotMarker({ slot, onPress }: { slot: TreeSlot; onPress: () => void }) {
  const { t } = useTranslation();

  const scale = useSharedValue(0.75);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 17, stiffness: 420 });
    opacity.value = withTiming(1, { duration: 120 });
    // Play once, when the slot appears for this selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(`family.slots.${slot.kind}`)}
      className="absolute items-center"
      style={{
        left: slot.x - LABEL_WIDTH / 2,
        top: slot.y - SLOT_SIZE / 2,
        width: LABEL_WIDTH,
      }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 5 }, popStyle]}>
        <View
          className="items-center justify-center border-[1.8px] border-dashed border-coral-border"
          style={{
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            borderRadius: radius.full,
            backgroundColor: 'rgba(255,255,255,0.62)',
          }}
        >
          <Plus size={21} color={colors.coral.dark} strokeWidth={2.2} />
        </View>
        <Text variant="badge" weight="semibold" color={colors.coral.dark} numberOfLines={1}>
          {t(`family.slots.${slot.kind}`)}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
