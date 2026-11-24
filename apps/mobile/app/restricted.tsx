import { Notice } from '@/components/patterns/Notice';
import { en } from '@/i18n/en';

// suspended (Frontend Specification 7.2). Error A18.
export default function Restricted() {
  return <Notice message={en.errors.A18} body={en.notices.restrictedBlocked} appeal />;
}
