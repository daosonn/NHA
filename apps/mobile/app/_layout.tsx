import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { colors } from '../src/theme';

export default function RootLayout() {
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.page },
        }}
      />
    </SafeAreaProvider>
  );
}
