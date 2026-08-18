import { createContext, useContext, useMemo, useState } from 'react';

export type Session = {
  email: string;
  displayName: string;
};

type SessionValue = {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Who is signed in — in memory only, on purpose.
 *
 * This is a stand-in so the sign-in flow can be walked end to end while the
 * screens are being designed. It authenticates nobody: there is no request,
 * no token and no persistence, so every reload starts at Welcome.
 *
 * When the AuthModule is wired (`docs/02-backend/architecture.md`), the
 * tokens belong in `expo-secure-store` and never in `AsyncStorage`, and the
 * API stays the authority on what this session may do — the app must not
 * decide permissions from what it finds in here.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      signIn: setSession,
      signOut: () => setSession(null),
    }),
    [session],
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
