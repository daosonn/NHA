// `Tabs` from 'expo-router' is deprecated in SDK 57 in favour of this entry
// point; the native-tabs variant cannot host a custom bar.
import { Tabs } from 'expo-router/js-tabs';

import { BottomNav } from '../../src/components/layout/bottom-nav';

/**
 * Home · Omoide · + · AI · Profile.
 *
 * Screen order here is the order they appear in the bar. The family tree is
 * deliberately absent — it is reached from the group strip on Home.
 */
export default function TabsLayout() {
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
