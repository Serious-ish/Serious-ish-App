import { border, icon, radius, space } from '@serious-ish/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { TOUCH } from './constants';
import { FocusRing, useFocusRing } from './focus';
import { CheckIcon } from './icons';
import { Text } from './Text';

// 5.4 and 5.7: a selectable chip is 40 high (padded to a 48 touch area); a read-only chip is 32.
const HEIGHT = 40;
const READ_ONLY_HEIGHT = 32;
const slop = (TOUCH - HEIGHT) / 2;

type Props = { label: string; selected?: boolean; onPress?: () => void };

// Without onPress the chip is read-only. Selected chips have a check, so colour is never the
// only signal (6.2). The "up to five" rule belongs to the screen that uses them.
export function Chip({ label, selected = false, onPress }: Props) {
  const { c, mode } = useTheme();
  const { focused, focusProps } = useFocusRing();

  if (!onPress) {
    return (
      <View style={[styles.readOnly, { backgroundColor: c.surf }]}>
        <Text variant="label" control>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: pressed ? c.brandh : c.brand, borderColor: c.brand }
          : { backgroundColor: pressed ? c.surf : c.raise, borderColor: c.line },
      ]}
      {...focusProps}
    >
      {({ pressed }) => {
        // Dark: a pressed brand fill takes a --bg label (2.7).
        const tone = selected ? (pressed && mode === 'dark' ? 'bg' : 'onbrand') : 'ink';
        return (
          <>
            {selected && <CheckIcon size={icon.sm} color={c[tone]} />}
            <Text variant="label" control color={tone}>
              {label}
            </Text>
            {focused && <FocusRing radius={radius.pill} />}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: HEIGHT,
    minWidth: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: border.divider,
  },
  readOnly: {
    minHeight: READ_ONLY_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
  },
});
