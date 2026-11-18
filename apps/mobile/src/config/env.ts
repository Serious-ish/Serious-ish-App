/**
 * The ONLY file in the mobile app that reads environment values (TRD 3.1).
 *
 * Every value here starts with EXPO_PUBLIC_, is baked into the app and can be read by
 * anyone who downloads it. Only public values belong here; secrets live in Edge Function
 * secrets and are reached through an Edge Function.
 *
 * Expo inlines EXPO_PUBLIC_ values only when they are read as `process.env.NAME`
 * literally, so each one is listed by name below.
 */

export type AppEnv = 'development' | 'staging' | 'production';

export interface PublicEnv {
  appEnv: AppEnv;
  supabaseUrl: string;
  supabasePublishableKey: string;
  revenueCatIosKey: string;
  revenueCatAndroidKey: string;
  posthogKey: string;
  posthogHost: string;
  sentryDsn: string;
}

type RawEnv = Record<keyof PublicEnv, string | undefined>;

const APP_ENVS: readonly AppEnv[] = ['development', 'staging', 'production'];

export function parseEnv(raw: RawEnv): PublicEnv {
  const appEnv = raw.appEnv ?? 'development';
  if (!APP_ENVS.includes(appEnv as AppEnv)) {
    throw new Error(`EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')}`);
  }

  return {
    appEnv: appEnv as AppEnv,
    supabaseUrl: raw.supabaseUrl ?? '',
    supabasePublishableKey: raw.supabasePublishableKey ?? '',
    revenueCatIosKey: raw.revenueCatIosKey ?? '',
    revenueCatAndroidKey: raw.revenueCatAndroidKey ?? '',
    posthogKey: raw.posthogKey ?? '',
    posthogHost: raw.posthogHost ?? '',
    sentryDsn: raw.sentryDsn ?? '',
  };
}

export const env: PublicEnv = parseEnv({
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
});
