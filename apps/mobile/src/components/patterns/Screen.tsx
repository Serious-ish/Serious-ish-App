import { space } from '@serious-ish/design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Header } from '@/components/ui/Header';
import { en } from '@/i18n/en';
import { useGate } from '@/lib/gate';
import { useTheme } from '@/theme/useTheme';

// A screen with its header. A paused member sees the persistent "Your profile is hidden" banner
// under the header on every tab (Frontend Specification 7.2). The Unpause button arrives with the
// pause setting.
export function Screen({ title, children }: { title: string; children?: ReactNode }) {
  const { c } = useTheme();
  const { place } = useGate();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Header title={title} />
      {place.to === 'tabs' && place.paused && (
        <View style={styles.banner}>
          <Banner kind="info" message={en.gate.paused} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  banner: { paddingHorizontal: space.lg },
});
