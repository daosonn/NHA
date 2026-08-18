import { Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { colors, radius } from '../../theme';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

const TILE = 104;

function RemoveButton({ onPress, label }: { onPress?: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: radius.full,
        backgroundColor: 'rgba(24,24,27,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <X size={13} color={colors.text.white} strokeWidth={2.4} />
    </Pressable>
  );
}

export type DraftMediaKind = 'photo' | 'video';

export type DraftMedia = {
  id: string;
  kind: DraftMediaKind;
  tone: 'light' | 'dark';
  /** Videos only, pre-formatted — `0:12`. */
  duration?: string;
  /**
   * Local file the picker handed back. Absent for the fixture tiles, which
   * is why the striped placeholder is still here: it is what a tile looks
   * like before there is a file behind it, not a permanent stand-in.
   */
  uri?: string;
  /** Needed by the upload — React Native's `FormData` wants both. */
  fileName?: string;
  mimeType?: string;
};

export type MediaStripProps = {
  media: DraftMedia[];
  onRemove?: (item: DraftMedia) => void;
  onAdd?: () => void;
};

/**
 * The attachments on a draft moment.
 *
 * Scrolls horizontally rather than wrapping: a moment can carry a dozen
 * photos, and a wrapping grid would push the audience picker — the one part
 * with a privacy consequence — off the bottom of the screen.
 */
export function MediaStrip({ media, onRemove, onAdd }: MediaStripProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Room for the remove badges, which sit outside the tile.
      contentContainerStyle={{ gap: 10, paddingTop: 8, paddingRight: 8 }}
    >
      {media.map((item) => (
        <View key={item.id} style={{ width: TILE, height: TILE }}>
          {item.uri !== undefined ? (
            <Image
              source={{ uri: item.uri }}
              style={{
                width: TILE,
                height: TILE,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.state.borderDefault,
              }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <PhotoPlaceholder
              tone={item.tone}
              style={{
                width: TILE,
                height: TILE,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.state.borderDefault,
                justifyContent: 'flex-end',
                padding: 8,
              }}
            >
              {item.kind === 'video' && item.duration !== undefined && (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    height: 20,
                    paddingHorizontal: 8,
                    borderRadius: radius.full,
                    backgroundColor: 'rgba(9,9,11,0.45)',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="badge" weight="medium" color={colors.text.white}>
                    {item.duration}
                  </Text>
                </View>
              )}
            </PhotoPlaceholder>
          )}

          <RemoveButton
            onPress={() => onRemove?.(item)}
            label={item.kind === 'video' ? t('moment.removeVideo') : t('moment.removePhoto')}
          />
        </View>
      ))}

      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={t('moment.addMedia')}
        style={{
          width: TILE,
          height: TILE,
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.state.borderDashed,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={24} color={colors.text.muted} strokeWidth={2} />
      </Pressable>
    </ScrollView>
  );
}
