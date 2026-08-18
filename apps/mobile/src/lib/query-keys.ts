/**
 * Every cache key in one place.
 *
 * Keys are hierarchical so a single invalidation can reach a whole subtree:
 * posting a moment invalidates `['families', id]` and the feed under it goes
 * stale with it. Spelling the arrays out at call sites instead would make
 * that impossible to see and easy to get subtly wrong.
 */
export const queryKeys = {
  families: () => ['families'] as const,
  family: (familyId: string) => ['families', familyId] as const,
  familyTree: (familyId: string) => ['families', familyId, 'tree'] as const,
  familyFeed: (familyId: string) => ['families', familyId, 'posts'] as const,
  post: (postId: string) => ['posts', postId] as const,
  postComments: (postId: string) => ['posts', postId, 'comments'] as const,
} as const;
