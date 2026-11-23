import { border } from '@serious-ish/design-tokens';
import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

// Keyboard and switch-access focus: a 2-point --ink ring with a 2-point gap, never removed (5.2).
export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusProps: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

const outset = -2 * border.focus;

// Rows draw the ring inside their edges, so a card that clips its corners cannot hide it.
export function FocusRing({ radius, inside = false }: { radius: number; inside?: boolean }) {
  const { c } = useTheme();
  const at = inside ? 0 : outset;
  return (
    <View
      testID="focus-ring"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: at,
        bottom: at,
        left: at,
        right: at,
        borderRadius: radius - at,
        borderWidth: border.focus,
        borderColor: c.ink,
      }}
    />
  );
}
