import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../src/lib/back';
import { Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AuthModeTabs } from '../../src/components/auth/auth-mode-tabs';
import { SocialButtons } from '../../src/components/auth/social-buttons';
import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Checkbox } from '../../src/components/ui/checkbox';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { TextLink } from '../../src/components/ui/text-link';
import { authErrorKey } from '../../src/features/auth/auth-error';
import { DEMO_ACCOUNT } from '../../src/features/auth/demo-account';
import { useSession } from '../../src/features/auth/session';
import { colors } from '../../src/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn } = useSession();

  // Filled in when social login sent them here: the address already has a
  // password, and retyping what they just proved they own is a small insult.
  // `demo=1` (the welcome CTA) prefills the public demo login instead, so a
  // first visit is one tap from being inside.
  const { email: prefill, demo } = useLocalSearchParams<{ email?: string; demo?: string }>();
  const [email, setEmail] = useState(demo === '1' ? DEMO_ACCOUNT.email : (prefill ?? ''));
  const [password, setPassword] = useState(demo === '1' ? DEMO_ACCOUNT.password : '');
  const [stayed, setStayed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const ready = email.trim().length > 0 && password.length > 0;

  const submit = async () => {
    setSubmitting(true);
    setErrorKey(null);

    try {
      await signIn({ email: email.trim(), password, persist: stayed });
      // No navigation here: `(auth)/_layout.tsx` redirects as soon as the
      // session exists, so success and a cold start take the same path.
    } catch (error) {
      setErrorKey(authErrorKey(error));
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      variant="auth"
      onBack={() => safeBack(router, '/welcome')}
      footer={
        <>
          {errorKey !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey)}
            </Text>
          )}

          <Button
            label={t('auth.signIn.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={submitting}
            onPress={() => void submit()}
          />

          <SocialButtons />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Text
          serif
          weight="bold"
          accessibilityRole="header"
          style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.4 }}
        >
          {t('auth.signIn.title')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {t('auth.signIn.subtitle')}
        </Text>
      </View>

      <AuthModeTabs mode="sign-in" />

      <View style={{ gap: 15 }}>
        <TextField
          label={t('auth.fields.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.fields.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          renderIcon={({ size, color }) => <Mail size={size} color={color} strokeWidth={2} />}
        />

        <TextField
          label={t('auth.fields.password')}
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />
      </View>

      {/* `wrap`: on a 320px screen the pair is wider than the row, and
          without it the forgot-link shoves out through the screen edge —
          wrapped, it simply drops to its own line. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Checkbox
          checked={stayed}
          onChange={setStayed}
          accessibilityLabel={t('auth.signIn.keepSignedIn')}
        >
          <Text variant="caption" weight="medium" color={colors.text.secondary}>
            {t('auth.signIn.keepSignedIn')}
          </Text>
        </Checkbox>

        <TextLink label={t('auth.signIn.forgot')} onPress={() => router.push('/forgot')} />
      </View>
    </FormScreen>
  );
}
