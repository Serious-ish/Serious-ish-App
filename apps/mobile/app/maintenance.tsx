import { useQueryClient } from '@tanstack/react-query';

import { ErrorState } from '@/components/ui/ErrorState';
import { en } from '@/i18n/en';
import { gateKeys } from '@/lib/gate';

// Maintenance mode from remote config (error G07). Try again reads the config again.
export default function Maintenance() {
  const queryClient = useQueryClient();
  return (
    <ErrorState
      message={en.errors.G07}
      onRetry={() => void queryClient.refetchQueries({ queryKey: gateKeys.config })}
    />
  );
}
