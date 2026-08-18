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
 */
export function useCreateFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateFamilyRequest) => families.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.families() }),
  });
}

export function useJoinFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: JoinFamilyRequest) => families.join(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.families() }),
  });
}
