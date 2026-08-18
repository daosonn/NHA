/**
 * The token pair: where it is kept, and who is allowed to ask for it.
 *
 * This module is deliberately outside React. The API client needs the access
 * token **synchronously**, on every request, from a plain function — and a
 * hook cannot be called from there. So the current pair lives here in module
 * scope, the React layer (`session.tsx`) subscribes to it, and both read the
 * same value.
 *
 * Storage is `expo-secure-store` — the iOS keychain and the Android
 * keystore. A refresh token is a long-lived credential and `AsyncStorage`
 * writes plain text (`CLAUDE.md` § 5); that store is for preferences like
 * the chosen language.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { auth } from '../../lib/api';
import type { AuthResult, AuthenticatedUser } from '../../lib/api';

const ACCESS_KEY = 'nha.auth.access';
const REFRESH_KEY = 'nha.auth.refresh';
const USER_KEY = 'nha.auth.user';

/**
 * `expo-secure-store` has no web implementation — its web build exports an
 * empty object, so every call throws. The browser tier is a layout preview,
 * never a shipping target (`docs/04-devops/mobile-development.md`), so it
 * falls back to `localStorage` purely to keep the dev loop usable. Do not
 * demonstrate anything that matters against the web build.
 *
 * `localStorage` is also absent while Expo prerenders routes in Node, hence
 * the second guard.
 */
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let current: AuthResult | null = null;

/**
 * Whether this session survives the app closing — the "Keep me signed in"
 * checkbox. Remembered separately from the pair itself because a refresh
 * replaces the tokens and must not quietly promote a deliberately temporary
 * session onto the keychain.
 */
let persistent = true;

type Listener = () => void;
const listeners = new Set<Listener>();

function publish(): void {
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore` — React re-reads the snapshot when this fires. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentSession(): AuthResult | null {
  return current;
}

export function currentUser(): AuthenticatedUser | null {
  return current?.user ?? null;
}

/** What `configureApi` is handed. Synchronous by necessity — see the header. */
export function currentAccessToken(): string | null {
  return current?.accessToken ?? null;
}

/**
 * Reads the pair back at launch.
 *
 * A partial write — say the app was killed between two `setItemAsync` calls —
 * is treated as no session at all rather than a half one, because a session
 * missing its refresh token cannot recover from its first 401.
 */
export async function loadSession(): Promise<AuthResult | null> {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    storage.get(ACCESS_KEY),
    storage.get(REFRESH_KEY),
    storage.get(USER_KEY),
  ]);

  if (accessToken === null || refreshToken === null || rawUser === null) {
    current = null;
    publish();
    return null;
  }

  try {
    current = { accessToken, refreshToken, user: JSON.parse(rawUser) as AuthenticatedUser };
  } catch {
    // Storage holds something this version cannot read. Start clean.
    current = null;
  }

  publish();
  return current;
}

export async function saveSession(
  next: AuthResult,
  options: { persist?: boolean } = {},
): Promise<void> {
  persistent = options.persist ?? persistent;

  current = next;
  publish();

  if (!persistent) {
    // Shared phone: the session works until the app closes and leaves
    // nothing on the device afterwards.
    await removeAll();
    return;
  }

  await Promise.all([
    storage.set(ACCESS_KEY, next.accessToken),
    storage.set(REFRESH_KEY, next.refreshToken),
    storage.set(USER_KEY, JSON.stringify(next.user)),
  ]);
}

export async function clearSession(): Promise<void> {
  current = null;
  persistent = true;
  publish();

  await removeAll();
}

function removeAll(): Promise<unknown> {
  return Promise.all([
    storage.remove(ACCESS_KEY),
    storage.remove(REFRESH_KEY),
    storage.remove(USER_KEY),
  ]);
}

/**
 * Trades the refresh token for a new pair. Handed to `configureApi` as
 * `onUnauthorized`, which guarantees only one of these runs at a time.
 *
 * That guarantee is the whole point. Refresh is **single-use rotation**
 * (`docs/00-shared/api-contract.md`): the old token is revoked as the new
 * pair is issued. Two of these racing would each send the same token, the
 * second would be rejected, and the session would be lost while the person
 * was still using the app.
 *
 * The new pair is persisted before `true` is returned, for the same reason —
 * a pair that only ever existed in memory dies with the process, and the one
 * on disk has already been revoked server-side.
 */
export async function refreshSession(): Promise<boolean> {
  const existing = current;
  if (existing === null) return false;

  try {
    const next = await auth.refresh({ refreshToken: existing.refreshToken });
    await saveSession(next);
    return true;
  } catch {
    // The refresh token is spent, revoked or expired: there is no way back
    // to a valid session from here, so stop pretending there is one.
    await clearSession();
    return false;
  }
}
