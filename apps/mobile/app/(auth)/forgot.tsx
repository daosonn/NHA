import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { colors } from '../../src/theme';

/**
 * Step one of the reset: name the account. Nothing is sent from here —
 * the code goes out from the next screen, after the new password is chosen
 * (reordered 2026-08-24, see `/reset`), so this screen is only navigation
 * and cannot fail.
 *
 * The next screens behave the same whether or not the address is
 * registered, because the server answers the same either way. Telling
 * somebody "no such account" would turn a password form into a way to find
 * out who has one.
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');

  return (
    <FormScreen
      onBack={() => router.back()}
      footer={
        <Button
          label={t('auth.verify.continue')}
          size="large"
          fullWidth
          disabled={email.trim().length === 0}
          onPress={() => router.push({ pathname: '/reset', params: { email: email.trim() } })}
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
          {t('auth.forgot.title')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {t('auth.forgot.subtitle')}
        </Text>
      </View>

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
    </FormScreen>
  );
}
