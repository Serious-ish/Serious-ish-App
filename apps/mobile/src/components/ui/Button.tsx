import { border, icon as iconSize, radius, space, type Theme } from '@serious-ish/design-tokens';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { en } from '@/i18n/en';
import { elevationStyle } from '@/theme/shadow';
import { useTheme } from '@/theme/useTheme';

import { DISABLED_OPACITY, TOUCH, motion } from './constants';
import { FocusRing, useFocusRing } from './focus';
import type { Icon } from './icons';
import { Text, type Colour } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive' | 'destructiveConfirm';
export type ButtonSize = 'large' | 'medium' | 'small';

// 5.1: large 56, medium 48, small 40 (padded to a 48 touch area); text buttons at least 44.
const HEIGHT = { large: 56, medium: TOUCH, small: 40 } as const;
const TEXT_HEIGHT = 44;
const LABEL = { large: 'buttonL', medium: 'buttonM', small: 'buttonS' } as const;

type Look = { fill: string; label: Colour; outline?: string; raised?: boolean };

// 5.1 and 5.2. Dark pressed and destructive fills take a --bg label (2.7).
function look(variant: ButtonVariant, t: Theme, dark: boolean, pressed: boolean, off: boolean) {
  const none = 'transparent';
  const looks: Record<ButtonVariant, Look> = {
    primary: off
      ? { fill: t.surf, label: 'muted' }
      : { fill: pressed ? t.brandh : t.brand, label: pressed && dark ? 'bg' : 'onbrand' },
    secondary: {
      fill: off ? t.elev : pressed ? t.surf : t.raise,
      label: off ? 'muted' : 'ink',
      // In dark the shadow cannot be seen, so a --line outline keeps the shape.
      outline: dark ? t.line : undefined,
      raised: !off,
    },
    text: { fill: pressed ? t.sheen : none, label: off ? 'muted' : 'ink' },
    destructive: { fill: pressed ? t.sheen : none, label: off ? 'muted' : 'ink', outline: t.err },
    destructiveConfirm: off
      ? { fill: t.surf, label: 'muted' }
      : { fill: t.err, label: dark ? 'bg' : 'onbrand' },
  };
  return looks[variant];
}

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  // Destructive buttons show an --err icon before the label.
  icon?: Icon;
  // Text buttons are --ink; red only where the link must stand out.
  emphasis?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon: LeadingIcon,
  emphasis = false,
  accessibilityHint,
}: Props) {
  const { c, mode } = useTheme();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { focused, focusProps } = useFocusRing();

  const isText = variant === 'text';
  const height = isText ? TEXT_HEIGHT : HEIGHT[size];
  const slop = (TOUCH - height) / 2;

  // 98% for 120 ms; with reduce motion on, only the colour changes.
  const pressTo = (to: number) => {
    if (!reduce)
      scale.set(withTiming(to, { duration: motion.press, easing: Easing.out(Easing.quad) }));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      accessibilityValue={loading ? { text: en.ui.loading } : undefined}
      // A loading button keeps its width and ignores taps.
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => pressTo(motion.pressScale)}
      onPressOut={() => pressTo(1)}
      hitSlop={slop > 0 ? { top: slop, bottom: slop } : undefined}
      style={{ minHeight: height, minWidth: TOUCH }}
      {...focusProps}
    >
      {({ pressed }) => {
        const l = look(variant, c, mode === 'dark', pressed, disabled);
        return (
          <Animated.View
            style={[
              styles.body,
              isText ? styles.textBody : styles.filledBody,
              { backgroundColor: l.fill },
              l.outline !== undefined && { borderWidth: border.control, borderColor: l.outline },
              l.raised && elevationStyle(c, 1),
              scaleStyle,
            ]}
          >
            {LeadingIcon && <LeadingIcon size={iconSize.sm} color={c.err} />}
            <Text
              control
              variant={isText ? 'bodyS' : LABEL[size]}
              color={isText && emphasis && !disabled ? 'brandink' : l.label}
              style={[loading && styles.hidden, disabled && styles.disabled]}
            >
              {label}
            </Text>
            {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={c[l.label]} />}
            {focused && <FocusRing radius={radius.pill} />}
          </Animated.View>
        );
      }}
    </Pressable>
  );
}

// 48 circle, 24 icon in --ink, --raise fill with a --line outline, or no fill in headers (5.1).
export function IconButton({
  icon: Glyph,
  label,
  onPress,
  bare = false,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  bare?: boolean;
}) {
  const { c } = useTheme();
  const { focused, focusProps } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        !bare && { borderWidth: border.divider, borderColor: c.line },
        { backgroundColor: pressed ? (bare ? c.sheen : c.surf) : bare ? 'transparent' : c.raise },
      ]}
      {...focusProps}
    >
      <Glyph size={iconSize.md} color={c.ink} />
      {focused && <FocusRing radius={radius.pill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
  },
  filledBody: { paddingHorizontal: space.xl, paddingVertical: space.xs },
  textBody: { paddingHorizontal: space.xs },
  hidden: { opacity: 0 },
  disabled: { opacity: DISABLED_OPACITY },
  icon: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
