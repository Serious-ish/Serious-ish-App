import { MessageForm } from '@/components/patterns/MessageForm';
import { en } from '@/i18n/en';
import { submitAppeal } from '@/lib/support';

// Open to held and suspended members only (the root layout's guard).
export default function Appeal() {
  return (
    <MessageForm
      title={en.notices.appeal}
      intro={en.notices.appealIntro}
      label={en.notices.appealLabel}
      sendLabel={en.notices.appealSend}
      send={async (text) =>
        // Nothing to appeal: support has the message instead (R08).
        (await submitAppeal(text)) === 'appeal' ? en.notices.appealSent : en.errors.R08
      }
    />
  );
}
