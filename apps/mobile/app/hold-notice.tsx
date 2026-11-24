import { Notice } from '@/components/patterns/Notice';
import { en } from '@/i18n/en';

// held (Frontend Specification 7.2): a report is being reviewed. Error R03.
export default function HoldNotice() {
  return <Notice message={en.errors.R03} body={en.notices.heldBlocked} appeal />;
}
