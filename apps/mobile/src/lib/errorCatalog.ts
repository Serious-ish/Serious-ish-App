import { en, type ErrorId } from '@/i18n/en';

import type { ApiError } from './api';

// How an error is shown (Frontend Specification 8.4, Security 6.1): under the field, as a banner,
// as a full-screen state with one retry, or as a dialog that blocks until acted on. An error whose
// message is null is handled silently.
export type Show = 'inline' | 'banner' | 'screen' | 'dialog' | 'silent';

type Entry = { id: ErrorId; show: Exclude<Show, 'silent'> };

// Every fixed code the server sends, plus the app's own (OFFLINE, TIMEOUT, BAD_REPLY). A server
// code without an entry here fails the build (errorCatalog.test.ts), so a new database function or
// Edge Function adds its codes in the same pull request. 'status' lets the HTTP status decide.
export const catalog = {
  // The app's own codes
  OFFLINE: { id: 'G01', show: 'banner' },
  TIMEOUT: { id: 'G02', show: 'screen' },
  BAD_REPLY: { id: 'G02', show: 'screen' },

  // General
  NOT_ALLOWED: 'status',
  NOT_AVAILABLE: { id: 'G05', show: 'screen' },
  SERVER_ERROR: { id: 'G02', show: 'screen' },
  // Only a bug in the app can send these, so the person sees the general server message.
  INVALID_REQUEST: { id: 'G02', show: 'screen' },
  METHOD_NOT_ALLOWED: { id: 'G02', show: 'screen' },

  // Photos (FT-007)
  MIN_PHOTOS: { id: 'P08', show: 'banner' },
  POSITION_TAKEN: { id: 'P09', show: 'banner' },
  TOO_MANY_PHOTOS: { id: 'P04', show: 'banner' },
  INVALID_POSITION: { id: 'G02', show: 'banner' },
} as const satisfies Record<string, Entry | 'status'>;

export type ErrorCode = keyof typeof catalog;

export const isKnownCode = (code: string): code is ErrorCode => Object.hasOwn(catalog, code);

// 8.4: what each HTTP status shows when the code does not decide. 409 and 422 carry the
// feature's own code; without one they fall to the general server message.
function byStatus(status: number | null): Entry {
  switch (status) {
    case 401:
      return { id: 'A15', show: 'dialog' };
    case 403:
      return { id: 'G04', show: 'screen' };
    case 404:
      return { id: 'G05', show: 'screen' };
    case 410:
      return { id: 'M01', show: 'screen' };
    case 429:
      return { id: 'G03', show: 'banner' };
    default:
      return { id: 'G02', show: 'screen' };
  }
}

// A code the catalogue does not know shows the general error; api.ts reports it to Sentry.
const unknown: Entry = { id: 'G08', show: 'screen' };

export type ErrorView = {
  id: ErrorId;
  message: string | null;
  show: Show;
  retryAfter: number | null;
};

// The only thing a screen asks about an error: its message and the component to show it in.
export function describeError(error: ApiError): ErrorView {
  const entry = isKnownCode(error.code) ? catalog[error.code] : error.code ? unknown : 'status';
  const { id, show } = entry === 'status' ? byStatus(error.status) : entry;
  const message = en.errors[id];
  return { id, message, show: message === null ? 'silent' : show, retryAfter: error.retryAfter };
}
