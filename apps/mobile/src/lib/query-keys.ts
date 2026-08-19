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
  // Khu AI (màn 21-33)
  specialDates: (familyId: string) => ['families', familyId, 'special-dates'] as const,
  evidenceStats: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'evidence-stats'] as const,
  memberProfile: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'profile'] as const,
  savedGiftIdeas: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'saved-gift-ideas'] as const,
  videoMusic: () => ['video-music'] as const,
  videoJobs: () => ['video-jobs'] as const,
  videoJob: (jobId: string) => ['video-jobs', jobId] as const,
} as const;
