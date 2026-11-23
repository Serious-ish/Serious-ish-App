import { border, icon, space } from '@serious-ish/design-tokens';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { FocusRing, useFocusRing } from './focus';
import { CaretRightIcon, type Icon } from './icons';
import { Text } from './Text';

// 5.7: at least 56 high, 16 padding, icon or avatar on the left, a chevron when tappable, a
// --sheen fill when pressed. Dividers are 1 point, --line, inset 16 (4.2).
const HEIGHT = 56;

type Props = {
  label: string;
  value?: string;
  icon?: Icon;
  // An avatar or other leading element instead of an icon.
  leading?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
};

export function ListRow({ label, value, icon: Glyph, leading, onPress, divider = false }: Props) {
  const { c } = useTheme();
  const { focused, focusProps } = useFocusRing();
  const body = (
    <>
      {Glyph && <Glyph size={icon.md} color={c.ink} />}
      {leading}
      <Text style={styles.label}>{label}</Text>
      {value !== undefined && <Text color="muted">{value}</Text>}
      {onPress && <CaretRightIcon size={icon.sm} color={c.muted} />}
      {divider && <View style={[styles.divider, { backgroundColor: c.line }]} />}
      {focused && <FocusRing radius={0} inside />}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.sheen }]}
      {...focusProps}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
  },
  label: { flex: 1 },
  divider: {
    position: 'absolute',
    left: space.md,
    right: 0,
    bottom: 0,
    height: border.divider,
  },
});
