import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { BottomNav } from '../../src/components/layout/bottom-nav';
import { useSession } from '../../src/features/auth/session';
import { useLayout } from '../../src/theme';

/**
 * Home · Omoide · Family tree · AI · Profile.
 *
 * Screen order here is the order they appear in the bar. The tree became an
 * ordinary tab on 2026-08-26 (owner's call — it had been the strip on Home,
 * then briefly the bar's raised centre disc). `new` keeps its route for the
 * compose screen but draws no slot: posting starts from Home's compose bar.
 */
export default function TabsLayout() {
  const { status } = useSession();
  const { expanded } = useLayout();

  // The keychain read is async, so "not read yet" is its own state. Treating
  // it as signed out would bounce every returning user through Welcome on
  // every cold start.
  if (status === 'loading') return null;
  if (status === 'anonymous') return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Nothing at all from 1024px up: the same destinations are already down
      // the left, mounted above this navigator so they survive a pushed screen
      // (`app/_layout.tsx` → `AppFrame`). Two navigations for four places is
      // one too many, and the bottom one would still be costing every screen
      // 160px of reserved height.
      tabBar={(props) => (expanded ? null : <BottomNav {...props} />)}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="omoide" />
      <Tabs.Screen name="family" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="profile" />
      {/* A route with no slot — see the layout docstring. */}
      <Tabs.Screen name="new" />
    </Tabs>
  );
}
