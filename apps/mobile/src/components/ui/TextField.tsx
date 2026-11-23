import { border, icon, maxFontScale, radius, space, typography } from '@serious-ish/design-tokens';
import { use, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

import { DISABLED_OPACITY } from './constants';
import { WarningCircleIcon } from './icons';
import { RaisedSurface } from './surface';
import { Text } from './Text';

// 5.3 and 5.4
const HEIGHT = 56;
const AREA_MIN = 112;
const AREA_MAX = 220;
const HELPER_GAP = 6; // off the 4-point scale, but it is the specified value

export type FieldType = 'text' | 'email' | 'phone' | 'multiline';

// Canada and US only (SEC-03): the "+1" is fixed and the field keeps 10 digits. A pasted
// "+1 (416) 555-0123" is cleaned to "4165550123".
export const phoneDigits = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  return (d.length === 11 && d.startsWith('1') ? d.slice(1) : d).slice(0, 10);
};

export const formatPhone = (digits: string) => {
  if (digits.length <= 3) return digits;
  const head = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}`;
  return digits.length > 6 ? `${head}-${digits.slice(6)}` : head;
};

const keyboard: Record<FieldType, TextInputProps> = {
  text: {},
  email: {
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
    textContentType: 'emailAddress',
  },
  phone: {
    keyboardType: 'number-pad',
    autoComplete: 'tel-national',
    textContentType: 'telephoneNumber',
  },
  multiline: { multiline: true, textAlignVertical: 'top' },
};

// The error line under a field: --err words on the page, --ink words in a card, sheet or dialog,
// always with the icon. Announced by the screen reader without moving focus (5.3, 6.2).
export function FieldError({ message }: { message: string }) {
  const { c } = useTheme();
  const raised = use(RaisedSurface);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View style={styles.message} accessibilityLiveRegion="assertive">
      <WarningCircleIcon size={icon.sm} color={c.err} />
      <Text variant="bodyS" color={raised ? 'ink' : 'err'} style={styles.wrap}>
        {message}
      </Text>
    </View>
  );
}

type Props = Omit<TextInputProps, 'style' | 'editable' | 'multiline' | 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  type?: FieldType;
  helper?: string;
  error?: string;
  disabled?: boolean;
  optional?: boolean;
  // Shows the "120 / 500" counter. Limits come from the server.
  maxLength?: number;
};

export function TextField({
  label,
  value,
  onChangeText,
  type = 'text',
  helper,
  error,
  disabled = false,
  optional = false,
  maxLength,
  ...rest
}: Props) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const phone = type === 'phone';
  const area = type === 'multiline';
  const name = optional ? `${label} ${en.ui.optional}` : label;

  // Disabled, then error, then focus decide the outline (5.3).
  const outline = disabled
    ? { borderColor: c.line, borderWidth: border.control }
    : error
      ? { borderColor: c.err, borderWidth: border.focus }
      : focused
        ? { borderColor: c.brand, borderWidth: border.focus }
        : { borderColor: c.muted, borderWidth: border.control };

  return (
    <View style={styles.field}>
      <Text variant="label">{name}</Text>
      <View
        style={[
          styles.box,
          area ? styles.area : styles.line,
          { backgroundColor: disabled ? c.elev : c.raise },
          outline,
        ]}
      >
        {phone && (
          <View style={[styles.country, { backgroundColor: c.surf }]}>
            <Text variant="label" control>
              {en.ui.countryCode}
            </Text>
          </View>
        )}
        <TextInput
          accessibilityLabel={name}
          accessibilityHint={error ?? helper}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={phone ? formatPhone(value) : value}
          onChangeText={(text) => onChangeText(phone ? phoneDigits(text) : text)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={maxLength}
          maxFontSizeMultiplier={maxFontScale.body}
          placeholderTextColor={c.muted}
          selectionColor={c.brand}
          scrollEnabled={area}
          style={[
            typography.body,
            styles.input,
            { color: c.ink },
            disabled && { opacity: DISABLED_OPACITY },
          ]}
          {...keyboard[type]}
          {...rest}
        />
      </View>
      {(error || helper || maxLength !== undefined) && (
        <View style={styles.below}>
          {error ? (
            <FieldError message={error} />
          ) : (
            helper && (
              <Text variant="caption" color="muted" style={styles.grow}>
                {helper}
              </Text>
            )
          )}
          {maxLength !== undefined && (
            <Text variant="caption" color="muted" style={styles.counter}>
              {en.ui.counter(value.length, maxLength)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  box: {
    flexDirection: 'row',
    gap: space.xs,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
  },
  line: { minHeight: HEIGHT, alignItems: 'center' },
  area: { minHeight: AREA_MIN, maxHeight: AREA_MAX, paddingVertical: space.sm },
  input: { flex: 1, alignSelf: 'stretch' },
  country: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xxs },
  // The field's own gap is 8; the helper line sits 6 below the box.
  below: { flexDirection: 'row', gap: space.xs, marginTop: HELPER_GAP - space.xs },
  // flexShrink, not flex: 1. A flex: 1 text in a column (the code input) is measured at zero
  // width and Yoga stops laying out everything after it.
  message: { flexShrink: 1, flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' },
  wrap: { flexShrink: 1 },
  grow: { flex: 1 },
  counter: { marginLeft: 'auto' },
});
