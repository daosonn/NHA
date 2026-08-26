import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Imported per weight rather than from the package root: the root index
// `require()`s every weight and italic, which would bundle ~10 MB of TTF for
// the seven faces the design system actually uses.
import Inter_400Regular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf';
import Inter_500Medium from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf';
import Inter_600SemiBold from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf';
import Inter_700Bold from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf';
import Lora_500Medium from '@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf';
import Lora_600SemiBold from '@expo-google-fonts/lora/600SemiBold/Lora_600SemiBold.ttf';
import Lora_700Bold from '@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf';

// Registers the Tailwind utilities with NativeWind. Must be imported once,
// at the root.
import '../global.css';
import { SideNav } from '../src/components/layout/side-nav';
import { ToastProvider } from '../src/components/ui/toast';
import { SessionProvider, useSession } from '../src/features/auth/session';
import { currentAccessToken, refreshSession } from '../src/features/auth/session-store';
import { ActiveFamilyProvider } from '../src/features/family/active-family';
import { configureApi } from '../src/lib/api';
import { createQueryClient } from '../src/lib/query-client';
// Importing the module is what initialises i18next, so it must happen before
// any screen calls `t()`. `restoreLocale` then swaps in a stored choice.
import '../src/i18n';
import { restoreLocale } from '../src/i18n/locale';
import { colors, useLayout } from '../src/theme';
import { modalTransition, screenTransition } from '../src/theme/motion';

// Module scope on purpose: this has to be in place before the first request,
// and a child's effect can fire one before this component's own effects run.
// The base URL keeps its default from `EXPO_PUBLIC_API_URL`.
configureApi({
  getAccessToken: currentAccessToken,
  onUnauthorized: refreshSession,
});

// One client for the life of the process, created outside the component so a
// fast refresh does not throw the cache away on every save.
const queryClient = createQueryClient();

/**
 * Route groups a signed-out visitor may see.
 *
 * `(auth)` is the signed-out half of the app. `invite` is there because
 * `GET /invitations/:code` is the API's only public route — the whole point
 * of the invitation page is to make its case to somebody who does not have an
 * account yet, and bouncing them to Welcome throws the code away.
 */
/**
 * Route groups a signed-out visitor is allowed to be in.
 *
 * `auth` — no parentheses — is `app/auth/callback.tsx`, where social login
 * lands. It was missing until 2026-08-21, which meant the gate below fired
 * the moment the stored session came back empty and threw the callback off
 * its own screen **while it was still saving the tokens it had just been
 * handed**. Whether the sign-in survived came down to which promise resolved
 * first.
 */
const PUBLIC_GROUPS: readonly string[] = ['(auth)', 'auth', 'invite'];

/**
 * Puts the side navigation beside the whole navigator, from 1024px up.
 *
 * It sits here rather than in `(tabs)/_layout.tsx` — where the bottom bar
 * lives — because a pushed screen is a `Stack` screen *above* the tabs, so a
 * navigation mounted inside the tab navigator disappears the moment somebody
 * opens a Life Profile or a post. On a phone that is correct and expected. In
 * a browser it is the difference between a web app and a phone app someone is
 * looking at through a window, so above the `Stack` is the only place it can
 * be.
 *
 * A plain flex row, not an overlay: the rail takes real width and the screen
 * beside it gets the rest, so no screen has to know the rail exists or reserve
 * room for it. That is also why nothing here reaches into a screen — the
 * content column inside each one simply centres in a narrower space.
 *
 * Hidden while signed out, on the public invitation page, and while the
 * keychain read is still in flight — the same three cases the guard above
 * treats as "not yet somebody's app".
 */
function AppFrame({ children }: { children: React.ReactNode }) {
  const { expanded } = useLayout();
  const { status } = useSession();
  const segments = useSegments();

  const group = segments[0];
  const guarded = group !== undefined && !PUBLIC_GROUPS.includes(group);

  if (!expanded || status !== 'authenticated' || !guarded) return children;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <SideNav />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * Sends a signed-out visitor back to Welcome, from anywhere.
 *
 * `(tabs)/_layout.tsx` and `(auth)/_layout.tsx` each guard their own group,
 * which left every route that belongs to neither — `settings`, `member`,
 * `memo`, `post`, `profile`, `family`, `ai`, `create-family` — unguarded.
 * Signing out from Settings is what exposed it: the session went empty, the
 * screen stayed put, and it simply redrew itself with "not signed in" where
 * the name had been.
 *
 * An effect rather than `<Redirect>` because this layout has to keep
 * rendering the `Stack` in every state — the Welcome screen being redirected
 * *to* is one of its children.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const group = segments[0];

  useEffect(() => {
    // `loading` is the keychain read, not a verdict — acting on it would
    // bounce every returning user through Welcome on each cold start.
    if (status !== 'anonymous') return;
    // Empty on the very first render, before a route has resolved.
    if (group === undefined || PUBLIC_GROUPS.includes(group)) return;

    router.replace('/welcome');
  }, [status, group, router]);

  return children;
}

export default function RootLayout() {
  // Deliberately not a render gate. i18next is already initialised with the
  // device language by the import above, so the first paint is correct for
  // almost everyone; waiting on storage would blank the screen for a tick
  // and would prerender to nothing at all on web. When the stored choice
  // arrives, react-i18next re-renders the tree.
  useEffect(() => {
    void restoreLocale();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
  });

  // Render nothing while the faces load, but do not hold the app hostage if
  // one fails — the system font is a worse look, not a broken screen.
  if (!fontsLoaded && fontError === null) return null;

  return (
    // Outermost on purpose: every gesture handler in the tree resolves against
    // this view, and one mounted below a screen only works for that screen.
    // Today it is the family tree's pinch and pan; anything added later gets
    // it for free rather than rediscovering why its gestures do nothing.
    //
    // It also carries the page colour, because the very back is the only place
    // that covers everything. `Stack` paints it behind a screen and every screen
    // asks for it again, but the frame *around* them had nothing — so on the web
    // the column reserved for the side bar showed the document's own white, and
    // the glass bar came out a white shape on a white strip beside a warm page.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background.page }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <QueryClientProvider client={queryClient}>
          {/* Inside the query provider: signing out has to empty the cache, or
              the next account reads the previous one's data. */}
          <SessionProvider>
            {/* Below the session: which family is active is only a question
                once somebody is signed in. */}
            <ActiveFamilyProvider>
              {/* Above the navigator so a toast outlives a screen change —
                  saving a memo and going back should still say "saved". */}
              <ToastProvider>
                <AuthGate>
                  <AppFrame>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background.page },
                        ...screenTransition,
                      }}
                    >
                      {/* The compose screen rises from the bottom and drops
                          back on close, like the sheets. The back gesture is
                          off because leaving must go through its ✕ — that is
                          where "keep editing or discard?" lives, and a swipe
                          would throw the draft away around it. */}
                      <Stack.Screen
                        name="new"
                        options={{ ...modalTransition, gestureEnabled: false }}
                      />
                    </Stack>
                  </AppFrame>
                </AuthGate>
              </ToastProvider>
            </ActiveFamilyProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
