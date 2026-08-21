import { ChevronUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import Animated, {
  clamp,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '../../theme';
import { Text } from '../ui/text';

/** Gone within a flick. It has served its purpose the moment you scroll. */
const FADE_DISTANCE = 50;
/** It drifts the way it is pointing while it goes. */
const FADE_LIFT = -6;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Hint that the moments feed is one swipe away.
 *
 * It is a hint and not a button: the feed is rendered directly below on
 * Home, so scrolling past this cue *is* the gesture it describes.
 *
 * Which is also why it fades on the first flick (2026-08-21). An
 * instruction that stays up after you have followed it is no longer an
 * instruction, it is furniture — and this one sits directly above the
 * moments it was pointing at.
 */
export type SwipeCueProps = {
  /** Optional shortcut. Omit it on Home, where scrolling already works. */
  onPress?: () => void;
  /**
   * How far the page has scrolled. Given it, the cue fades away as soon as
   * somebody starts; without it the cue simply stays.
   */
  scrollY?: SharedValue<number>;
};

export function SwipeCue({ onPress, scrollY }: SwipeCueProps) {
  const { t } = useTranslation();

  const progress = useDerivedValue(() =>
    scrollY === undefined ? 0 : clamp(scrollY.value / FADE_DISTANCE, 0, 1),
  );

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, FADE_LIFT]) }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      style={[{ alignItems: 'center', gap: 2 }, style]}
    >
      <ChevronUp size={18} color="rgba(24,24,27,0.22)" strokeWidth={2} />
      <Text
        variant="caption"
        weight="medium"
        color={colors.text.lightMuted}
        style={{ letterSpacing: 0.2 }}
      >
        {t('home.swipeCue')}
      </Text>
    </AnimatedPressable>
  );
}
