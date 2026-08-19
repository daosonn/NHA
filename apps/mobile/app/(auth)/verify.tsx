import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { OtpInput } from '../../src/components/ui/otp-input';
import { Text } from '../../src/components/ui/text';
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

  useEffect(() => {
    if (seconds === 0) return;
    const timer = setTimeout(() => setSeconds((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const address = email ?? t('auth.verify.fallbackAddress');
  const resetting = intent === 'reset';

  /**
   * Nothing here calls the server yet. The reset flow does have endpoints —
   * `POST /auth/password-reset/{request,verify,confirm}` — but they are not
   * mirrored in `src/lib/api/endpoints.ts`, so this screen still only carries
   * the address forward (`docs/00-shared/api-contract.md`). The sign-up half
   * has no endpoint at all: registration returns a token pair straight away,
   * so that flow no longer comes through here.
   *
   * It must not sign anyone in: doing so would hand out a session with no
   * token behind it, reachable by anyone who opens `/verify` directly.
   */
  const submit = () => {
    if (resetting) {
      router.push({ pathname: '/reset', params: { email: address } });
      return;
    }
    router.replace('/sign-in');
  };

  return (
    <FormScreen
      onBack={() => router.back()}
      footer={
        <>
          <Button
            label={resetting ? t('auth.verify.continue') : t('auth.verify.verify')}
            size="large"
            fullWidth
            disabled={code.length < CODE_LENGTH}
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
        onChangeText={setCode}
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
            onPress={() => setSeconds(RESEND_SECONDS)}
          />
        )}
      </View>
    </FormScreen>
  );
}
