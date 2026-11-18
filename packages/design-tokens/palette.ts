// The ONLY place colour values may appear (TRD 2.6 and 3.2, Frontend Specification v1.5 8.1).
// Values are Frontend Specification v1.5 sections 02 to 04 and the final Colour Palette.
// Mobile reads this through apps/mobile/src/theme; the moderation page reads the CSS variables
// that build-css.ts generates from it.

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

// 02: 20 colour tokens, 6 glass and overlay tokens, and depth, in both themes.
export const palette = {
  light: {
    brand: '#A62625',
    brandh: '#721918',
    brandink: '#A62625',
    onbrand: '#FBF4F4',
    secondary: '#C16867',
    accent: '#F5D8D5',
    bg: '#FFFFFF',
    raise: '#FFFFFF',
    elev: '#FBF4F4',
    surf: '#F5D8D5',
    skel: '#F1DDDD',
    ink: '#361616',
    muted: '#886363',
    line: '#E9D2D2',
    ok: '#2F9E44',
    okink: '#16682A',
    ver: '#2F80ED',
    verink: '#175FBD',
    warn: '#D9822B',
    err: '#B3261E',
    glass: 'rgba(251,244,244,.86)',
    glassdeep: 'rgba(251,244,244,.95)',
    glassline: 'rgba(54,22,22,.14)',
    glasstext: '#361616',
    scrim: 'rgba(54,22,22,.55)',
    sheen: 'rgba(43,23,18,.05)',
    shc: '54 22 22',
    shk: 1,
    raiseline: 'none',
  },
  dark: {
    brand: '#CE4746',
    brandh: '#CA7372',
    brandink: '#E58A89',
    onbrand: '#FFFFFF',
    secondary: '#CA7372',
    accent: '#D49B9B',
    bg: '#141010',
    raise: '#2B2121',
    elev: '#211C1C',
    surf: '#302221',
    skel: '#2A2222',
    ink: '#F3F1F1',
    muted: '#A59797',
    line: '#3D3333',
    ok: '#46C15D',
    okink: '#46C15D',
    ver: '#5B9BF5',
    verink: '#5B9BF5',
    warn: '#E8974A',
    err: '#E0453A',
    glass: 'rgba(48,34,33,.62)',
    glassdeep: 'rgba(20,16,16,.93)',
    glassline: 'rgba(255,255,255,.14)',
    glasstext: '#F3E9E6',
    scrim: 'rgba(0,0,0,.66)',
    sheen: 'rgba(255,255,255,.05)',
    shc: '0 0 0',
    shk: 5.5,
    raiseline: 'inset 0 1px 0 rgba(255,255,255,.07)',
  },
} as const;

export type Theme = (typeof palette)[ThemeMode];
export type ColourToken = keyof Theme;

// 2.5: fixed photo constants, the same in both themes.
export const photo = {
  offWhite: '#FFF6F4',
  chip: 'rgba(255,255,255,.16)',
  chipBlur: 16,
  chipEdge: 'rgba(255,255,255,.26)',
  tag: 'rgba(255,255,255,.9)',
  shade: 'rgba(16,8,6,.28)',
  splashRed: '#A62625',
} as const;

// 2.5: gradients. Locations are 0 to 1; the like heart's middle stop sits at 55%.
export const gradient = {
  likeHeart: { colors: ['#EDA5A3', '#D46B6A', '#B23B3A'], locations: [0, 0.55, 1] },
  passCross: { colors: ['#FFFFFF', '#EDE4E3'], locations: [0, 1] },
  // Card frost tint: [position, alpha]; the colour is sampled from each photo.
  frostStops: [
    [0, 0],
    [0.22, 0.08],
    [0.48, 0.34],
    [0.74, 0.62],
    [1, 0.74],
  ],
} as const;

// 2.5: the blush glow at the top of every screen. Pass the theme's --surf (or 'var(--surf)').
export const screenGlow = (surf: string) =>
  `radial-gradient(130% 40% at 50% -4%, ${surf} 0%, rgba(245,216,213,0) 72%)`;

// 2.8: a phone that reports no scheme falls back to light.
export const resolveMode = (pref: ThemePreference, system?: ThemeMode | null): ThemeMode =>
  pref === 'system' ? (system ?? 'light') : pref;

// 2.5: shadow = rgb(shc / (alpha x shk)). Write each shadow once with its light-theme alpha.
export const shadow = (t: Theme, alpha: number) =>
  `rgba(${t.shc.split(' ').join(',')},${Math.min(1, alpha * t.shk)})`;

// 03: typefaces. Names are the keys the mobile app loads from the @expo-google-fonts packages.
export const font = {
  display: 'Prata_400Regular',
  head: 'Sora_600SemiBold',
  headMedium: 'Sora_500Medium',
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodyBold: 'Outfit_600SemiBold',
} as const;

// 3.1 type scale and 3.2 special text styles (mobile). Sizes and line heights in points.
export const typography = {
  displayL: { fontFamily: font.display, fontSize: 34, lineHeight: 42 },
  display: { fontFamily: font.display, fontSize: 28, lineHeight: 36 },
  h1: { fontFamily: font.head, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: font.head, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: font.head, fontSize: 17, lineHeight: 22 },
  bodyL: { fontFamily: font.body, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  bodyS: { fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: font.bodyMedium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: font.head,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  buttonL: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 22 },
  buttonM: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 20 },
  buttonS: { fontFamily: font.bodyBold, fontSize: 14, lineHeight: 18 },
  cardName: { fontFamily: font.head, fontSize: 26, lineHeight: 32 },
  countdown: { fontFamily: font.head, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  codeDigit: { fontFamily: font.head, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  tabLabel: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 16 },
  chat: { fontFamily: font.body, fontSize: 16, lineHeight: 22 },
  link: { fontFamily: font.bodyMedium, textDecorationLine: 'underline' },
} as const;

// 3.3: largest text size multiplier. Body text grows to 140%, buttons and tab labels to 120%.
export const maxFontScale = { body: 1.4, control: 1.2 } as const;

// 04: layout tokens do not change with the theme.
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

// 4.3: shadow offset y and blur in points, with the light-theme alpha (shadow() scales it).
export const elevation = {
  1: { y: 1, blur: 3, alpha: 0.08 },
  2: { y: 4, blur: 16, alpha: 0.12 },
  3: { y: 8, blur: 32, alpha: 0.18 },
} as const;

export const border = { divider: 1, control: 1.5, focus: 2 } as const;

export const icon = { sm: 20, md: 24, lg: 28, empty: 48 } as const;
