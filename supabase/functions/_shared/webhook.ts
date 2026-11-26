// One safe way to receive outside callbacks (FT-010; TRD 5 "Scheduled jobs and outside
// callbacks"; Security & Access 5.2, B07, B08, S02 to S04).
//
// Every webhook Edge Function is this pipeline with its own provider settings:
//
//   1. POST only, with a size limit.
//   2. Prove the sender (a shared secret or a signature) before anything else. A failure is
//      401 and changes nothing. A member's own token proves nothing here: these functions run
//      without Supabase's sign-in check, and only the provider's secret is accepted.
//   3. Read the event's ID, type, subject (member or session) and time.
//   4. Hand it to the database (public.receive_webhook_event), which records it once, refuses
//      old and out-of-order events and applies the rest in one transaction.
//
// The body is never logged or stored; the database keeps a SHA-256 fingerprint of it. A log line
// holds the provider, an outcome category and a short fingerprint of the event ID only.
//
// Runtime-neutral (Web Crypto, Request, Response), so the contract tests run it under Node.

export type Provider = 'revenuecat' | 'age_check';
export type Outcome = 'processed' | 'duplicate' | 'superseded' | 'stale' | 'failed';

export type WebhookEvent = {
  id: string;
  type: string;
  subject: string;
  occurredAt: Date;
  // Other members or sessions the event changes, such as the member who loses a transferred
  // purchase. Each is locked with the subject and gets a check of its current state.
  alsoAffects?: string[];
};

export type ProviderSettings = {
  provider: Provider;
  // True only when the request provably came from the provider. Gets the exact body bytes.
  authenticate: (req: Request, body: Uint8Array, nowMs: number) => Promise<boolean>;
  // The event inside an authenticated body, or null if it is not one we understand.
  parse: (body: unknown) => WebhookEvent | null;
};

export type Recorded = WebhookEvent & { provider: Provider; payloadHash: string };

export type LogEntry = {
  provider: Provider;
  outcome: Outcome | 'bad_signature' | 'invalid' | 'too_large' | 'wrong_method' | 'error';
  // First 12 hex characters of SHA-256(event ID): enough to match a log line to a row.
  ref?: string;
};

// The event could not be accepted as given (the database refused it as invalid). Retrying the
// same body would not help, so the provider gets 422, not 500.
export class InvalidEventError extends Error {}

// What the webhook Edge Functions need from a Supabase client.
export type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};

const OUTCOMES: readonly Outcome[] = ['processed', 'duplicate', 'superseded', 'stale', 'failed'];

// Hands an event to public.receive_webhook_event with the server key. The error's own text is
// never passed on or logged.
export function databaseRecorder(client: RpcClient) {
  return async (event: Recorded): Promise<Outcome> => {
    const { data, error } = await client.rpc('receive_webhook_event', {
      p_provider: event.provider,
      p_event_id: event.id,
      p_event_type: event.type,
      p_subject: event.subject,
      p_occurred_at: event.occurredAt.toISOString(),
      p_payload_hash: event.payloadHash,
      p_also_affects: event.alsoAffects ?? [],
    });
    if (error?.code === 'PT422') throw new InvalidEventError();
    if (error || !OUTCOMES.includes(data as Outcome))
      throw new Error('receive_webhook_event failed');
    return data as Outcome;
  };
}

export type Deps = {
  record: (event: Recorded) => Promise<Outcome>;
  log?: (entry: LogEntry) => void;
  now?: () => number;
};

export const MAX_BODY_BYTES = 64 * 1024;

export function createWebhookHandler(settings: ProviderSettings, deps: Deps) {
  const log = deps.log ?? ((entry: LogEntry) => console.log(JSON.stringify({ webhook: entry })));
  const now = deps.now ?? (() => Date.now());
  const provider = settings.provider;

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      log({ provider, outcome: 'wrong_method' });
      return reply(405, { code: 'METHOD_NOT_ALLOWED' });
    }

    const body = await readLimited(req, MAX_BODY_BYTES);
    if (!body) {
      log({ provider, outcome: 'too_large' });
      return reply(413, { code: 'INVALID_REQUEST' });
    }

    if (!(await settings.authenticate(req, body, now()))) {
      log({ provider, outcome: 'bad_signature' });
      return reply(401, { code: 'NOT_ALLOWED' });
    }

    let event: WebhookEvent | null = null;
    try {
      event = settings.parse(JSON.parse(new TextDecoder().decode(body)));
    } catch {
      event = null;
    }
    if (!event) {
      log({ provider, outcome: 'invalid' });
      return reply(422, { code: 'INVALID_REQUEST' });
    }

    const ref = (await sha256Hex(new TextEncoder().encode(event.id))).slice(0, 12);
    try {
      const outcome = await deps.record({ ...event, provider, payloadHash: await sha256Hex(body) });
      log({ provider, outcome, ref });
      // Every recorded outcome is a 200, so the provider stops retrying: a repeat, an old event,
      // an out-of-order one and one that could not be applied are all handled, by doing nothing
      // or by queuing a check of the current state. 'failed' is logged so it can be alerted on.
      return reply(200, { ok: true });
    } catch (thrown) {
      if (thrown instanceof InvalidEventError) {
        log({ provider, outcome: 'invalid', ref });
        return reply(422, { code: 'INVALID_REQUEST' });
      }
      // Nothing was recorded (the database step is one transaction); a non-200 makes the
      // provider retry later.
      log({ provider, outcome: 'error', ref });
      return reply(500, { code: 'SERVER_ERROR' });
    }
  };
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// The body, or null if it is larger than the limit (whatever Content-Length claims).
async function readLimited(req: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

// Crypto helpers -----------------------------------------------------------------------------

export async function sha256Hex(data: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

export async function hmacSha256Hex(secret: string, message: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return toHex(new Uint8Array(signature));
}

// Compares two strings in time that depends only on their lengths, never on where they first
// differ, so a wrong guess teaches an attacker nothing.
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
