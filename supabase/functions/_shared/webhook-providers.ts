// How each provider proves itself and what its events look like (FT-010). Used by
// revenuecat-webhook and verification-webhook through _shared/webhook.ts.

import {
  hmacSha256Hex,
  timingSafeEqual,
  type ProviderSettings,
  type WebhookEvent,
} from './webhook.ts';

const MIN_SECRET_LENGTH = 32;

function requireSecret(name: string, value: string | undefined): string {
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be set to a random value of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return value;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' && value.length <= 200 ? value : null;

// RevenueCat ---------------------------------------------------------------------------------
// RevenueCat sends the Authorization header value set in its dashboard with every webhook.
// REVENUECAT_WEBHOOK_AUTH holds exactly that value (for example "Bearer <random>").
// Body: { api_version, event: { id, type, app_user_id, event_timestamp_ms, ... } }.
// The subject is the member: the app logs in to RevenueCat with the member's ID (FT-056).
export function revenueCat(authValue: string | undefined): ProviderSettings {
  const expected = requireSecret('REVENUECAT_WEBHOOK_AUTH', authValue);
  return {
    provider: 'revenuecat',
    authenticate: async (req) => timingSafeEqual(req.headers.get('authorization') ?? '', expected),
    parse: (body) => {
      const event = (body as { event?: Record<string, unknown> } | null)?.event;
      if (!event || typeof event !== 'object') return null;
      const id = text(event.id);
      const type = text(event.type);
      // A transfer moves a purchase between app users and names them in transferred_to.
      const transferredTo = Array.isArray(event.transferred_to) ? event.transferred_to[0] : null;
      const subject =
        text(event.app_user_id) ?? text(event.original_app_user_id) ?? text(transferredTo);
      const at = event.event_timestamp_ms;
      if (!id || !type || !subject || typeof at !== 'number' || !Number.isFinite(at)) return null;
      return { id, type, subject, occurredAt: new Date(at) } satisfies WebhookEvent;
    },
  };
}

// Age-check vendor ---------------------------------------------------------------------------
// PLACEHOLDER until the vendor contract (FD-002) confirms how callbacks are signed. Swap the
// signature check and the body fields here; nothing else changes.
//
// Header: X-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>." + body)>
//   More than one v1 is allowed, so the secret can be rotated without downtime.
//   A signature more than 5 minutes from our clock is refused, so a captured callback cannot
//   be replayed later.
// Body: { event_id, type, session_id, occurred_at (ISO 8601) }. The subject is the vendor's
//   session, which start-verification (FT-019) links to the member.
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export function ageCheck(secret: string | undefined): ProviderSettings {
  const key = requireSecret('VERIFICATION_WEBHOOK_SECRET', secret);
  return {
    provider: 'age_check',
    authenticate: async (req, body, nowMs) => {
      const parts = (req.headers.get('x-signature') ?? '').split(',').map((p) => p.trim());
      const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2) ?? '';
      const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      if (!/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false;
      if (Math.abs(nowMs - Number(timestamp) * 1000) > SIGNATURE_TOLERANCE_MS) return false;

      const prefix = new TextEncoder().encode(`${timestamp}.`);
      const signed = new Uint8Array(prefix.length + body.length);
      signed.set(prefix);
      signed.set(body, prefix.length);
      const expected = await hmacSha256Hex(key, signed);
      // Check every candidate so the time taken does not depend on which one matched.
      let ok = false;
      for (const candidate of signatures) ok = timingSafeEqual(candidate, expected) || ok;
      return ok;
    },
    parse: (body) => {
      const event = body as Record<string, unknown> | null;
      if (!event || typeof event !== 'object') return null;
      const id = text(event.event_id);
      const type = text(event.type);
      const subject = text(event.session_id);
      const at = typeof event.occurred_at === 'string' ? Date.parse(event.occurred_at) : NaN;
      if (!id || !type || !subject || !Number.isFinite(at)) return null;
      return { id, type, subject, occurredAt: new Date(at) } satisfies WebhookEvent;
    },
  };
}
