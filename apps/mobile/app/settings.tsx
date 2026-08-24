import { useRouter } from 'expo-router';
import { Bell, ChevronRight, KeyRound, Mail } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AnimatedPressable } from '../src/components/motion/animated-pressable';
import { usePressScale } from '../src/components/motion/press';
import { CARD_PRESS_SCALE } from '../src/theme/motion';

import { AppHeader } from '../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../src/components/layout/header-slots';
import { Avatar } from '../src/components/ui/avatar';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { IconBadge } from '../src/components/ui/icon-badge';
import { SelectField } from '../src/components/ui/select-field';
import { Text } from '../src/components/ui/text';
import { useSession } from '../src/features/auth/session';
import { useMemberForUser } from '../src/features/family/use-member-for-user';
import { useMyProfile } from '../src/features/member/use-profile';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../src/i18n';
import { setLocale } from '../src/i18n/locale';
import { useLocale } from '../src/i18n/use-locale';
import { colors, radius, spacing } from '../src/theme';

/**
 * A row that goes somewhere.
 *
 * Its own thing rather than a `Button`: these are destinations in a list,
 * not actions, and four full-width buttons stacked in a card would read as
 * four decisions to make rather than four places to look.
 */
function NavRow({
  icon: Icon,
  label,
  hint,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const press = usePressScale({ scale: CARD_PRESS_SCALE });

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 13 }, press.style]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: colors.coral.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={17} color={colors.coral.deep} strokeWidth={2.1} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body1" weight="semibold">
          {label}
        </Text>

        <Text variant="caption" color={colors.text.muted}>
          {hint}
        </Text>
      </View>

      <ChevronRight size={18} color={colors.text.subtle} strokeWidth={2.2} />
    </AnimatedPressable>
  );
}

/**
 * Each language names itself, so the row is readable from whichever side of
 * it you are standing on — someone who has put the app into a language they
 * cannot read still has to be able to find their way back out.
 */
const LANGUAGE_OPTIONS = SUPPORTED_LOCALES.map((locale) => ({
  value: locale,
  label: LOCALE_NAMES[locale],
}));

/**
 * Screen 20 — Account & Settings.
 *
 * Only what actually exists: who is signed in, and how to leave. The rest of
 * the screen is deliberately empty until there are real settings to put in
 * it — inventing rows here would be inventing product.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useSession();
  // The account carries no picture; the member row in the active family does.
  const me = useMemberForUser(user?.id ?? null);
  const locale = useLocale();
  // A social-only account (signed up with Google/Facebook) has no password,
  // so its row says "Set a password" — "requires your current one" would be
  // a lie. The destination screen makes the same call from the same field.
  const profile = useMyProfile();
  const socialOnly = profile.data?.hasPassword === false;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={<ScreenTitle title={t('settings.title')} />}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Card padding={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar size={56} name={user?.name} mediaId={me?.avatarKey} />

          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
              {user?.name ?? t('settings.signedOut')}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <IconBadge size={22} renderIcon={(props) => <Mail {...props} strokeWidth={2.2} />} />
              <Text variant="caption" color={colors.text.muted}>
                {user?.email ?? t('settings.noEmail')}
              </Text>
            </View>
          </View>
        </Card>

        <Card padding={16} style={{ gap: 20 }}>
          <NavRow
            icon={KeyRound}
            label={socialOnly ? t('settings.password.set.title') : t('settings.password.title')}
            hint={socialOnly ? t('settings.password.set.row') : t('settings.password.row')}
            onPress={() => router.push('/settings/password')}
          />

          <NavRow
            icon={Bell}
            label={t('settings.notifications.title')}
            hint={t('settings.notifications.row')}
            onPress={() => router.push('/settings/notifications')}
          />
        </Card>

        <Card padding={16}>
          <SelectField<Locale>
            label={t('settings.language')}
            title={t('settings.languageTitle')}
            value={locale}
            options={LANGUAGE_OPTIONS}
            onChange={(next) => void setLocale(next)}
          />
        </Card>

        <Button
          label={t('settings.signOut')}
          variant="destructive"
          size="large"
          fullWidth
          onPress={() => void signOut()}
        />
      </ScrollView>
    </View>
  );
}
