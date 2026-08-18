import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';

/** Roughly one screen transition: long enough to stop a back-navigation refetching. */
const STALE_TIME = 30_000;
const MAX_OFFLINE_RETRIES = 2;

/**
 * Retry only what retrying can fix.
 *
 * The default is three attempts at everything, which is wrong here in both
 * directions: a 404 means the post is not yours to see and will never become
 * yours (`docs/00-shared/api-contract.md`), and a 401 has already been
 * through the client's refresh by the time it lands here. Only a request
 * that never reached the server is worth sending again.
 */
function retry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.isOffline && failureCount < MAX_OFFLINE_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry, staleTime: STALE_TIME },
      // A mutation is something the person asked for once. Retrying a failed
      // "post moment" behind their back can post it twice.
      mutations: { retry: false },
    },
  });
}
