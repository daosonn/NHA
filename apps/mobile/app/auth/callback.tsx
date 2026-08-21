import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { saveSession } from '../../src/features/auth/session-store';
import { readCallback } from '../../src/features/auth/use-social-login';
import { colors, spacing } from '../../src/theme';

/**
 * Which sentence a failure gets.
 *
 * `email_taken` is the one worth spelling out. Signing in with Google using
 * an address that already has a password is not a mistake anybody would
 * guess they had made, and the server deliberately refuses to join the two
 * accounts on its own (`docs/02-backend/architecture.md` — no auto-linking,
 * decided 2026-08-17). Saying "use your password instead" and carrying the
 * address over is the whole of the fix available today.
 */
const MESSAGE: Record<string, string> = {
  email_taken: 'auth.social.errors.emailTaken',
  rejected: 'auth.social.errors.rejected',
  incomplete: 'auth.social.errors.incomplete',
  failed: 'errors.generic',
};

/** How long the spinner may run before this screen admits it is stuck. */
const WATCHDOG_MS = 8000;

/**
 * Where social login lands.
 *
 * The server has just redirected the browser here with the outcome in the
 * fragment. This reads it and gets out of the way — a doorway, not a screen.
 * Before it existed a refused sign-in left somebody staring at raw JSON on an
 * API address with no way back into the app.
 *
 * The fragment is cleared either way. It never reached a server, but leaving
 * a refresh token in the address bar and in the browser's history is
 * careless in a way that costs nothing to avoid.
 *
 * **Nothing here may end in silence** (hardened 2026-08-21 after a blank
 * screen nobody could explain from the code). Three ways it used to be able
 * to: a rejected `saveSession` had no `catch`, so the spinner ran forever on
 * an unhandled rejection; a redirect that never arrived looked identical to
 * one still in flight; and a failure offered no way out but a timer. Now the
 * write is caught, a watchdog gives up out loud, and every dead end has a
 * button on it.
 */
export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);

  const backToSignIn = () => router.replace('/sign-in');

  useEffect(() => {
    const href = typeof window === 'undefined' ? '' : window.location.href;
    const outcome = readCallback(href);

    const clearFragment = () => {
      if (typeof window === 'undefined') return;
      window.history.replaceState(null, '', window.location.pathname);
    };

    if (outcome === null) {
      // Somebody opened this route directly. Nothing happened, so say nothing.
      router.replace('/sign-in');
      return;
    }

    if (outcome.kind === 'failed') {
      clearFragment();
      setFailure(MESSAGE[outcome.code] ?? 'errors.generic');

      // Long enough to read, then back to the form — with the address filled
      // in, so the answer to "log in with your password" is one field away.
      // The button below is there for anyone who does not want to wait.
      const timer = setTimeout(() => {
        router.replace(
          outcome.email === null
            ? '/sign-in'
            : { pathname: '/sign-in', params: { email: outcome.email } },
        );
      }, 2600);
      return () => clearTimeout(timer);
    }

    // If the write to storage fails there is no session, and pretending
    // otherwise would drop somebody into the app holding tokens that vanish
    // on the next reload.
    let settled = false;

    saveSession(outcome.session)
      .then(() => {
        settled = true;
        clearFragment();
        router.replace('/');
      })
      .catch(() => {
        settled = true;
        clearFragment();
        setFailure('errors.generic');
      });

    const watchdog = setTimeout(() => {
      if (!settled) setFailure('auth.social.errors.stuck');
    }, WATCHDOG_MS);

    return () => clearTimeout(watchdog);
  }, [router]);

  return (
    <View
      className="flex-1 bg-page"
      style={{ alignItems: 'center', justifyContent: 'center', gap: 14, padding: spacing.xl }}
    >
      {failure === null && <ActivityIndicator color={colors.coral.primary} />}

      <Text
        variant="body2"
        color={failure === null ? colors.text.muted : colors.text.body}
        accessibilityRole={failure === null ? undefined : 'alert'}
        style={{ textAlign: 'center' }}
      >
        {t(failure ?? 'auth.social.finishing')}
      </Text>

      {failure !== null && (
        <Button label={t('auth.social.backToSignIn')} variant="secondary" onPress={backToSignIn} />
      )}
    </View>
  );
}
