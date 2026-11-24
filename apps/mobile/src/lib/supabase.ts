import { createClient, type Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/config/env';

import { appVersion, setSession } from './api';
import { encryptedStorage } from './encryptedStorage';

// Supabase Auth: sign-in (FT-013) and the session. Data calls go through api.ts, which this hands
// the session's token. Without a project URL (a fresh clone with an empty .env.local) there is no
// client, and the app behaves as signed out.
export const supabase = env.supabaseUrl
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        storage: encryptedStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-app-version': appVersion } },
    })
  : null;

let current: Session | null = null;

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    current = session;
  });

  setSession({
    accessToken: () => current?.access_token ?? null,
    refresh: async () => {
      const { data, error } = await supabase.auth.refreshSession();
      return !error && data.session !== null;
    },
  });

  // Refresh the token only while the app is in front (Supabase's React Native guidance).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
