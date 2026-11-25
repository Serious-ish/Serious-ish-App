import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

import { env } from '@/config/env';

import { isKnownCode } from './errorCatalog';
import { reportUnknownCode } from './sentry';
import { markClockStale, noteDateHeader, noteServerTime } from './serverClock';

// The one door to the server (Frontend Specification 8.3, 8.4 and 9.2). Screens never call the
// network; each feature's api/ folder calls rpc() or edge() with a Zod schema for the reply and
// gets typed data back, or an ApiError. The error carries a fixed code and the status only,
// never the server's own text, so raw messages, stack traces and secrets cannot reach a screen.
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null,
    readonly retryAfter: number | null = null,
    readonly ref: string | null = null,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

// Sign-in (FT-013) plugs the member's session in here. Until then calls go out without one.
type Session = { accessToken: () => string | null; refresh: () => Promise<boolean> };
let session: Session = { accessToken: () => null, refresh: async () => false };
export const setSession = (next: Session) => {
  session = next;
};

export const appVersion = Constants.expoConfig?.version ?? '0';

const TIMEOUT_MS = 15_000; // 30_000 for photo uploads (9.2)
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
// A longer wait than this is shown to the person (G03) rather than waited out.
const MAX_WAIT_S = 10;

type CallOptions<T> = {
  schema: z.ZodType<T>;
  // Reads retry after server and network failures. A write retries only when it carries the
  // client_request_id the person's action created, so a repeat can never act twice (9.2).
  kind: 'read' | 'write';
  requestId?: string;
  timeoutMs?: number;
};

// A database function through Supabase REST (PostgREST).
export const rpc = <T>(name: string, args: object, options: CallOptions<T>) =>
  call(`/rest/v1/rpc/${name}`, args, options);

// An Edge Function.
export const edge = <T>(name: string, body: object, options: CallOptions<T>) =>
  call(`/functions/v1/${name}`, body, options);

// One ID per tap or message, made when the person acts and passed as requestId on every retry
// of that action, so the server acts on it once (FT-006; TRD 5 "Matching and chat").
export const newRequestId = (): string => randomUUID();

// Sets the server clock to the millisecond (FT-006). Every reply already keeps it right to
// about a second; screens that count down to a deadline call this when they open.
export async function syncServerClock(): Promise<void> {
  const sentAt = performance.now();
  const time = await rpc('server_time', {}, { schema: z.string(), kind: 'read' });
  // Postgres gives microseconds; keep milliseconds, which every JavaScript engine parses.
  noteServerTime(Date.parse(time.replace(/(\.\d{3})\d+/, '$1')), 1, sentAt, performance.now());
}

// A read straight from a table, protected by row-level security (9.4), e.g.
// read('members', 'select=status', schema).
export const read = <T>(table: string, query: string, schema: z.ZodType<T>) =>
  call(`/rest/v1/${table}?${query}`, null, { schema, kind: 'read' });

async function call<T>(path: string, args: object | null, options: CallOptions<T>): Promise<T> {
  const body = args && options.requestId ? { ...args, client_request_id: options.requestId } : args;
  const retries = options.kind === 'read' || options.requestId ? RETRY_DELAYS_MS : [];
  let refreshed = false;
  let waited = false;
  let attempt = 0;

  for (;;) {
    try {
      return await send(path, body, options);
    } catch (thrown) {
      const error = thrown as ApiError;
      // 401: refresh the session once, then ask the person to sign in again (A15).
      if (error.status === 401 && !refreshed) {
        refreshed = true;
        if (await session.refresh()) continue;
      } else if (error.status === 429 && !waited && (error.retryAfter ?? Infinity) <= MAX_WAIT_S) {
        waited = true;
        await sleep((error.retryAfter ?? 0) * 1_000);
        continue;
      } else if (transient(error) && attempt < retries.length) {
        await sleep(retries[attempt++] ?? 0);
        continue;
      }
      if (error.code && !isKnownCode(error.code)) reportUnknownCode(error);
      throw error;
    }
  }
}

const transient = (error: ApiError) =>
  error.code === 'OFFLINE' || error.code === 'TIMEOUT' || (error.status ?? 0) >= 500;

async function send<T>(path: string, body: object | null, options: CallOptions<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  const token = session.accessToken();
  const sentAt = performance.now();
  try {
    const res = await fetch(env.supabaseUrl + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        apikey: env.supabasePublishableKey,
        'Content-Type': 'application/json',
        'x-app-version': appVersion,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body && { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    noteDateHeader(res.headers.get('date'), sentAt, performance.now());
    const ref = res.headers.get('sb-request-id') ?? res.headers.get('x-request-id');
    const reply: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(fixedCode(reply), res.status, retryAfter(res), ref);
    const parsed = options.schema.safeParse(reply);
    if (!parsed.success) throw new ApiError('BAD_REPLY', res.status, null, ref);
    return parsed.data;
  } catch (thrown) {
    if (thrown instanceof ApiError) throw thrown;
    // No reply: the connection may have dropped, so the next reply resets the server clock.
    markClockStale();
    throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'OFFLINE', null);
  } finally {
    clearTimeout(timer);
  }
}

// Edge Functions reply { code: 'NOT_ALLOWED' }. Database functions raise the code as the message
// ({ code: 'PT409', message: 'POSITION_TAKEN' }). Anything else (Postgres or PostgREST text,
// numbered codes such as 23505 or PGRST116) is not one of ours and is dropped.
const FIXED = /^[A-Z]+(?:_[A-Z]+)*$/;
function fixedCode(reply: unknown): string {
  if (typeof reply !== 'object' || reply === null) return '';
  const { code, message } = reply as { code?: unknown; message?: unknown };
  for (const candidate of [code, message]) {
    if (typeof candidate === 'string' && FIXED.test(candidate)) return candidate;
  }
  return '';
}

function retryAfter(res: Response): number | null {
  const seconds = Number(res.headers.get('retry-after'));
  return res.headers.has('retry-after') && Number.isFinite(seconds) ? seconds : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
