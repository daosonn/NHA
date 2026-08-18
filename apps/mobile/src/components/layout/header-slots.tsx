import { Bell, ChevronLeft, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

/** The NHA wordmark. Lora is allowed here — it is the brand, not a control. */
export function BrandWordmark() {
  return (
    <Text
      serif
      weight="bold"
      accessibilityRole="header"
      style={{ fontSize: 22, lineHeight: 28, letterSpacing: 1.6, color: colors.coral.primary }}
    >
      PRESENT
    </Text>
  );
}

/** Leading slot for any pushed screen. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
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

export type NotificationBellProps = {
  count?: number;
  onPress?: () => void;
};

/** 40px touch target with the unread count riding the top-right of the bell. */
export function NotificationBell({ count = 0, onPress }: NotificationBellProps) {
  const { t } = useTranslation();

  const label = count > 0 ? t('nav.notificationsUnread', { count }) : t('nav.notifications');

  return (
    <Pressable
      onPress={onPress}
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
