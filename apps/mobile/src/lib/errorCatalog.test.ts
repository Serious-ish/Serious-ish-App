/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { en } from '@/i18n/en';

import { catalog, isKnownCode } from './errorCatalog';

// The build gate (Frontend Specification 8.4, Security 9.2 gate 10): every fixed code the server
// can send has a catalogue entry, and every entry has a message.

const supabase = join(__dirname, '../../../../supabase');

const files = (dir: string, ext: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name), ext)
      : e.name.endsWith(ext)
        ? [join(dir, e.name)]
        : [],
  );

// Database functions: raise exception 'POSITION_TAKEN' using errcode = 'PT409'.
// Edge Functions: reply(409, { code: 'POSITION_TAKEN' }).
const CODE = '([A-Z]+(?:_[A-Z]+)*)';
const patterns: [string, string, RegExp][] = [
  [
    'migrations',
    '.sql',
    new RegExp(`(?:raise|RAISE)\\s+(?:exception|EXCEPTION)\\s+'${CODE}'`, 'g'),
  ],
  ['functions', '.ts', new RegExp(`\\bcode:\\s*'${CODE}'`, 'g')],
];

const serverCodes = new Set(
  patterns.flatMap(([dir, ext, re]) =>
    files(join(supabase, dir), ext)
      .filter((f) => !f.includes('.test.'))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(re)].map((m) => m[1]!)),
  ),
);

describe('error catalogue build gate', () => {
  it('finds the server codes', () => {
    expect(serverCodes.size).toBeGreaterThan(0);
  });

  it('has an entry for every code the server sends', () => {
    expect([...serverCodes].filter((code) => !isKnownCode(code))).toEqual([]);
  });

  it('has a message for every entry that is shown', () => {
    for (const entry of Object.values(catalog)) {
      if (entry !== 'status') expect(typeof en.errors[entry.id]).toBe('string');
    }
  });

  it('has a message for every status in the 8.4 table and for unknown codes', () => {
    for (const id of ['A15', 'G01', 'G02', 'G03', 'G04', 'G05', 'G08', 'M01'] as const) {
      expect(typeof en.errors[id]).toBe('string');
    }
  });
});

describe('message file (Security & Access v1.3, section 06)', () => {
  // The 90 error IDs, by family and count.
  const families = { A: 18, V: 10, P: 9, D: 8, M: 4, C: 8, B: 8, R: 9, E: 3, X: 5, G: 8 };

  it('holds exactly the 90 error IDs', () => {
    const expected = Object.entries(families).flatMap(([letter, count]) =>
      Array.from({ length: count }, (_, i) => `${letter}${String(i + 1).padStart(2, '0')}`),
    );
    expect(Object.keys(en.errors).sort()).toEqual(expected.sort());
  });

  it('gives each one a message, or null when it is handled silently', () => {
    for (const message of Object.values(en.errors)) {
      expect(message === null || (typeof message === 'string' && message.trim() !== '')).toBe(true);
    }
  });
});
