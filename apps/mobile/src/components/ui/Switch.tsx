import { border, radius, space } from '@serious-ish/design-tokens';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';

import { DISABLED_OPACITY, motion } from './constants';
import { FocusRing, useFocusRing } from './focus';
import { Text } from './Text';

// 5.4: track 52 by 32, thumb 28; the row is a settings row, at least 56 high (5.7).
const TRACK = { width: 52, height: 32 };
const THUMB = 28;
const INSET = (TRACK.height - THUMB) / 2;
const TRAVEL = TRACK.width - THUMB - 2 * INSET;
const ROW = 56;

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

// Label on the left, switch on the right, the whole row tappable.
export function Switch({ label, value, onValueChange, disabled = false }: Props) {
  const { c, mode } = useTheme();
  const reduce = useReducedMotion();
  const { focused, focusProps } = useFocusRing();
  const x = useSharedValue(value ? TRAVEL : 0);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  useEffect(() => {
    const to = value ? TRAVEL : 0;
    x.set(reduce ? to : withTiming(to, { duration: motion.press }));
  }, [value, reduce, x]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.sheen }]}
      {...focusProps}
    >
      <Text style={[styles.label, disabled && styles.off]} color={disabled ? 'muted' : 'ink'}>
        {label}
      </Text>
      <View
        style={[
          styles.track,
          { backgroundColor: value ? c.brand : c.muted },
          disabled && styles.off,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: c.raise },
            // The thumb is white in light; in dark it is --raise with a --glassline edge.
            mode === 'dark' && { borderWidth: border.divider, borderColor: c.glassline },
            thumbStyle,
          ]}
        />
      </View>
      {focused && <FocusRing radius={radius.md} inside />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  label: { flex: 1 },
  off: { opacity: DISABLED_OPACITY },
  track: { ...TRACK, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    top: INSET,
    left: INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
  },
});
