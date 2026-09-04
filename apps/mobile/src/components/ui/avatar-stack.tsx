import { View } from 'react-native';

import { colors, fonts, radius } from '../../theme';
import { Avatar } from './avatar';
import { Text } from './text';

export type AvatarStackItem = {
  id: string;
  /**
   * Whose face this is. Given, `Avatar` draws their initials on a tint of
   * their own; omitted, the stack falls back to the striped placeholder,
   * which is what the decorative stacks beside a photo count want.
   */
  name?: string;
  /** Only reached by the items that carry no name. */
  tone?: 'light' | 'dark';
};

export type AvatarStackProps = {
  items: AvatarStackItem[];
  size?: number;
  /** Colour of the surface behind the stack — painted as the gap between faces. */
  surface?: string;
  /** Trailing `+N` bubble. Omit or pass 0 to hide it. */
  remaining?: number;
};

/**
 * Overlapping faces.
 *
 * The gap between them is a ring in the surface colour rather than real
 * spacing, so the group reads as one object however tightly it is packed.
 */
export function AvatarStack({
  items,
  size = 34,
  surface = colors.background.page,
  remaining = 0,
}: AvatarStackProps) {
  const overlap = Math.round(size * 0.28);
  const ring = `0 0 0 2px ${surface}`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {items.map((item, index) => (
        <Avatar
          key={item.id}
          size={size}
          name={item.name}
          tone={item.tone}
          ring={ring}
          style={index > 0 ? { marginLeft: -overlap } : undefined}
        />
      ))}

      {remaining > 0 && (
        <View
          style={{
            width: size,
            height: size,
            marginLeft: items.length > 0 ? -overlap : 0,
            borderRadius: radius.full,
            backgroundColor: colors.coral.primary,
            boxShadow: ring,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text weight="bold" color={colors.text.white} style={{ fontSize: 11, lineHeight: 13 }}>
            {`+${remaining}`}
          </Text>
        </View>
      )}
    </View>
  );
}
