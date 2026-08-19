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
  /**
   * The signed-in account's Life Profile. Kept outside the `families` tree
   * because it is global — one profile per person, shown in every family
   * they belong to (`docs/00-shared/domain-model.md`).
   */
  myProfile: () => ['me', 'profile'] as const,
  memberProfile: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'profile'] as const,
} as const;
