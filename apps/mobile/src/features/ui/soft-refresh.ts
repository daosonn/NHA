/**
 * Refresh what is on screen, without reloading the app.
 *
 * Until now the only way to see new data was a browser reload, which throws
 * away the bundle, the session read and wherever the reader was. This is the
 * gesture every social app has instead: tap the logo, or tap the tab you are
 * already on, and the screen fetches again in place.
 *
 * `invalidateQueries()` with no filter is the whole mechanism. React Query
 * refetches the queries that are currently mounted and marks the rest stale,
 * so the screen you are looking at updates now and the ones behind it update
 * when you next open them — which is exactly the desired scope, and cheaper
 * than a blanket refetch of everything the app has ever loaded.
 */
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { FamilyFeed } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * Where "back to the top" happens.
 *
 * The gesture starts outside the screen it acts on — the tab bar, the rail,
 * the header — so the scroller cannot be reached by props. Module scope,
 * outside React, the same shape as `features/family/pending-invite.ts`.
 *
 * One at a time on purpose: only the focused screen should register, and the
 * cleanup returned by `registerScrollToTop` clears it on blur.
 */
let scrollToTop: (() => void) | null = null;

export function registerScrollToTop(fn: () => void): () => void {
  scrollToTop = fn;
  return () => {
    // Guard the identity: a screen that unmounts after another has already
    // registered must not clear the newer one.
    if (scrollToTop === fn) scrollToTop = null;
  };
}

export function useSoftRefresh(): {
  refresh: () => void;
  refreshing: boolean;
} {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    scrollToTop?.();

    // The feed is the app's one infinite list, and refetching it whole would
    // re-request every page the reader had scrolled through — ten pages deep
    // is ten requests to show them the top. Trimming to the first page first
    // means one request, and because the old first page stays in place while
    // it flies there is no flash of an empty timeline.
    queryClient.setQueryData<InfiniteData<FamilyFeed, string | null>>(
      queryKeys.myFeed(),
      (current) =>
        current === undefined
          ? current
          : {
              pages: current.pages.slice(0, 1),
              pageParams: current.pageParams.slice(0, 1),
            },
    );

    setRefreshing(true);
    void queryClient.invalidateQueries().finally(() => setRefreshing(false));
  }, [queryClient]);

  return { refresh, refreshing };
}
