import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Prata_400Regular } from '@expo-google-fonts/prata/400Regular';
import { Sora_500Medium } from '@expo-google-fonts/sora/500Medium';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationTheme,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorState } from '@/components/ui/ErrorState';
import { en } from '@/i18n/en';
import { initSentry } from '@/lib/sentry';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';

// The red splash stays up until fonts and theme are ready, so a dark phone never shows a white
// screen (TRD 2.6). The theme is read synchronously, so only the fonts are waited for.
void SplashScreen.preventAutoHideAsync();
initSentry();

// A crash anywhere shows the general error (G08), never the error's own text or stack
// (Security 06). FT-012 adds the crash report and its reference code.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <ErrorState message={en.errors.G08} onRetry={retry} />
    </ThemeProvider>
  );
}

// Root layout. Query client and session gate arrive with FT-008.
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Prata_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });
  const ready = loaded || error !== null;

  // A font that fails to load falls back to the system font and the app still opens (3.3).
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { c, mode } = useTheme();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.brand,
      background: c.bg,
      card: c.raise,
      text: c.ink,
      border: c.line,
      notification: c.brand,
    },
  };

  return (
    <NavigationTheme value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="(dev)/gallery" />
        </Stack.Protected>
      </Stack>
    </NavigationTheme>
  );
}
