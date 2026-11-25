// revenuecat-webhook: purchase and renewal events from RevenueCat (FT-010; TRD 5;
// Security & Access 5.2, S02, S03).
//
// POST from RevenueCat with the Authorization header set in its dashboard.
// 200 { ok: true } once the event is recorded (new, repeated, old or out of order);
// 401 if the header is wrong; 422 if the body is not an event; 500 so RevenueCat retries.
//
// Supabase's sign-in check is off for this function (config.toml): RevenueCat has no member
// token, and a member's token must never count as proof. What an event changes is decided in
// the database (public.receive_webhook_event); plans and entitlements arrive with FT-056.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

import { createWebhookHandler, databaseRecorder } from '../_shared/webhook.ts';
import { revenueCat } from '../_shared/webhook-providers.ts';

const server = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createWebhookHandler(revenueCat(Deno.env.get('REVENUECAT_WEBHOOK_AUTH')), {
    record: databaseRecorder(server),
  }),
);

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment value ${name}`);
  return value;
}
