import { Redirect, Stack } from 'expo-router';

import { useSession } from '../../src/features/auth/session';

/**
 * The signed-out half of the app.
 *
 * Nobody who is already signed in has any business here, so the guard lives
 * on the group rather than on each screen — one place to change when real
 * sessions arrive.
 */
export default function AuthLayout() {
  const { session } = useSession();

  if (session !== null) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
