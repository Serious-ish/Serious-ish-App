#!/usr/bin/env node
// Fails if any EXPO_PUBLIC_ or NEXT_PUBLIC_ variable is used that is not on the approved
// public list (TRD 7.2 and 7.5). Anything with one of these prefixes is shipped to every
// phone or browser, so a new one must be reviewed and added here and to the README.
//
// Usage: node scripts/check-public-env.mjs [directory]   (defaults to the repository root)

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const APPROVED_PUBLIC_VARIABLES = new Set([
  // Mobile app (TRD 7.2)
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_SENTRY_DSN',
  // Moderation page (TRD 7.5)
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
]);

const PUBLIC_NAME = /\b(?:EXPO|NEXT)_PUBLIC_[A-Z0-9_]+/g;
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.expo', 'dist', 'coverage']);
const SKIP_FILES = new Set(['pnpm-lock.yaml']);
const BINARY = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|zip|gz|pdf)$/i;

function listFiles(root) {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    // Only trust git's list when root is the top of a repository.
    if (prefix === '') return out.split('\n').filter(Boolean);
  } catch {
    // Not a git repository: fall back to walking the directory.
  }
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(relative(root, full));
    }
  };
  walk(root);
  return files;
}

export function findUnapprovedPublicVariables(root) {
  const problems = [];
  for (const file of listFiles(root)) {
    const base = file.split('/').pop();
    if (SKIP_FILES.has(base) || BINARY.test(file)) continue;
    let text;
    try {
      text = readFileSync(join(root, file), 'utf8');
    } catch {
      continue;
    }
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(PUBLIC_NAME)) {
        if (!APPROVED_PUBLIC_VARIABLES.has(match[0])) {
          problems.push(`${file}:${index + 1}  ${match[0]}`);
        }
      }
    });
  }
  return problems;
}

const root = process.argv[2] ?? process.cwd();
const problems = findUnapprovedPublicVariables(root);

if (problems.length > 0) {
  console.error('Unapproved public variables found. These are shipped to every phone or browser:');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nIf the value is genuinely public, add it to APPROVED_PUBLIC_VARIABLES in this script and to the README.' +
      '\nIf it is a secret, move it to Edge Function secrets and call it through an Edge Function.',
  );
  process.exit(1);
}

console.log('Public variable check passed.');
