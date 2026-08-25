import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { OtpInput } from '../../src/components/ui/otp-input';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { authErrorKey } from '../../src/features/auth/auth-error';
import {
  useConfirmPasswordReset,
  useRequestPasswordReset,
} from '../../src/features/auth/use-password-reset';
import { ApiError } from '../../src/lib/api';
import { colors } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Steps two and three of the reset: choose the password, then confirm it
 * with the emailed code.
 *
 * Password FIRST, code last (reordered 2026-08-24, same shape as
 * `/settings/set-password`): nothing is emailed until the password is
 * chosen and "send code" is tapped, so the code arrives when the person is
 * ready to type it — not while they are still inventing a password — and
 * its 15 minutes are not spent on the thinking. The code is the final
 * confirmation, entered right before the request that consumes it, so the
 * separate check-without-spending screen this flow used to have has
 * nothing left to check.
 *
 * Both steps live in one screen because the password must never travel as
 * a route param — on web that is the URL.
 *
 * Every session this account has is revoked server-side, so this lands on
 * sign-in rather than signing anybody in.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<'password' | 'code'>('password');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const request = useRequestPasswordReset();
  const confirm = useConfirmPasswordReset();

  useEffect(() => {
    if (step !== 'code' || seconds === 0) return;
    const timer = setTimeout(() => setSeconds((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, seconds]);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  // Only complain once there is enough typed to be a real mismatch.
  const mismatched = confirmation.length >= password.length && confirmation !== password;

  // Arriving without an email means somebody opened this route directly.
  const carried = email !== undefined;
  const passwordReady =
    carried &&
    password.length >= MIN_PASSWORD &&
    password.length <= MAX_PASSWORD &&
    confirmation === password;

  const sendCode = () => {
    if (!passwordReady) return;

    request.mutate(
      { email: email as string },
      {
        // The countdown starts only once the mail is actually on its way;
        // starting it on the tap would hide a failure behind a timer.
        onSuccess: () => {
          setSeconds(RESEND_SECONDS);
          setStep('code');
        },
      },
    );
  };

  const submit = () => {
    if (!carried || code.length !== CODE_LENGTH) return;

    confirm.mutate(
      { email: email as string, code, newPassword: password },
      { onSuccess: () => router.replace('/sign-in') },
    );
  };

  /**
   * A 400 on confirm is the **code** — mistyped, expired, or already
   * spent. The password step bounded everything else before it was sent.
   */
  const errorKey = !carried
    ? 'auth.reset.errors.missingEmail'
    : confirm.error instanceof ApiError && confirm.error.status === 400
      ? 'auth.verify.wrongCode'
      : confirm.error !== null
        ? authErrorKey(confirm.error)
        : request.error !== null
          ? authErrorKey(request.error)
          : null;

  const errorAlert = errorKey !== null && (
    <Text variant="caption" color={colors.themes.destructive.text} accessibilityRole="alert">
      {t(errorKey)}
    </Text>
  );

  if (step === 'password') {
    return (
      <FormScreen
        onBack={() => goBack(router)}
        footer={
          <>
            {errorAlert}

            <Button
              label={t('auth.forgot.submit')}
              size="large"
              fullWidth
              disabled={!passwordReady}
              loading={request.isPending}
              onPress={sendCode}
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

  return (
    <FormScreen
      // Back from the code step re-opens the password step, not the email
      // screen — the person may have left to check their inbox.
      onBack={() => setStep('password')}
      footer={
        <>
          {errorAlert}

          <Button
            label={t('auth.reset.submit')}
            size="large"
            fullWidth
            disabled={code.length < CODE_LENGTH}
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
          {t('auth.verify.title')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {t('auth.verify.sentBefore', { count: CODE_LENGTH })}
          <Text variant="body1" weight="semibold">
            {email ?? t('auth.verify.fallbackAddress')}
          </Text>
          {t('auth.verify.sentAfter')}
        </Text>
      </View>

      <OtpInput
        value={code}
        // Editing clears the complaint: leaving "that code is not right"
        // under a box the person is busy correcting is just noise.
        onChangeText={(next) => {
          confirm.reset();
          setCode(next);
        }}
        length={CODE_LENGTH}
        accessibilityLabel={t('auth.verify.codeLabel', { count: CODE_LENGTH })}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Clock size={17} color={colors.text.lightMuted} strokeWidth={2} />

        {seconds > 0 ? (
          <Text variant="caption" color={colors.text.muted}>
            {t('auth.verify.resendBefore')}
            <Text variant="caption" weight="semibold">
              {countdown(seconds)}
            </Text>
          </Text>
        ) : (
          <Button
            label={t('auth.verify.resend')}
            variant="ghost"
            size="small"
            loading={request.isPending}
            onPress={() => {
              if (!carried) return;
              request.mutate(
                { email: email as string },
                { onSuccess: () => setSeconds(RESEND_SECONDS) },
              );
            }}
          />
        )}
      </View>
    </FormScreen>
  );
}
