import { useQuery } from '@tanstack/react-query';

import { lifeEvents } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * A person's milestones, oldest first.
 *
 * Two routes serve the same rows and which one applies is not a preference:
 * `/me/life-events` is the only one that works before you belong to a family,
 * and the member route is the only one that can read somebody else. So the
 * caller says which person this is, and the hook picks.
 *
 * Server order is left alone. A life reads birth-to-now, the API already
 * returns it that way, and sorting again here would be a second opinion that
 * quietly drifts from the first.
 */
export function useLifeEvents(options: {
  /** True when this is the signed-in account's own profile. */
  own: boolean;
  familyId: string | null;
  memberId: string | null;
}) {
  const { own, familyId, memberId } = options;

  const memberScoped = familyId !== null && memberId !== null;

  return useQuery({
    queryKey: own
      ? queryKeys.myLifeEvents()
      : queryKeys.memberLifeEvents(familyId ?? '', memberId ?? ''),
    queryFn: () =>
      own ? lifeEvents.mine() : lifeEvents.forMember(familyId as string, memberId as string),
    enabled: own || memberScoped,
  });
}
