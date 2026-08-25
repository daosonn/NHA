import { useRouter, type Href } from 'expo-router';
import { Bell, ChevronLeft, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useUnreadCount } from '../../features/notification/use-notifications';
import { useSafeBack } from '../../lib/back';

import { colors, radius } from '../../theme';
import { BrandMark } from '../ui/brand-mark';
import { Text } from '../ui/text';

/**
 * How big the mark is in a header. One number, everywhere.
 *
 * It was 22 on the Life Profile and the memo screens, 23 on Omoide and 26 on
 * the AI tab — three sizes for the same mark, on screens one tap apart.
 */
const MARK = 22;

/**
 * The full lockup: the mark beside the name. Home only.
 *
 * Home is the front door and has no screen title to carry, so this is where
 * the brand gets to say its whole name. Everywhere else the mark travels on
 * its own next to that screen's title — see `ScreenTitle`.
 *
 * Lora is allowed here. It is the brand, not a control.
 */
export function BrandWordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <BrandMark size={MARK} />

      <Text
        serif
        weight="bold"
        accessibilityRole="header"
        style={{ fontSize: 22, lineHeight: 28, letterSpacing: 1.6, color: colors.coral.primary }}
      >
        NHA
      </Text>
    </View>
  );
}

/**
 * The centre of every header that is not Home: the mark, then where you are.
 *
 * Made one component on 2026-08-21 because it had become five. The mark
 * appeared on five screens out of twenty, at three sizes, sometimes in the
 * left slot and sometimes in the middle; the title beside it was a bold
 * subtitle on sixteen screens, a 21px serif on the AI tab and coral text on
 * the Profile tab. Nothing about that was a decision — it was drift.
 *
 * The title clamps to one line. It sits between two buttons, and an album
 * called "Summer at my grandmother's house" must not push them off the edge.
 */
export function ScreenTitle({ title }: { title: string }) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}
      accessibilityRole="header"
    >
      <BrandMark size={MARK} />

      <Text
        variant="subtitle"
        weight="bold"
        numberOfLines={1}
        style={{ letterSpacing: -0.2, flexShrink: 1 }}
      >
        {title}
      </Text>
    </View>
  );
}

/**
 * Leading slot for any pushed screen.
 *
 * Không truyền `onPress` thì tự "quay lại an toàn": có history thì back,
 * không có (reload web / deep link / mở từ thông báo) thì replace về
 * `fallback` — trước đây mọi màn truyền `() => router.back()` trần và nút
 * chết kèm lỗi GO_BACK trong đúng các kịch bản đó. Chỉ truyền `onPress`
 * khi màn thật sự cần logic riêng (xác nhận bỏ nháp…).
 */
export function BackButton({ onPress, fallback = '/' }: { onPress?: () => void; fallback?: Href }) {
  const { t } = useTranslation();
  const goBack = useSafeBack(fallback);

  return (
    <Pressable
      onPress={onPress ?? goBack}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={8}
      className="h-[32px] w-[32px] items-center justify-center"
    >
      <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
    </Pressable>
  );
}

/** Trailing slot on your own profile — the way in to Account & Settings. */
export function SettingsButton({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('nav.settings')}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Settings size={21} color={colors.text.primary} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * The bell, and the number on it.
 *
 * It reads its own count and knows its own destination — deliberately, after
 * the props version drifted: Home fed it a hard-coded `3` from a fixture, the
 * AI tab fed it a count of this month's occasions, and Omoide had no bell at
 * all. A badge whose number comes from whatever the screen happened to have
 * lying around is not a badge.
 *
 * Every caller now writes `right={<NotificationBell />}` and cannot get it
 * wrong.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  const label = count > 0 ? t('nav.notificationsUnread', { count }) : t('nav.notifications');

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Bell size={22} color={colors.text.primary} strokeWidth={2} />

      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 4,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: radius.full,
            backgroundColor: colors.coral.primary,
            borderWidth: 2,
            borderColor: colors.background.page,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="badge" weight="bold" color={colors.text.white}>
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
