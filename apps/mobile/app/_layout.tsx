import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
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
import { SessionProvider } from '../src/features/auth/session';
// Importing the module is what initialises i18next, so it must happen before
// any screen calls `t()`. `restoreLocale` then swaps in a stored choice.
import '../src/i18n';
import { restoreLocale } from '../src/i18n/locale';
import { colors } from '../src/theme';

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
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.page },
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
