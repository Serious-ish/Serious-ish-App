import { space, type ThemePreference } from '@serious-ish/design-tokens';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

import { catalog } from './catalog';

const appearances: ThemePreference[] = ['system', 'light', 'dark'];

// The component gallery (Frontend Specification 11.2, item 02): every state from section 05,
// with a System, Light and Dark switch at the top. Development builds only.
export default function Gallery() {
  const { c, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space['2xl'] },
      ]}
    >
      <Text variant="h1" accessibilityRole="header">
        Component gallery
      </Text>
      <View style={styles.row}>
        {appearances.map((p) => (
          <Chip key={p} label={p} selected={preference === p} onPress={() => setPreference(p)} />
        ))}
      </View>
      {catalog.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text variant="h2" accessibilityRole="header">
            {section.title}
          </Text>
          {section.demos.map((demo) => (
            <View key={demo.name} style={[styles.demo, !section.wide && styles.natural]}>
              <Text variant="caption" color="muted">
                {demo.name}
              </Text>
              {demo.render()}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, gap: space['2xl'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  section: { gap: space.md },
  demo: { gap: space.xs },
  natural: { alignItems: 'flex-start' },
});
