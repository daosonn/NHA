import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { posts, reactions } from '../../lib/api';
import type { PostDetail, ReactionType } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** One post. 404 here also means "not yours to see" — the server never sends 403. */
export function usePost(postId: string | null) {
  return useQuery({
    queryKey: queryKeys.post(postId ?? 'none'),
    queryFn: () => posts.detail(postId as string),
    enabled: postId !== null,
  });
}

/**
 * Sets, changes or clears the viewer's own reaction.
 *
 * Optimistic, because a reaction that waits for a round trip feels broken —
 * it is the one control people tap twice when nothing happens. Both routes
 * return the authoritative `{ myReaction, reactionCount }`, so the guess is
 * replaced by the truth rather than left to drift.
 *
 * The feed is deliberately **not** invalidated: it holds the same post with
 * the same counters, and refetching a whole page because one heart changed
 * would scroll the reader's position out from under them. The detail cache is
 * patched instead, and the feed catches up the next time it is stale.
 */
export function useSetReaction(postId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.post(postId);

  return useMutation({
    mutationFn: (type: ReactionType | null) =>
      type === null ? reactions.clear(postId) : reactions.set(postId, type),

    onMutate: async (type) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PostDetail>(key);

      if (previous !== undefined) {
        const had = previous.myReaction !== null;
        const has = type !== null;

        queryClient.setQueryData<PostDetail>(key, {
          ...previous,
          myReaction: type,
          // Changing LIKE to LOVE replaces one reaction, it does not add one.
          reactionCount: previous.reactionCount + (has ? 1 : 0) - (had ? 1 : 0),
        });
      }

      return { previous };
    },

    onError: (_error, _type, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous);
    },

    onSuccess: (state) => {
      queryClient.setQueryData<PostDetail>(key, (current) =>
        current === undefined ? current : { ...current, ...state },
      );
    },
  });
}
