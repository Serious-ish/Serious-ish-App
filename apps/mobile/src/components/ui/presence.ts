import { useEffect, useState } from 'react';
import {
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { transition } from './constants';

// Keeps an overlay mounted while it animates out. progress runs 0 to 1 on the way in and back
// to 0 on the way out; move is false when the phone asks for reduced motion (fade only).
export function usePresence(
  visible: boolean,
  duration: number,
): { mounted: boolean; progress: SharedValue<number>; move: boolean; duration: number } {
  const reduce = useReducedMotion();
  const t = transition(reduce, duration);
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    progress.set(
      withTiming(visible ? 1 : 0, { duration: t.duration }, (finished) => {
        'worklet';
        if (finished && !visible) runOnJS(setMounted)(false);
      }),
    );
  }, [visible, mounted, t.duration, progress]);

  return { mounted, progress, move: t.move, duration: t.duration };
}
