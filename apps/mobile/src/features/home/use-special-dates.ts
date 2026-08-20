import { useQuery } from '@tanstack/react-query';

import { specialDates } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * Upcoming occasions for the family on screen, soonest first.
 *
 * Birthdays and memorials are **derived from `LifeProfile` dates at request
 * time** rather than stored, so this list changes the moment somebody fills
 * in a birth date on their profile — there is nothing to create and nothing
 * to keep in step.
 */
export function useUpcomingSpecialDates(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familySpecialDates(familyId ?? 'none'),
    queryFn: () => specialDates.upcoming(familyId as string),
    enabled: familyId !== null,
  });
}
