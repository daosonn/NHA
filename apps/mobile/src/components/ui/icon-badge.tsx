import { View } from 'react-native';

import { colors, radius } from '../../theme';

export type IconBadgeProps = {
  size?: number;
  background?: string;
  foreground?: string;
  /** Receives a size proportional to the badge, so callers never guess. */
  renderIcon: (props: { size: number; color: string }) => React.ReactNode;
};

/**
 * A small tinted circle behind an icon.
 *
 * Used wherever a line of text needs a marker that carries meaning rather
 * than decoration — invitation facts, occasion kinds, gift rationales.
 */
export function IconBadge({
  size = 26,
  background = colors.coral.light,
  foreground = colors.coral.deep,
  renderIcon,
}: IconBadgeProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius.full,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderIcon({ size: Math.round(size * 0.54), color: foreground })}
    </View>
  );
}
