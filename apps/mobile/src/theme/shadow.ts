import { elevation, shadow, type Theme } from '@serious-ish/design-tokens';

// Elevation 1 to 3 as a React Native boxShadow (Frontend Specification 2.5 and 4.3): one shadow
// written with its light-theme alpha, scaled by the theme, plus the raised top edge in dark.
export const elevationStyle = (t: Theme, level: keyof typeof elevation) => {
  const { y, blur, alpha } = elevation[level];
  const drop = `0 ${y}px ${blur}px ${shadow(t, alpha)}`;
  return { boxShadow: t.raiseline === 'none' ? drop : `${drop}, ${t.raiseline}` };
};

// Cards have no shadow, but dark mode still draws the raised top edge (5.5).
export const raisedEdge = (t: Theme) => (t.raiseline === 'none' ? {} : { boxShadow: t.raiseline });
