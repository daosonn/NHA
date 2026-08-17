import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import type { Recommendation } from '../../fixtures/home';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

const FEATURE_HEIGHT = 212;
const SECONDARY_HEIGHT = 101;

/** Keeps white captions legible over whatever photo lands behind them. */
const SCRIM = ['rgba(9,9,11,0)', 'rgba(9,9,11,0.6)'] as const;

type TileProps = {
  item: Recommendation;
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
      <PhotoPlaceholder tone={item.tone} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={SCRIM}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: scrimHeight }}
      />
      {children}
    </Pressable>
  );
}

export type RecommendationGridProps = {
  feature: Recommendation;
  secondary: [Recommendation, Recommendation];
  onSelect?: (item: Recommendation) => void;
};

/** One tall tile beside two short ones — the two columns end level. */
export function RecommendationGrid({ feature, secondary, onSelect }: RecommendationGridProps) {
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

      <View style={{ flex: 1, gap: 10 }}>
        {secondary.map((item) => (
          <Tile
            key={item.id}
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
    </View>
  );
}
