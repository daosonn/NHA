import { Camera } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, radius } from '../../theme';
import type { GalleryItem } from '../../fixtures/member';
import { EmptyState } from '../ui/empty-state';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

const COLUMNS = 3;
/**
 * Columns are a percentage, and the gutters are what `space-between` leaves
 * over — so the grid is fluid from an iPhone Mini to a Pro Max without ever
 * measuring the container. A fixed cell width would only be right on the one
 * handset it was drawn for.
 */
const CELL_WIDTH = '32%';

export type AlbumGridProps = {
  items: GalleryItem[];
  onSelect?: (item: GalleryItem) => void;
  onAddPhotos?: () => void;
};

/**
 * The photos of one person.
 *
 * This is **derived**, not an album the user curates: it is the media from
 * posts that tag this member, plus whatever hangs off their life events. The
 * `Album` model in the schema is a private, owner-only collection — a
 * different thing that must not be conflated with this grid.
 */
export function AlbumGrid({ items, onSelect, onAddPhotos }: AlbumGridProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <EmptyState
        renderIcon={(props) => <Camera {...props} strokeWidth={2} />}
        title={t('member.albumEmpty')}
        description={t('member.albumEmptyBody')}
        actionLabel={t('member.albumEmptyAction')}
        onActionPress={onAddPhotos}
      />
    );
  }

  // Keeps the final row left-aligned: `space-between` would otherwise push a
  // lone last photo to the right edge.
  const fillers = (COLUMNS - (items.length % COLUMNS)) % COLUMNS;

  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption" color={colors.text.subtle}>
        {t('member.albumCaption')}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 8,
        }}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onSelect?.(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('member.openPhoto')}
            style={{ width: CELL_WIDTH }}
          >
            <PhotoPlaceholder
              tone={item.tone}
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.state.borderDefault,
              }}
            />
          </Pressable>
        ))}

        {Array.from({ length: fillers }, (_, i) => (
          <View key={`filler-${i}`} style={{ width: CELL_WIDTH }} />
        ))}
      </View>
    </View>
  );
}
