import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleMark, GoogleMark } from '../../src/components/auth/identity-marks';
import { AvatarStack } from '../../src/components/ui/avatar-stack';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextLink } from '../../src/components/ui/text-link';
import { colors, spacing } from '../../src/theme';

/** Faces of a family that already exists — proof, not decoration. */
const FACES = [
  { id: 'a', tone: 'light' as const },
  { id: 'b', tone: 'dark' as const },
  { id: 'c', tone: 'light' as const },
  { id: 'd', tone: 'dark' as const },
];

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-page">
      <View
        style={{
          paddingTop: insets.top + 40,
          paddingBottom: 34,
          paddingHorizontal: spacing['2xl'],
          backgroundColor: colors.coral.light,
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
          alignItems: 'center',
          gap: 26,
        }}
      >
        <BrandMark size={66} />

        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text
            serif
            weight="bold"
            accessibilityRole="header"
            style={{ fontSize: 30, lineHeight: 38, letterSpacing: -0.4, textAlign: 'center' }}
          >
            {t('auth.welcome.title')}
          </Text>

          <Text variant="body1" color={colors.text.muted} style={{ textAlign: 'center' }}>
            {t('auth.welcome.subtitle')}
          </Text>
        </View>

        <AvatarStack items={FACES} size={34} surface={colors.coral.light} remaining={6} />
      </View>

      <View style={{ flex: 1, paddingTop: 30, paddingHorizontal: spacing.xl, gap: 10 }}>
        <Button
          label={t('auth.welcome.create')}
          size="large"
          fullWidth
          onPress={() => router.push('/sign-up')}
        />

        <Button
          label={t('auth.continueApple')}
          variant="neutral"
          size="large"
          fullWidth
          renderIcon={() => <AppleMark />}
        />

        <Button
          label={t('auth.continueGoogle')}
          variant="neutral"
          size="large"
          fullWidth
          renderIcon={() => <GoogleMark />}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 24,
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="body1" color={colors.text.muted}>
            {t('auth.welcome.haveAccount')}
          </Text>
          <TextLink
            label={t('auth.welcome.signIn')}
            variant="body1"
            onPress={() => router.push('/sign-in')}
          />
        </View>

        <Text
          variant="badge"
          color={colors.text.subtle}
          style={{ textAlign: 'center', maxWidth: 290 }}
        >
          {t('auth.welcome.legal')}
        </Text>
      </View>
    </View>
  );
}
