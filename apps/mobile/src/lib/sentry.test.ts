import * as Sentry from '@sentry/react-native';

import { initSentry, scrub } from './sentry';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));

// Frontend Specification 9.17: nothing personal leaves the phone.
describe('scrub', () => {
  it('removes user details, request bodies, headers, cookies and query strings', () => {
    const event = scrub({
      type: undefined,
      user: { id: 'member-1', email: 'maya@example.com', ip_address: '1.2.3.4' },
      request: {
        url: 'https://x.supabase.co/rest/v1/rpc/swipe?access_token=secret',
        method: 'POST',
        data: { message: 'hello' },
        headers: { Authorization: 'Bearer secret' },
        cookies: { session: 'secret' },
        query_string: 'access_token=secret',
      },
      breadcrumbs: [
        { category: 'fetch', data: { url: 'https://x.supabase.co/a?token=secret', body: 'hi' } },
        { category: 'navigation', message: 'opened chat' },
      ],
    });
    const sent = JSON.stringify(event);
    for (const text of ['member-1', 'maya@', '1.2.3.4', 'hello', 'secret', 'hi"']) {
      expect(sent).not.toContain(text);
    }
    expect(event.request).toEqual({
      url: 'https://x.supabase.co/rest/v1/rpc/swipe',
      method: 'POST',
    });
    expect(event.breadcrumbs?.[0]).toEqual({
      category: 'fetch',
      data: { url: 'https://x.supabase.co/a' },
    });
    expect(event.breadcrumbs?.[1]).toEqual({ category: 'navigation', message: 'opened chat' });
  });
});

it('stays off without a DSN (development)', () => {
  initSentry();
  expect(Sentry.init).not.toHaveBeenCalled();
});
