import { View, type ViewProps } from 'react-native';

import { colors, elevation, radius, spacing } from '../../theme';

export type CardProps = ViewProps & {
  padding?: number;
};

/**
 * White surface. The hairline border does the separating work; the shadow is
 * only there to lift it off the page.
 */
export function Card({ padding = spacing.lg, style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.background.card,
          borderRadius: radius['3xl'],
          borderWidth: 1,
          borderColor: colors.state.borderDefault,
          padding,
        },
        elevation.card,
        style,
      ]}
    />
  );
}
