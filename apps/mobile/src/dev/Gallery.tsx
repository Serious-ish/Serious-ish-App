import { space, type ThemePreference } from '@serious-ish/design-tokens';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { ApiError } from '@/lib/api';
import { setGatePreview, type Place } from '@/lib/gate';
import { useTheme } from '@/theme/useTheme';

import { catalog } from './catalog';

const appearances: ThemePreference[] = ['system', 'light', 'dark'];

// Every place the status gate can send a member, previewed without a server. Reload the app to
// leave the preview.
const places: [string, Place][] = [
  ['welcome', { to: 'welcome' }],
  ['details', { to: 'details' }],
  ['step 4', { to: 'profile-step', step: 4 }],
  ['age check', { to: 'age-check' }],
  ['review', { to: 'review' }],
  ['go live', { to: 'go-live' }],
  ['under 18', { to: 'age-blocked' }],
  ['active', { to: 'tabs', paused: false }],
  ['paused', { to: 'tabs', paused: true }],
  ['held', { to: 'hold' }],
  ['suspended', { to: 'restricted' }],
  ['deleted', { to: 'deleted' }],
  ['old version', { to: 'update-required' }],
  ['maintenance', { to: 'maintenance' }],
  ['offline', { to: 'unavailable', error: new ApiError('OFFLINE', null) }],
];

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
      <Text variant="h2" accessibilityRole="header">
        Status gate preview
      </Text>
      <View style={styles.row}>
        {places.map(([label, place]) => (
          <Chip
            key={label}
            label={label}
            onPress={() => {
              setGatePreview(place);
              router.replace('/');
            }}
          />
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
