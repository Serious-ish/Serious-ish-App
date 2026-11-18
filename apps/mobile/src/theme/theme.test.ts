import { palette, resolveMode } from '@serious-ish/design-tokens';
import Storage from 'expo-sqlite/kv-store';

import { PREFERENCE_KEY, readPreference, savePreference } from './ThemeProvider';
import { elevationStyle } from './shadow';

jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (k: string) => store.get(k) ?? null,
      setItemSync: (k: string, v: string) => void store.set(k, v),
      clear: () => store.clear(),
    },
  };
});

const storage = Storage as unknown as {
  clear: () => void;
  setItemSync: (k: string, v: string) => void;
};

beforeEach(() => storage.clear());

describe('appearance choice (stored on the phone only)', () => {
  it('a new install uses System', () => {
    expect(readPreference()).toBe('system');
  });

  it('a saved choice is read back after a restart', () => {
    savePreference('dark');
    expect(readPreference()).toBe('dark');
    savePreference('light');
    expect(readPreference()).toBe('light');
  });

  it('an unknown stored value falls back to System', () => {
    storage.setItemSync(PREFERENCE_KEY, 'sepia');
    expect(readPreference()).toBe('system');
  });
});

describe('resolveMode', () => {
  it('System follows the phone', () => {
    expect(resolveMode('system', 'dark')).toBe('dark');
    expect(resolveMode('system', 'light')).toBe('light');
  });

  it('a phone with no scheme gets Light (2.8)', () => {
    expect(resolveMode('system', null)).toBe('light');
    expect(resolveMode('system', undefined)).toBe('light');
  });

  it('a manual choice ignores the phone', () => {
    expect(resolveMode('light', 'dark')).toBe('light');
    expect(resolveMode('dark', 'light')).toBe('dark');
  });
});

describe('elevationStyle', () => {
  it('light uses warm ink at the light alpha and no top edge', () => {
    expect(elevationStyle(palette.light, 2)).toEqual({
      boxShadow: '0 4px 16px rgba(54,22,22,0.12)',
    });
  });

  it('dark scales the alpha by 5.5 and adds the raised top edge', () => {
    expect(elevationStyle(palette.dark, 1).boxShadow).toBe(
      '0 1px 3px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,.07)',
    );
    expect(elevationStyle(palette.dark, 3).boxShadow).toMatch(/rgba\(0,0,0,0\.99\)/);
  });
});
