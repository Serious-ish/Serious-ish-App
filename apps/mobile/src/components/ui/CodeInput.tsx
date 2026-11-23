import { border, radius, space } from '@serious-ish/design-tokens';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { FieldError } from './TextField';
import { Text } from './Text';

// 5.4: six boxes, each 46 wide and 56 high, 8 apart, digits in Sora 600 24 (FE-12).
const LENGTH = 6;
const BOX = { width: 46, height: 56 };

type Props = {
  // Read by the screen reader; the screen's title says what the code is for.
  label: string;
  value: string;
  onChangeText: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: string;
  autoFocus?: boolean;
};

// One hidden input sits over the boxes, so typing advances, backspace goes back, a pasted
// code fills all six and the phone's "code from text message" suggestion works.
export function CodeInput({ label, value, onChangeText, onComplete, error, autoFocus }: Props) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);

  const update = (raw: string) => {
    const code = raw.replace(/\D/g, '').slice(0, LENGTH);
    onChangeText(code);
    if (code.length === LENGTH) onComplete?.(code);
  };

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <View
          style={styles.boxes}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: LENGTH }, (_, i) => {
            const active = focused && i === Math.min(value.length, LENGTH - 1);
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  { backgroundColor: c.raise },
                  error
                    ? { borderColor: c.err, borderWidth: border.focus }
                    : active
                      ? { borderColor: c.brand, borderWidth: border.focus }
                      : { borderColor: c.muted, borderWidth: border.control },
                ]}
              >
                <Text variant="codeDigit" control>
                  {value[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          value={value}
          onChangeText={update}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
          selectionColor="transparent"
          style={[StyleSheet.absoluteFill, styles.hidden]}
        />
      </View>
      {error && <FieldError message={error} />}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  row: { alignSelf: 'flex-start' },
  boxes: { flexDirection: 'row', gap: space.xs },
  box: { ...BOX, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  hidden: { color: 'transparent', backgroundColor: 'transparent' },
});
