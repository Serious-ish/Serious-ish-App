import { radius, space } from '@serious-ish/design-tokens';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { elevationStyle } from '@/theme/shadow';
import { useTheme } from '@/theme/useTheme';

import { Button } from './Button';
import { motion } from './constants';
import { usePresence } from './presence';
import { RaisedSurface } from './surface';
import { Text } from './Text';

// 5.6: centred, the screen width minus 48 up to 340, radius 24, padding 24, elevation 3.
const MAX_WIDTH = 340;

type Action = { label: string; onPress: () => void };

type Props = {
  visible: boolean;
  title: string;
  body: string;
  icon?: ReactNode;
  // The top button; destructive makes it the red confirm version.
  primary: Action & { destructive?: boolean };
} & (
  | { onDismiss: () => void; secondary?: Action }
  // Blocking dialogs (under 18, update required, account restricted) cannot be dismissed and
  // have one button.
  | { onDismiss?: undefined; secondary?: undefined }
);

// 200 ms fade with a 95% to 100% scale; with reduce motion on, a 150 ms fade (6.1).
export function Dialog({ visible, title, body, icon, primary, secondary, onDismiss }: Props) {
  const { c } = useTheme();
  const { width: screen } = useWindowDimensions();
  const { mounted, progress, move } = usePresence(visible, motion.fade);
  const from = motion.dialogScaleFrom;

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const box = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: move ? from + (1 - from) * progress.value : 1 }],
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => onDismiss?.()}
    >
      <View style={styles.center}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}>
          {onDismiss && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onDismiss}
              accessible={false}
              importantForAccessibility="no"
            />
          )}
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.box,
            { width: Math.min(screen - 2 * space.xl, MAX_WIDTH), backgroundColor: c.raise },
            elevationStyle(c, 3),
            box,
          ]}
        >
          <RaisedSurface value>
            {icon}
            <Text variant="h2" accessibilityRole="header">
              {title}
            </Text>
            <Text color="muted">{body}</Text>
            <View style={styles.actions}>
              <Button
                label={primary.label}
                onPress={primary.onPress}
                variant={primary.destructive ? 'destructiveConfirm' : 'primary'}
              />
              {secondary && (
                <Button label={secondary.label} onPress={secondary.onPress} variant="text" />
              )}
            </View>
          </RaisedSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { padding: space.xl, gap: space.sm, borderRadius: radius.xl },
  actions: { gap: space.sm, marginTop: space.sm },
});
