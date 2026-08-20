import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSocialLogin } from '../../features/auth/use-social-login';
import { Button } from '../ui/button';
import { Divider } from '../ui/divider';
import { FacebookMark, GoogleMark } from './identity-marks';

export type SocialButtonsProps = {
  /** `row` beside the password form, `stack` on Welcome where they lead. */
  layout?: 'row' | 'stack';
  /** Welcome words them as "Continue with"; the forms just name the provider. */
  continueWording?: boolean;
};

/**
 * Google and Facebook.
 *
 * **Rendered only where they work.** They were removed entirely on
 * 2026-08-20 because the OAuth callback answered with JSON, which no client
 * can read; the server now redirects back with the tokens in the fragment
 * (`OAUTH_APP_REDIRECTS`), so on web the flow completes. Native still has no
 * way back into the app — that needs `expo-web-browser`'s auth session — so
 * there the component draws nothing rather than putting a button on a phone
 * that does nothing when pressed.
 */
export function SocialButtons({ layout = 'row', continueWording = false }: SocialButtonsProps) {
  const { t } = useTranslation();
  const { start, pending, available } = useSocialLogin();

  if (!available) return null;

  const google = (
    <Button
      label={continueWording ? t('auth.continueGoogle') : t('auth.google')}
      variant="neutral"
      size="large"
      fullWidth
      loading={pending === 'google'}
      disabled={pending !== null}
      onPress={() => start('google')}
      renderIcon={() => <GoogleMark />}
    />
  );

  const facebook = (
    <Button
      label={continueWording ? t('auth.continueFacebook') : t('auth.facebook')}
      variant="neutral"
      size="large"
      fullWidth
      loading={pending === 'facebook'}
      disabled={pending !== null}
      onPress={() => start('facebook')}
      renderIcon={() => <FacebookMark />}
    />
  );

  if (layout === 'stack') {
    return (
      <>
        {google}
        {facebook}
      </>
    );
  }

  return (
    <>
      <Divider label={t('common.or')} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>{google}</View>
        <View style={{ flex: 1 }}>{facebook}</View>
      </View>
    </>
  );
}
