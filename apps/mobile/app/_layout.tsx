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
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorState } from '@/components/ui/ErrorState';
import { en } from '@/i18n/en';
import { routeFor, useGate, type Group } from '@/lib/gate';
import { queryClient } from '@/lib/queryClient';
import { initSentry } from '@/lib/sentry';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';

// The red splash stays up until fonts, theme and the first session check are ready, so a dark
// phone never shows a white screen (TRD 2.6, FT-008). The theme is read synchronously.
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

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Prata_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });
  // A font that fails to load falls back to the system font and the app still opens (3.3).
  if (!loaded && error === null) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <GatedStack />
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// The status gate (Frontend Specification 7.2) opens exactly one group of screens. Every route is
// listed here, so a route outside the current place (a deep link to a tab while held, say) is
// closed and sends the person to index, which redirects to the right place. The server still
// checks every request; these guards are for the screen only.
function GatedStack() {
  const { c, mode } = useTheme();
  const gate = useGate();

  useEffect(() => {
    if (gate.ready) SplashScreen.hide();
  }, [gate.ready]);

  if (!gate.ready) return null;
  const open = (group: Group) => routeFor(gate.place).group === group;
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
        <Stack.Screen name="index" />
        <Stack.Protected guard={open('update-required')}>
          <Stack.Screen name="update-required" />
        </Stack.Protected>
        <Stack.Protected guard={open('maintenance')}>
          <Stack.Screen name="maintenance" />
        </Stack.Protected>
        <Stack.Protected guard={open('unavailable')}>
          <Stack.Screen name="unavailable" />
        </Stack.Protected>
        <Stack.Protected guard={open('auth')}>
          <Stack.Screen name="(auth)/welcome" />
        </Stack.Protected>
        <Stack.Protected guard={open('onboarding')}>
          <Stack.Screen name="(onboarding)/details" />
          <Stack.Screen name="(onboarding)/profile/[step]" />
          <Stack.Screen name="(onboarding)/age-check" />
          <Stack.Screen name="(onboarding)/review" />
          <Stack.Screen name="(onboarding)/go-live" />
        </Stack.Protected>
        {/* Detail screens (full profile, chat, event) join this group, so they push over the tabs. */}
        <Stack.Protected guard={open('tabs')}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={open('hold')}>
          <Stack.Screen name="hold-notice" />
        </Stack.Protected>
        <Stack.Protected guard={open('restricted')}>
          <Stack.Screen name="restricted" />
        </Stack.Protected>
        <Stack.Protected guard={open('deleted')}>
          <Stack.Screen name="deleted" />
        </Stack.Protected>
        {/* The appeal and support path pushes over its notice (FT-046). */}
        <Stack.Protected guard={open('hold') || open('restricted')}>
          <Stack.Screen name="appeal" />
        </Stack.Protected>
        <Stack.Protected guard={open('hold') || open('restricted') || open('deleted')}>
          <Stack.Screen name="support" />
        </Stack.Protected>
        <Stack.Protected guard={open('age-blocked')}>
          <Stack.Screen name="age-blocked" />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="(dev)/gallery" />
        </Stack.Protected>
      </Stack>
    </NavigationTheme>
  );
}
