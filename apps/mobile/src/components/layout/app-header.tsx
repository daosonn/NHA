import { BlurView } from 'expo-blur';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, spacing } from '../../theme';

const HEIGHT = 56;

export type AppHeaderProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  /** 16 when the right slot is a 40px icon button, so the icon optically aligns. */
  paddingRight?: number;
};

/**
 * The same chrome on every screen: translucent page colour over a blur, and
 * **no border** — only the soft shadow separates it from the content that
 * scrolls underneath.
 */
export function AppHeader({ left, center, right, paddingRight = spacing.xl }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[
        {
          paddingTop: insets.top,
          backgroundColor: colors.background.headerBlur,
          zIndex: 10,
        },
        elevation.header,
      ]}
    >
      <View
        style={{
          height: HEIGHT,
          paddingLeft: spacing.xl,
          paddingRight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {left ?? <View />}
        {center}
        {right ?? <View />}
      </View>
    </BlurView>
  );
}

AppHeader.HEIGHT = HEIGHT;
