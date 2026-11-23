import { maxFontScale, typography, type Theme } from '@serious-ish/design-tokens';
import { Text as NativeText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';

export type Colour = Exclude<keyof Theme, 'shc' | 'shk' | 'raiseline'>;

type Props = TextProps & {
  variant?: keyof typeof typography;
  color?: Colour;
  // Labels on buttons, chips and tabs grow to 120%; other text to 140% (3.3).
  control?: boolean;
};

// Every word on screen goes through this, so no component names a font or a colour.
export function Text({ variant = 'body', color = 'ink', control = false, style, ...rest }: Props) {
  const { c } = useTheme();
  return (
    <NativeText
      maxFontSizeMultiplier={control ? maxFontScale.control : maxFontScale.body}
      style={[typography[variant], { color: c[color] }, style]}
      {...rest}
    />
  );
}
