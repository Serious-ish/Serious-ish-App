import { useQueryClient } from '@tanstack/react-query';

import { ErrorState } from '@/components/ui/ErrorState';
import { gateKeys, useGate } from '@/lib/gate';
import { describeError } from '@/lib/errorCatalog';
import { en } from '@/i18n/en';

// The member's status could not be read (offline, or the server failed). Try again reads it again.
export default function Unavailable() {
  const { place } = useGate();
  const queryClient = useQueryClient();
  const message = place.to === 'unavailable' ? describeError(place.error).message : null;
  return (
    <ErrorState
      message={message ?? en.errors.G02}
      onRetry={() => void queryClient.refetchQueries({ queryKey: gateKeys.member })}
    />
  );
}
