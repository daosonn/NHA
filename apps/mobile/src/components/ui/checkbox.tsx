import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { colors, radius } from '../../theme';

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
 */
export function Checkbox({ checked, onChange, accessibilityLabel, children }: CheckboxProps) {
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
        {checked && <Check size={13} color={colors.text.white} strokeWidth={3} />}
      </View>

      {children}
    </Pressable>
  );
}
