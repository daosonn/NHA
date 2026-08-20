import { View } from 'react-native';

import { colors } from '../../theme';
import { Text } from '../ui/text';

export type SectionLabelProps = {
  label: string;
  /** Optional right-aligned value on the same line (11a: BUDGET … "3.000〜8.000円"). */
  trailing?: React.ReactNode;
};

/**
 * The tiny uppercase section label the mockups use everywhere:
 * FOR / OCCASION / BUDGET / FROM / ANYTHING TO ADD / MESSAGE / DESIGN / EDIT.
 */
export function SectionLabel({ label, trailing }: SectionLabelProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text
        variant="badge"
        weight="semibold"
        color={colors.text.lightMuted}
        style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
      >
        {label}
      </Text>
      {trailing}
    </View>
  );
}
