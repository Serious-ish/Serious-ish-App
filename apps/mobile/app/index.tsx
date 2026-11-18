import { StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';

// Placeholder start screen so a fresh clone has something to open.
// Replaced by the Welcome screen and status gate (FT-008, FT-013).
export default function Index() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header">Serious-ish</Text>
      <Text>Environment: {env.appEnv}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
