import { space } from '@serious-ish/design-tokens';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { useTheme } from '@/theme/useTheme';

// Placeholder start screen so a fresh clone has something to open.
// Replaced by the Welcome screen and status gate (FT-008, FT-013). The gallery link (with the
// appearance switch) is for development builds only; members get Profile, Settings, Appearance
// (FT-072).
export default function Index() {
  const { c } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text variant="display" accessibilityRole="header">
        Serious-ish
      </Text>
      <Text color="muted">Environment: {env.appEnv}</Text>
      {__DEV__ && (
        <View style={styles.dev}>
          <Button
            label="Component gallery"
            variant="secondary"
            size="medium"
            onPress={() => router.push('/gallery')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
  },
  dev: { marginTop: space.xl },
});
