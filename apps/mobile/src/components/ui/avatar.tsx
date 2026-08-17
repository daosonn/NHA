import type { StyleProp, ViewStyle } from 'react-native';

import { radius } from '../../theme';
import { PhotoPlaceholder } from './photo-placeholder';

export type AvatarProps = {
  size: number;
  tone?: 'light' | 'dark';
  /**
   * Ring drawn outside the circle, as a CSS box-shadow. Rings stack
   * (`0 0 0 2px #FFF, 0 0 0 4px #F0705F`), which a border cannot do, and they
   * must not shrink the image the way an inset border would.
   */
  ring?: string;
  style?: StyleProp<ViewStyle>;
};

/** A person. Stripes until real media is wired up. */
export function Avatar({ size, tone = 'light', ring, style }: AvatarProps) {
  return (
    <PhotoPlaceholder
      tone={tone}
      period={10}
      style={[
        { width: size, height: size, borderRadius: radius.full },
        ring !== undefined && { boxShadow: ring },
        style,
      ]}
    />
  );
}
