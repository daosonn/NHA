import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AuthModeTabs } from '../../src/components/auth/auth-mode-tabs';
import { AppleMark, GoogleMark } from '../../src/components/auth/identity-marks';
import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Checkbox } from '../../src/components/ui/checkbox';
import { Divider } from '../../src/components/ui/divider';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { TextLink } from '../../src/components/ui/text-link';
import { useSession } from '../../src/features/auth/session';
import { colors } from '../../src/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stayed, setStayed] = useState(true);

  const ready = email.trim().length > 0 && password.length > 0;

  return (
    <FormScreen
      onBack={() => router.back()}
      footer={
        <>
          <Button
            label={t('auth.signIn.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            onPress={() => signIn({ email: email.trim(), displayName: 'Minh' })}
          />

          <Divider label={t('common.or')} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t('auth.apple')}
                variant="neutral"
                size="large"
                fullWidth
                renderIcon={() => <AppleMark />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('auth.google')}
                variant="neutral"
                size="large"
                fullWidth
                renderIcon={() => <GoogleMark />}
              />
            </View>
          </View>
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

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
