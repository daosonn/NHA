import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { colors } from '../../src/theme';

const MIN_PASSWORD = 8;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  // Only complain once there is enough typed to be a real mismatch.
  const mismatched = confirmation.length >= password.length && confirmation !== password;
  const ready = password.length >= MIN_PASSWORD && confirmation === password;

  return (
    <FormScreen
      onBack={() => router.back()}
      footer={
        <Button
          label={t('auth.reset.submit')}
          size="large"
          fullWidth
          disabled={!ready}
          // Password reset is WBS 1.1.7, deferred pending an email
          // infrastructure decision, so there is nothing to submit to. The
          // screen returns to sign-in rather than faking a session.
          onPress={() => router.replace('/sign-in')}
        />
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
          error={confirmation.length > 0 && mismatched ? t('auth.reset.mismatch') : undefined}
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />
      </View>
    </FormScreen>
  );
}
