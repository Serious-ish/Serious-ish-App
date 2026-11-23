import { border, icon, radius, space } from '@serious-ish/design-tokens';
import { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  useReducedMotion,
} from 'react-native-reanimated';

import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

import { IconButton } from './Button';
import { motion } from './constants';
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon, XIcon } from './icons';
import { Text, type Colour } from './Text';

// 5.6: slides down under the header, radius 12, at least 56 high, padding 12 16, --elev fill,
// a 1.5-point border and an icon in the status colour. Words are --okink, --verink or --ink (2.6).
const HEIGHT = 56;

export type BannerKind = 'success' | 'info' | 'warning' | 'error';

const kinds = {
  success: { status: 'ok', words: 'okink', Glyph: CheckCircleIcon },
  info: { status: 'ver', words: 'verink', Glyph: InfoIcon },
  warning: { status: 'warn', words: 'ink', Glyph: WarningIcon },
  error: { status: 'err', words: 'ink', Glyph: WarningCircleIcon },
} as const satisfies Record<BannerKind, { status: Colour; words: Colour; Glyph: unknown }>;

type Props = { kind: BannerKind; message: string; onHide: () => void };

// Success and info hide after 4 seconds; warnings and errors stay until fixed or dismissed.
// Read by the screen reader as soon as shown, assertively for errors (6.2).
export function Banner({ kind, message, onHide }: Props) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const { status, words, Glyph } = kinds[kind];
  const autoHide = kind === 'success' || kind === 'info';
  const hide = useEffectEvent(onHide);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    if (!autoHide) return;
    const timer = setTimeout(hide, motion.bannerHide);
    return () => clearTimeout(timer);
  }, [message, autoHide]);

  return (
    <Animated.View
      entering={reduce ? FadeIn.duration(motion.reduced) : FadeInDown.duration(motion.fade)}
      exiting={reduce ? FadeOut.duration(motion.reduced) : FadeOutUp.duration(motion.fade)}
      accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      style={[styles.banner, { backgroundColor: c.elev, borderColor: c[status] }]}
    >
      <Glyph size={icon.md} color={c[status]} />
      <Text variant="bodyS" color={words} style={styles.message}>
        {message}
      </Text>
      {!autoHide && (
        <View style={styles.close}>
          <IconButton icon={XIcon} label={en.ui.close} onPress={onHide} bare />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: border.control,
  },
  message: { flex: 1 },
  // The 48-point close button overlaps the padding so the banner stays 56 high.
  close: { marginVertical: -space.sm, marginRight: -space.sm },
});
