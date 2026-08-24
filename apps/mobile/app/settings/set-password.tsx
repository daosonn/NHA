import { useRouter } from 'expo-router';
import { Clock, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { OtpInput } from '../../src/components/ui/otp-input';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { authErrorKey } from '../../src/features/auth/auth-error';
import { useSession } from '../../src/features/auth/session';
import {
  useConfirmPasswordReset,
  useRequestPasswordReset,
} from '../../src/features/auth/use-password-reset';
import { ApiError } from '../../src/lib/api';
import { colors } from '../../src/theme';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Set a password on a social-only account (reached from
 * `/settings/password`).
 *
 * This is the password-reset flow worn by a signed-in person: the server
 * has no separate "set password" endpoint on purpose — owning the email is
 * the proof, same as the provider login itself (`api-contract.md` → Auth).
 *
 * Two steps, password FIRST: choose the password, and only the "email me a
 * code" tap sends anything — so the code arrives when the person is ready
 * to type it, not while they are still inventing a password, and closing
 * the screen at step one costs nothing. The emailed code is the final
 * confirmation. (The signed-out reset flow runs the other way around
 * because there the code also proves which account is being reset; here
 * the session already knows.)
 *
 * Succeeding revokes **every** session, this device's included — the reset
 * contract, and right for it. So the last step says that before the
 * button, and afterwards signs out locally so the person lands on sign-in
 * instead of watching the app quietly 401 on the next refresh.
 */
export default function SetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { user, signOut } = useSession();

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

  const email = user?.email ?? null;

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  // Only complain once there is enough typed to be a real mismatch.
  const mismatched = confirmation.length >= password.length && confirmation !== password;

  const passwordReady =
    email !== null &&
    password.length >= MIN_PASSWORD &&
    password.length <= MAX_PASSWORD &&
    confirmation === password;

  const sendCode = () => {
    if (!passwordReady || email === null) return;

    request.mutate(
      { email },
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
    if (code.length !== CODE_LENGTH || email === null) return;

    confirm.mutate(
      { email, code, newPassword: password },
      {
        onSuccess: () => {
          toast.success(t('settings.password.set.done'));
          // The server just revoked every session, this one included; the
          // sign-out clears the dead pair and the guard lands on Welcome.
          void signOut();
        },
      },
    );
  };

  /**
   * A 400 on confirm is the **code** — expired, mistyped, or already
   * spent. The password step bounded everything else before it was sent.
   */
  const errorKey =
    confirm.error instanceof ApiError && confirm.error.status === 400
      ? 'auth.verify.wrongCode'
      : confirm.error !== null
        ? authErrorKey(confirm.error)
        : request.error !== null
          ? authErrorKey(request.error)
          : null;

  if (step === 'password') {
    return (
      <FormScreen
        onBack={() => router.back()}
        title={t('settings.password.set.title')}
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
              label={t('settings.password.set.send')}
              size="large"
              fullWidth
              disabled={!passwordReady}
              loading={request.isPending}
              onPress={sendCode}
            />
          </>
        }
      >
        <Text variant="body2" color={colors.text.muted}>
          {t('settings.password.set.howItWorks')}
        </Text>

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
      // Back from the code step re-opens the password step, not Settings —
      // the person may have left to check their inbox and mistyped earlier.
      onBack={() => setStep('password')}
      title={t('settings.password.set.title')}
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
            label={t('settings.password.set.submit')}
            size="large"
            fullWidth
            disabled={code.length < CODE_LENGTH}
            loading={confirm.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <Text variant="body2" color={colors.text.muted}>
        {t('auth.verify.sentBefore', { count: CODE_LENGTH })}
        <Text variant="body2" weight="semibold">
          {email ?? t('auth.verify.fallbackAddress')}
        </Text>
        {t('auth.verify.sentAfter')}
      </Text>

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
              if (email === null) return;
              request.mutate({ email }, { onSuccess: () => setSeconds(RESEND_SECONDS) });
            }}
          />
        )}
      </View>

      {/* Said before it happens, not after — this one signs out THIS device
          too, unlike the change-password form one screen back. */}
      <Text variant="caption" color={colors.text.subtle}>
        {t('settings.password.set.signsOutAll')}
      </Text>
    </FormScreen>
  );
}
