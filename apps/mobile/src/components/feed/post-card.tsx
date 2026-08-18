import { MessageCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { formatFullDate } from '../../lib/date';
import type { PostDetail } from '../../lib/api';
import { colors, elevation, radius, spacing } from '../../theme';
import { Avatar } from '../ui/avatar';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

export type PostCardProps = {
  post: PostDetail;
  onPress?: () => void;
  /** Opens the author's Life Profile. Omitted when they are not in this family. */
  onAuthorPress?: () => void;
};

/**
 * One moment in the feed.
 *
 * The author's avatar is its own press target, not part of the card's:
 * tapping a face anywhere in the app opens that person's Life Profile, and a
 * card that swallowed the tap would make the tree the only way in.
 *
 * Media is drawn as placeholders. The bytes need a bearer token
 * (`api-contract.md` → Media), so real thumbnails wait for the image layer
 * that can carry one — the count is honest in the meantime.
 */
export function PostCard({ post, onPress, onAuthorPress }: PostCardProps) {
  const { t } = useTranslation();

  const posted = formatFullDate(post.createdAt.slice(0, 10));
  const isEvent = post.type === 'EVENT';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('post.openLabel', { name: post.authorName })}
      style={{
        backgroundColor: colors.background.card,
        borderRadius: radius['2xl'],
        padding: 14,
        gap: 12,
        ...elevation.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onAuthorPress}
          disabled={onAuthorPress === undefined}
          accessibilityRole="button"
          accessibilityLabel={t('post.openProfile', { name: post.authorName })}
          hitSlop={6}
        >
          <Avatar size={40} />
        </Pressable>

        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="body1" weight="semibold" numberOfLines={1}>
            {post.authorName}
          </Text>

          {posted !== null && (
            <Text variant="caption" color={colors.text.subtle}>
              {posted}
            </Text>
          )}
        </View>

        {post.familyIds.length === 0 && (
          <View
            style={{
              paddingHorizontal: 8,
              height: 20,
              borderRadius: radius.full,
              backgroundColor: colors.background.subtle,
              justifyContent: 'center',
            }}
          >
            <Text variant="badge" weight="semibold" color={colors.text.muted}>
              {t('post.private')}
            </Text>
          </View>
        )}
      </View>

      {isEvent && post.eventTitle !== null && (
        <Text variant="body1" weight="semibold">
          {post.eventTitle}
        </Text>
      )}

      {post.content !== null && post.content !== '' && (
        <Text variant="body2" color={colors.text.body}>
          {post.content}
        </Text>
      )}

      {post.media.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {post.media.slice(0, 3).map((item) => (
            <PhotoPlaceholder
              key={item.id}
              style={{ flex: 1, minWidth: 92, height: 92, borderRadius: radius.lg }}
            />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {post.reactionCount > 0 && (
          <Text variant="caption" color={colors.text.subtle}>
            {t('post.reactionCount', { count: post.reactionCount })}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MessageCircle size={15} color={colors.text.subtle} strokeWidth={2} />
          <Text variant="caption" color={colors.text.subtle}>
            {post.commentCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
