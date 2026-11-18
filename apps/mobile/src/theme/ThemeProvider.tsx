import {
  palette,
  resolveMode,
  type Theme,
  type ThemeMode,
  type ThemePreference,
} from '@serious-ish/design-tokens';
import Storage from 'expo-sqlite/kv-store';
import * as SystemUI from 'expo-system-ui';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

// The appearance choice lives on the phone only: not in the secure store, not on the server,
// not in analytics (TRD 2.6, Frontend Specification 8.3). It belongs to the phone, so sign-out
// must clear session keys only and keep this one. It is presentation only: no permission,
// deadline or safety rule may read it.
export const PREFERENCE_KEY = 'appearance';

const isPreference = (v: unknown): v is ThemePreference =>
  v === 'system' || v === 'light' || v === 'dark';

// Read synchronously so the theme is known before the first screen draws (no white flash).
export const readPreference = (): ThemePreference => {
  const stored = Storage.getItemSync(PREFERENCE_KEY);
  return isPreference(stored) ? stored : 'system';
};

export const savePreference = (p: ThemePreference) => Storage.setItemSync(PREFERENCE_KEY, p);

export type ThemeValue = {
  c: Theme;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readPreference);

  // A phone that reports no scheme gets Light (2.8). The diagnostics event for it arrives with
  // analytics.
  const mode = resolveMode(preference, useColorScheme());
  const c = palette[mode];

  // Native views (keyboard, alerts, status bar, pickers) follow the choice; 'auto' hands control
  // back to the phone, and useColorScheme then reports the phone's own scheme live.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
  }, [preference]);

  // The window behind every screen, so transitions and the keyboard never show white on dark.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  // Instant swap, no crossfade: allowed by 2.8 and what reduced motion requires anyway.
  const setPreference = (p: ThemePreference) => {
    savePreference(p);
    setPreferenceState(p);
  };

  return <ThemeContext value={{ c, mode, preference, setPreference }}>{children}</ThemeContext>;
}
