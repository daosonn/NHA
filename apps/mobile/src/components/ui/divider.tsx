import { View } from 'react-native';

import { colors } from '../../theme';
import { Text } from './text';

/** A hairline, optionally interrupted by a word. */
export function Divider({ label }: { label?: string }) {
  const line = <View style={{ flex: 1, height: 1, backgroundColor: colors.state.borderNeutral }} />;

  if (label === undefined) return line;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {line}
      <Text variant="badge" weight="medium" color={colors.text.subtle}>
        {label}
      </Text>
      {line}
    </View>
  );
}
