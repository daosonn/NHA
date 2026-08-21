import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Plus, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Pill } from '../../src/components/ai/pill';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { useVideoDraft } from '../../src/features/video/draft';
import { useVideoPhotos } from '../../src/features/video/use-video-photos';
import { media } from '../../src/lib/api';
import { thumbnailSource } from '../../src/lib/media-source';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 28 (11m) — "Sources by family group, numbered order, add more".
 * SỐ trên ảnh là THỨ TỰ xuất hiện trong video; tap lại để bỏ. "Choose for me"
 * lấy 8 ảnh mới nhất trong bộ lọc hiện tại; ô "+ Add" upload từ máy.
 */

type Filter = 'all' | 'mine' | string; // string = familyId

export default function VideoPhotosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const { draft, update } = useVideoDraft();

  const { tiles, familyList, isLoading } = useVideoPhotos();
  const [filter, setFilter] = useState<Filter>('all');
  const [uploading, setUploading] = useState(false);

  const visible = useMemo(() => {
    if (filter === 'all') return tiles;
    if (filter === 'mine') return tiles.filter((p) => p.authorUserId === user?.id);
    return tiles.filter((p) => p.familyId === filter);
  }, [tiles, filter, user?.id]);

  const clipTotal = useMemo(
    () => tiles.filter((p) => p.mimeType.startsWith('video/')).length,
    [tiles],
  );

  /** Chọn/bỏ chọn — ghi luôn image|video để màn khác không phải hỏi lại feed. */
  const select = (ids: string[]) => {
    const kinds: Record<string, 'image' | 'video'> = { ...draft.mediaKinds };
    for (const id of ids) {
      const mime = tiles.find((p) => p.id === id)?.mimeType ?? '';
      if (mime) kinds[id] = mime.startsWith('video/') ? 'video' : 'image';
    }
    update({ mediaIds: ids, mediaKinds: kinds });
  };

  const toggle = (id: string) =>
    select(
      draft.mediaIds.includes(id)
        ? draft.mediaIds.filter((x) => x !== id)
        : [...draft.mediaIds, id],
    );

  const chooseForMe = () => select(visible.slice(0, 8).map((p) => p.id));

  /**
   * "+ Add" — chọn từ máy, upload, tự tick vào cuối thứ tự.
   * Ô mới lưu trong DRAFT (không phải state của màn) nên rời màn rồi quay lại
   * vẫn còn — trước đây nó biến mất và ô đã chọn trông như rỗng.
   */
  const addFromDevice = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.92,
    });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const up = await media.upload({
        uri: asset.uri,
        name: asset.fileName ?? `add-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        type: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      });
      update({
        uploadedTiles: [
          { id: up.id, mimeType: up.mimeType, createdAt: up.createdAt },
          ...draft.uploadedTiles,
        ],
        mediaIds: [...draft.mediaIds, up.id],
        mediaKinds: {
          ...draft.mediaKinds,
          [up.id]: up.mimeType.startsWith('video/') ? 'video' : 'image',
        },
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={<ScreenTitle title={t('video.photosTitle')} />}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: 14,
          paddingBottom: 130,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* filter chips: Everyone / <family> / Mine (11m) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pill
            label={t('video.filterEveryone')}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {familyList.length > 1 &&
            familyList.map((f) => (
              <Pill
                key={f.id}
                label={f.name}
                selected={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          <Pill
            label={t('video.filterMine')}
            selected={filter === 'mine'}
            onPress={() => setFilter('mine')}
          />
        </ScrollView>

        {/* "46 photos and 3 clips shared with you" + Choose for me */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text variant="caption" color={colors.text.body} style={{ flex: 1 }}>
            {t('video.photosShared', { photos: tiles.length - clipTotal, clips: clipTotal })}
          </Text>
          <Pressable
            onPress={chooseForMe}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              height: 30,
              paddingHorizontal: 11,
              borderRadius: radius.full,
              backgroundColor: pressed ? colors.coral.light : colors.coral.soft,
            })}
          >
            <Sparkles size={13} color={colors.coral.hover} strokeWidth={2.2} />
            <Text variant="badge" weight="semibold" color={colors.coral.hover}>
              {t('video.chooseForMe')}
            </Text>
          </Pressable>
        </View>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {/* ô "+ Add" đứng đầu lưới (11m) */}
          <Pressable
            onPress={() => void addFromDevice()}
            disabled={uploading}
            accessibilityRole="button"
            style={{
              width: '23.5%',
              aspectRatio: 1,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.state.borderDashed,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              backgroundColor: colors.background.surfaceSoft,
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.coral.primary} />
            ) : (
              <>
                <Plus size={18} color={colors.text.muted} strokeWidth={2.2} />
                <Text variant="badge" color={colors.text.muted}>
                  {t('video.addTile')}
                </Text>
              </>
            )}
          </Pressable>

          {visible.map((p) => {
            const order = draft.mediaIds.indexOf(p.id);
            const selected = order >= 0;
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  width: '23.5%',
                  aspectRatio: 1,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                }}
              >
                {/* A clip has no image of its own to draw: `thumbnailSource`
                    asks for its poster frame instead, or the tile is blank. */}
                <Image
                  source={thumbnailSource(p.id, p.mimeType)}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {p.mimeType.startsWith('video/') && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 5,
                      top: 5,
                      paddingHorizontal: 6,
                      height: 17,
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      backgroundColor: 'rgba(24,24,27,0.62)',
                    }}
                  >
                    <Text variant="badge" color={colors.text.white}>
                      {t('video.clipBadge')}
                    </Text>
                  </View>
                )}
                {selected && (
                  <>
                    <View
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderWidth: 2.5,
                        borderColor: colors.coral.primary,
                        borderRadius: radius.lg,
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: 4,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.coral.primary,
                        borderWidth: 1.5,
                        borderColor: colors.background.card,
                      }}
                    >
                      <Text variant="badge" weight="bold" color={colors.text.white}>
                        {order + 1}
                      </Text>
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Lưới rỗng phải NÓI RA — trước đây nó trắng trơn và trông như lỗi hiển thị */}
        {!isLoading && visible.length === 0 && (
          <Text variant="caption" color={colors.text.body}>
            {filter === 'all' ? t('video.noPhotosYet') : t('video.noPhotosInFilter')}
          </Text>
        )}

        <Text variant="badge" color={colors.text.subtle}>
          {t('video.orderHint')}
        </Text>
      </ScrollView>

      {/* footer — "8 chosen, in this order · 1 → 8 · Use these" */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: spacing.xl,
          paddingBottom: 28,
          backgroundColor: colors.background.card,
          borderTopWidth: 1,
          borderTopColor: colors.state.borderDefault,
          gap: 10,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text variant="caption" weight="semibold">
            {t('video.chosenSummary', { count: draft.mediaIds.length })}
          </Text>
          {draft.mediaIds.length > 0 && (
            <Text variant="caption" color={colors.text.muted}>
              1 → {draft.mediaIds.length}
            </Text>
          )}
        </View>
        <Button
          label={t('video.useThese')}
          variant="primary"
          size="large"
          fullWidth
          disabled={draft.mediaIds.length === 0}
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}
