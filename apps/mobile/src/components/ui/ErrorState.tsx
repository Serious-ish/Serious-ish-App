import { icon, space } from '@serious-ish/design-tokens';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

import { Button } from './Button';
import { WarningCircleIcon } from './icons';
import { Text } from './Text';

type Props = {
  // From describeError(): the catalogue's message, never server text.
  message: string;
  onRetry?: () => void;
};

// 5.6 Inline error state: a full-screen state for a screen that cannot load. Icon 48, the message
// in Heading 3 and one primary button, "Try again". Announced without moving focus (6.2).
export function ErrorState({ message, onRetry }: Props) {
  const { c } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]} accessibilityLiveRegion="assertive">
      <WarningCircleIcon size={icon.empty} color={c.err} />
      <Text variant="h3" style={styles.message}>
        {message}
      </Text>
      {onRetry && <Button label={en.ui.tryAgain} onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  message: { textAlign: 'center' },
});
