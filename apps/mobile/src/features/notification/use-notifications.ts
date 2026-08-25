import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifications } from '../../lib/api';
import type { NotificationPage } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { useSession } from '../auth/session';

/** How often the badge asks again while somebody is looking at a screen. */
const BADGE_REFRESH_MS = 60_000;

/**
 * The number on the bell.
 *
 * Its own tiny request rather than a page of rows: the badge sits in the
 * header of four screens, and pulling twenty notifications in behind it on
 * every one of them would be a lot of bytes to render a digit.
 *
 * It refetches on a timer because nothing pushes — the MVP has no sockets and
 * no push notifications (`sprint-03.md`), so a minute is the compromise
 * between "the bell is wrong" and "the app polls all day".
 */
export function useUnreadCount() {
  // Chuông nằm trong header nên mount TRƯỚC khi phiên đăng nhập kịp khôi phục
  // (và cả khi đã đăng xuất). Không gate thì poll bắn request trần → server trả
  // 401 lặp mỗi phút, console đỏ. Query tắt là interval cũng tự dừng.
  const { status } = useSession();
  return useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: () => notifications.unreadCount(),
    refetchInterval: BADGE_REFRESH_MS,
    staleTime: BADGE_REFRESH_MS,
    enabled: status === 'authenticated',
  });
}

/**
 * The list behind the bell, newest first.
 *
 * Cursor-paginated for the same reason the feed is: rows arrive at the top
 * while somebody is reading, and an offset would show them the same one twice.
 */
export function useNotifications(unreadOnly = false) {
  const { status } = useSession();
  return useInfiniteQuery({
    queryKey: [...queryKeys.notifications(), { unreadOnly }] as const,
    queryFn: ({ pageParam }) => notifications.list({ cursor: pageParam ?? undefined, unreadOnly }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: NotificationPage) => last.nextCursor,
    enabled: status === 'authenticated',
  });
}

/**
 * Marks one read.
 *
 * Optimistic, because this fires as somebody taps through to whatever the
 * notification was about: the row has to look read *before* the screen
 * changes, or they come back to a list that still says it is new. The whole
 * subtree is refetched afterwards so the badge and the server agree.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notifications.markRead(notificationId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notifications.markAllRead(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}
