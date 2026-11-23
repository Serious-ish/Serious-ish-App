import { radius, space } from '@serious-ish/design-tokens';
import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { en } from '@/i18n/en';
import { elevationStyle } from '@/theme/shadow';
import { useTheme } from '@/theme/useTheme';

import { IconButton } from './Button';
import { TOUCH, motion } from './constants';
import { XIcon } from './icons';
import { usePresence } from './presence';
import { RaisedSurface } from './surface';
import { Text } from './Text';

// 5.6: top corners 24, a 36 by 4 grab handle, padding 20, at most 85% of the screen.
const HANDLE = { width: 36, height: 4 };
const MAX_SHARE = 0.85;
const FLING = 800; // points per second that count as a flick down

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

// Rises with a 320 ms spring; drag down, tap the scrim or press Close to dismiss. The Close
// button is always there for switch users (6.2). Frosted glass arrives with FT-009.
export function Sheet({ visible, onClose, title, children }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const { mounted, progress, move, duration } = usePresence(visible, motion.fade);
  const y = useSharedValue(move ? screen : 0);
  const drag = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (!mounted || !move) return;
    drag.set(0);
    y.set(visible ? withSpring(0, motion.sheetSpring) : withTiming(screen, { duration }));
  }, [visible, mounted, move, screen, duration, y, drag]);

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      drag.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > height.get() / 3 || e.velocityY > FLING) runOnJS(onClose)();
      else drag.set(withSpring(0, motion.sheetSpring));
    },
  });

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    opacity: move ? 1 : progress.value,
    transform: [{ translateY: (move ? y.value : 0) + drag.value }],
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessible={false}
            importantForAccessibility="no"
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => {
            height.set(e.nativeEvent.layout.height);
          }}
          style={[
            styles.panel,
            {
              backgroundColor: c.raise,
              maxHeight: screen * MAX_SHARE,
              paddingBottom: space.lg + insets.bottom,
            },
            elevationStyle(c, 2),
            panel,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View>
              <View style={[styles.handle, { backgroundColor: c.muted }]} />
              <View style={styles.header}>
                {title !== undefined && (
                  <Text variant="h3" accessibilityRole="header" style={styles.title}>
                    {title}
                  </Text>
                )}
                <View style={styles.close}>
                  <IconButton icon={XIcon} label={en.ui.close} onPress={onClose} bare />
                </View>
              </View>
            </View>
          </GestureDetector>
          <RaisedSurface value>{children}</RaisedSurface>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { ...HANDLE, alignSelf: 'center', borderRadius: radius.pill, marginBottom: space.xs },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH },
  title: { flex: 1 },
  close: { marginLeft: 'auto' },
});
