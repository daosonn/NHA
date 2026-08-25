import { useRouter } from 'expo-router';
import { safeBack } from '../../src/lib/back';
import { Lock, Mail, UserRound } from 'lucide-react-native';
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
import { authErrorKey } from '../../src/features/auth/auth-error';
import { useSession } from '../../src/features/auth/session';
import { colors } from '../../src/theme';

const MIN_PASSWORD = 8;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { register } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const ready =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= MIN_PASSWORD && agreed;

  /**
   * Registration returns a token pair immediately — the server has no email
   * confirmation step (`docs/00-shared/api-contract.md`), so this lands
   * straight in the app rather than pretending to check something. (The old
   * standalone code screen, `verify.tsx`, was removed 2026-08-24 when the
   * reset flow folded its code entry into `/reset`.)
   */
  const submit = async () => {
    setSubmitting(true);
    setErrorKey(null);

    try {
      await register({ name: name.trim(), email: email.trim(), password });
    } catch (error) {
      setErrorKey(authErrorKey(error));
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
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
            label={t('auth.signUp.submit')}
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
          {t('auth.signUp.title')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {t('auth.signUp.subtitle')}
        </Text>
      </View>

      <AuthModeTabs mode="sign-up" />

      <View style={{ gap: 15 }}>
        <TextField
          label={t('auth.fields.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('auth.fields.namePlaceholder')}
          autoComplete="name"
          textContentType="name"
          renderIcon={({ size, color }) => <UserRound size={size} color={color} strokeWidth={2} />}
        />

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
          placeholder={t('auth.fields.minCharacters', { count: MIN_PASSWORD })}
          autoComplete="new-password"
          textContentType="newPassword"
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />
      </View>

      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        accessibilityLabel={t('auth.signUp.termsLabel')}
      >
        <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
          {t('auth.signUp.termsBefore')}
          <Text variant="caption" weight="semibold">
            {t('auth.signUp.termsWord')}
          </Text>
          {t('auth.signUp.termsBetween')}
          <Text variant="caption" weight="semibold">
            {t('auth.signUp.privacyWord')}
          </Text>
          {t('auth.signUp.termsAfter')}
        </Text>
      </Checkbox>
    </FormScreen>
  );
}
