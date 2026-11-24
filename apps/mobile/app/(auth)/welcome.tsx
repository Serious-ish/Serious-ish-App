import { space } from '@serious-ish/design-tokens';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/patterns/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { en } from '@/i18n/en';

// Placeholder until FT-013 builds Welcome, phone and code sign-in.
export default function Welcome() {
  return (
    <Screen title={en.screens.welcome}>
      <View style={styles.body}>
        <Text color="muted">Environment: {env.appEnv}</Text>
        {__DEV__ && (
          <Button
            label="Component gallery"
            variant="secondary"
            size="medium"
            onPress={() => router.push('/gallery')}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, alignItems: 'flex-start' },
});
