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
 * Step one of three: prove which account, then the code screen, then a new
 * password. It reuses the same code screen as sign-up rather than sending a
 * reset link, because a link has to open somewhere — and the role of
 * `apps/web` is still undecided (`docs/01-frontend/architecture.md`).
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
          label={t('auth.forgot.submit')}
          size="large"
          fullWidth
          disabled={email.trim().length === 0}
          onPress={() =>
            router.push({
              pathname: '/verify',
              params: { email: email.trim(), intent: 'reset' },
            })
          }
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
