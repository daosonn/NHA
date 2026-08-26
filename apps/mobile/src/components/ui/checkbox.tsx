import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { colors, radius } from '../../theme';
import { easing, tickTiming } from '../../theme/motion';

const BOX = 20;

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accessibilityLabel: string;
  /** Sits right of the box and is part of the same touch target. */
  children?: React.ReactNode;
};

/**
 * A checkbox and its label as a single press target.
 *
 * The label is plain text rather than a nested pressable: on the web an
 * interactive element inside another one is invalid markup, and a checkbox
 * whose words cannot be tapped is a small cruelty on a phone.
 *
 * The mark springs in (`.nha-tick`): always rendered, scaled to 0.4 and
 * invisible while unchecked, so both directions animate instead of the
 * mark blinking out of existence.
 */
export function Checkbox({ checked, onChange, accessibilityLabel, children }: CheckboxProps) {
  const tick = useAnimatedStyle(
    () => ({
      opacity: withTiming(checked ? 1 : 0, { duration: tickTiming.fadeMs }),
      transform: [
        {
          scale: withTiming(checked ? 1 : 0.4, {
            duration: tickTiming.scaleMs,
            easing: easing.bounce,
          }),
        },
      ],
    }),
    [checked],
  );

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}
    >
      <View
        style={{
          width: BOX,
          height: BOX,
          marginTop: 1,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? colors.coral.primary : colors.background.card,
          borderWidth: checked ? 0 : 1.5,
          borderColor: colors.state.borderNeutral,
        }}
      >
        <Animated.View style={tick}>
          <Check size={13} color={colors.text.white} strokeWidth={3} />
        </Animated.View>
      </View>

      {children}
    </Pressable>
  );
}
