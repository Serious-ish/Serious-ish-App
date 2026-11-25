// Webhook contract tests (FT-010 acceptance criteria; Security & Access B07, B08, S02 to S04).
// Signed sample events go through the same pipeline the Edge Functions use, against the real
// local database, with every log line captured. When the functions are being served they are
// called end to end as well.
//
// Secrets come from supabase/functions/.env (local test values; CI writes random ones), never
// from the repository. Run with `pnpm db:test:api` while the local stack is running.

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

import {
  ageCheck,
  revenueCat,
  SIGNATURE_TOLERANCE_MS,
} from '../../functions/_shared/webhook-providers.ts';
import {
  createWebhookHandler,
  databaseRecorder,
  hmacSha256Hex,
  MAX_BODY_BYTES,
  timingSafeEqual,
  type LogEntry,
  type ProviderSettings,
} from '../../functions/_shared/webhook.ts';

const local = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json', '--agent', 'no'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
) as Record<string, string>;
const API_URL = local.API_URL!;
const PUBLISHABLE_KEY = local.PUBLISHABLE_KEY ?? local.ANON_KEY!;
const SECRET_KEY = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY!;

const ENV_FILE = new URL('../../functions/.env', import.meta.url);
const secrets = Object.fromEntries(
  (existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '')
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
) as Record<string, string>;
const RC_AUTH = secrets.REVENUECAT_WEBHOOK_AUTH ?? `Bearer test-${randomUUID()}${randomUUID()}`;
const VENDOR_SECRET = secrets.VERIFICATION_WEBHOOK_SECRET ?? `test-${randomUUID()}${randomUUID()}`;

