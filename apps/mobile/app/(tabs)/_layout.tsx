import { Redirect } from 'expo-router';
// `Tabs` from 'expo-router' is deprecated in SDK 57 in favour of this entry
// point; the native-tabs variant cannot host a custom bar.
import { Tabs } from 'expo-router/js-tabs';

import { BottomNav } from '../../src/components/layout/bottom-nav';
import { useSession } from '../../src/features/auth/session';

/**
 * Home · Omoide · + · AI · Profile.
 *
 * Screen order here is the order they appear in the bar. The family tree is
 * deliberately absent — it is reached from the group strip on Home.
 *
 * Everything behind the tab bar is a family's private record, so the guard
 * sits on the group: one gate rather than five.
 */
export default function TabsLayout() {
  const { status } = useSession();

  // The keychain read is async, so "not read yet" is its own state. Treating
  // it as signed out would bounce every returning user through Welcome on
  // every cold start.
  if (status === 'loading') return null;
  if (status === 'anonymous') return <Redirect href="/welcome" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNav {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="omoide" />
      <Tabs.Screen name="new" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
