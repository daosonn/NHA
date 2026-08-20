import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { OtpInput } from '../../src/components/ui/otp-input';
import { Text } from '../../src/components/ui/text';
import { authErrorKey } from '../../src/features/auth/auth-error';
import { ApiError } from '../../src/lib/api';
import {
  useRequestPasswordReset,
  useVerifyResetCode,
} from '../../src/features/auth/use-password-reset';
import { colors } from '../../src/theme';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * One screen for two flows.
 *
 * Confirming an address and proving you own it before a password reset are
 * the same act to the person typing, so `intent` changes only where they
 * land afterwards — not what they see.
 */
export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email, intent } = useLocalSearchParams<{ email?: string; intent?: string }>();

  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  /** A code the server rejected, as opposed to a request that failed. */
  const [wrongCode, setWrongCode] = useState(false);

  const verify = useVerifyResetCode();
  const resend = useRequestPasswordReset();

  useEffect(() => {
    if (seconds === 0) return;
    const timer = setTimeout(() => setSeconds((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const address = email ?? t('auth.verify.fallbackAddress');
  const resetting = intent === 'reset';

  /**
   * The reset half is real; the sign-up half is not.
   *
   * `POST /auth/password-reset/verify` checks the code **without spending
   * it**, which is exactly what this middle step needs: the person finds out
   * they mistyped before choosing a password, and the same code still works
   * on the next screen — verified against the running server, twice in a row.
   *
   * A wrong code comes back as a **400**, not as `{ valid: false }`, even
   * though the shape allows the latter. Both are treated as "wrong code":
   * routing the 400 through the generic mapper instead would have put
   * "check the fields" under a six-digit box with nothing else in it.
   *
   * Registration has no code to check: it returns a token pair immediately,
   * so that flow no longer comes through here. This screen must never sign
   * anyone in — doing so would hand out a session with no token behind it, to
   * anyone who opens `/verify` directly.
   */
  const submit = () => {
    if (!resetting) {
      router.replace('/sign-in');
      return;
    }

    setWrongCode(false);

    verify.mutate(
      { email: address, code },
      {
        onSuccess: (result) => {
          if (!result.valid) {
            setWrongCode(true);
            return;
          }
          router.push({ pathname: '/reset', params: { email: address, code } });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400) setWrongCode(true);
        },
      },
    );
  };

  const rejected = wrongCode || (verify.error instanceof ApiError && verify.error.status === 400);

  const errorKey = rejected
    ? 'auth.verify.wrongCode'
    : verify.error !== null
      ? authErrorKey(verify.error)
      : resend.error !== null
        ? authErrorKey(resend.error)
        : null;

  return (
    <FormScreen
      onBack={() => router.back()}
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
            label={resetting ? t('auth.verify.continue') : t('auth.verify.verify')}
            size="large"
            fullWidth
            disabled={code.length < CODE_LENGTH}
            loading={verify.isPending}
            onPress={submit}
          />

          <Button
            label={resetting ? t('auth.verify.differentEmail') : t('auth.verify.changeEmail')}
            variant="ghost"
            fullWidth
            onPress={() => router.back()}
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
            {address}
          </Text>
          {t('auth.verify.sentAfter')}
        </Text>
      </View>

      <OtpInput
        value={code}
        // Editing clears the complaint: leaving "that code is not right"
        // under a box the person is busy correcting is just noise.
        onChangeText={(next) => {
          setWrongCode(false);
          verify.reset();
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
            loading={resend.isPending}
            onPress={() =>
              resend.mutate(
                { email: address },
                // The countdown restarts only once the mail is actually on
                // its way; restarting it on the tap would hide a failure
                // behind a timer.
                { onSuccess: () => setSeconds(RESEND_SECONDS) },
              )
            }
          />
        )}
      </View>
    </FormScreen>
  );
}
