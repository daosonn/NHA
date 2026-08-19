import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { auth } from '../../lib/api';
import type { AuthenticatedUser } from '../../lib/api';
import { resetRefreshState } from '../../lib/api';
import {
  clearSession,
  currentSession,
  currentUser,
  loadSession,
  saveSession,
  subscribe,
} from './session-store';

/**
 * `loading` is not a formality: the token pair comes back from the keychain
 * asynchronously, and a guard that treats "not read yet" as "signed out"
 * bounces every returning user through Welcome on every cold start.
 */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type SessionValue = {
  status: SessionStatus;
  user: AuthenticatedUser | null;
  /** `persist` is the "Keep me signed in" checkbox; default is to persist. */
  signIn: (input: { email: string; password: string; persist?: boolean }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

/** How long to wait for the server to revoke the token before giving up. */
const LOGOUT_TIMEOUT_MS = 5000;

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Who is signed in.
 *
 * The tokens themselves live in `session-store.ts`, outside React, because
 * the API client has to read the access token synchronously from a plain
 * function. This component is the React view of that store, not a second
 * copy of it — hence `useSyncExternalStore` rather than local state.
 *
 * What it deliberately does not do is decide anything. Authorization is the
 * server's job; the app must never grant itself access from what it finds in
 * a token (`CLAUDE.md` § 3).
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);

  const session = useSyncExternalStore(subscribe, currentSession, currentSession);

  useEffect(() => {
    let cancelled = false;

    void loadSession().finally(() => {
      if (!cancelled) setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    const existing = currentSession();

    // The server call has to come first. `POST /auth/logout` is an
    // authenticated endpoint — the controller reads `@CurrentUser()` — so
    // clearing the tokens beforehand sent it with no Authorization header, it
    // came back 401, and the refresh token was never revoked: a working
    // credential left alive on the server every time somebody signed out.
    if (existing !== null) {
      await Promise.race([
        auth.logout({ refreshToken: existing.refreshToken }),
        // The API client has no timeout of its own, and a request that hangs
        // must not strand somebody on a screen they asked to leave. Signing
        // out locally is the part that actually belongs to them.
        new Promise<void>((resolve) => {
          setTimeout(resolve, LOGOUT_TIMEOUT_MS);
        }),
      ]).catch(() => {
        // Offline, or the token was already revoked. Nothing left to undo.
      });
    }

    await clearSession();
    resetRefreshState();
    // Otherwise the next account to sign in on this device reads the
    // previous one's families out of the cache before its own arrive.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({
      status: !hydrated ? 'loading' : session === null ? 'anonymous' : 'authenticated',
      user: currentUser(),
      signIn: async ({ email, password, persist = true }) => {
        await saveSession(await auth.login({ email, password }), { persist });
      },
      register: async ({ name, email, password }) => {
        // Registration returns a token pair immediately — there is no email
        // confirmation step on the server yet (`docs/00-shared/api-contract.md`).
        await saveSession(await auth.register({ name, email, password }));
      },
      signOut,
    }),
    [hydrated, session, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (value === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }

  return value;
}
