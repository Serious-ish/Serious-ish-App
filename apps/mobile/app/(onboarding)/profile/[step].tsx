import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/patterns/Screen';
import { en } from '@/i18n/en';
import { PROFILE_STEPS } from '@/lib/gate';

// Placeholder until FT-022 builds the 11 profile steps.
export default function ProfileStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  return <Screen title={en.screens.profileStep(Number(step), PROFILE_STEPS)} />;
}
