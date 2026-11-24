import { space } from '@serious-ish/design-tokens';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CalendarBlankIcon,
  ChatCircleIcon,
  HeartIcon,
  HouseIcon,
  UserIcon,
} from '@/components/ui/icons';
import { TabBar, type Tab } from '@/components/ui/TabBar';
import { en } from '@/i18n/en';

// The five tabs (Frontend Specification 5.7, 7.1), Home first. Icons are Phosphor stand-ins until
// the designer confirms the deck's. Counts on Matches and Chat arrive with those features, through
// each screen's tabBarBadge option.
const tabs: Omit<Tab, 'badge'>[] = [
  { name: 'home', label: en.nav.home, icon: HouseIcon },
  { name: 'matches', label: en.nav.matches, icon: HeartIcon },
  { name: 'chat', label: en.nav.chat, icon: ChatCircleIcon },
  { name: 'events', label: en.nav.events, icon: CalendarBlankIcon },
  { name: 'profile', label: en.nav.profile, icon: UserIcon },
];

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Floating: inset 12 from the sides and sitting above the safe area.
function FloatingTabBar({ state, descriptors, navigateToTab, insets }: TabBarProps) {
  const active = state.routes[state.index]?.name ?? 'home';
  const withBadges = tabs.map((tab) => {
    const route = state.routes.find((r) => r.name === tab.name);
    const badge = route ? descriptors[route.key]?.options.tabBarBadge : undefined;
    return { ...tab, badge: typeof badge === 'number' ? badge : 0 };
  });
  return (
    <View style={[styles.floating, { bottom: insets.bottom }]} pointerEvents="box-none">
      <TabBar
        tabs={withBadges}
        active={active}
        onPress={(name) => {
          const route = state.routes.find((r) => r.name === name);
          if (route) navigateToTab(route.key);
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: space.sm, right: space.sm },
});
