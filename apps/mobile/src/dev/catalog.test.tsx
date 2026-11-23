import { palette, type ThemeMode } from '@serious-ish/design-tokens';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { TestInstance } from 'test-renderer';

import { ThemeContext } from '@/theme/ThemeProvider';

import { catalog } from './catalog';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));

// The same providers the root layout gives every screen, with an iPhone-sized safe area.
const metrics = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const inTheme = (mode: ThemeMode) =>
  function Themed({ children }: { children: ReactNode }) {
    return (
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={metrics}>
          <ThemeContext
            value={{ c: palette[mode], mode, preference: mode, setPreference: () => {} }}
          >
            {children}
          </ThemeContext>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  };

const states = catalog.flatMap((section) =>
  section.demos.map((demo) => [`${section.title} › ${demo.name}`, demo] as const),
);

// Renders a state; overlays are opened first so the snapshot shows them open.
async function show(demo: (typeof states)[number][1], mode: ThemeMode) {
  await render(demo.render(), { wrapper: inTheme(mode) });
  const open = screen.queryByRole('button', { name: /^Show / });
  if (open) await fireEvent.press(open);
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// FT-004: snapshot tests cover every component state in both themes (TRD 8.5).
describe.each(['light', 'dark'] as const)('%s theme', (mode) => {
  it.each(states)('%s', async (_, demo) => {
    await show(demo, mode);
    expect(screen.toJSON()).toMatchSnapshot();
  });
});

// FT-004: screen readers read each component clearly, and touch targets are at least 48 by 48
// (Frontend Specification 4.2, 6.2).
const controlRoles = new Set(['button', 'checkbox', 'switch', 'adjustable', 'radio', 'link']);
const textOf = (node: TestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const slop = (s: unknown) =>
  typeof s === 'number'
    ? { top: s, bottom: s, left: s, right: s }
    : { top: 0, bottom: 0, left: 0, right: 0, ...(s as object) };

describe('accessibility', () => {
  it.each(states)('%s', async (_, demo) => {
    await show(demo, 'light');
    const hosts = screen.root?.queryAll((n) => typeof n.type === 'string') ?? [];

    // Anything that can be pressed says what it is.
    for (const n of hosts) {
      const pressable = n.props.onClick !== undefined || n.props.onResponderRelease !== undefined;
      if (pressable && n.props.accessible !== false) {
        expect(n.props.accessibilityRole).toBeDefined();
      }
    }

    for (const n of hosts.filter((h) => controlRoles.has(h.props.accessibilityRole))) {
      const name = n.props.accessibilityLabel ?? textOf(n);
      expect(name.trim()).not.toBe('');
      const style = StyleSheet.flatten(n.props.style) ?? {};
      const hit = slop(n.props.hitSlop);
      const height = Math.max(Number(style.height ?? 0), Number(style.minHeight ?? 0));
      expect(height + hit.top + hit.bottom).toBeGreaterThanOrEqual(48);
      const width = style.width ?? style.minWidth;
      // Rows and cards without a width stretch across the screen.
      if (width !== undefined)
        expect(Number(width) + hit.left + hit.right).toBeGreaterThanOrEqual(48);
    }

    // Every text field has a label.
    for (const n of hosts.filter((h) => h.type === 'TextInput')) {
      expect(n.props.accessibilityLabel).toBeTruthy();
    }
  });
});
