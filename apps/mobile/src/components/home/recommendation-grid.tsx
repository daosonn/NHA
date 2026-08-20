import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RecommendationTile } from '../../features/home/use-recommendations';
import { mediaSource } from '../../lib/media-source';
import { colors, radius, spacing } from '../../theme';
import { Text } from '../ui/text';

const FEATURE_HEIGHT = 212;
const SECONDARY_HEIGHT = 101;

/** Keeps white captions legible over whatever photo lands behind them. */
const SCRIM = ['rgba(9,9,11,0)', 'rgba(9,9,11,0.6)'] as const;

type TileProps = {
  item: RecommendationTile;
  height: number;
  /** How far up the scrim reaches. */
  scrimHeight: number;
  onPress?: () => void;
  children: React.ReactNode;
};

function Tile({ item, height, scrimHeight, onPress, children }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={{
        height,
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: colors.state.borderDefault,
        overflow: 'hidden',
      }}
    >
      <Image
        source={mediaSource(item.mediaId)}
        recyclingKey={item.mediaId}
        contentFit="cover"
        transition={160}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={SCRIM}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: scrimHeight }}
      />
      {children}
    </Pressable>
  );
}

export type RecommendationGridProps = {
  /** Up to three, newest rule first. Fewer is normal; none renders nothing. */
  tiles: RecommendationTile[];
  onSelect?: (tile: RecommendationTile) => void;
};

/**
 * One tall tile beside up to two short ones — the two columns end level.
 *
 * The count is not fixed at three any more. A family with one old moment
 * gets one tile rather than two invented ones, and the tall one takes the
 * full width so the row does not end in a gap.
 */
export function RecommendationGrid({ tiles, onSelect }: RecommendationGridProps) {
  const [feature, ...secondary] = tiles;
  if (feature === undefined) return null;

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Tile
          item={feature}
          height={FEATURE_HEIGHT}
          scrimHeight={70}
          onPress={() => onSelect?.(feature)}
        >
          <View style={{ position: 'absolute', left: spacing.md, bottom: spacing.md, gap: 2 }}>
            <Text variant="body2" weight="semibold" color={colors.text.white}>
              {feature.title}
            </Text>
            {feature.meta !== undefined && (
              <Text variant="caption" color="rgba(255,255,255,0.8)">
                {feature.meta}
              </Text>
            )}
          </View>
        </Tile>
      </View>

      {secondary.length > 0 && (
        <View style={{ flex: 1, gap: 10 }}>
          {secondary.map((item) => (
            <Tile
              key={`${item.target.kind}-${item.target.id}`}
              item={item}
              height={SECONDARY_HEIGHT}
              scrimHeight={56}
              onPress={() => onSelect?.(item)}
            >
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.white}
                style={{ position: 'absolute', left: spacing.md, bottom: 10 }}
              >
                {item.title}
              </Text>
            </Tile>
          ))}
        </View>
      )}
    </View>
  );
}
