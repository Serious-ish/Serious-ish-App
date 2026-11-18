import { palette, type ColourToken, type ThemeMode } from '@serious-ish/design-tokens';

// WCAG 2.2 contrast ratio between two #RRGGBB colours.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

type Pair = [ColourToken, ColourToken];
// Frontend Specification v1.5, section 2.7: every allowed pairing, in both themes, with its
// minimum (4.5 for text, 3 for outlines and meaningful icons). Where a theme uses a different
// pairing (dark pressed and destructive button labels), the dark pair is given separately.
const pairings: { name: string; light: Pair; dark?: Pair; min: number }[] = [
  { name: 'Body text on page', light: ['ink', 'bg'], min: 4.5 },
  { name: 'Body text on raised surfaces', light: ['ink', 'raise'], min: 4.5 },
  { name: 'Body text on elevated fills', light: ['ink', 'elev'], min: 4.5 },
  { name: 'Body text on blush surface', light: ['ink', 'surf'], min: 4.5 },
  { name: 'Body text on skeleton', light: ['ink', 'skel'], min: 4.5 },
  { name: 'Muted text on page', light: ['muted', 'bg'], min: 4.5 },
  { name: 'Muted text on raised surfaces', light: ['muted', 'raise'], min: 4.5 },
  { name: 'Muted text on elevated fills', light: ['muted', 'elev'], min: 4.5 },
  { name: 'Red text and links on page', light: ['brandink', 'bg'], min: 4.5 },
  { name: 'Red text and links on raised surfaces', light: ['brandink', 'raise'], min: 4.5 },
  { name: 'Red text on elevated fills', light: ['brandink', 'elev'], min: 4.5 },
  { name: 'Label on brand button', light: ['onbrand', 'brand'], min: 4.5 },
  {
    name: 'Label on pressed brand button',
    light: ['onbrand', 'brandh'],
    dark: ['bg', 'brandh'],
    min: 4.5,
  },
  { name: 'Label on error button', light: ['onbrand', 'err'], dark: ['bg', 'err'], min: 4.5 },
  { name: 'Success text on page', light: ['okink', 'bg'], min: 4.5 },
  { name: 'Success text on elevated fills', light: ['okink', 'elev'], min: 4.5 },
  { name: 'Verified text on page', light: ['verink', 'bg'], min: 4.5 },
  { name: 'Verified text on elevated fills', light: ['verink', 'elev'], min: 4.5 },
  { name: 'Error text on page', light: ['err', 'bg'], min: 4.5 },
  { name: 'Form outline on page', light: ['muted', 'bg'], min: 3 },
  { name: 'Form outline on raised input', light: ['muted', 'raise'], min: 3 },
  { name: 'Focus ring on page', light: ['brand', 'bg'], min: 3 },
  { name: 'Focus ring on raised input', light: ['brand', 'raise'], min: 3 },
  { name: 'Verified badge fill on page', light: ['ver', 'bg'], min: 3 },
  { name: 'Success icon on page', light: ['ok', 'bg'], min: 3 },
];

const cases = pairings.flatMap((p) =>
  (['light', 'dark'] as ThemeMode[]).map((mode) => {
    const [fg, bg] = mode === 'dark' && p.dark ? p.dark : p.light;
    return { label: `${p.name} (${mode}: ${fg} on ${bg})`, mode, fg, bg, min: p.min };
  }),
);

describe('contrast (Frontend Specification 2.7, WCAG 2.2 AA)', () => {
  it.each(cases)('$label is at least $min to 1', ({ mode, fg, bg, min }) => {
    expect(ratio(String(palette[mode][fg]), String(palette[mode][bg]))).toBeGreaterThanOrEqual(min);
  });

  it('matches the ratios printed in 2.7', () => {
    expect(ratio(palette.light.ink, palette.light.bg)).toBeCloseTo(16.37, 2);
    expect(ratio(palette.dark.onbrand, palette.dark.brand)).toBeCloseTo(4.55, 2);
    expect(ratio(palette.dark.err, palette.dark.bg)).toBeCloseTo(4.57, 2);
    expect(ratio(palette.dark.brand, palette.dark.raise)).toBeCloseTo(3.44, 2);
  });
});
