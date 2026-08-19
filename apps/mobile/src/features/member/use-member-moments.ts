import { useQuery } from '@tanstack/react-query';

import { families } from '../../lib/api';
import type { PostDetail } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * How much of the feed one album scan reads.
 *
 * There is no per-member media endpoint and no server-side filter on the
 * feed — `FeedQueryDto` takes a limit and a cursor and nothing else — so the
 * only way to find the moments somebody appears in is to read the feed and
 * look at each post. Reading *all* of it would mean an unbounded number of
 * requests every time a profile opens.
 *
 * 4 × 50 is the compromise: the two hundred most recent moments, at the
 * server's maximum page size. When it stops short the screen says so rather
 * than presenting a partial album as the whole of someone's life. A real
 * fix is a backend one — see `docs/00-shared/api-contract.md`.
 */
const SCAN_PAGES = 4;
const PAGE_SIZE = 50;

export type MemberMoments = {
  /** Newest first, only the ones with something to show. */
  items: PostDetail[];
  photoCount: number;
  /** False when the scan hit its page limit with feed left unread. */
  complete: boolean;
};

/**
 * Whether a moment belongs on this person's page.
 *
 * Two ways in, and the second one is why the tab is not empty:
 *
 * - **Tagged in it.** `PostMemberTag` — somebody said this person is in the
 *   photograph. This is the definition in `domain-model.md`.
 * - **Shared it.** A moment this person posted is theirs as surely as one
 *   they were named in, and "my album" without my own photographs in it is
 *   not an album. Matched on `authorUserId`, so it only ever applies to a
 *   member with an account behind them; a placeholder has posted nothing.
 *
 * The second rule was added 2026-08-19 after the tab shipped empty for
 * everybody. Tagging had no way into the app at the time — the composer
 * never wrote a `PostMemberTag` — so a feature built on tags alone could
 * never show anything. The composer can tag now, but authorship stays: it is
 * the honest answer to what a person's own album contains.
 */
function belongsTo(post: PostDetail, memberId: string, userId: string | null): boolean {
  if (post.taggedMemberIds.includes(memberId)) return true;
  return userId !== null && post.authorUserId === userId;
}

async function scan(
  familyId: string,
  memberId: string,
  userId: string | null,
): Promise<MemberMoments> {
  const items: PostDetail[] = [];
  let cursor: string | undefined;
  let complete = false;

  for (let page = 0; page < SCAN_PAGES; page++) {
    const feed = await families.feed(familyId, { limit: PAGE_SIZE, cursor });

    for (const post of feed.items) {
      if (post.media.length === 0) continue;
      if (!belongsTo(post, memberId, userId)) continue;
      items.push(post);
    }

    if (feed.nextCursor === null) {
      complete = true;
      break;
    }

    cursor = feed.nextCursor;
  }

  return {
    items,
    photoCount: items.reduce((total, post) => total + post.media.length, 0),
    complete,
  };
}

/**
 * The Album tab: moments this person is in or shared, newest first.
 *
 * **Derived, not curated.** These are posts shared to this family — nobody
 * assembles them, and there is no way to put a picture on somebody's page
 * directly. The `Album` model in the schema is a private, owner-only
 * collection and is a different thing entirely; the two must not be
 * conflated.
 *
 * Grouped by moment rather than flattened into loose photographs, because a
 * moment is what a family actually remembers.
 */
export function useMemberMoments(
  familyId: string | null,
  memberId: string | null,
  /** The account behind this member, if any. Null for a placeholder. */
  userId: string | null,
) {
  return useQuery({
    queryKey: queryKeys.memberMoments(familyId ?? '', memberId ?? ''),
    queryFn: () => scan(familyId as string, memberId as string, userId),
    enabled: familyId !== null && memberId !== null,
  });
}
