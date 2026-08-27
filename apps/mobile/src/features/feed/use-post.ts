import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { posts, reactions } from '../../lib/api';
import type { PostDetail, ReactionType, UpdatePostRequest } from '../../lib/api';
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

      // Thẻ trên dòng thời gian là CÙNG bài đó: trái tim bấm ở feed phải đổi
      // ngay tại chỗ, nên vá luôn mọi trang feed đang có bài này.
      const feeds = patchFeeds(queryClient, postId, (post) => {
        const had = post.myReaction !== null;
        const has = type !== null;
        return {
          ...post,
          myReaction: type,
          reactionCount: post.reactionCount + (has ? 1 : 0) - (had ? 1 : 0),
        };
      });

      return { previous, feeds };
    },

    onError: (_error, _type, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous);
      // Trả từng trang feed về đúng nội dung trước khi bấm
      for (const [feedKey, data] of context?.feeds ?? []) {
        queryClient.setQueryData(feedKey, data);
      }
    },

    onSuccess: (state) => {
      queryClient.setQueryData<PostDetail>(key, (current) =>
        current === undefined ? current : { ...current, ...state },
      );
      // Con số của server thắng phỏng đoán lạc quan
      patchFeeds(queryClient, postId, (post) => ({ ...post, ...state }));
    },
  });
}

/**
 * Sửa một bài của chính mình. Server chỉ cho tác giả (403), và hai mảng
 * `familyIds`/`taggedMemberIds` là THAY CẢ TẬP — form phải gửi đủ, gửi thiếu
 * là lặng lẽ rụng tag/bớt nhà.
 */
export function useUpdatePost(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdatePostRequest) => posts.update(postId, body),
    onSuccess: (detail) => {
      const previous = queryClient.getQueryData<PostDetail>(queryKeys.post(postId));
      queryClient.setQueryData(queryKeys.post(postId), detail);
      patchFeeds(queryClient, postId, () => detail);

      // Đối tượng chia sẻ có thể đã đổi: làm mới feed + cây family (album/
      // gallery của thành viên dẫn xuất từ tag) của HỢP hai tập nhà — nhà bị
      // rút khỏi bài cũng phải thấy bài biến mất.
      const touched = new Set([...(previous?.familyIds ?? []), ...detail.familyIds]);
      for (const familyId of touched) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.familyFeed(familyId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.myFeed() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myGallery() });
    },
  });
}

/**
 * Xóa một bài — nhận NGUYÊN PostDetail (không chỉ id) để onSuccess còn biết
 * bài từng ở những nhà nào mà dọn cache. DELETE mang theo cả file media, nên
 * bước xác nhận nằm ở UI (sheet), không ở đây.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: PostDetail) => posts.remove(post.id),
    onSuccess: (_result, post) => {
      // Gỡ theo tiền tố: kéo theo cả ['posts', id, 'comments'].
      queryClient.removeQueries({ queryKey: queryKeys.post(post.id) });
      // Gỡ NGAY khỏi mọi trang feed trong cache — đợi refetch thì bài chết
      // vẫn nằm đó và bấm vào là 404.
      removeFromFeeds(queryClient, post.id);
      for (const familyId of post.familyIds) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.familyFeed(familyId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.myFeed() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myGallery() });
    },
  });
}

type FeedPage = { items: PostDetail[]; nextCursor: string | null };
type FeedData = { pages: FeedPage[]; pageParams: unknown[] };

/**
 * Mọi khoá feed đang có trong cache: feed theo nhà `['families', id, 'posts']`
 * (+ biến thể video-picker) và dòng chung của Home `['me', 'feed']`. Cùng một
 * bài có thể nằm ở nhiều feed — trái tim/sửa/xoá phải chạm đủ.
 */
function isFeedKey(queryKey: readonly unknown[]): boolean {
  return (
    (queryKey[0] === 'families' && queryKey[2] === 'posts') ||
    (queryKey[0] === 'me' && queryKey[1] === 'feed')
  );
}

/**
 * Sửa một bài trong mọi trang của mọi feed đang nằm trong cache.
 *
 * Trả về ảnh chụp trước khi sửa để `onError` hoàn nguyên. Quét theo tiền tố
 * khoá thay vì đòi `familyId`: cùng một bài có thể đang nằm trong feed của
 * nhiều gia đình mà nút tim không cần biết điều đó.
 */
function patchFeeds(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  update: (post: PostDetail) => PostDetail,
): [readonly unknown[], FeedData][] {
  const snapshots: [readonly unknown[], FeedData][] = [];

  const entries = queryClient.getQueriesData<FeedData>({
    predicate: ({ queryKey }) => isFeedKey(queryKey),
  });

  for (const [queryKey, data] of entries) {
    if (!data?.pages?.some((page) => page.items.some((p) => p.id === postId))) continue;
    snapshots.push([queryKey, data]);
    queryClient.setQueryData<FeedData>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((p) => (p.id === postId ? update(p) : p)),
      })),
    });
  }

  return snapshots;
}

/** Như patchFeeds nhưng loại bài ra khỏi từng trang thay vì thay nội dung. */
function removeFromFeeds(queryClient: ReturnType<typeof useQueryClient>, postId: string): void {
  const entries = queryClient.getQueriesData<FeedData>({
    predicate: ({ queryKey }) => isFeedKey(queryKey),
  });

  for (const [queryKey, data] of entries) {
    if (!data?.pages?.some((page) => page.items.some((p) => p.id === postId))) continue;
    queryClient.setQueryData<FeedData>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.filter((p) => p.id !== postId),
      })),
    });
  }
}
