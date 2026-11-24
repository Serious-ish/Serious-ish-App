import * as Sentry from '@sentry/react-native';
import { z } from 'zod';

import { ApiError, edge, rpc, setSession } from './api';
import { describeError } from './errorCatalog';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));

// Frontend Specification 8.4 (the status table) and 9.2 (timeouts and retries), with mocked replies.

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };
const reply = ({ status, body = null, headers = {} }: Reply) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (k: string) => headers[k.toLowerCase()] ?? null,
    has: (k: string) => k.toLowerCase() in headers,
  },
  json: async () => body,
});

const fetchMock = jest.fn();
const ok = z.object({ ok: z.boolean() });
const read = { schema: ok, kind: 'read' } as const;
const write = { schema: ok, kind: 'write' } as const;

// Runs a call to the end, letting retry and timeout timers run.
async function settle<T>(promise: Promise<T>): Promise<T | ApiError> {
  const result = promise.catch((e: unknown) => e as ApiError);
  for (let i = 0; i < 20; i++) await jest.advanceTimersByTimeAsync(20_000);
  return result;
}

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  setSession({ accessToken: () => null, refresh: async () => false });
  jest.mocked(Sentry.captureMessage).mockClear();
});
afterEach(() => jest.useRealTimers());

it('returns the typed reply and sends the 9.2 headers', async () => {
  setSession({ accessToken: () => 'token', refresh: async () => false });
  fetchMock.mockResolvedValue(reply({ status: 200, body: { ok: true } }));
  await expect(rpc('get_profile', {}, read)).resolves.toEqual({ ok: true });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/rest\/v1\/rpc\/get_profile$/);
  expect(init.headers).toMatchObject({
    'Content-Type': 'application/json',
    Authorization: 'Bearer token',
  });
  expect(init.headers).toHaveProperty('apikey');
  expect(init.headers).toHaveProperty('x-app-version');
});

it('a reply that does not match the schema is BAD_REPLY, shown as G02', async () => {
  fetchMock.mockResolvedValue(reply({ status: 200, body: { unexpected: 1 } }));
  const error = await settle(rpc('get_profile', {}, write));
  expect(error).toMatchObject({ code: 'BAD_REPLY' });
  expect(describeError(error as ApiError)).toMatchObject({ id: 'G02', show: 'screen' });
});

