import { radius, space } from '@serious-ish/design-tokens';
import { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  useReducedMotion,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';

import { motion } from './constants';
import { Text } from './Text';

type Props = { message: string; onHide: () => void };

// 5.6: a small pill in the inverse of the theme (--ink fill, --bg words), Outfit 500 14, gone
// after 3 seconds. For confirmations only ("Saved"), never for errors. The screen places it near
// the bottom, above the tab bar (FT-008).
export function Toast({ message, onHide }: Props) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const hide = useEffectEvent(onHide);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(hide, motion.toastHide);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <Animated.View
      entering={reduce ? FadeIn.duration(motion.reduced) : FadeInUp.duration(motion.fade)}
      exiting={reduce ? FadeOut.duration(motion.reduced) : FadeOutDown.duration(motion.fade)}
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: c.ink }]}
    >
      <Text variant="label" color="bg">
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
});
