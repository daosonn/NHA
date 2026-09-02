import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform } from 'react-native';

import { apiBaseUrl, auth } from '../../lib/api';
import type { AuthResult, OAuthProvider } from '../../lib/api';

/**
 * Where the server sends the browser back to, once the provider is done.
 *
 * `Linking.createURL` gives `nha://auth/callback` on a device and
 * `http://localhost:8081/auth/callback` on web, which is exactly the pair the
 * server's `OAUTH_APP_REDIRECTS` allowlist has to contain. It is validated
 * there, not here — a client cannot talk its way into a redirect the server
 * has not been told about.
 */
export function socialRedirectUri(): string {
  return Linking.createURL('auth/callback');
}

/**
 * What came back on the fragment: a session, or a reason there is not one.
 *
 * `email` is set only alongside `email_taken`, and it is the address the
 * person just proved they control — so the sign-in screen can fill it in
 * rather than making them type it again.
 */
export type CallbackResult =
  { kind: 'session'; session: AuthResult } | { kind: 'failed'; code: string; email: string | null };

/**
 * Reads the outcome out of a callback URL's fragment.
 *
 * Everything after `#` never leaves the browser: it is not sent to the
 * server, does not appear in an access log, and is not passed on in
 * `Referer`. That is why the server puts it there rather than in the query
 * string — the thing being carried is a refresh token.
 *
 * Returns null only for a URL with no fragment at all. A fragment that is
 * present but incomplete counts as a failure, not as a session: half a token
 * pair must never become half a login.
 */
export function readCallback(url: string): CallbackResult | null {
  const hash = url.split('#')[1];
  if (hash === undefined || hash === '') return null;

  const params = new URLSearchParams(hash);

  const failure = params.get('error');
  if (failure) {
    return { kind: 'failed', code: failure, email: params.get('email') };
  }

  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  const id = params.get('userId');
  const email = params.get('email');
  const name = params.get('name');

  if (!accessToken || !refreshToken || !id || !email || !name) {
    return { kind: 'failed', code: 'incomplete', email: null };
  }

  return { kind: 'session', session: { accessToken, refreshToken, user: { id, email, name } } };
}

/**
 * Sign in with Google.
 *
 * `start` still takes an `OAuthProvider` rather than nothing at all: the
 * server kept its Facebook route when the button was dropped on 2026-09-01,
 * so the provider is a real parameter here, just one no screen passes.
 *
 * The flow leaves the app: the browser goes to the provider, the provider
 * returns to the server's callback, and the server redirects back here with
 * the tokens in the fragment. On web that is a plain top-level navigation —
 * the page is replaced and comes back, and `app/auth/callback.tsx` finishes
 * the job.
 *
 * **Native is not wired.** `Linking.openURL` would hand the flow to the
 * system browser and never bring it back into the app; doing it properly
 * needs `expo-web-browser`'s auth session, which is not installed. So the
 * buttons only appear on web, rather than sitting on a phone doing nothing —
 * see `docs/00-shared/api-contract.md`.
 */
export function useSocialLogin() {
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const start = (provider: OAuthProvider) => {
    if (Platform.OS !== 'web') return;

    setPending(provider);

    const url = `${auth.oauthStartUrl(provider, apiBaseUrl())}?redirect=${encodeURIComponent(
      socialRedirectUri(),
    )}`;

    // Replaces the page. Nothing after this runs.
    window.location.assign(url);
  };

  return { start, pending, available: Platform.OS === 'web' };
}
