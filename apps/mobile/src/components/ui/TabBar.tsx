import { icon, radius, space } from '@serious-ish/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';

import { elevationStyle } from '@/theme/shadow';
import { useTheme } from '@/theme/useTheme';

import { CountBadge } from './Badge';
import { TOUCH } from './constants';
import { FocusRing, useFocusRing } from './focus';
import type { Icon } from './icons';

// 5.7 Tab bar: a floating --raise bar with fully rounded ends, 56 high, icons only (24) with an
// accessibility label each. Active: filled icon in --brand; inactive: outline icon in --muted. A
// --brand count badge on Matches and Chat, never over 9. The layout places it (inset 12, above the
// safe area); FT-009 makes it frosted.
const HEIGHT = 56;

export type Tab = { name: string; label: string; icon: Icon; badge?: number };

type Props = { tabs: Tab[]; active: string; onPress: (name: string) => void };

export function TabBar({ tabs, active, onPress }: Props) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: c.raise }, elevationStyle(c, 1)]}
    >
      {tabs.map((tab) => (
        <TabButton
          key={tab.name}
          tab={tab}
          selected={tab.name === active}
          onPress={() => onPress(tab.name)}
        />
      ))}
    </View>
  );
}

function TabButton({
  tab,
  selected,
  onPress,
}: {
  tab: Tab;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const { focused, focusProps } = useFocusRing();
  const Glyph = tab.icon;
  const badge = tab.badge ?? 0;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={badge > 0 ? `${tab.label}, ${badge}` : tab.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tab}
      {...focusProps}
    >
      <View>
        <Glyph
          size={icon.md}
          weight={selected ? 'fill' : 'regular'}
          color={selected ? c.brand : c.muted}
        />
        <View style={styles.badge} pointerEvents="none">
          <CountBadge count={badge} />
        </View>
      </View>
      {focused && <FocusRing radius={radius.pill} inside />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    minHeight: TOUCH,
    minWidth: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -space.xxs, left: icon.md - space.xs },
});
