import { border, glassBlur, photo } from '@serious-ish/design-tokens';
import { BlurTargetView, BlurView } from 'expo-blur';
import {
  createContext,
  use,
  type ComponentRef,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/useTheme';

// Frosted glass (Frontend Specification 2.5 and 2.8, FT-009). Only over a photo: chips (tags and
// photo buttons) look the same in both themes; glass panels (a sheet over a photo) follow the theme.
export type FrostKind = 'chip' | 'glass' | 'glassdeep';

const blurPoints: Record<FrostKind, number> = {
  chip: photo.chipBlur,
  glass: glassBlur,
  glassdeep: glassBlur,
};

const ANDROID_12 = 31;

// expo-blur has no blur radius on iOS: intensity is how far the system blur is applied, so this
// factor was matched by eye to the deck's 16 and 18 point blur. Android takes the radius in
// points (with blurReductionFactor 1), which also keeps its own added tint faint.
const IOS_INTENSITY_PER_POINT = 2.5;

type Device = {
  os: string;
  version: string | number;
  reduceTransparency: boolean;
  hasTarget: boolean;
};

// Blur only where the phone does it well. Otherwise a solid tint that keeps text readable:
// Reduce Transparency is on, Android is older than 12 (its blur is slow there), or nothing on
// Android marks what is behind.
export function frostMode({ os, version, reduceTransparency, hasTarget }: Device) {
  if (reduceTransparency) return 'solid';
  if (os === 'android') return hasTarget && Number(version) >= ANDROID_12 ? 'blur' : 'solid';
  return 'blur';
}

type Target = RefObject<ComponentRef<typeof View> | null>;
const FrostTarget = createContext<Target | null>(null);

type AreaProps = { backdrop: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> };

// A photo with frosted things on top. Android can only blur what a target wraps, and the frosted
// views must sit outside it, so the backdrop goes inside the target and the children over it.
export function FrostArea({ backdrop, children, style }: AreaProps) {
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <FrostTarget value={target}>
      <View style={style}>
        <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
          {backdrop}
        </BlurTargetView>
        {children}
      </View>
    </FrostTarget>
  );
}

// iOS only; Android reports false.
function useReduceTransparency() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (live) setOn(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return on;
}

type Props = {
  kind: FrostKind;
  // Corner radii of the frosted shape.
  style?: StyleProp<ViewStyle>;
};

// The frosted layer alone: it fills its parent behind the content, with the 1-point edge.
export function Frost({ kind, style }: Props) {
  const { c, mode } = useTheme();
  const target = use(FrostTarget);
  const reduceTransparency = useReduceTransparency();
  const chip = kind === 'chip';
  const blur =
    frostMode({
      os: Platform.OS,
      version: Platform.Version,
      reduceTransparency,
      hasTarget: target !== null,
    }) === 'blur';
  const points = blurPoints[kind];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, style]}>
      {blur ? (
        <>
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={Platform.OS === 'ios' ? points * IOS_INTENSITY_PER_POINT : points}
            blurReductionFactor={1}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={target ?? undefined}
            // Android's tint is only an added colour, and 'default' is its faintest.
            tint={
              Platform.OS === 'android' ? 'default' : chip || mode === 'light' ? 'light' : 'dark'
            }
          />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: chip ? photo.chip : c[kind] }]}
          />
        </>
      ) : chip ? (
        // 2.8: a solid tint over the photo shade.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: photo.shade }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: photo.chipFallback }]} />
        </View>
      ) : (
        // Glass falls back to its denser value, the one meant for busy photos.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glassdeep }]} />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          style,
          { borderWidth: border.divider, borderColor: chip ? photo.chipEdge : c.glassline },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
