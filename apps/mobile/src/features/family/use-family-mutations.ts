import { useMutation, useQueryClient } from '@tanstack/react-query';

import { families } from '../../lib/api';
import type { CreateFamilyRequest, JoinFamilyRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * Creating and joining both change the same list, so both invalidate it.
 *
 * `invalidateQueries` rather than writing the response into the cache by
 * hand: `POST /families` returns a `FamilyDetail` and the list holds
 * `FamilySummary`, which carries a `memberCount` the detail does not. Faking
 * the missing field would put a number on screen the server never said.
 *
 * Both `void` that invalidation instead of returning it, and the difference
 * is a whole round trip of waiting (2026-09-03). React Query AWAITS whatever
 * `onSuccess` returns before the mutation settles, so returning the promise
 * kept the submit button spinning until the families list had been refetched
 * too — the group existed, the server had already answered, and the form sat
 * there through a second request. The list still refreshes; the button just
 * stops pretending the work is unfinished. `useCommitMyTimeline` voids its
 * invalidation for the same reason.
 */
export function useCreateFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateFamilyRequest) => families.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

export function useJoinFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: JoinFamilyRequest) => families.join(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}
