import { border, radius, space } from '@serious-ish/design-tokens';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

import { TOUCH } from './constants';
import { Text } from './Text';

// 5.4: track 4 high in --line, filled part --brand, thumb 28 with a 48-point touch area.
const TRACK = 4;
const THUMB = 28;
const SLOP = (TOUCH - THUMB) / 2;

type Value = number | [number, number];

type Props<V extends Value> = {
  label: string;
  min: number;
  max: number;
  step?: number;
  // One number for distance, a [low, high] pair for the age range.
  value: V;
  onChange: (value: V) => void;
  // The value shown above the track, e.g. "50 km".
  format?: (n: number) => string;
};

export function Slider<V extends Value>({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = String,
}: Props<V>) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const range = Array.isArray(value);
  const [low, high] = range ? value : [min, value as number];

  const snap = (n: number) =>
    Math.min(max, Math.max(min, min + Math.round((n - min) / step) * step));
  const toX = (n: number) => ((n - min) / (max - min)) * width;

  // The two thumbs of a range never cross.
  const move = (thumb: 'low' | 'high', n: number) => {
    const v = snap(n);
    if (!range) return onChange(v as V);
    onChange((thumb === 'low' ? [Math.min(v, high), high] : [low, Math.max(v, low)]) as V);
  };

  const thumb = (which: 'low' | 'high', n: number) => (
    <Thumb
      key={which}
      x={toX(n)}
      value={n}
      perPoint={width > 0 ? (max - min) / width : 0}
      onMove={(to) => move(which, to)}
      step={step}
      min={min}
      max={max}
      label={range ? `${label}, ${which === 'low' ? en.ui.minimum : en.ui.maximum}` : label}
      text={format(n)}
    />
  );

  return (
    <View style={styles.field}>
      <Text variant="label" control accessibilityElementsHidden importantForAccessibility="no">
        {range ? `${format(low)} – ${format(high)}` : format(high)}
      </Text>
      <View
        style={styles.area}
        onLayout={(e) => setWidth(Math.max(0, e.nativeEvent.layout.width - THUMB))}
      >
        <View style={[styles.track, { backgroundColor: c.line }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: c.brand,
                left: range ? toX(low) : 0,
                width: toX(high) - (range ? toX(low) : 0),
              },
            ]}
          />
        </View>
        {range && thumb('low', low)}
        {thumb('high', high)}
      </View>
    </View>
  );
}

type ThumbProps = {
  x: number;
  value: number;
  perPoint: number;
  onMove: (to: number) => void;
  step: number;
  min: number;
  max: number;
  label: string;
  text: string;
};

function Thumb({ x, value, perPoint, onMove, step, min, max, label, text }: ThumbProps) {
  const { c } = useTheme();
  const start = useRef(value);
  const pan = usePanGesture({
    runOnJS: true,
    onBegin: () => {
      start.current = value;
    },
    onUpdate: (e) => onMove(start.current + e.translationX * perPoint),
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onMove(value + (e.nativeEvent.actionName === 'increment' ? step : -step))
        }
        hitSlop={SLOP}
        style={[styles.thumb, { left: x, backgroundColor: c.raise, borderColor: c.brand }]}
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  area: { height: TOUCH, justifyContent: 'center' },
  track: {
    height: TRACK,
    marginHorizontal: THUMB / 2,
    borderRadius: radius.pill,
  },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    borderWidth: border.control,
  },
});
