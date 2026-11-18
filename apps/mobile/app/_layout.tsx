import { Stack } from 'expo-router';

// Root layout. Providers (theme, query client, session gate) arrive with FT-003 and FT-008.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
