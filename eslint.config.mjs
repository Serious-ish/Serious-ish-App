// Root ESLint config: covers packages/* and scripts/.
// Each app has its own config (apps/mobile uses Expo's, apps/moderation uses Next.js's).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'apps/**',
      'supabase/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
