import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
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
import { colors } from '../src/theme';

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
const PUBLIC_GROUPS: readonly string[] = ['(auth)', 'invite'];

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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background.page },
                    }}
                  />
                </AuthGate>
              </ToastProvider>
            </ActiveFamilyProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
