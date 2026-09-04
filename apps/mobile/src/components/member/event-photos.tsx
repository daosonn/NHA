import { Image } from 'expo-image';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

/** How much taller the parallax layer is than its frame, each side. */
const PARALLAX_BLEED = 16;

/**
 * The lone photo's frame follows the photo's own aspect ratio (measured on
 * load), not a fixed 110px letterbox — the same rule as the feed's single
 * photo (`feed/post-media.tsx`). The clamp keeps a 3:4 card and a 16:9
 * shot intact; only extremes (a 9:16 portrait, a panorama) get trimmed.
 */
const DEFAULT_SINGLE_RATIO = 3 / 2;
const MIN_SINGLE_RATIO = 0.72;
const MAX_SINGLE_RATIO = 1.9;

export type EventPhoto = {
  key: string;
  /**
   * The media id, when this is a stored photograph. Absent on a draft the
   * editor has not uploaded yet, which is why tapping one does nothing
   * there: there is no full-size copy to open.
   */
  mediaId?: string;
  mimeType?: string;
  /** `thumbnailSource(...)` for server media, `{ uri }` for a local draft. */
  source: ComponentProps<typeof Image>['source'];
};

/**
 * The photos on a timeline entry (mockup `edit-timeline-view-edit.html`):
 * a lone photo runs the card's width, several become a row of squares with
 * the last one carrying "+N" for the rest. Three tiles is the cap — past
 * that a row stops reading as photos and starts reading as a contact sheet.
 *
 * Shared by the read timeline and the editor's cards, which is the point:
 * an entry must look like the same entry with the tools out.
 */
export function EventPhotos({
  photos,
  onOpen,
  parallaxStyle,
}: {
  photos: EventPhoto[];
  /** Opens one at full size. The editor leaves it off — see `mediaId`. */
  onOpen?: (photo: EventPhoto) => void;
  /**
   * Scroll-linked drift for the lone-photo frame (`timeline-motion.ts`):
   * the image layer is taller than its frame and translates against the
   * scroll, so it moves slower than its card. Only the single photo gets
   * it — the square row reads as tiles, not as a window onto a picture.
   */
  parallaxStyle?: ComponentProps<typeof Animated.View>['style'];
}) {
  const { t } = useTranslation();

  // Measured natural ratio of the lone photo, keyed so a swapped draft
  // photo does not inherit the previous one's shape.
  const [measured, setMeasured] = useState<{ key: string; ratio: number } | null>(null);

  if (photos.length === 0) return null;

  /**
   * Tappable only when there is somewhere to go. A picture that grows under
   * your finger everywhere else and does nothing here reads as broken, but
   * so does a button that leads nowhere — so the two cases are kept apart
   * rather than always wrapping.
   */
  const wrap = (photo: EventPhoto, child: React.ReactNode, style: object) =>
    onOpen === undefined || photo.mediaId === undefined ? (
      <View key={photo.key} style={style}>
        {child}
      </View>
    ) : (
      <Pressable
        key={photo.key}
        onPress={() => onOpen(photo)}
        accessibilityRole="imagebutton"
        accessibilityLabel={t('post.openPhoto')}
        style={style}
      >
        {child}
      </Pressable>
    );

  const only = photos[0];
  if (photos.length === 1 && only !== undefined) {
    const ratio = Math.min(
      MAX_SINGLE_RATIO,
      Math.max(
        MIN_SINGLE_RATIO,
        measured?.key === only.key ? measured.ratio : DEFAULT_SINGLE_RATIO,
      ),
    );
    const image = (
      <Image
        source={only.source}
        contentFit="cover"
        transition={150}
        style={{ width: '100%', height: '100%' }}
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width > 0 && height > 0) setMeasured({ key: only.key, ratio: width / height });
        }}
      />
    );
    return wrap(
      only,
      parallaxStyle === undefined ? (
        image
      ) : (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -PARALLAX_BLEED,
              bottom: -PARALLAX_BLEED,
              left: 0,
              right: 0,
            },
            parallaxStyle,
          ]}
        >
          {image}
        </Animated.View>
      ),
      {
        width: '100%',
        aspectRatio: ratio,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.background.subtle,
        // Forces a stacking context. On the web, a TRANSFORMED child (the
        // parallax layer) escapes a rounded overflow clip unless the
        // clipping frame has one — the photo painted square over the
        // frame's corners. Harmless on native.
        zIndex: 0,
      },
    );
  }

  const shown = photos.slice(0, 3);
  const extra = photos.length - shown.length;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {shown.map((photo, index) =>
        wrap(
          photo,
          <>
            <Image
              source={photo.source}
              contentFit="cover"
              transition={150}
              style={{ width: '100%', height: '100%' }}
            />

            {index === shown.length - 1 && extra > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(24,24,27,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text weight="bold" color={colors.text.white} style={{ fontSize: 14 }}>
                  {`+${extra}`}
                </Text>
              </View>
            )}
          </>,
          {
            flex: 1,
            aspectRatio: 1,
            borderRadius: radius.md,
            overflow: 'hidden',
            backgroundColor: colors.background.subtle,
          },
        ),
      )}
    </View>
  );
}
