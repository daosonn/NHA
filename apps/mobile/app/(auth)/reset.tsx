import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { authErrorKey } from '../../src/features/auth/auth-error';
import { useConfirmPasswordReset } from '../../src/features/auth/use-password-reset';
import { ApiError } from '../../src/lib/api';
import { colors } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

/**
 * Step three: spend the code and set the password.
 *
 * The code is carried here from the verify screen rather than asked for
 * again — it was checked one screen ago without being consumed, which is why
 * that check exists. Arriving without one means somebody opened this route
 * directly, and there is nothing to submit.
 *
 * Every session this account has is revoked server-side, so this lands on
 * sign-in rather than signing anybody in.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email, code } = useLocalSearchParams<{ email?: string; code?: string }>();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const confirm = useConfirmPasswordReset();

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  // Only complain once there is enough typed to be a real mismatch.
  const mismatched = confirmation.length >= password.length && confirmation !== password;

  const carried = email !== undefined && code !== undefined;
  const ready =
    carried &&
    password.length >= MIN_PASSWORD &&
    password.length <= MAX_PASSWORD &&
    confirmation === password;

  const submit = () => {
    if (!ready) return;

    confirm.mutate(
      { email: email as string, code: code as string, newPassword: password },
      { onSuccess: () => router.replace('/sign-in') },
    );
  };

  /**
   * A 400 here is the **code**, not the password.
   *
   * The two fields already bound the password to 8–72 characters, so the only
   * thing left for the server to reject is a code that expired or was spent
   * between this screen and the last one. "Check the fields" would send the
   * person hunting through two password boxes that are perfectly fine.
   */
  const errorKey = !carried
    ? 'auth.reset.errors.noCode'
    : confirm.error instanceof ApiError && confirm.error.status === 400
      ? 'auth.reset.errors.codeExpired'
      : confirm.error !== null
        ? authErrorKey(confirm.error)
        : null;

  return (
    <FormScreen
      onBack={() => goBack('/welcome')}
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
            label={t('auth.reset.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={confirm.isPending}
            onPress={submit}
          />
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
          {t('auth.reset.title')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {t('auth.reset.subtitle')}
        </Text>
      </View>

      <View style={{ gap: 15 }}>
        <TextField
          label={t('auth.reset.newPassword')}
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={MAX_PASSWORD}
          hint={t('auth.fields.minCharacters', { count: MIN_PASSWORD })}
          error={tooShort ? t('auth.fields.minCharacters', { count: MIN_PASSWORD }) : undefined}
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />

        <TextField
          label={t('auth.reset.confirmPassword')}
          value={confirmation}
          onChangeText={setConfirmation}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={MAX_PASSWORD}
          error={confirmation.length > 0 && mismatched ? t('auth.reset.mismatch') : undefined}
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />
      </View>
    </FormScreen>
  );
}
