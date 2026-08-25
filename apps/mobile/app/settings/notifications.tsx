import { TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Switch, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '../../src/features/settings/use-notification-settings';
import type { NotificationSettings } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

/**
 * The three groups, in the order somebody is likeliest to want them off:
 * feed noise first, things aimed at you last.
 */
const GROUPS: { key: keyof NotificationSettings; labelKey: string; bodyKey: string }[] = [
  {
    key: 'newPosts',
    labelKey: 'settings.notifications.newPosts',
    bodyKey: 'settings.notifications.newPostsBody',
  },
  {
    key: 'reminders',
    labelKey: 'settings.notifications.reminders',
    bodyKey: 'settings.notifications.remindersBody',
  },
  {
    key: 'aboutMe',
    labelKey: 'settings.notifications.aboutMe',
    bodyKey: 'settings.notifications.aboutMeBody',
  },
];

function ToggleRow({
  label,
  body,
  value,
  onChange,
}: {
  label: string;
  body: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body1" weight="semibold">
          {label}
        </Text>

        <Text variant="caption" color={colors.text.muted}>
          {body}
        </Text>
      </View>

      {/* The platform switch, not a drawn one. It carries the right
          accessibility role and the gesture people already know, and a
          hand-made toggle would be a component to maintain for no gain. */}
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.state.disabledBg, true: colors.coral.primary }}
        thumbColor={colors.background.card}
        ios_backgroundColor={colors.state.disabledBg}
        accessibilityLabel={label}
      />
    </View>
  );
}

/**
 * WBS 3.4.5 — which notifications arrive at all.
 *
 * Grouped by *why* something arrived rather than one switch per type: three
 * questions somebody can answer ("too much from the feed", "stop reminding
 * me") beat nine they have to translate first. The grouping is the server's
 * (`api-contract.md` § Settings), so the two cannot drift.
 *
 * **Muting is not hiding.** A muted group is never written, so nothing
 * appears in the list, the badge never counts it, and turning the group back
 * on does not resurrect what was missed. The line under the switches says
 * so, because "off" could reasonably mean either.
 */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const toast = useToast();

  const query = useNotificationSettings();
  const update = useUpdateNotificationSettings();

  const flip = (key: keyof NotificationSettings, next: boolean) => {
    update.mutate(
      { [key]: next },
      { onError: () => toast.failure(t('settings.notifications.saveFailed')) },
    );
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/settings" />}
        center={<ScreenTitle title={t('settings.notifications.title')} />}
      />

      {query.isPending ? (
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      ) : query.isError || query.data === undefined ? (
        <EmptyState
          renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
          title={t('settings.notifications.loadFailed')}
          actionLabel={t('home.retry')}
          onActionPress={() => void query.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ ...contentColumn, paddingVertical: spacing.xl, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          <Card padding={18} style={{ gap: 20 }}>
            {GROUPS.map((group) => (
              <ToggleRow
                key={group.key}
                label={t(group.labelKey)}
                body={t(group.bodyKey)}
                value={query.data[group.key]}
                onChange={(next) => flip(group.key, next)}
              />
            ))}
          </Card>

          <Text variant="caption" color={colors.text.subtle}>
            {t('settings.notifications.mutedMeaning')}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
