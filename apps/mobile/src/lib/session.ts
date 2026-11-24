import { useEffect, useState } from 'react';

import { clearPhotoCache } from './photo-cache';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

export type SessionState = { ready: boolean; userId: string | null };

// The first session check (Frontend Specification 7.2): the stored session is read once at launch,
// then followed through every sign-in, refresh and sign-out.
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ ready: supabase === null, userId: null });

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, userId: session?.user.id ?? null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

// FT-008: sign-out removes the session and its key, the cached cards and the cached photos. The
// appearance choice belongs to the phone and stays (2.8).
export async function signOut(): Promise<void> {
  if (supabase) {
    // Ask the server to end the session, then remove it from the phone even if that call failed.
    await supabase.auth.signOut().catch(() => undefined);
    await supabase.auth.signOut({ scope: 'local' });
  }
  queryClient.clear();
  await clearPhotoCache();
}
