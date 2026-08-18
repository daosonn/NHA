import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * The NHA mark: a house silhouette with the heart cut out in negative space.
 *
 * The geometry is duplicated from `scripts/generate-icons.mjs`, which cannot
 * import from `src/` (it runs in Node, outside the Metro graph). Change one
 * and change the other — or lift both into `@nha/tokens`, which is where a
 * third copy should force the issue.
 */
const VIEWBOX = 96;

const HOUSE =
  'M48 9 Q43.6 9 40.4 11.8 L13.6 36.6 Q9 40.8 9 47 V76 Q9 87 20 87 H76 Q87 87 87 76 ' +
  'V47 Q87 40.8 82.4 36.6 L55.6 11.8 Q52.4 9 48 9 Z';

const HEART =
  'M48 77.5 C62 66.5 70 59.5 70 52.5 C70 47 66 43.5 61.5 43.5 C56 43.5 51 47.5 48 52.5 ' +
  'C45 47.5 40 43.5 34.5 43.5 C30 43.5 26 47 26 52.5 C26 59.5 34 66.5 48 77.5 Z';

export type BrandMarkProps = {
  size: number;
  /** `coral` is the house on blush; `blush` inverts it. */
  tone?: 'coral' | 'blush';
};

export function BrandMark({ size, tone = 'coral' }: BrandMarkProps) {
  const house = tone === 'coral' ? colors.coral.primary : colors.coral.light;
  const heart = tone === 'coral' ? colors.coral.light : colors.coral.primary;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      <Path d={HOUSE} fill={house} />
      <Path d={HEART} fill={heart} />
    </Svg>
  );
}