const db = postgres(local.DB_URL!, { max: 2, onnotice: () => {} });
const server = createClient(API_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Sample events -------------------------------------------------------------------------------
// Shaped like RevenueCat's documented webhook body, with the payment details a real one carries.
const PAYMENT_DETAILS = [
  '4.99',
  'CAD',
  'GPA.3372-1234-5678-90123',
  'serious.spark.week',
  'buyer@example.test',
];
function revenueCatEvent(subject: string, at = Date.now(), id = randomUUID()) {
  return {
    api_version: '1.0',
    event: {
      id,
      type: 'RENEWAL',
      app_user_id: subject,
      original_app_user_id: subject,
      event_timestamp_ms: at,
      product_id: 'serious.spark.week',
      store: 'PLAY_STORE',
      price: 4.99,
      currency: 'CAD',
      transaction_id: 'GPA.3372-1234-5678-90123',
      subscriber_attributes: { $email: { value: 'buyer@example.test' } },
    },
  };
}

// The placeholder vendor format, carrying the kind of data that must never reach a log.
const SELFIE_DETAILS = ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ', '23.4'];
function vendorEvent(session: string, at = new Date(), id = randomUUID()) {
  return {
    event_id: id,
    type: 'session.completed',
    session_id: session,
    occurred_at: at.toISOString(),
    result: { estimated_age: 23.4, selfie: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ' },
  };
}

async function signVendor(
  body: string,
  secret = VENDOR_SECRET,
  atMs = Date.now(),
): Promise<string> {
  const t = Math.floor(atMs / 1000);
  return `t=${t},v1=${await hmacSha256Hex(secret, new TextEncoder().encode(`${t}.${body}`))}`;
}

// The pipeline, with logs captured ---------------------------------------------------------------
const logs: LogEntry[] = [];
const rcHandler = createWebhookHandler(revenueCat(RC_AUTH), {
  record: databaseRecorder(server),
  log: (entry) => logs.push(entry),
});
const vendorHandler = createWebhookHandler(ageCheck(VENDOR_SECRET), {
  record: databaseRecorder(server),
  log: (entry) => logs.push(entry),
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://local/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function eventRows(provider: string, subject: string) {
  const rows = await db`
    select e.provider_event_id, e.status,
           (select count(*)::int from public.audit_log a
             where a.subject_type = 'webhook_event' and a.subject_id = e.id) as audits
    from public.webhook_events e
    where e.provider = ${provider} and e.subject = ${subject}
    order by e.received_at`;
  return Array.from(rows);
}

describe('webhook contract', () => {
  before(() => {
    logs.length = 0;
  });
  after(async () => {
    // Recorded events and their audit entries stay: the audit log is append-only by design.
    await db.end();
  });

  describe('proving the sender', () => {
    it('an unsigned RevenueCat callback is refused and changes nothing', async () => {
      const subject = `member-${randomUUID()}`;
      const res = await rcHandler(post(revenueCatEvent(subject)));
      assert.equal(res.status, 401);
      assert.deepEqual(await eventRows('revenuecat', subject), []);
    });

    it('a wrong RevenueCat secret is refused and changes nothing', async () => {
      const subject = `member-${randomUUID()}`;
      const res = await rcHandler(post(revenueCatEvent(subject), { Authorization: `${RC_AUTH}x` }));
      assert.equal(res.status, 401);
      assert.deepEqual(await eventRows('revenuecat', subject), []);
    });

    it("a member's own sign-in token is not proof", async () => {
      const subject = `member-${randomUUID()}`;
      const email = `webhook-test-${randomUUID()}@example.test`;
      const password = randomUUID();
      const { data: created } = await server.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      const member = createClient(API_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: session } = await member.auth.signInWithPassword({ email, password });
      const res = await rcHandler(
        post(revenueCatEvent(subject), {
          Authorization: `Bearer ${session.session!.access_token}`,
        }),
      );
      assert.equal(res.status, 401);
      // Nor can the member hand an event to the database themselves.
      const { error } = await member.rpc('receive_webhook_event', {
        p_provider: 'revenuecat',
        p_event_id: randomUUID(),
        p_event_type: 'INITIAL_PURCHASE',
        p_subject: subject,
        p_occurred_at: new Date().toISOString(),
        p_payload_hash: 'a'.repeat(64),
      });
      assert.ok(error);
      assert.deepEqual(await eventRows('revenuecat', subject), []);
      await server.auth.admin.deleteUser(created.user!.id);
    });

    it('an unsigned, badly signed, tampered or old vendor callback is refused', async () => {
      const session = `session-${randomUUID()}`;
      const body = JSON.stringify(vendorEvent(session));
      const tampered = body.replace('session.completed', 'session.passed');
      const cases: [string, Record<string, string>][] = [
        ['unsigned', {}],
        ['wrong secret', { 'X-Signature': await signVendor(body, `${VENDOR_SECRET}x`) }],
        ['tampered body', { 'X-Signature': await signVendor(body) }],
        [
          'too old',
          {
            'X-Signature': await signVendor(
              body,
              VENDOR_SECRET,
              Date.now() - SIGNATURE_TOLERANCE_MS - 60_000,
            ),
          },
        ],
        ['garbled header', { 'X-Signature': 't=abc,v1=zz' }],
      ];
      for (const [name, headers] of cases) {
        const res = await vendorHandler(post(name === 'tampered body' ? tampered : body, headers));
        assert.equal(res.status, 401, name);
      }
      assert.deepEqual(await eventRows('age_check', session), []);
    });

    it('a vendor signature made with a rotated-in second secret is accepted alongside the old one', async () => {
      const session = `session-${randomUUID()}`;
      const body = JSON.stringify(vendorEvent(session));
      const t = Math.floor(Date.now() / 1000);
      const good = await hmacSha256Hex(VENDOR_SECRET, new TextEncoder().encode(`${t}.${body}`));
      const res = await vendorHandler(
        post(body, { 'X-Signature': `t=${t},v1=${'0'.repeat(64)},v1=${good}` }),
      );
      assert.equal(res.status, 200);
    });

    it('secrets that are missing or too short stop the function from starting', () => {
      assert.throws(() => revenueCat(undefined));
      assert.throws(() => revenueCat('short'));
      assert.throws(() => ageCheck(''));
    });

    it('compares secrets without stopping at the first difference', () => {
      assert.equal(timingSafeEqual('abc', 'abc'), true);
      assert.equal(timingSafeEqual('abc', 'abd'), false);
      assert.equal(timingSafeEqual('abc', 'abcd'), false);
      assert.equal(timingSafeEqual('', ''), true);
    });
  });

  describe('recording each event once', () => {
    it('a replayed RevenueCat event makes one state change and one audit entry', async () => {
      const subject = `member-${randomUUID()}`;
      const event = revenueCatEvent(subject);
      for (let i = 0; i < 3; i++) {
        const res = await rcHandler(post(event, { Authorization: RC_AUTH }));
        assert.equal(res.status, 200);
      }
      const rows = await eventRows('revenuecat', subject);
      assert.deepEqual(
        rows.map((r) => [r.status, r.audits]),
        [['processed', 1]],
      );
    });

    it('ten copies of one vendor event delivered at once are recorded once', async () => {
      const session = `session-${randomUUID()}`;
      const body = JSON.stringify(vendorEvent(session));
      const signature = await signVendor(body);
      const statuses = await Promise.all(
        Array.from({ length: 10 }, () =>
          vendorHandler(post(body, { 'X-Signature': signature })).then((r) => r.status),
        ),
      );
      assert.deepEqual(new Set(statuses), new Set([200]));
      const rows = await eventRows('age_check', session);
      assert.deepEqual(
        rows.map((r) => [r.status, r.audits]),
        [['processed', 1]],
      );
    });
  });

  describe('old and out-of-order events', () => {
    it('an event older than one already applied is not applied and asks for a state check', async () => {
      const subject = `member-${randomUUID()}`;
      const newer = revenueCatEvent(subject, Date.now() - 60_000);
      const older = revenueCatEvent(subject, Date.now() - 30 * 60_000);
      assert.equal((await rcHandler(post(newer, { Authorization: RC_AUTH }))).status, 200);
      assert.equal((await rcHandler(post(older, { Authorization: RC_AUTH }))).status, 200);
      const rows = await eventRows('revenuecat', subject);
      assert.deepEqual(
        rows.map((r) => [r.provider_event_id, r.status]),
        [
          [newer.event.id, 'processed'],
          [older.event.id, 'superseded'],
        ],
      );
      const [request] = await db`
        select reason from private.webhook_reconcile_requests
        where provider = 'revenuecat' and subject = ${subject}`;
      assert.equal(request?.reason, 'out_of_order');
    });

    it('an event more than a day old is not applied and asks for a state check', async () => {
      const subject = `member-${randomUUID()}`;
      const res = await rcHandler(
        post(revenueCatEvent(subject, Date.now() - 2 * 86_400_000), { Authorization: RC_AUTH }),
      );
      assert.equal(res.status, 200);
      assert.deepEqual(
        (await eventRows('revenuecat', subject)).map((r) => r.status),
        ['stale'],
      );
      const [request] = await db`
        select reason from private.webhook_reconcile_requests
        where provider = 'revenuecat' and subject = ${subject}`;
      assert.equal(request?.reason, 'stale');
    });

    it('an event dated in the future is refused as invalid, so it is not retried forever', async () => {
      const subject = `member-${randomUUID()}`;
      const res = await rcHandler(
        post(revenueCatEvent(subject, Date.now() + 3_600_000), { Authorization: RC_AUTH }),
      );
      assert.equal(res.status, 422);
      assert.deepEqual(await eventRows('revenuecat', subject), []);
    });
  });

  describe('bad requests', () => {
    it('refuses anything but POST, oversized bodies and bodies that are not events', async () => {
      const get = await rcHandler(new Request('http://local/webhook', { method: 'GET' }));
      assert.equal(get.status, 405);
      const big = await rcHandler(post('x'.repeat(MAX_BODY_BYTES + 1), { Authorization: RC_AUTH }));
      assert.equal(big.status, 413);
      const notJson = await rcHandler(post('not json', { Authorization: RC_AUTH }));
      assert.equal(notJson.status, 422);
      const noId = await rcHandler(
        post({ event: { type: 'RENEWAL' } }, { Authorization: RC_AUTH }),
      );
      assert.equal(noId.status, 422);
    });

    it('a database failure is a 500 so the provider retries, and nothing is recorded', async () => {
      const failing: ProviderSettings = revenueCat(RC_AUTH);
      const handler = createWebhookHandler(failing, {
        record: async () => {
          throw new Error('connection lost: password=hunter2');
        },
        log: (entry) => logs.push(entry),
      });
      const subject = `member-${randomUUID()}`;
      const res = await handler(post(revenueCatEvent(subject), { Authorization: RC_AUTH }));
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { code: 'SERVER_ERROR' });
    });
  });

  describe('logs', () => {
    it('never contain payment details, the selfie or the body', () => {
      assert.ok(logs.length > 20, 'the tests above produced log lines');
      const written = JSON.stringify(logs);
      for (const secret of [
        ...PAYMENT_DETAILS,
        ...SELFIE_DETAILS,
        'hunter2',
        RC_AUTH,
        VENDOR_SECRET,
      ]) {
        assert.ok(!written.includes(secret), `a log line contains ${secret}`);
      }
      for (const entry of logs) {
        assert.deepEqual(
          Object.keys(entry).filter((k) => !['provider', 'outcome', 'ref'].includes(k)),
          [],
        );
        if (entry.ref) assert.match(entry.ref, /^[0-9a-f]{12}$/);
      }
    });

    it('nor does the database: it keeps a fingerprint of the body, not the body', async () => {
      const columns = await db`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'webhook_events'`;
      assert.deepEqual(columns.map((c) => c.column_name).sort(), [
        'error_code',
        'event_type',
        'id',
        'occurred_at',
        'payload_hash',
        'processed_at',
        'provider',
        'provider_event_id',
        'received_at',
        'status',
        'subject',
      ]);
    });
  });

  describe('the served Edge Functions', () => {
    let served = false;
    before(async () => {
      const probe = await fetch(`${API_URL}/functions/v1/revenuecat-webhook`, {
        method: 'POST',
      }).catch(() => null);
      served = probe?.status === 401 && 'REVENUECAT_WEBHOOK_AUTH' in secrets;
    });

    it('revenuecat-webhook refuses a wrong secret and records a signed event once', async (t) => {
      if (!served)
        return t.skip('Edge Functions are not being served with supabase/functions/.env');
      const subject = `member-${randomUUID()}`;
      const event = JSON.stringify(revenueCatEvent(subject));
      const call = (auth: string) =>
        fetch(`${API_URL}/functions/v1/revenuecat-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: event,
        });
      assert.equal((await call(`Bearer ${PUBLISHABLE_KEY}`)).status, 401);
      assert.equal((await call(RC_AUTH)).status, 200);
      assert.equal((await call(RC_AUTH)).status, 200);
      assert.deepEqual(
        (await eventRows('revenuecat', subject)).map((r) => [r.status, r.audits]),
        [['processed', 1]],
      );
    });

    it('verification-webhook refuses an unsigned event and records a signed one once', async (t) => {
      if (!served)
        return t.skip('Edge Functions are not being served with supabase/functions/.env');
      const session = `session-${randomUUID()}`;
      const body = JSON.stringify(vendorEvent(session));
      const call = (headers: Record<string, string>) =>
        fetch(`${API_URL}/functions/v1/verification-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body,
        });
      assert.equal((await call({})).status, 401);
      const signature = await signVendor(body);
      assert.equal((await call({ 'X-Signature': signature })).status, 200);
      assert.equal((await call({ 'X-Signature': signature })).status, 200);
      assert.deepEqual(
        (await eventRows('age_check', session)).map((r) => [r.status, r.audits]),
        [['processed', 1]],
      );
    });
  });
});
