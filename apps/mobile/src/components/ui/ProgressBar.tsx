import { radius, space } from '@serious-ish/design-tokens';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

// 5.7: 4 high, track --line, fill --brand, rounded ends. The segmented version is for photos
// and the onboarding steps.
const HEIGHT = 4;

type Props = {
  label: string;
  // 0 to 1.
  progress: number;
  segments?: number;
};

export function ProgressBar({ label, progress, segments }: Props) {
  const { c } = useTheme();
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={styles.row}
    >
      {segments ? (
        Array.from({ length: segments }, (_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              styles.segment,
              { backgroundColor: i < Math.round(p * segments) ? c.brand : c.line },
            ]}
          />
        ))
      ) : (
        <View style={[styles.bar, styles.segment, { backgroundColor: c.line }]}>
          <View style={[styles.bar, { width: `${p * 100}%`, backgroundColor: c.brand }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xxs },
  bar: { height: HEIGHT, borderRadius: radius.pill },
  segment: { flex: 1, overflow: 'hidden' },
});
