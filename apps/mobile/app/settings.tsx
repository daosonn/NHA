import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../src/components/layout/app-header';
import { BackButton } from '../src/components/layout/header-slots';
import { Avatar } from '../src/components/ui/avatar';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { IconBadge } from '../src/components/ui/icon-badge';
import { SelectField } from '../src/components/ui/select-field';
import { Text } from '../src/components/ui/text';
import { useSession } from '../src/features/auth/session';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../src/i18n';
import { setLocale } from '../src/i18n/locale';
import { useLocale } from '../src/i18n/use-locale';
import { colors, spacing } from '../src/theme';

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
  const locale = useLocale();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('settings.title')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Card padding={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar size={56} name={user?.name} />

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
