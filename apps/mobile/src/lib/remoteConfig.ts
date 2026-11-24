import { z } from 'zod';

import { read } from './api';

// Remote config (Frontend Specification 8.3): non-secret switches read from app_config at launch
// and every 10 minutes. Members may read only the allow-listed keys (Security & Access 04).
export const CONFIG_REFRESH_MS = 10 * 60_000;

export type RemoteConfig = { minAppVersion: string | null; maintenance: boolean };

// Signed out, or before the first read: nothing blocks. The server still refuses an old app on
// every call (G06).
export const openConfig: RemoteConfig = { minAppVersion: null, maintenance: false };

const rows = z.array(z.object({ key: z.string(), value_json: z.unknown() }));

export function toConfig(list: z.infer<typeof rows>): RemoteConfig {
  const value = (key: string) => list.find((row) => row.key === key)?.value_json;
  const min = value('min_app_version');
  return {
    minAppVersion: typeof min === 'string' ? min : null,
    maintenance: value('maintenance_mode') === true,
  };
}

export const readConfig = async () =>
  toConfig(await read('app_config', 'select=key,value_json', rows));

// Compares dotted versions such as 1.4.0, number by number. A missing part counts as 0.
export function isBelowMinimum(version: string, minimum: string | null): boolean {
  if (!minimum) return false;
  const a = version.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}
