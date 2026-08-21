import { Image } from 'expo-image';
import { Heart, MessageCircle, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { PostDetail, ReactionType } from '../../lib/api';
import { formatFullDate } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { colors, elevation, radius, spacing } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

/**
 * Trái tim gửi đúng một loại trong năm loại của server — cùng lựa chọn với
 * `LikeButton` ở trang bài đăng, để hai chỗ không lệch nhau.
 */
const HEART: ReactionType = 'LOVE';

/** One photo fills the card; two share the width. Mockup 2a. */
const SINGLE_MEDIA_HEIGHT = 200;
const PAIR_MEDIA_HEIGHT = 104;
/** Beyond this the card would push the next post off the screen entirely. */
const MAX_TILES = 2;

export type PostCardProps = {
  post: PostDetail;
  /** Which family this reached, already resolved to a word by the screen. */
  audienceLabel?: string;
  onPress?: () => void;
  /** Opens the author's Life Profile. Omitted when they are not in this family. */
  onAuthorPress?: () => void;
  /** Mở một tấm ảnh / một clip cho lớn. Không truyền thì ảnh không bấm được. */
  onMediaPress?: (item: PostDetail['media'][number]) => void;
  /**
   * Thả hoặc bỏ tim ngay trên thẻ. `null` là bỏ tim.
   * Không truyền thì trái tim chỉ còn là con số, như trước.
   */
  onToggleLike?: (type: ReactionType | null) => void;
  /**
   * The author's photograph, as a `Media` id. Resolved by the screen — a
   * post carries `authorUserId` and no face, and the card has no business
   * holding a family tree to look one up.
   */
  authorAvatarId?: string | null;
  /**
   * The heart and comment counters along the bottom. On by default, because
   * in a feed they are the only sign a moment has been read at all — off on
   * the detail screen, where the same two numbers appear right below in
   * controls that can act on them.
   */
  showStats?: boolean;
};

/**
 * One moment in the feed, drawn to mockup 2a.
 *
 * Two press targets side by side rather than one inside the other: the
 * author block opens their Life Profile, the body opens the moment. Nesting
 * them would be the same mistake `GroupStrip` had — `react-native-web` turns
 * every `accessibilityRole="button"` into a real `<button>`, and HTML does
 * not allow one inside another.
 *
 * The audience pill is not decoration. A post carrying no family is private
 * to its author (`docs/02-backend/database.md`), and that is invisible
 * everywhere else in the card — so it is stated rather than implied.
 */
export function PostCard({
  post,
  audienceLabel,
  onPress,
  onAuthorPress,
  onMediaPress,
  onToggleLike,
  authorAvatarId,
  showStats = true,
}: PostCardProps) {
  const { t } = useTranslation();

  const posted = formatFullDate(post.createdAt.slice(0, 10));
  const isPrivate = post.familyIds.length === 0;
  const tiles = post.media.slice(0, MAX_TILES);
  const isPair = tiles.length > 1;
  const hasBody =
    (post.content !== null && post.content !== '') || tiles.length > 0 || post.eventTitle !== null;

  return (
    <View
      style={{
        backgroundColor: colors.background.card,
        borderRadius: radius['2xl'],
        padding: 14,
        gap: 12,
        ...elevation.card,
      }}
    >
      <Pressable
        onPress={onAuthorPress}
        disabled={onAuthorPress === undefined}
        accessibilityRole={onAuthorPress === undefined ? undefined : 'button'}
        accessibilityLabel={t('post.openProfile', { name: post.authorName })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        {/* The post carries its author's face; the screen may also have
            looked one up in the family it is drawing. Either answers the
            same question, so whichever the caller has is used. */}
        <Avatar size={40} name={post.authorName} mediaId={authorAvatarId ?? post.authorAvatarKey} />

        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="body1" weight="semibold" numberOfLines={1}>
            {post.authorName}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {posted !== null && (
              <Text variant="caption" weight="medium" color={colors.text.lightMuted}>
                {posted}
              </Text>
            )}

            {(isPrivate || audienceLabel !== undefined) && (
              <>
                <Text variant="caption" color={colors.state.borderDefault}>
                  ·
                </Text>

                <View
                  style={{
                    height: 18,
                    paddingHorizontal: 8,
                    borderRadius: radius.full,
                    justifyContent: 'center',
                    backgroundColor: isPrivate ? colors.background.muted : colors.coral.soft,
                  }}
                >
                  <Text
                    variant="badge"
                    weight="semibold"
                    color={isPrivate ? colors.text.secondary : colors.coral.deep}
                    numberOfLines={1}
                    style={{ letterSpacing: 0.2 }}
                  >
                    {isPrivate ? t('post.private') : audienceLabel}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Pressable>

      {hasBody && (
        <Pressable
          onPress={onPress}
          disabled={onPress === undefined}
          accessibilityRole={onPress === undefined ? undefined : 'button'}
          accessibilityLabel={t('post.openLabel', { name: post.authorName })}
          style={{ gap: 12 }}
        >
          {post.type === 'EVENT' && post.eventTitle !== null && (
            <Text variant="body1" weight="semibold">
              {post.eventTitle}
            </Text>
          )}

          {post.content !== null && post.content !== '' && (
            <Text variant="body2" color={colors.text.secondary}>
              {post.content}
            </Text>
          )}

          {tiles.length > 0 && (
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {tiles.map((item) => {
                const clip = item.mimeType.startsWith('video/');
                return (
                  // Mỗi tấm mở được: chạm vào ảnh trước đây chỉ mở bài đăng,
                  // nên không có cách nào xem tấm ảnh cho lớn hay phát clip.
                  <Pressable
                    key={item.id}
                    onPress={() => onMediaPress?.(item)}
                    disabled={onMediaPress === undefined}
                    accessibilityRole={onMediaPress === undefined ? undefined : 'imagebutton'}
                    accessibilityLabel={clip ? t('post.openClip') : t('post.openPhoto')}
                    style={{
                      flex: isPair ? 1 : undefined,
                      width: isPair ? undefined : '100%',
                    }}
                  >
                    <Image
                      source={thumbnailSource(item.id, item.mimeType)}
                      style={{
                        width: '100%',
                        height: isPair ? PAIR_MEDIA_HEIGHT : SINGLE_MEDIA_HEIGHT,
                        borderRadius: isPair ? radius.lg : radius.xl,
                        backgroundColor: colors.background.subtle,
                      }}
                      contentFit="cover"
                      // A moment is worth a beat of blur rather than a blank rectangle.
                      transition={160}
                      recyclingKey={item.id}
                      accessibilityIgnoresInvertColors
                    />
                    {clip && (
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
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      )}

      {/* Trái tim là NÚT ngay trên thẻ: thả tim là việc một nhịp, bắt mở bài
          rồi quay ra là ba nhịp cho cùng một hành động. Số bình luận vẫn chỉ là
          con số — viết bình luận thì phải mở bài ra, ở đó mới có ô nhập. */}
      {showStats && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable
            onPress={() => onToggleLike?.(post.myReaction === null ? HEART : null)}
            disabled={onToggleLike === undefined}
            accessibilityRole={onToggleLike === undefined ? undefined : 'button'}
            accessibilityState={{ selected: post.myReaction !== null }}
            accessibilityLabel={
              post.myReaction === null ? t('post.reactions.love') : t('post.reactions.clear')
            }
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Heart
              size={16}
              color={post.myReaction === null ? colors.text.lightMuted : colors.coral.primary}
              strokeWidth={2}
              fill={post.myReaction === null ? 'transparent' : colors.coral.primary}
            />
            <Text variant="caption" weight="medium" color={colors.text.secondary}>
              {post.reactionCount}
            </Text>
          </Pressable>

          {/* Bấm vào bình luận là muốn đọc/viết bình luận → mở bài, nơi có ô nhập */}
          <Pressable
            onPress={onPress}
            disabled={onPress === undefined}
            accessibilityRole={onPress === undefined ? undefined : 'button'}
            accessibilityLabel={t('post.comments', { count: post.commentCount })}
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <MessageCircle size={16} color={colors.text.lightMuted} strokeWidth={2} />
            <Text variant="caption" weight="medium" color={colors.text.secondary}>
              {post.commentCount}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
