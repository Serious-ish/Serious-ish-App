import { MessageForm } from '@/components/patterns/MessageForm';
import { en } from '@/i18n/en';
import { useGate } from '@/lib/gate';
import { requestSupport } from '@/lib/support';

// Open to held, suspended and deleted members (the root layout's guard).
export default function Support() {
  const { place } = useGate();
  const type = place.to === 'deleted' ? 'deletion_query' : 'other';
  return (
    <MessageForm
      title={en.notices.contactSupport}
      intro={en.notices.supportIntro}
      label={en.notices.supportLabel}
      sendLabel={en.notices.supportSend}
      send={async (text) => {
        await requestSupport(type, text);
        return en.notices.supportSent;
      }}
    />
  );
}
