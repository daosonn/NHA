import { Image } from 'expo-image';
import { Camera, ImagePlus, Lock, Play, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { MemberGallery } from '../../features/member/use-member-gallery';
import type { GalleryMediaItem } from '../../lib/api';
import { formatFullDate } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { colors, radius } from '../../theme';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { Text } from '../ui/text';

/** All / shared with a family / shared with nobody. */
type Filter = 'all' | 'shared' | 'private';

type DayGroup = { date: string; items: GalleryMediaItem[] };

/**
 * Newest day first, newest photo first inside it.
 *
 * Not `features/omoide/group-photos.ts`: that one takes whole posts, packs
 * rows of four and works out a place from the moments that day — none of
 * which this grid has or wants. Sharing it would mean bending both.
 */
function groupByDay(items: GalleryMediaItem[]): DayGroup[] {
  const byDate = new Map<string, GalleryMediaItem[]>();
  for (const item of items) {
    const date = item.createdAt.slice(0, 10);
    const bucket = byDate.get(date);
    if (bucket === undefined) byDate.set(date, [item]);
    else bucket.push(item);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayItems]) => ({ date, items: dayItems }));
}

/** Khoảng hở giữa hai ô, tính theo pixel như mắt nhìn thấy. */
const GRID_GAP = 6;

/**
 * Ba cột, ở MỌI bề rộng.
 *
 * Trước đây là `width: '32.2%'` cộng `gap: 6` — phần trăm tính theo
 * container còn khe thì cộng thêm bằng pixel, nên ba ô chỉ lọt một dòng khi
 * container rộng ít nhất ~353px (0.966·W + 12 ≤ W). Hẹp hơn thì ô thứ ba rơi
 * xuống dòng và lưới lặng lẽ thành hai cột với ô to gấp rưỡi — đúng thứ
 * người dùng nhìn thấy trên máy hẹp, ngày 04/09.
 *
 * Giờ mỗi ô chiếm đúng một phần ba và tự đệm bên trong, nên tổng bề rộng
 * luôn là 100% dù container to nhỏ thế nào. Hàng bù lại nửa khe ở hai mép
 * ngoài để lưới vẫn thẳng hàng với tiêu đề phía trên.
 */
const TILE_WIDTH = '33.333%';

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
  /**
   * Start a post with no audience — a picture kept to yourself. Only your
   * own page passes this: there is no way to add a photograph to somebody
   * else's page, and a button implying otherwise would be a lie.
   */
  onAddPrivate?: () => void;
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
  onAddPrivate,
}: AlbumGridProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');

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

  const privateCount = items.filter((item) => !item.shared).length;
  const visible =
    filter === 'all' ? items : items.filter((item) => item.shared === (filter === 'shared'));
  const days = groupByDay(visible);

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

      {/* Only where there is something to separate. On a page whose pictures
          are all shared the filter would be three buttons doing one thing. */}
      {privateCount > 0 && (
        <SegmentedTabs
          options={[
            { value: 'all', label: t('member.moments.filterAll'), count: items.length },
            {
              value: 'shared',
              label: t('member.moments.filterShared'),
              count: items.length - privateCount,
            },
            {
              value: 'private',
              label: t('member.moments.filterPrivate'),
              count: privateCount,
            },
          ]}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={t('member.moments.filterLabel')}
        />
      )}

      {onAddPrivate !== undefined && (
        <Button
          label={t('member.moments.addPrivate')}
          variant="ghost"
          onPress={onAddPrivate}
          renderIcon={({ size, color }) => (
            <ImagePlus size={size} color={color} strokeWidth={2.1} />
          )}
        />
      )}

      {visible.length === 0 && (
        <EmptyState
          renderIcon={(props) => <Lock {...props} strokeWidth={2} />}
          title={t('member.moments.noneInFilter')}
        />
      )}

      {days.map((day) => (
        <View key={day.date} style={{ gap: 7 }}>
          {/* The day on its own line, then that day's pictures under it —
              the shape Omoide already uses, so the two shelves read alike. */}
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {formatFullDate(day.date) ?? day.date}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginHorizontal: -GRID_GAP / 2,
            }}
          >
            {day.items.map((item) => {
              const isVideo = item.mimeType.startsWith('video/');
              return (
                <View key={item.id} style={{ width: TILE_WIDTH, padding: GRID_GAP / 2 }}>
                  <Pressable
                    onPress={() => onOpenPhoto?.(item)}
                    onLongPress={
                      item.postId !== null ? () => onOpenMoment?.(item.postId as string) : undefined
                    }
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('member.moments.openPhoto')}
                    style={{
                      width: '100%',
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
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
