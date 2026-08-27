import { Image } from 'expo-image';
import { Camera, Play, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { MemberGallery } from '../../features/member/use-member-gallery';
import type { GalleryMediaItem } from '../../lib/api';
import { thumbnailSource } from '../../lib/media-source';
import { colors, radius } from '../../theme';
import { EmptyState } from '../ui/empty-state';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

const GRID_GAP = 6;
/** Ba cột: (100 − 2 khoảng hở ~1.7%) / 3. */
const TILE_WIDTH = '32.2%';

export type AlbumGridProps = {
  gallery: MemberGallery | undefined;
  memberName: string;
  /** Your own page, which is addressed in the second person. */
  own?: boolean;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** Chạm một tấm — mở trình xem toàn màn hình. */
  onOpenPhoto?: (item: GalleryMediaItem) => void;
  /** Giữ một tấm — mở bài đăng nó thuộc về (nếu có), nơi còn caption/bình luận. */
  onOpenMoment?: (postId: string) => void;
};

/**
 * Tab Album của một người — lưới ảnh LẺ ba cột (mỗi tấm một ô vuông, như màn
 * Omoide), không gom cụm theo bài đăng nữa.
 *
 * Bản trước gom mỗi bài đăng thành một tile "moment" — Sơn bỏ (26/08): người
 * xem muốn chạm vào TỪNG tấm để xem to, không phải đoán tile này giấu mấy tấm.
 * Ngữ cảnh bài đăng không mất: giữ (long-press) một tấm thuộc bài đăng thì mở
 * bài đó.
 *
 * **Derived, not curated.** The server assembles this from the posts the
 * person authored or was tagged in plus their life-event media. Nobody
 * curates it, and there is no way to put a picture on somebody's page
 * directly — which is why there is no "add photo" action here.
 */
export function AlbumGrid({
  gallery,
  memberName,
  own = false,
  loading = false,
  failed = false,
  onRetry,
  onOpenPhoto,
  onOpenMoment,
}: AlbumGridProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={colors.coral.primary} />
      </View>
    );
  }

  if (failed) {
    return (
      <EmptyState
        renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
        title={t('member.moments.failed')}
        actionLabel={t('home.retry')}
        onActionPress={onRetry}
      />
    );
  }

  const items = gallery?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        renderIcon={(props) => <Camera {...props} strokeWidth={2} />}
        title={t('member.moments.empty')}
        description={
          own
            ? t('member.moments.emptyBodyOwn')
            : t('member.moments.emptyBody', { name: memberName })
        }
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
          {own ? t('member.moments.headingOwn') : t('member.moments.heading')}
        </Text>

        <Text variant="caption" color={colors.text.muted}>
          {t('member.moments.counts', { count: items.length })}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
        {items.map((item) => {
          const isVideo = item.mimeType.startsWith('video/');
          return (
            <Pressable
              key={item.id}
              onPress={() => onOpenPhoto?.(item)}
              onLongPress={
                item.postId !== null ? () => onOpenMoment?.(item.postId as string) : undefined
              }
              accessibilityRole="imagebutton"
              accessibilityLabel={t('member.moments.openPhoto')}
              style={{
                width: TILE_WIDTH,
                aspectRatio: 1,
                borderRadius: radius.lg,
                overflow: 'hidden',
                backgroundColor: colors.background.subtle,
              }}
            >
              {/* Lót sau ảnh: đang tải hay tải hỏng đều còn vân nền, không ô trắng */}
              <PhotoPlaceholder style={StyleSheet.absoluteFill} />
              <Image
                source={thumbnailSource(item.id, item.mimeType)}
                recyclingKey={item.id}
                contentFit="cover"
                transition={160}
                style={StyleSheet.absoluteFill}
              />
              {isVideo && (
                <View
                  style={{
                    position: 'absolute',
                    right: 5,
                    bottom: 5,
                    width: 22,
                    height: 22,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(24,24,27,0.62)',
                  }}
                >
                  <Play
                    size={11}
                    color={colors.text.white}
                    strokeWidth={2.4}
                    fill={colors.text.white}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
