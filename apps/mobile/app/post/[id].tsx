import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { PostCard } from '../../src/components/feed/post-card';
import { LikeButton } from '../../src/components/feed/like-button';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { Divider } from '../../src/components/ui/divider';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useMemberIdForUser } from '../../src/features/family/use-member-for-user';
import { useAddComment, useComments } from '../../src/features/feed/use-comments';
import { usePost, useSetReaction } from '../../src/features/feed/use-post';
import { formatFullDate } from '../../src/lib/date';
import type { CommentSummary } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

const MAX_COMMENT = 2000;

function CommentRow({ comment }: { comment: CommentSummary }) {
  const { t } = useTranslation();
  const router = useRouter();
  const posted = formatFullDate(comment.createdAt.slice(0, 10));

  // Same rule as everywhere: a face is a way into a Life Profile. Null when
  // the commenter is not a member of the family being viewed, in which case
  // the avatar stays inert rather than leading somewhere that does not exist.
  const memberId = useMemberIdForUser(comment.authorUserId);

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pressable
        onPress={
          memberId === null
            ? undefined
            : () => router.push({ pathname: '/member/[id]', params: { id: memberId } })
        }
        disabled={memberId === null}
        accessibilityRole="button"
        accessibilityLabel={t('post.openProfile', { name: comment.authorName })}
        hitSlop={6}
      >
        <Avatar size={32} name={comment.authorName} />
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            {comment.authorName}
          </Text>

          {posted !== null && (
            <Text variant="badge" color={colors.text.subtle}>
              {posted}
            </Text>
          )}
        </View>

        <Text variant="body2" color={colors.text.body}>
          {comment.content}
        </Text>
      </View>
    </View>
  );
}

/**
 * One moment, its reactions and its thread.
 *
 * A 404 here is deliberately ambiguous — the server returns it both for a
 * post that never existed and for one that is not yours to read
 * (`api-contract.md`) — so the screen says "not available" rather than
 * inventing a reason it cannot know.
 */
export default function PostDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const postId = id ?? null;

  const { data: post, isPending, isError } = usePost(postId);
  const comments = useComments(postId);
  const addComment = useAddComment(postId ?? '');
  const setReaction = useSetReaction(postId ?? '');

  const authorMemberId = useMemberIdForUser(post?.authorUserId ?? null);
  const [draft, setDraft] = useState('');

  const openAuthor =
    authorMemberId === null
      ? undefined
      : () => router.push({ pathname: '/member/[id]', params: { id: authorMemberId } });

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];

  const submit = () => {
    const content = draft.trim();
    if (content === '') return;

    addComment.mutate(content, { onSuccess: () => setDraft('') });
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('post.title')}
          </Text>
        }
      />

      {isError ? (
        <EmptyState
          renderIcon={({ size, color }) => (
            <TriangleAlert size={size} color={color} strokeWidth={2} />
          )}
          title={t('post.unavailableTitle')}
          description={t('post.unavailableBody')}
        />
      ) : isPending || post === undefined ? null : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.xl, gap: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* `showStats={false}`: the heart and the comment count the card
                normally draws are both repeated immediately below — once by
                the button, once by the divider. Two of each on one screen was
                the second half of what made the reactions confusing. */}
            <PostCard post={post} onAuthorPress={openAuthor} showStats={false} />

            <LikeButton
              mine={post.myReaction}
              count={post.reactionCount}
              onChange={(type) => setReaction.mutate(type)}
            />

            <Divider label={t('post.comments', { count: post.commentCount })} />

            {items.length === 0 ? (
              <Text variant="body2" color={colors.text.subtle} style={{ textAlign: 'center' }}>
                {t('post.noComments')}
              </Text>
            ) : (
              <View style={{ gap: 16 }}>
                {items.map((comment) => (
                  <CommentRow key={comment.id} comment={comment} />
                ))}
              </View>
            )}

            {comments.hasNextPage === true && (
              <Button
                label={t('post.loadMoreComments')}
                variant="ghost"
                size="small"
                loading={comments.isFetchingNextPage}
                onPress={() => void comments.fetchNextPage()}
              />
            )}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 10,
              paddingHorizontal: spacing.xl,
              paddingBottom: 28,
            }}
          >
            <View style={{ flex: 1 }}>
              <TextField
                label={t('post.addComment')}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('post.commentPlaceholder')}
                maxLength={MAX_COMMENT}
                multiline
              />
            </View>

            <Button
              label={t('post.send')}
              size="medium"
              disabled={draft.trim() === ''}
              loading={addComment.isPending}
              onPress={submit}
              renderIcon={({ size, color }) => <Send size={size} color={color} strokeWidth={2.1} />}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
