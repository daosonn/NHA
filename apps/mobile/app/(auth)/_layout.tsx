import { Redirect, Stack } from 'expo-router';

import { useSession } from '../../src/features/auth/session';

/**
 * The signed-out half of the app.
 *
 * Nobody who is already signed in has any business here, so the guard lives
 * on the group rather than on each screen — one place to change, and the
 * mirror of the one in `(tabs)/_layout.tsx`.
 */
export default function AuthLayout() {
  const { status } = useSession();

  if (status === 'loading') return null;
  if (status === 'authenticated') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
