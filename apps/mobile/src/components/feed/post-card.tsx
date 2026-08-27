import { Heart, MessageCircle, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { PostDetail, ReactionType } from '../../lib/api';
import { formatFullDate } from '../../lib/date';
import { colors, elevation, radius } from '../../theme';
import { CARD_PRESS_SCALE } from '../../theme/motion';
import { usePop } from '../motion/pop';
import { usePressScale } from '../motion/press';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';
import { PostMedia } from './post-media';

/**
 * Trái tim gửi đúng một loại trong năm loại của server — cùng lựa chọn với
 * `LikeButton` ở trang bài đăng, để hai chỗ không lệch nhau.
 */
const HEART: ReactionType = 'LOVE';

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
  const hasText = (post.content !== null && post.content !== '') || post.eventTitle !== null;

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
      {/* Two press targets, side by side and never nested (react-native-web
          turns `accessibilityRole="button"` into a real <button>, and HTML
          forbids one inside another).

          The author block is sized to its content rather than stretched:
          it used to carry `flex: 1`, so the whole width of the header —
          including the empty half beyond the date — opened the profile. On
          a card whose body opens the moment, that made the top third of it
          go somewhere else for no visible reason. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onAuthorPress}
          disabled={onAuthorPress === undefined}
          accessibilityRole={onAuthorPress === undefined ? undefined : 'button'}
          accessibilityLabel={t('post.openProfile', { name: post.authorName })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}
        >
          {/* The post carries its author's face; the screen may also have
              looked one up in the family it is drawing. Either answers the
              same question, so whichever the caller has is used. */}
          <Avatar
            size={40}
            name={post.authorName}
            mediaId={authorAvatarId ?? post.authorAvatarKey}
          />

          <View style={{ flexShrink: 1, gap: 1 }}>
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

        {/* The rest of the row belongs to the moment, like the body does.
            Blank space that does nothing is worse than either destination. */}
        <Pressable
          onPress={onPress}
          disabled={onPress === undefined}
          accessibilityRole={onPress === undefined ? undefined : 'button'}
          accessibilityLabel={t('post.openLabel', { name: post.authorName })}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={{ flex: 1, alignSelf: 'stretch', minWidth: 24 }}
        />
      </View>

      {hasText && (
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
        </Pressable>
      )}

      {/* Media is a SIBLING of the body, not inside it. Two reasons: each
          tile is its own press target, and a button inside a button is
          invalid on the web build; and the row scrolls sideways, which it
          cannot do while a parent Pressable is claiming the gesture. */}
      {post.media.length > 0 && (
        <PostMedia
          media={post.media}
          singleRatio={singleRatio}
          onRatio={(id: string, ratio: number) =>
            setSingleRatio((current) =>
              current[id] !== undefined ? current : { ...current, [id]: ratio },
            )
          }
          onMediaPress={onMediaPress}
        />
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
