import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

export type EventPhoto = {
  key: string;
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
export function EventPhotos({ photos }: { photos: EventPhoto[] }) {
  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <Image
        source={photos[0]!.source}
        contentFit="cover"
        transition={150}
        style={{
          width: '100%',
          height: 110,
          borderRadius: radius.lg,
          backgroundColor: colors.background.subtle,
        }}
      />
    );
  }

  const shown = photos.slice(0, 3);
  const extra = photos.length - shown.length;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {shown.map((photo, index) => (
        <View
          key={photo.key}
          style={{
            flex: 1,
            aspectRatio: 1,
            borderRadius: radius.md,
            overflow: 'hidden',
            backgroundColor: colors.background.subtle,
          }}
        >
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
        </View>
      ))}
    </View>
  );
}
