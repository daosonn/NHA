import { useRouter } from 'expo-router';
import {
  BellOff,
  CalendarHeart,
  Heart,
  Images,
  MessageCircle,
  Sparkles,
  TriangleAlert,
  UserRoundPlus,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppHeader } from '../src/components/layout/app-header';
import { contentColumnBleed } from '../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../src/components/layout/header-slots';
import { EmptyState } from '../src/components/ui/empty-state';
import { IconBadge } from '../src/components/ui/icon-badge';
import { Text } from '../src/components/ui/text';
import { TextLink } from '../src/components/ui/text-link';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../src/features/notification/use-notifications';
import {
  notificationLine,
  notificationTarget,
} from '../src/features/notification/notification-label';
import type { NotificationDetail, NotificationType } from '../src/lib/api';
import { relativeTime } from '../src/lib/date';
import { colors, radius, spacing } from '../src/theme';
import { enter } from '../src/theme/motion';

/** How many rows join the entrance cascade on first paint (Home's rule). */
const CASCADE_ROWS = 6;

/** One glyph per kind, so the list is scannable before it is read. */
const ICON: Record<NotificationType, typeof Heart> = {
  NEW_POST: Images,
  COMMENT: MessageCircle,
  REACTION: Heart,
  MEMBER_TAG: UserRoundPlus,
  FAMILY_INVITE: UserRoundPlus,
  BIRTHDAY_REMINDER: CalendarHeart,
  EVENT_REMINDER: CalendarHeart,
  CARE_REMINDER: CalendarHeart,
  AI_SUGGESTION: Sparkles,
};

function Row({ item, onPress }: { item: NotificationDetail; onPress: () => void }) {
  const { t } = useTranslation();

  const line = notificationLine(item);
  const when = relativeTime(item.createdAt);
  const unread = item.readAt === null;
  const Icon = ICON[item.type] ?? Sparkles;
  const openable = notificationTarget(item) !== null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!openable}
      accessibilityRole={openable ? 'button' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: spacing.xl,
        // Unread is a tint, not a dot: the whole row changes weight, which
        // reads at a glance down a long list.
        backgroundColor: unread ? colors.coral.subtle : 'transparent',
      }}
    >
      <IconBadge
        size={36}
        background={unread ? colors.coral.light : colors.background.subtle}
        foreground={unread ? colors.coral.deep : colors.text.muted}
        renderIcon={(props) => <Icon {...props} strokeWidth={2.1} />}
      />

      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body2" weight={unread ? 'semibold' : 'regular'}>
          {t(line.key, line.values)}
        </Text>

        {when !== null && (
          <Text variant="badge" color={colors.text.subtle}>
            {t(when.key, { count: when.count })}
          </Text>
        )}
      </View>

      {unread && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: radius.full,
            backgroundColor: colors.coral.primary,
            marginTop: 6,
          }}
        />
      )}
    </Pressable>
  );
}

/**
 * Screen 19 — everything the family did while you were away.
 *
 * One list for two different things, because that is how the server stores
 * them: somebody commenting is a `Notification` row and so is "her birthday
 * is on Thursday". Reminders have no table of their own.
 *
 * Tapping marks read **and** navigates, in that order, so coming back does
 * not show the row still lit. A row with nowhere to go — an AI suggestion,
 * for now — is not pressable rather than pressable and inert.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = list.data?.pages[0]?.unreadCount ?? 0;

  const open = (item: NotificationDetail) => {
    if (item.readAt === null) markRead.mutate(item.id);

    const target = notificationTarget(item);
    if (target === null) return;

    router.push(
      target.kind === 'post'
        ? { pathname: '/post/[id]', params: { id: target.id } }
        : target.kind === 'video'
          ? { pathname: '/video/[id]', params: { id: target.id } }
          : target.kind === 'invite'
            ? { pathname: '/invite/[code]', params: { code: target.code } }
            : target.kind === 'date'
              ? { pathname: '/dates/[id]', params: { id: target.id } }
              : { pathname: '/member/[id]', params: { id: target.id } },
    );
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton />}
        center={<ScreenTitle title={t('nav.notifications')} />}
        right={
          unread > 0 ? (
            <TextLink
              label={t('notifications.markAll')}
              variant="caption"
              onPress={() => markAll.mutate()}
            />
          ) : undefined
        }
      />

      {list.isPending ? (
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      ) : list.isError ? (
        <EmptyState
          renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
          title={t('notifications.loadFailed')}
          actionLabel={t('home.retry')}
          onActionPress={() => void list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          cat
          renderIcon={(props) => <BellOff {...props} strokeWidth={2} />}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyBody')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            // Rows past the cascade (and rows mounted later by scrolling)
            // rise immediately — same reasoning as the Home feed.
            <Animated.View entering={enter.up(index < CASCADE_ROWS ? index : 0)}>
              <Row item={item} onPress={() => open(item)} />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: colors.background.subtle }} />
          )}
          contentContainerStyle={{ ...contentColumnBleed, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
        />
      )}
    </View>
  );
}
