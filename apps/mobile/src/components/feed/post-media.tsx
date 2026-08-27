/**
 * The photographs on a card.
 *
 * A moment with three photos used to show two and drop the rest without
 * saying so — `slice(0, 2)`, no counter, no way in. The third one simply did
 * not exist as far as the feed was concerned.
 *
 * One photo draws full width at its own aspect ratio. Two or more sit in a
 * **row that scrolls sideways**, every tile the same height and **as wide as
 * its own photo asks for** — so a portrait stays a portrait beside a
 * landscape, and neither is squeezed into a shared box. The next tile leans
 * in from the edge, which is the affordance: you can see there is more before
 * touching anything.
 *
 * Tapping a tile opens the viewer, where the set can be seen at full size.
 * That is deliberately not this component's job: a carousel inside a
 * vertically scrolling feed should hint at more, not become the gallery.
 */
import { Image } from 'expo-image';
import { ImageOff, Play } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';

import type { PostDetail } from '../../lib/api';
import { thumbnailSource } from '../../lib/media-source';
import { colors, radius, spacing } from '../../theme';
import { Text } from '../ui/text';

type MediaItem = PostDetail['media'][number];

/**
 * The carousel's height. Every tile shares it and takes whatever width its
 * own aspect ratio asks for, so nothing is squeezed and a portrait sits
 * beside a landscape without either being cropped to a common box.
 *
 * The first pass gave every tile half the row at 104 tall, borrowing the
 * pair layout from mockup 2a. That reads fine for two square-ish photos and
 * badly for anything else: a portrait shot came out as a squat letterbox,
 * and three photos meant three small ones. Height fixed, width free is what
 * keeps a photo looking like the photo that was posted.
 */
const CAROUSEL_HEIGHT = 232;

/**
 * Clamp on the tile's width. The floor keeps a very tall portrait from
 * becoming a sliver; the ceiling stops a panorama from filling the card so
 * completely that nothing peeks past it, which is the whole signal that the
 * row scrolls.
 */
const MIN_TILE_RATIO = 0.6;
const MAX_TILE_RATIO = 1.6;

/**
 * Anh DON ve theo dung ty le cua no (khai qua onLoad), thay vi khung cung
 * 200px cover. Kep trong [0.72, 1.9]: thiep 3:4 lot nguyen ven, anh 16:9
 * cung vay; chi anh doc qua dai (9:16) moi bi xen nhe.
 */
const DEFAULT_SINGLE_RATIO = 3 / 2;
const MIN_SINGLE_RATIO = 0.72;
const MAX_SINGLE_RATIO = 1.9;

function Unavailable({ style }: { style: ViewStyle }) {
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('post.mediaUnavailable')}
      style={[
        {
          backgroundColor: colors.background.subtle,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        style,
      ]}
    >
      <ImageOff size={20} color={colors.text.subtle} strokeWidth={2} />
      <Text variant="badge" color={colors.text.subtle}>
        {t('post.mediaUnavailable')}
      </Text>
    </View>
  );
}

function PlayBadge() {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.full,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Play size={20} color={colors.text.white} fill={colors.text.white} />
      </View>
    </View>
  );
}

function Tile({
  item,
  ratio,
  maxWidth,
  onRatio,
  onPress,
}: {
  item: MediaItem;
  ratio: number | undefined;
  maxWidth: number;
  onRatio: (id: string, ratio: number) => void;
  onPress?: (item: MediaItem) => void;
}) {
  const { t } = useTranslation();
  const clip = item.mimeType.startsWith('video/');

  const shape = Math.min(MAX_TILE_RATIO, Math.max(MIN_TILE_RATIO, ratio ?? 1));
  const width = Math.min(maxWidth, CAROUSEL_HEIGHT * shape);

  // File nam tren may khac (DB Neon chung) thi ve o "khong co o day", thay vi
  // mot anh vo bam vao duoc roi 404.
  if (item.available === false) {
    return <Unavailable style={{ width, height: CAROUSEL_HEIGHT, borderRadius: radius.lg }} />;
  }

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : 'imagebutton'}
      accessibilityLabel={clip ? t('post.openClip') : t('post.openPhoto')}
      style={{ width, height: CAROUSEL_HEIGHT }}
    >
      <Image
        source={thumbnailSource(item.id, item.mimeType)}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: radius.lg,
          backgroundColor: colors.background.subtle,
        }}
        // Only the extremes are cropped, and only to the clamp above: a tile
        // sized from its own ratio has nothing left to trim.
        contentFit="cover"
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w > 0 && h > 0) onRatio(item.id, w / h);
        }}
        transition={160}
        recyclingKey={item.id}
        accessibilityIgnoresInvertColors
      />
      {clip && <PlayBadge />}
    </Pressable>
  );
}

export type PostMediaProps = {
  media: MediaItem[];
  singleRatio: Record<string, number>;
  onRatio: (id: string, ratio: number) => void;
  onMediaPress?: (item: MediaItem) => void;
};

export function PostMedia({ media, singleRatio, onRatio, onMediaPress }: PostMediaProps) {
  const { t } = useTranslation();

  // Measured, not assumed: a hard-coded tile would be wrong at one of the two
  // widths this card is drawn at.
  const [rowWidth, setRowWidth] = useState(0);

  const single = media[0];

  if (media.length === 1 && single !== undefined) {
    if (single.available === false) {
      return <Unavailable style={{ width: '100%', height: 120, borderRadius: radius.xl }} />;
    }

    const clip = single.mimeType.startsWith('video/');
    const ratio = Math.min(
      MAX_SINGLE_RATIO,
      Math.max(MIN_SINGLE_RATIO, singleRatio[single.id] ?? DEFAULT_SINGLE_RATIO),
    );

    return (
      <Pressable
        onPress={() => onMediaPress?.(single)}
        disabled={onMediaPress === undefined}
        accessibilityRole={onMediaPress === undefined ? undefined : 'imagebutton'}
        accessibilityLabel={clip ? t('post.openClip') : t('post.openPhoto')}
        style={{ width: '100%' }}
      >
        <Image
          source={thumbnailSource(single.id, single.mimeType)}
          style={{
            width: '100%',
            aspectRatio: ratio,
            borderRadius: radius.xl,
            backgroundColor: colors.background.subtle,
          }}
          contentFit="cover"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width > 0 && height > 0) onRatio(single.id, width / height);
          }}
          // A moment is worth a beat of blur rather than a blank rectangle.
          transition={160}
          recyclingKey={single.id}
          accessibilityIgnoresInvertColors
        />
        {clip && <PlayBadge />}
      </Pressable>
    );
  }

  // A tile may take the whole row when its photo is wide, but never more.
  const maxTileWidth = rowWidth;

  return (
    <View onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      {rowWidth > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // The feed scrolls vertically through this row; the lock is what
          // keeps a downward flick from being claimed by the carousel.
          directionalLockEnabled
          contentContainerStyle={{ gap: spacing.xs }}
        >
          {media.map((item) => (
            <Tile
              key={item.id}
              item={item}
              ratio={singleRatio[item.id]}
              maxWidth={maxTileWidth}
              onRatio={onRatio}
              onPress={onMediaPress}
            />
          ))}
        </ScrollView>
      )}

      {/* From two up. Tiles are as wide as their photos, so even a pair
          usually runs past the card's edge — the count is then telling you
          something the row cannot. */}
      {media.length > 1 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            paddingHorizontal: 8,
            height: 20,
            borderRadius: radius.full,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="badge" weight="semibold" color={colors.text.white}>
            {t('post.mediaCount', { count: media.length })}
          </Text>
        </View>
      )}
    </View>
  );
}
