import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { comments } from '../../lib/api';
import type { CommentList, PostDetail } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * A post's comments, **oldest first** — a thread reads top-down, so paging
 * forward moves further into the conversation rather than further into the
 * past. That is the opposite of the feed, and it is the server's choice, not
 * a mistake here.
 */
export function useComments(postId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.postComments(postId ?? 'none'),
    queryFn: ({ pageParam }) => comments.list(postId as string, { cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommentList) => last.nextCursor,
    enabled: postId !== null,
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => comments.create(postId, { content }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.postComments(postId) });

      // The post carries its own `commentCount`, which the comment routes do
      // not return. Nudging it locally keeps the header honest without a
      // second request; the next fetch of the post confirms it.
      queryClient.setQueryData<PostDetail>(queryKeys.post(postId), (current) =>
        current === undefined ? current : { ...current, commentCount: current.commentCount + 1 },
      );
    },
  });
}

/**
 * Rewrites one of your own comments.
 *
 * Author-only on the server, so there is nothing to check here beyond
 * drawing the affordance on the right rows. The whole thread is refetched
 * rather than patched in place: a comment can sit on any page of an infinite
 * query, and finding it to splice would be more code than one request.
 *
 * The post's `commentCount` is untouched — editing does not change how many
 * there are.
 */
export function useUpdateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      comments.update(postId, commentId, { content }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.postComments(postId) });
    },
  });
}

/**
 * Removes one of your own comments. There is no undo.
 *
 * The count is nudged down for the same reason `useAddComment` nudges it up:
 * the comment routes never return the post, and a header that still says
 * "3 comments" over two of them is the kind of small wrongness people notice
 * immediately.
 */
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => comments.remove(postId, commentId),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.postComments(postId) });

      queryClient.setQueryData<PostDetail>(queryKeys.post(postId), (current) =>
        current === undefined
          ? current
          : { ...current, commentCount: Math.max(0, current.commentCount - 1) },
      );
    },
  });
}
