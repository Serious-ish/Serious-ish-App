import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

import { noRawColours } from '../../eslint.config.mjs';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  noRawColours,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
