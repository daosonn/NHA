import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, Send, TriangleAlert, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { CommentActionsSheet } from '../../src/components/feed/comment-actions-sheet';
import { PostCard } from '../../src/components/feed/post-card';
import { LikeButton } from '../../src/components/feed/like-button';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { Divider } from '../../src/components/ui/divider';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useMemberForUser } from '../../src/features/family/use-member-for-user';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useUpdateComment,
} from '../../src/features/feed/use-comments';
import { usePost, useSetReaction } from '../../src/features/feed/use-post';
import { formatFullDate } from '../../src/lib/date';
import type { CommentSummary } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

const MAX_COMMENT = 2000;

function CommentRow({
  comment,
  mine,
  onActions,
}: {
  comment: CommentSummary;
  /** Draws the ⋯. The server decides who may act; this decides who is asked. */
  mine: boolean;
  onActions: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const posted = formatFullDate(comment.createdAt.slice(0, 10));
  // A comment edited after it was written says so, the way every thread
  // does — otherwise a reply can end up answering words that changed.
  const edited = comment.updatedAt !== comment.createdAt;

  // Same rule as everywhere: a face is a way into a Life Profile. Null when
  // the commenter is not a member of the family being viewed, in which case
  // the avatar stays inert rather than leading somewhere that does not exist.
  const member = useMemberForUser(comment.authorUserId);
  const memberId = member?.id ?? null;

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
        <Avatar
          size={32}
          name={comment.authorName}
          mediaId={comment.authorAvatarKey ?? member?.avatarKey}
        />
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            {comment.authorName}
          </Text>

          {posted !== null && (
            <Text variant="badge" color={colors.text.subtle}>
              {edited ? t('post.commentEdited', { date: posted }) : posted}
            </Text>
          )}
        </View>

        <Text variant="body2" color={colors.text.body}>
          {comment.content}
        </Text>
      </View>

      {/* Visible, not a long press. The app already hides one destructive
          action behind a long press on a tree node and nobody finds it;
          repeating that here would be repeating a known mistake. It is drawn
          only on your own rows, so it stays out of everybody else's. */}
      {mine && (
        <Pressable
          onPress={onActions}
          accessibilityRole="button"
          accessibilityLabel={t('post.commentActions.open')}
          hitSlop={8}
          style={{ paddingTop: 2 }}
        >
          <Ellipsis size={17} color={colors.text.subtle} strokeWidth={2.2} />
        </Pressable>
      )}
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

  const { user } = useSession();
  const toast = useToast();

  const { data: post, isPending, isError } = usePost(postId);
  const comments = useComments(postId);
  const addComment = useAddComment(postId ?? '');
  const updateComment = useUpdateComment(postId ?? '');
  const deleteComment = useDeleteComment(postId ?? '');
  const setReaction = useSetReaction(postId ?? '');

  /** Which comment the ⋯ sheet is open for. */
  const [acting, setActing] = useState<CommentSummary | null>(null);
  /**
   * The comment being rewritten, if any. Editing reuses the composer at the
   * bottom rather than turning the row into a text box: the keyboard is
   * already handled down there, and a row that becomes an input pushes the
   * whole thread around while somebody is reading it.
   */
  const [editing, setEditing] = useState<CommentSummary | null>(null);

  const author = useMemberForUser(post?.authorUserId ?? null);
  const authorMemberId = author?.id ?? null;
  const [draft, setDraft] = useState('');

  const openAuthor =
    authorMemberId === null
      ? undefined
      : () => router.push({ pathname: '/member/[id]', params: { id: authorMemberId } });

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];

  const startEditing = (comment: CommentSummary) => {
    setActing(null);
    setEditing(comment);
    setDraft(comment.content);
  };

  const stopEditing = () => {
    setEditing(null);
    setDraft('');
  };

  const remove = (comment: CommentSummary) => {
    deleteComment.mutate(comment.id, {
      onSuccess: () => {
        setActing(null);
        // Deleting the one being rewritten would otherwise leave the
        // composer editing a comment that no longer exists.
        if (editing?.id === comment.id) stopEditing();
        toast.success(t('post.commentDelete.done'));
      },
      onError: () => toast.failure(t('post.commentDelete.failed')),
    });
  };

  const submit = () => {
    const content = draft.trim();
    if (content === '') return;

    if (editing !== null) {
      updateComment.mutate(
        { commentId: editing.id, content },
        {
          onSuccess: () => {
            stopEditing();
            toast.success(t('post.commentEdit.done'));
          },
          onError: () => toast.failure(t('post.commentEdit.failed')),
        },
      );
      return;
    }

    addComment.mutate(content, { onSuccess: () => setDraft('') });
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton />}
        center={<ScreenTitle title={t('post.title')} />}
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
            <PostCard
              post={post}
              onAuthorPress={openAuthor}
              onMediaPress={(m) =>
                router.push({ pathname: '/media/[id]', params: { id: m.id, mime: m.mimeType } })
              }
              authorAvatarId={author?.avatarKey}
              showStats={false}
            />

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
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    mine={user !== null && comment.authorUserId === user.id}
                    onActions={() => setActing(comment)}
                  />
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

          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: 28, gap: 8 }}>
            {/* Says which mode the composer is in, and offers the way out.
                Without it, tapping Edit silently changes what the send
                button does — and the only clue would be text appearing in a
                box somebody was not looking at. */}
            {editing !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="caption" color={colors.coral.deep} style={{ flex: 1 }}>
                  {t('post.commentEdit.banner')}
                </Text>

                <Pressable
                  onPress={stopEditing}
                  accessibilityRole="button"
                  accessibilityLabel={t('post.commentEdit.cancel')}
                  hitSlop={8}
                >
                  <X size={16} color={colors.text.muted} strokeWidth={2.2} />
                </Pressable>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={editing === null ? t('post.addComment') : t('post.commentEdit.label')}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('post.commentPlaceholder')}
                  maxLength={MAX_COMMENT}
                  multiline
                />
              </View>

              <Button
                label={editing === null ? t('post.send') : t('post.commentEdit.save')}
                size="medium"
                disabled={draft.trim() === '' || draft.trim() === editing?.content}
                loading={addComment.isPending || updateComment.isPending}
                onPress={submit}
                renderIcon={({ size, color }) => (
                  <Send size={size} color={color} strokeWidth={2.1} />
                )}
              />
            </View>
          </View>

          <CommentActionsSheet
            comment={acting}
            onClose={() => setActing(null)}
            onEdit={startEditing}
            onDelete={remove}
            deleting={deleteComment.isPending}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
