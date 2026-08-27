import { Image } from 'expo-image';
import { Heart, ImageOff, MessageCircle, Play, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { PostDetail, ReactionType } from '../../lib/api';
import { formatFullDate } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { colors, elevation, radius, spacing } from '../../theme';
import { CARD_PRESS_SCALE } from '../../theme/motion';
import { usePop } from '../motion/pop';
import { usePressScale } from '../motion/press';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

/**
 * Trái tim gửi đúng một loại trong năm loại của server — cùng lựa chọn với
 * `LikeButton` ở trang bài đăng, để hai chỗ không lệch nhau.
 */
const HEART: ReactionType = 'LOVE';

/** Two photos share the width at a fixed height. Mockup 2a. */
const PAIR_MEDIA_HEIGHT = 104;
/** Beyond this the card would push the next post off the screen entirely. */
const MAX_TILES = 2;

/**
 * Ảnh ĐƠN vẽ theo đúng tỷ lệ của nó (khai qua onLoad), thay vì khung cứng
 * 200px cover — khung cứng từng cắt thiệp dọc 1080×1440 còn mỗi dải giữa.
 * Kẹp trong [0.72, 1.9]: thiệp 3:4 (0.75) lọt nguyên vẹn, ảnh 16:9 cũng vậy;
 * chỉ ảnh dọc quá dài (9:16) mới bị xén nhẹ để một bài không nuốt cả màn.
 */
const DEFAULT_SINGLE_RATIO = 3 / 2;
const MIN_SINGLE_RATIO = 0.72;
const MAX_SINGLE_RATIO = 1.9;

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
   * Ai được tag trong bài, đã được MÀN HÌNH đổi từ memberId ra tên (cùng lý
   * do với `authorAvatarId`: thẻ không ôm cây gia đình). Tag không đổi ra
   * được tên (người của nhà khác) thì màn hình lược đi — không đưa xuống.
   */
  taggedMembers?: { id: string; label: string }[];
  /** Chạm một chip tag — mở hồ sơ người đó. */
  onTagPress?: (memberId: string) => void;
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
  taggedMembers,
  onTagPress,
  showStats = true,
}: PostCardProps) {
  const { t } = useTranslation();

  // Tỷ lệ thật của ảnh đơn, học được khi ảnh tải xong — theo id vì FlatList
  // tái dùng card cho bài khác.
  const [singleRatio, setSingleRatio] = useState<Record<string, number>>({});

  const posted = formatFullDate(post.createdAt.slice(0, 10));
  const isPrivate = post.familyIds.length === 0;
  const tiles = post.media.slice(0, MAX_TILES);
  const isPair = tiles.length > 1;
  const hasBody =
    (post.content !== null && post.content !== '') || tiles.length > 0 || post.eventTitle !== null;

  // The whole card dips while the "open this moment" surfaces are held —
  // the body and the comment count, which share one destination. The author
  // block and the heart go elsewhere, so they do not move the card.
  const press = usePressScale({ scale: CARD_PRESS_SCALE });
  // `nhaPop` on toggle — setting and clearing alike; never on first paint.
  const heartPop = usePop(post.myReaction);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.background.card,
          borderRadius: radius['2xl'],
          padding: 14,
          gap: 12,
          ...elevation.card,
        },
        press.style,
      ]}
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
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
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
                // File nằm trên máy khác (DB Neon chung) → vẽ ô "không có ở
                // đây" thay vì một ảnh vỡ bấm vào được rồi 404.
                if (item.available === false) {
                  return (
                    <View
                      key={item.id}
                      accessibilityLabel={t('post.mediaUnavailable')}
                      style={{
                        flex: isPair ? 1 : undefined,
                        width: isPair ? undefined : '100%',
                        height: isPair ? PAIR_MEDIA_HEIGHT : 120,
                        borderRadius: isPair ? radius.lg : radius.xl,
                        backgroundColor: colors.background.subtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <ImageOff size={20} color={colors.text.subtle} strokeWidth={2} />
                      <Text variant="badge" color={colors.text.subtle}>
                        {t('post.mediaUnavailable')}
                      </Text>
                    </View>
                  );
                }
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
                        ...(isPair
                          ? { height: PAIR_MEDIA_HEIGHT }
                          : {
                              aspectRatio: Math.min(
                                MAX_SINGLE_RATIO,
                                Math.max(
                                  MIN_SINGLE_RATIO,
                                  singleRatio[item.id] ?? DEFAULT_SINGLE_RATIO,
                                ),
                              ),
                            }),
                        borderRadius: isPair ? radius.lg : radius.xl,
                        backgroundColor: colors.background.subtle,
                      }}
                      contentFit="cover"
                      onLoad={
                        isPair
                          ? undefined
                          : (e) => {
                              const { width, height } = e.source;
                              if (width > 0 && height > 0) {
                                setSingleRatio((current) =>
                                  current[item.id] !== undefined
                                    ? current
                                    : { ...current, [item.id]: width / height },
                                );
                              }
                            }
                      }
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

      {/* Ai có mặt trong khoảnh khắc này — tag vốn được ghi từ lúc đăng nhưng
          chưa từng được VẼ ra ở đâu. Chip là ANH EM của khối thân bài, không
          lồng vào trong (bài học button-in-button); chạm chip mở hồ sơ. */}
      {taggedMembers !== undefined && taggedMembers.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {taggedMembers.map((member) => (
            <Pressable
              key={member.id}
              onPress={() => onTagPress?.(member.id)}
              disabled={onTagPress === undefined}
              accessibilityRole={onTagPress === undefined ? undefined : 'button'}
              accessibilityLabel={t('post.openTagged', { name: member.label })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 24,
                paddingHorizontal: 9,
                borderRadius: radius.full,
                backgroundColor: colors.background.muted,
              }}
            >
              <UserRound size={11} color={colors.text.secondary} strokeWidth={2.2} />
              <Text variant="badge" weight="semibold" color={colors.text.secondary}>
                {member.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
            <Animated.View style={heartPop}>
              <Heart
                size={16}
                color={post.myReaction === null ? colors.text.lightMuted : colors.coral.primary}
                strokeWidth={2}
                fill={post.myReaction === null ? 'transparent' : colors.coral.primary}
              />
            </Animated.View>
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
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
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
    </Animated.View>
  );
}
