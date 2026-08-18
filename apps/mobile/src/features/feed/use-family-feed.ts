import { useInfiniteQuery } from '@tanstack/react-query';

import { families } from '../../lib/api';
import type { FamilyFeed } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * The family's shared posts, newest first.
 *
 * Cursor-paginated rather than offset: the feed grows from the top while
 * someone is reading it, and an offset would show them the same post twice
 * or skip one. `nextCursor: null` is the end — not an empty page.
 */
export function useFamilyFeed(familyId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.familyFeed(familyId ?? 'none'),
    queryFn: ({ pageParam }) =>
      families.feed(familyId as string, { cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: FamilyFeed) => last.nextCursor,
    enabled: familyId !== null,
  });
}
