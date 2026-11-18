import {
  border,
  elevation,
  gradient,
  icon,
  palette,
  photo,
  radius,
  space,
  typography,
} from '@serious-ish/design-tokens';

// Frontend Specification v1.5, section 02 (and the final Colour Palette), typed out by hand so
// a change to palette.ts has to be made twice, on purpose. [light, dark]
const section02: Record<string, [string | number, string | number]> = {
  brand: ['#A62625', '#CE4746'],
  brandh: ['#721918', '#CA7372'],
  brandink: ['#A62625', '#E58A89'],
  onbrand: ['#FBF4F4', '#FFFFFF'],
  secondary: ['#C16867', '#CA7372'],
  accent: ['#F5D8D5', '#D49B9B'],
  bg: ['#FFFFFF', '#141010'],
  raise: ['#FFFFFF', '#2B2121'],
  elev: ['#FBF4F4', '#211C1C'],
  surf: ['#F5D8D5', '#302221'],
  skel: ['#F1DDDD', '#2A2222'],
  ink: ['#361616', '#F3F1F1'],
  muted: ['#886363', '#A59797'],
  line: ['#E9D2D2', '#3D3333'],
  ok: ['#2F9E44', '#46C15D'],
  okink: ['#16682A', '#46C15D'],
  ver: ['#2F80ED', '#5B9BF5'],
  verink: ['#175FBD', '#5B9BF5'],
  warn: ['#D9822B', '#E8974A'],
  err: ['#B3261E', '#E0453A'],
  glass: ['rgba(251,244,244,.86)', 'rgba(48,34,33,.62)'],
  glassdeep: ['rgba(251,244,244,.95)', 'rgba(20,16,16,.93)'],
  glassline: ['rgba(54,22,22,.14)', 'rgba(255,255,255,.14)'],
  glasstext: ['#361616', '#F3E9E6'],
  scrim: ['rgba(54,22,22,.55)', 'rgba(0,0,0,.66)'],
  sheen: ['rgba(43,23,18,.05)', 'rgba(255,255,255,.05)'],
  shc: ['54 22 22', '0 0 0'],
  shk: [1, 5.5],
  raiseline: ['none', 'inset 0 1px 0 rgba(255,255,255,.07)'],
};

describe('design tokens match Frontend Specification v1.5 section 02', () => {
  it.each(Object.entries(section02))('%s in light and dark', (name, [light, dark]) => {
    expect(palette.light[name as keyof typeof palette.light]).toBe(light);
    expect(palette.dark[name as keyof typeof palette.dark]).toBe(dark);
  });

  it('has no colour token the specification does not list', () => {
    expect(Object.keys(palette.light).sort()).toEqual(Object.keys(section02).sort());
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(section02).sort());
  });

  it('photo constants are fixed in both themes (2.5)', () => {
    expect(photo).toEqual({
      offWhite: '#FFF6F4',
      chip: 'rgba(255,255,255,.16)',
      chipBlur: 16,
      chipEdge: 'rgba(255,255,255,.26)',
      tag: 'rgba(255,255,255,.9)',
      shade: 'rgba(16,8,6,.28)',
      splashRed: '#A62625',
    });
  });

  it('gradients (2.5)', () => {
    expect(gradient.likeHeart).toEqual({
      colors: ['#EDA5A3', '#D46B6A', '#B23B3A'],
      locations: [0, 0.55, 1],
    });
    expect(gradient.passCross).toEqual({ colors: ['#FFFFFF', '#EDE4E3'], locations: [0, 1] });
    expect(gradient.frostStops).toEqual([
      [0, 0],
      [0.22, 0.08],
      [0.48, 0.34],
      [0.74, 0.62],
      [1, 0.74],
    ]);
  });
});

describe('type, spacing and shape match sections 03 and 04', () => {
  it('type scale (3.1)', () => {
    const scale = (k: keyof typeof typography) => {
      const s = typography[k] as { fontFamily: string; fontSize: number; lineHeight: number };
      return [s.fontFamily, s.fontSize, s.lineHeight];
    };
    expect(scale('displayL')).toEqual(['Prata_400Regular', 34, 42]);
    expect(scale('display')).toEqual(['Prata_400Regular', 28, 36]);
    expect(scale('h1')).toEqual(['Sora_600SemiBold', 24, 30]);
    expect(scale('h2')).toEqual(['Sora_600SemiBold', 20, 26]);
    expect(scale('h3')).toEqual(['Sora_600SemiBold', 17, 22]);
    expect(scale('bodyL')).toEqual(['Outfit_400Regular', 17, 26]);
    expect(scale('body')).toEqual(['Outfit_400Regular', 16, 24]);
    expect(scale('bodyS')).toEqual(['Outfit_400Regular', 14, 20]);
    expect(scale('label')).toEqual(['Outfit_500Medium', 14, 18]);
    expect(scale('caption')).toEqual(['Outfit_400Regular', 12, 16]);
    expect(scale('overline')).toEqual(['Sora_600SemiBold', 11, 14]);
    expect(typography.overline.letterSpacing).toBe(0.8);
  });

  it('spacing (4.1), radius, elevation, borders and icons (4.3)', () => {
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    expect(radius).toEqual({ sm: 8, md: 12, lg: 16, xl: 24, pill: 999 });
    expect(elevation).toEqual({
      1: { y: 1, blur: 3, alpha: 0.08 },
      2: { y: 4, blur: 16, alpha: 0.12 },
      3: { y: 8, blur: 32, alpha: 0.18 },
    });
    expect(border).toEqual({ divider: 1, control: 1.5, focus: 2 });
    expect(icon).toEqual({ sm: 20, md: 24, lg: 28, empty: 48 });
  });
});
