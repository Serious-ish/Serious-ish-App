import { use } from 'react';

import { ThemeContext } from './ThemeProvider';

// const { c, mode, preference, setPreference } = useTheme();   c.brand, c.ink ...
export function useTheme() {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
