import { space } from '@serious-ish/design-tokens';

// Values from Frontend Specification sections 05 and 06 that are not design tokens.
export const TOUCH = space['4xl']; // 48 by 48 is the smallest touch area (4.2)
export const DISABLED_OPACITY = 0.6; // disabled labels are --muted at 60% (5.2)

// 6.1 Motion. Durations in milliseconds.
export const motion = {
  press: 120,
  pressScale: 0.98,
  fade: 200, // dialogs, scrim, banners and toasts
  dialogScaleFrom: 0.95,
  sheetSpring: { damping: 20, stiffness: 220 },
  shimmer: 1200,
  shimmerStop: 10_000,
  bannerHide: 4000,
  toastHide: 3000,
  reduced: 150,
} as const;

// With the phone's reduce motion setting on, slides and scales become 150 ms fades (6.1).
export const transition = (reduce: boolean, duration: number) =>
  reduce ? { duration: motion.reduced, move: false } : { duration, move: true };
