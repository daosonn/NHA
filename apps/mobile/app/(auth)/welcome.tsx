import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SocialButtons } from '../../src/components/auth/social-buttons';
import { AuthShell } from '../../src/components/layout/auth-shell';
import { ContentColumn } from '../../src/components/layout/content-column';
import { AvatarStack } from '../../src/components/ui/avatar-stack';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextLink } from '../../src/components/ui/text-link';
import { colors, spacing, useLayout } from '../../src/theme';

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
  const { expanded } = useLayout();

  /** The two ways in. Identical on both layouts, so written once. */
  const actions = (
    <>
      <Button
        label={t('auth.welcome.create')}
        size="large"
        fullWidth
        onPress={() => router.push('/sign-up')}
      />

      <SocialButtons layout="stack" continueWording />
    </>
  );

  /** Already have an account, and the legal line. Also identical. */
  const aside = (
    <>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
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
        style={{ textAlign: 'center', maxWidth: 290, alignSelf: 'center' }}
      >
        {t('auth.welcome.legal')}
      </Text>
    </>
  );

  /**
   * On a wide window the hero becomes the card's left pane — the shell draws
   * it, from the same copy — and this screen is only the actions beside it.
   */
  if (expanded) {
    return (
      <View className="flex-1 bg-page">
        <AuthShell footer={aside}>{actions}</AuthShell>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      {/*
        The header grows; the gap does not.

        `flex: 3` here against `flex: 1` on the spacer below the buttons hands
        three quarters of whatever space is left over to the coral. That is
        the whole fix for the dead white band this screen used to have in the
        middle: the band was leftover space with nowhere to go, so it went
        below the buttons and sat there.

        Content is centred **inside** the header rather than pinned to its
        top, so the mark and the title stay optically placed however tall the
        header ends up on a given handset.

        It still stretches edge to edge, which is the decision recorded in
        `design-system.md` — the wide-window version above is a different
        layout, not a revisiting of that one.
      */}
      <View
        style={{
          flex: 3,
          justifyContent: 'center',
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

      <ContentColumn style={{ paddingTop: 26, gap: 10 }}>{actions}</ContentColumn>

      {/* What is left of the gap — a quarter of the slack, not all of it. */}
      <View style={{ flex: 1 }} />

      <ContentColumn style={{ paddingBottom: insets.bottom + 24, gap: 14 }}>{aside}</ContentColumn>
    </View>
  );
}
