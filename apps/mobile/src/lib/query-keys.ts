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
  familyInvitations: (familyId: string) => ['families', familyId, 'invitations'] as const,
  /**
   * A preview read by code, not by family: the reader is usually not in that
   * family yet, and often has no account at all, so this cannot hang under
   * `families` — nothing would ever invalidate it.
   */
  invitation: (code: string) => ['invitations', code] as const,
  post: (postId: string) => ['posts', postId] as const,
  postComments: (postId: string) => ['posts', postId, 'comments'] as const,
  /**
   * The signed-in account's Life Profile. Kept outside the `families` tree
   * because it is global — one profile per person, shown in every family
   * they belong to (`docs/00-shared/domain-model.md`).
   */
  myProfile: () => ['me', 'profile'] as const,
  /** Cũng là khoá màn Ask dùng để đọc ngày sinh của người nhận quà. */
  memberProfile: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'profile'] as const,
  /**
   * A member's derived photo gallery, read through the family you are
   * viewing them from — so it drops out of the cache with everything else
   * about that family when you leave it.
   */
  memberGallery: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'gallery'] as const,
  /** Your own, which exists before you belong to any family. */
  myGallery: () => ['me', 'gallery'] as const,
  /**
   * Personal albums. Outside `families` because they belong to the account,
   * not to any family — leaving a family must not drop them.
   */
  myAlbums: () => ['me', 'albums'] as const,
  album: (albumId: string) => ['me', 'albums', albumId] as const,
  /**
   * Notifications and the badge, kept as siblings so marking one read can
   * invalidate both with `['me', 'notifications']`.
   */
  notifications: () => ['me', 'notifications'] as const,
  unreadCount: () => ['me', 'notifications', 'unread'] as const,
  /**
   * Deliberately **not** under `notifications`: muting a group changes
   * which rows the server writes from now on, not which rows already exist,
   * so invalidating the list from here would refetch for nothing.
   */
  notificationSettings: () => ['me', 'settings', 'notifications'] as const,
  /**
   * Notes the viewer wrote about one member. Under `families` so leaving a
   * family drops them from the cache with everything else about it.
   */
  memberMemos: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'memos'] as const,
  /** Toàn bộ sổ tay của bạn — mọi ghi chú, về bất kỳ ai, kể cả người đã rời đi. */
  myMemos: () => ['me', 'memos'] as const,
  /** One note, reachable by id alone — including one whose member has gone. */
  memo: (memoId: string) => ['memos', memoId] as const,
  /** Your own timeline, which exists before you belong to any family. */
  myLifeEvents: () => ['me', 'life-events'] as const,
  memberLifeEvents: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'life-events'] as const,

  // Khu AI (màn 21-33)
  specialDates: (familyId: string) => ['families', familyId, 'special-dates'] as const,
  evidenceStats: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'evidence-stats'] as const,
  savedGiftIdeas: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'saved-gift-ideas'] as const,
  videoMusic: () => ['video-music'] as const,
  videoJobs: () => ['video-jobs'] as const,
  videoJob: (jobId: string) => ['video-jobs', jobId] as const,
} as const;
