import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settings } from '../../lib/api';
import type { NotificationSettings, UpdateNotificationSettingsRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

export function useNotificationSettings() {
  return useQuery({
    queryKey: queryKeys.notificationSettings(),
    queryFn: () => settings.notifications(),
  });
}

/**
 * Flips one group of notifications on or off.
 *
 * **Optimistic**, and this is the one place in the app where that is not
 * merely a nicety: a switch that waits for a round trip before moving reads
 * as broken, and people press it again. The cache is rolled back if the
 * server disagrees, so the switch snapping back is what a failure looks
 * like — the screen adds a toast to say why.
 *
 * The notification list is deliberately **not** invalidated. Muting changes
 * which rows the server writes from now on; the ones already written stay
 * exactly as they are (`api-contract.md` § Settings), so there is nothing
 * for a refetch to find.
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  const key = queryKeys.notificationSettings();

  return useMutation({
    mutationFn: (body: UpdateNotificationSettingsRequest) => settings.updateNotifications(body),

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationSettings>(key);

      if (previous !== undefined) {
        queryClient.setQueryData<NotificationSettings>(key, { ...previous, ...body });
      }

      return { previous };
    },

    onError: (_error, _body, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<NotificationSettings>(key, context.previous);
      }
    },

    // The response is the whole settled object, so take it rather than
    // refetching what the server just told us.
    onSuccess: (fresh) => {
      queryClient.setQueryData<NotificationSettings>(key, fresh);
    },
  });
}
