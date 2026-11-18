// Root ESLint config: covers packages/* and scripts/.
// Each app has its own config (apps/mobile uses Expo's, apps/moderation uses Next.js's).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Colour values live only in packages/design-tokens (TRD 3.2, Frontend Specification 8.1).
// Each app's config applies this too. Tests may spell out expected values.
const rawColour = '/#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(/';
const message = 'Colour values live only in packages/design-tokens/palette.ts. Use a token.';
export const noRawColours = {
  ignores: ['packages/design-tokens/**', '**/*.test.*'],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: `Literal[value=${rawColour}]`, message },
      { selector: `TemplateElement[value.raw=${rawColour}]`, message },
    ],
  },
};

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
  noRawColours,
);
