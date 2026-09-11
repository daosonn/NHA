import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSocialLogin } from '../../features/auth/use-social-login';
import { Button } from '../ui/button';
import { Divider } from '../ui/divider';
import { GoogleMark } from './identity-marks';

export type SocialButtonsProps = {
  /** `row` sits under the password form and needs the "or" rule above it. */
  layout?: 'row' | 'stack';
  /** Welcome words it as "Continue with"; the forms just name the provider. */
  continueWording?: boolean;
};

/**
 * Signing in with Google.
 *
 * **Rendered only where it works.** It was removed entirely on 2026-08-20
 * because the OAuth callback answered with JSON, which no client can read;
 * the server now redirects back with the tokens in the fragment
 * (`OAUTH_APP_REDIRECTS`), so on web the flow completes. Native still has no
 * way back into the app — that needs `expo-web-browser`'s auth session — so
 * there this component draws nothing rather than putting a button on a phone
 * that does nothing when pressed.
 *
 * Facebook stood beside it until 2026-09-01, when the owner asked for it to
 * go. Only the button went: the server keeps its route and `OAuthProvider`
 * still names the provider, so an account already linked through Facebook
 * would go on working. None is — every OAuth account on record is Google.
 *
 * `layout` survives the removal because it never described the arrangement
 * of two buttons: `row` is the variant that follows a password form and so
 * carries the "or" rule, `stack` is Welcome, where signing in with Google is
 * the first thing offered and there is nothing above it to separate from.
 *
 * **Disabled for the demo (2026-09-11).** The button stays visible but
 * greyed out and unpressable: the OAuth round-trip leaves the demo script.
 * The flow itself still works — `useSocialLogin` and the server route are
 * untouched — so re-enabling is restoring the `onPress`/`loading` wiring
 * this component had before this date.
 */
export function SocialButtons({ layout = 'row', continueWording = false }: SocialButtonsProps) {
  const { t } = useTranslation();
  const { available } = useSocialLogin();

  if (!available) return null;

  const google = (
    <Button
      label={continueWording ? t('auth.continueGoogle') : t('auth.google')}
      variant="neutral"
      size="large"
      fullWidth
      disabled
      renderIcon={() => (
        // Brand colours read as pressable; dimmed to match the disabled text.
        <View style={{ opacity: 0.45 }}>
          <GoogleMark />
        </View>
      )}
    />
  );

  if (layout === 'stack') return google;

  return (
    <>
      <Divider label={t('common.or')} />
      {google}
    </>
  );
}
