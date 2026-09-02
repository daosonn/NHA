import { Image } from 'expo-image';
import { Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { PhotoTile } from '../../features/omoide/use-family-photos';
import { thumbnailSource } from '../../lib/media-source';
import { colors, radius } from '../../theme';

/** Mockup 10b: four across, hairline gaps, barely-rounded corners. */
export const GRID_GAP = 3;
const TILE_RADIUS = 3;

export type PhotoRowProps = {
  tiles: PhotoTile[];
  /** Opens the moment the tile belongs to. */
  onPress: (tile: PhotoTile) => void;
  /** Giữ lâu — chỗ của các hành động phụ (đặt ảnh bìa nhà, 2026-09-01). */
  onLongPress?: (tile: PhotoTile) => void;
};

/**
 * One row of the photo grid.
 *
 * A short row is padded with empty flex slots rather than letting three
 * photos stretch to fill four columns — the last day of a month should line
 * up with every other day, not have wider tiles.
 */
export function PhotoRow({ tiles, onPress, onLongPress }: PhotoRowProps) {
  const { t } = useTranslation();
  const missing = 4 - tiles.length;

  return (
    <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.id}
          onPress={() => onPress(tile)}
          onLongPress={onLongPress === undefined ? undefined : () => onLongPress(tile)}
          accessibilityRole="button"
          accessibilityLabel={t('omoide.openMoment')}
          style={{ flex: 1, aspectRatio: 1 }}
        >
          <Image
            source={thumbnailSource(tile.id, tile.mimeType)}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: TILE_RADIUS,
              backgroundColor: colors.background.subtle,
            }}
            contentFit="cover"
            transition={140}
            // `recyclingKey` lets expo-image reuse the view as the grid
            // scrolls instead of flashing the previous photo into the slot.
            recyclingKey={tile.id}
            accessibilityIgnoresInvertColors
          />

          {tile.mimeType.startsWith('video/') && (
            <View
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                height: 16,
                paddingHorizontal: 5,
                borderRadius: radius.full,
                backgroundColor: 'rgba(24,24,27,0.6)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* No duration badge: `PostMediaSummary` carries mime type and
                  size, not length, and a made-up number would be worse than
                  none. */}
              <Video size={10} color={colors.text.white} strokeWidth={2.6} />
            </View>
          )}
        </Pressable>
      ))}

      {missing > 0 &&
        Array.from({ length: missing }, (_, index) => (
          <View key={`gap-${index}`} style={{ flex: 1 }} />
        ))}
    </View>
  );
}
