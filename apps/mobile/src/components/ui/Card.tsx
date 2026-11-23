import { border, radius, space } from '@serious-ish/design-tokens';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { raisedEdge } from '@/theme/shadow';
import { useTheme } from '@/theme/useTheme';

import { TOUCH } from './constants';
import { FocusRing, useFocusRing } from './focus';
import { RaisedSurface } from './surface';

type Props = {
  children: ReactNode;
  // Only when the whole card has one clear destination (5.5).
  onPress?: () => void;
  accessibilityLabel?: string;
  // Settings groups hold full-width rows, so they turn the padding off.
  padded?: boolean;
};

// 5.5 Basic card: --raise, 1-point --line outline, radius 16, padding 16, no shadow; dark adds
// the raised top edge.
export function Card({ children, onPress, accessibilityLabel, padded = true }: Props) {
  const { c } = useTheme();
  const { focused, focusProps } = useFocusRing();
  const look = [
    styles.card,
    { backgroundColor: c.raise, borderColor: c.line },
    raisedEdge(c),
    padded ? styles.padded : styles.flush,
  ];
  const content = <RaisedSurface value>{children}</RaisedSurface>;

  if (!onPress) return <View style={look}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [look, styles.tappable, pressed && { backgroundColor: c.elev }]}
      {...focusProps}
    >
      {content}
      {focused && <FocusRing radius={radius.lg} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: border.divider },
  padded: { padding: space.md },
  flush: { overflow: 'hidden' },
  tappable: { minHeight: TOUCH },
});
