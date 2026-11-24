import { ErrorState } from '@/components/ui/ErrorState';
import { en } from '@/i18n/en';

// A blocking screen with no tabs (Frontend Specification 7.1, 7.2): error A18.
export default function Page() {
  return <ErrorState message={en.errors.A18} />;
}
