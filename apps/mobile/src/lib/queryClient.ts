import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

// Server data cache (Frontend Specification 8.3). api.ts already retries by the 9.2 rules, so the
// cache never retries on its own. Coming back to the app counts as focus, which refetches the
// status gate.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
    mutations: { retry: false },
  },
});

focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) =>
    setFocused(state === 'active'),
  );
  return () => subscription.remove();
});
