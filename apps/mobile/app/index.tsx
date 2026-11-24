import { Redirect, type Href } from 'expo-router';

import { routeFor, useGate } from '@/lib/gate';

// The anchor: every closed route lands here and goes on to the one place the status gate allows.
export default function Index() {
  const { place } = useGate();
  return <Redirect href={routeFor(place).href as Href} />;
}
