import { Notice } from '@/components/patterns/Notice';
import { en } from '@/i18n/en';

// deleted (Frontend Specification 7.2): restore is not offered, so support is the only action.
// Error X03.
export default function Deleted() {
  return <Notice message={en.errors.X03} body={en.notices.deletedBody} />;
}