describe('the status table (8.4)', () => {
  it('401: refreshes the session once and retries', async () => {
    const refresh = jest.fn(async () => true);
    setSession({ accessToken: () => 'token', refresh });
    fetchMock
      .mockResolvedValueOnce(reply({ status: 401, body: { code: 'NOT_ALLOWED' } }))
      .mockResolvedValueOnce(reply({ status: 200, body: { ok: true } }));
    await expect(settle(edge('photo-links', {}, read))).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('401: if the refresh fails, asks the person to sign in again (A15)', async () => {
    fetchMock.mockResolvedValue(reply({ status: 401, body: { code: 'NOT_ALLOWED' } }));
    const error = (await settle(edge('photo-links', {}, read))) as ApiError;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(describeError(error)).toMatchObject({ id: 'A15', show: 'dialog' });
  });

  it.each([
    [403, { code: 'PT403', message: 'NOT_ALLOWED' }, 'G04'],
    [404, { code: 'PT404', message: 'NOT_AVAILABLE' }, 'G05'],
    [404, null, 'G05'],
    [409, { code: 'PT409', message: 'POSITION_TAKEN' }, 'P09'],
    [409, { code: 'PT409', message: 'MIN_PHOTOS' }, 'P08'],
    [410, null, 'M01'],
    [422, { code: 'PT422', message: 'TOO_MANY_PHOTOS' }, 'P04'],
    [422, { code: 'INVALID_REQUEST' }, 'G02'],
  ])('%i %j shows %s and is not retried', async (status, body, id) => {
    fetchMock.mockResolvedValue(reply({ status, body }));
    const error = (await settle(rpc('add_photo', {}, read))) as ApiError;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(describeError(error).id).toBe(id);
  });

  it('429: waits for the retry-after time, then tries once more', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ status: 429, headers: { 'retry-after': '2' } }))
      .mockResolvedValueOnce(reply({ status: 200, body: { ok: true } }));
    const result = rpc('swipe', {}, write);
    await jest.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(settle(result)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429: a long wait is shown as G03 with the time to wait', async () => {
    fetchMock.mockResolvedValue(reply({ status: 429, headers: { 'retry-after': '120' } }));
    const error = (await settle(rpc('swipe', {}, write))) as ApiError;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(describeError(error)).toMatchObject({ id: 'G03', show: 'banner', retryAfter: 120 });
  });

  it('5xx: a read retries after 1, 3 and 8 seconds, then shows G02', async () => {
    fetchMock.mockResolvedValue(reply({ status: 503 }));
    const result = rpc('get_feed', {}, read);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(8_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(describeError((await settle(result)) as ApiError)).toMatchObject({
      id: 'G02',
      show: 'screen',
    });
  });

  it('5xx: a write without a request ID is never retried', async () => {
    fetchMock.mockResolvedValue(reply({ status: 500 }));
    await settle(rpc('report_member', {}, write));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('5xx: a write retries only with the same client_request_id', async () => {
    fetchMock.mockResolvedValue(reply({ status: 500 }));
    await settle(rpc('swipe', { target: 'x' }, { ...write, requestId: 'req-1' }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.parse(init.body)).toEqual({ target: 'x', client_request_id: 'req-1' });
    }
  });

  it('a timeout after 15 seconds shows G02', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const result = rpc('report_member', {}, write);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(
      await Promise.race([
        result.then(
          () => 'done',
          () => 'done',
        ),
        Promise.resolve('pending'),
      ]),
    ).toBe('pending');
    const error = (await settle(result)) as ApiError;
    expect(error.code).toBe('TIMEOUT');
    expect(describeError(error).id).toBe('G02');
  });

  it('no connection shows G01', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const error = (await settle(rpc('report_member', {}, write))) as ApiError;
    expect(describeError(error)).toMatchObject({ id: 'G01', show: 'banner' });
  });
});

describe('what reaches the screen', () => {
  it('never carries the server’s own text, stack traces or secrets', async () => {
    const leak = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "members_phone_key"',
      details: 'Key (phone)=(+14165550123) already exists. at exec (/srv/db.js:12:3)',
      hint: 'service_role eyJhbGciOiJIUzI1NiJ9.secret',
    };
    fetchMock.mockResolvedValue(reply({ status: 409, body: leak }));
    const error = (await settle(rpc('add_member', {}, write))) as ApiError;
    const view = describeError(error);
    const seen = JSON.stringify({ error, message: error.message, view });
    for (const text of ['duplicate', '+14165550123', 'srv', 'eyJ', 'service_role', '23505']) {
      expect(seen).not.toContain(text);
    }
    expect(view).toMatchObject({
      id: 'G02',
      message: 'Something went wrong on our side. Try again.',
    });
  });

  it('an unknown code shows the general error (G08) and sends one Sentry event', async () => {
    fetchMock.mockResolvedValue(reply({ status: 503, body: { code: 'BRAND_NEW_CODE' } }));
    const error = (await settle(rpc('get_feed', {}, read))) as ApiError;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(describeError(error)).toMatchObject({ id: 'G08', show: 'screen' });
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Unknown error code', {
      level: 'error',
      tags: { code: 'BRAND_NEW_CODE', status: '503' },
      contexts: { api: { ref: null } },
    });
  });

  it('a known code sends nothing to Sentry', async () => {
    fetchMock.mockResolvedValue(
      reply({ status: 409, body: { code: 'PT409', message: 'POSITION_TAKEN' } }),
    );
    await settle(rpc('add_photo', {}, write));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
