// verification-webhook: age-check results from the vendor (FT-010; TRD 5;
// Security & Access 5.2, S04).
//
// POST from the vendor, signed with VERIFICATION_WEBHOOK_SECRET (see the placeholder scheme in
// _shared/webhook-providers.ts until the vendor contract, FD-002, confirms it).
// 200 { ok: true } once the event is recorded (new, repeated, old or out of order);
// 401 if the signature is missing, wrong or more than 5 minutes old; 422 if the body is not an
// event; 500 so the vendor retries.
//
// Supabase's sign-in check is off for this function (config.toml): a result forwarded by the
// app is never proof, only the vendor's signature is. What an event changes is decided in the
// database (public.receive_webhook_event); age-check results arrive with FT-019. The selfie and
// the vendor's full result are never stored or logged here.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

import { createWebhookHandler, databaseRecorder } from '../_shared/webhook.ts';
import { ageCheck } from '../_shared/webhook-providers.ts';

const server = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createWebhookHandler(ageCheck(Deno.env.get('VERIFICATION_WEBHOOK_SECRET')), {
    record: databaseRecorder(server),
  }),
);

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment value ${name}`);
  return value;
}
