import {
  border,
  radius,
  space,
  typography,
  type ThemePreference,
} from '@serious-ish/design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';
import { useTheme } from '@/theme/useTheme';

const choices: ThemePreference[] = ['system', 'light', 'dark'];

// Placeholder start screen so a fresh clone has something to open.
// Replaced by the Welcome screen and status gate (FT-008, FT-013). The appearance switch is for
// development builds only; members get Profile, Settings, Appearance (FT-072).
export default function Index() {
  const { c, preference, setPreference } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text accessibilityRole="header" style={[typography.display, { color: c.ink }]}>
        Serious-ish
      </Text>
      <Text style={[typography.body, { color: c.muted }]}>Environment: {env.appEnv}</Text>
      {__DEV__ && (
        <View accessibilityRole="radiogroup" style={styles.row}>
          {choices.map((p) => {
            const selected = preference === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setPreference(p)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: selected ? c.brand : c.raise,
                    borderColor: selected ? c.brand : c.muted,
                  },
                ]}
              >
                <Text style={[typography.buttonS, { color: selected ? c.onbrand : c.ink }]}>
                  {p}
                </Text>
              </Pressable>
            );
          })}
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
  row: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.xl,
  },
  choice: {
    minHeight: space['4xl'],
    minWidth: space['4xl'],
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: border.control,
  },
});
