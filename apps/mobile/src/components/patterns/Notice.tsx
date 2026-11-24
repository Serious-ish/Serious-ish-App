import { icon, space } from '@serious-ish/design-tokens';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { WarningCircleIcon } from '@/components/ui/icons';
import { Text } from '@/components/ui/Text';
import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

type Props = {
  // The catalogue's message for the status (R03, A18, X03).
  message: string;
  // What the status blocks, or what the member can still do.
  body: string;
  appeal?: boolean;
};

// A blocking notice (Frontend Specification 7.1, 7.2; FT-046): one full screen with no tabs and
// only the actions the status allows. The status gate keeps every other screen closed, so it
// cannot be dismissed into the app; Appeal and Contact support push on top of it.
export function Notice({ message, body, appeal = false }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: space.lg + insets.bottom },
      ]}
    >
      <View style={styles.content}>
        <WarningCircleIcon size={icon.empty} color={c.err} />
        <Text variant="h3" accessibilityRole="header" style={styles.center}>
          {message}
        </Text>
        <Text color="muted" style={styles.center}>
          {body}
        </Text>
      </View>
      <View style={styles.actions}>
        {appeal && <Button label={en.notices.appeal} onPress={() => router.push('/appeal')} />}
        <Button
          label={en.notices.contactSupport}
          variant={appeal ? 'secondary' : 'primary'}
          onPress={() => router.push('/support')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.lg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  center: { textAlign: 'center' },
  actions: { gap: space.sm },
});
