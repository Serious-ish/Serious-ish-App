import { radius as corner } from '@serious-ish/design-tokens';
import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';

import { motion } from './constants';

type Props = {
  width: DimensionValue;
  height: number;
  radius?: keyof typeof corner;
};

// 5.7 and 6.1: a shape in --skel moving to --elev on a 1.2 second loop, in the shape of the real
// content. It stops after 10 seconds (the screen shows its error state by then); with reduce
// motion on it is a still tint. Hidden from screen readers: the screen announces the loading.
export function Skeleton({ width, height, radius = 'sm' }: Props) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const tint = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [c.skel, c.elev]),
  }));

  useEffect(() => {
    if (reduce) return;
    t.set(withRepeat(withTiming(1, { duration: motion.shimmer / 2 }), -1, true));
    const stop = setTimeout(() => {
      cancelAnimation(t);
      t.set(0);
    }, motion.shimmerStop);
    return () => {
      clearTimeout(stop);
      cancelAnimation(t);
    };
  }, [reduce, t]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: corner[radius], backgroundColor: c.skel }, tint]}
    />
  );
}
