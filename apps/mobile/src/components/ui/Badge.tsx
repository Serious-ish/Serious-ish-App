import { palette, photo, radius, space, typography } from '@serious-ish/design-tokens';
import { StyleSheet, Text as NativeText, View } from 'react-native';

import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

import { CrownIcon, LightningIcon, SealCheckIcon } from './icons';
import { Text } from './Text';

// 5.7: pill 20 high, padding 8, Sora 600 11. The profile seal and the count badge are 16.
const HEIGHT = 20;
const SMALL = 16;
const label = { ...typography.overline, textTransform: 'none', letterSpacing: 0 } as const;

// Everything on a photo looks the same in both themes (2.5), so photo badges take the light
// values on the white photo tag.
const onPhoto = palette.light;

export function VerifiedBadge({ photoTag = false }: { photoTag?: boolean }) {
  const { c } = useTheme();
  if (!photoTag) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={en.ui.verified}>
        <SealCheckIcon weight="fill" size={SMALL} color={c.ver} />
      </View>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: photo.tag }]} accessible>
      <SealCheckIcon weight="fill" size={SMALL} color={onPhoto.ver} />
      <NativeText style={[label, { color: onPhoto.verink }]}>{en.ui.verified}</NativeText>
    </View>
  );
}

// Spark and Elite differ by name and icon, never by colour (2.6).
const planIcon = { spark: LightningIcon, elite: CrownIcon };

export function PlanBadge({
  plan,
  photoTag = false,
}: {
  plan: 'spark' | 'elite';
  photoTag?: boolean;
}) {
  const { c } = useTheme();
  const Glyph = planIcon[plan];
  const t = photoTag ? onPhoto : c;
  return (
    <View style={[styles.pill, { backgroundColor: photoTag ? photo.tag : c.raise }]} accessible>
      <Glyph size={SMALL} color={t.brand} />
      <NativeText style={[label, { color: t.ink }]}>{en.ui.plan[plan]}</NativeText>
    </View>
  );
}

// The count on the Matches and Chat tabs: never a number over 9 (5.7).
export function CountBadge({ count }: { count: number }) {
  const { c } = useTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.count, { backgroundColor: c.brand }]}>
      <Text control color="onbrand" style={label}>
        {en.ui.count(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xxs,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
  },
  count: {
    minWidth: SMALL,
    height: SMALL,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space.xxs,
    borderRadius: radius.pill,
  },
});
