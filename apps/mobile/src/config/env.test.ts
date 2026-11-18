import { parseEnv } from './env';

const blank = {
  appEnv: undefined,
  supabaseUrl: undefined,
  supabasePublishableKey: undefined,
  revenueCatIosKey: undefined,
  revenueCatAndroidKey: undefined,
  posthogKey: undefined,
  posthogHost: undefined,
  sentryDsn: undefined,
};

describe('parseEnv', () => {
  it('defaults to development when no environment is set', () => {
    expect(parseEnv(blank).appEnv).toBe('development');
  });

  it.each(['development', 'staging', 'production'])('accepts %s', (appEnv) => {
    expect(parseEnv({ ...blank, appEnv }).appEnv).toBe(appEnv);
  });

  it('rejects an unknown environment', () => {
    expect(() => parseEnv({ ...blank, appEnv: 'prod' })).toThrow('EXPO_PUBLIC_APP_ENV');
  });
});
