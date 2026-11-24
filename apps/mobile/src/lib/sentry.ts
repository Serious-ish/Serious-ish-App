import * as Sentry from '@sentry/react-native';

import { env } from '@/config/env';

import type { ApiError } from './api';

// Frontend Specification 9.17: personal content is stripped before anything leaves the phone.
// FT-012 adds the crash screen, PostHog, source maps and the rest of the reporting set-up.
export function initSentry() {
  // No DSN (development) means no reporting.
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: scrub,
  });
}

const withoutQuery = (url: unknown) => (typeof url === 'string' ? url.split('?')[0] : undefined);

// Drops user details, request bodies, headers, cookies and query strings (which can carry tokens),
// from the event and from its breadcrumbs.
export function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  delete event.user;
  if (event.request) {
    event.request = { url: withoutQuery(event.request.url), method: event.request.method };
  }
  event.breadcrumbs = event.breadcrumbs?.map(({ data, ...crumb }) => ({
    ...crumb,
    ...(data?.url !== undefined && { data: { url: withoutQuery(data.url) } }),
  }));
  return event;
}

// 8.4: a server code with no catalogue entry is reported once. The code and status are fixed
// values from our own server, never personal data.
export function reportUnknownCode(error: ApiError) {
  Sentry.captureMessage('Unknown error code', {
    level: 'error',
    tags: { code: error.code, status: String(error.status) },
    contexts: { api: { ref: error.ref } },
  });
}
