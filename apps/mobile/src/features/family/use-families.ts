import { useQuery } from '@tanstack/react-query';

import { families } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { useSession } from '../auth/session';

/**
 * Every family the signed-in person belongs to.
 *
 * Read by the group strip on Home, the family switcher in Omoide and the
 * audience picker on New moment — one request, shared, because react-query
 * dedupes them by key.
 */
export function useFamilies() {
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.families(),
    queryFn: () => families.list(),
    // Nothing to ask for before there is a token, and asking anyway would
    // spend a refresh attempt on a 401 that was never going to succeed.
    enabled: status === 'authenticated',
  });
}
