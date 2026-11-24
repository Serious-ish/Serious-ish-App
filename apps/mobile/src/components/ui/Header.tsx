import { border, space } from '@serious-ish/design-tokens';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

import { IconButton } from './Button';
import { CaretLeftIcon } from './icons';
import { Text } from './Text';

// 5.7 Header: 56 high on --bg. Top-level screens have a large title (Heading 1); detail screens
// have a back arrow and a centred Heading 3. A --line divider appears once content scrolls under.
const HEIGHT = 56;

type Props = { title: string; onBack?: () => void; divider?: boolean };

export function Header({ title, onBack, divider = false }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, backgroundColor: c.bg },
        divider && { borderBottomWidth: border.divider, borderBottomColor: c.line },
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <>
            <IconButton icon={CaretLeftIcon} label={en.nav.back} onPress={onBack} bare />
            <Text variant="h3" accessibilityRole="header" numberOfLines={1} style={styles.centred}>
              {title}
            </Text>
            <View style={styles.balance} />
          </>
        ) : (
          <Text variant="h1" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg },
  row: { minHeight: HEIGHT, flexDirection: 'row', alignItems: 'center' },
  centred: { flex: 1, textAlign: 'center' },
  // Keeps the title centred against the back button.
  balance: { width: space['4xl'] },
});
