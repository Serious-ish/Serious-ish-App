// tsx lets the config import TypeScript from the token package (Expo SDK 58 TypeScript guide).
import 'tsx/cjs';

import { photo } from '@serious-ish/design-tokens';
import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

const appEnv = (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as AppEnv;

const nameSuffix: Record<AppEnv, string> = {
  development: ' (Dev)',
  staging: ' (Staging)',
  production: '',
};

// iOS bundle ID and Android package name (TRD-10). Android does not allow hyphens, so the
// serious-ish.com domain becomes "seriousish". Development and staging get their own IDs so
// all three builds can sit side by side on one phone. The production ID cannot change after
// the first store release.
const appId: Record<AppEnv, string> = {
  development: 'com.seriousish.app.dev',
  staging: 'com.seriousish.app.staging',
  production: 'com.seriousish.app',
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Serious-ish${nameSuffix[appEnv]}`,
  owner: 'serious-ish',
  slug: 'serious-ish',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'seriousish',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: appId[appEnv],
    supportsTablet: false,
  },
  android: {
    package: appId[appEnv],
    adaptiveIcon: {
      // Splash red, identical in light and dark.
      backgroundColor: photo.splashRed,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    [
      'expo-splash-screen',
      {
        backgroundColor: photo.splashRed,
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appEnv,
    eas: {
      // Expo project @serious-ish/serious-ish. Not a secret.
      projectId: '2e463244-17f9-4712-af89-9f989dcf7464',
    },
  },
});
