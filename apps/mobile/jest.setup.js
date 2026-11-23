/* global jest */
// Reanimated stand-in for unit tests. Reanimated 4's own mock and Jest build load its browser
// code (DOM, matchMedia, react-native-web), which this app does not have. Animations here jump
// to their end value, so snapshots show the resting state. Tests spy on useReducedMotion to
// turn reduced motion on. Add a function here when a component starts using one.
jest.mock('react-native-reanimated', () => {
  const { useRef } = require('react');
  const { View } = require('react-native');
  const end = (to, _config, done) => {
    done?.(true);
    return to;
  };
  const builder = { duration: () => builder };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c) => c },
    useSharedValue: (initial) => {
      const ref = useRef(null);
      if (!ref.current) {
        const sv = { value: initial, get: () => sv.value, set: (v) => (sv.value = v) };
        ref.current = sv;
      }
      return ref.current;
    },
    useAnimatedStyle: (style) => style(),
    useReducedMotion: () => false,
    withTiming: end,
    withSpring: end,
    withRepeat: (animation) => animation,
    cancelAnimation: () => {},
    interpolateColor: (value, input, output) =>
      value >= input[input.length - 1] ? output.at(-1) : output[0],
    runOnJS: (fn) => fn,
    Easing: { out: (f) => f, quad: (t) => t },
    FadeIn: builder,
    FadeInDown: builder,
    FadeInUp: builder,
    FadeOut: builder,
    FadeOutDown: builder,
    FadeOutUp: builder,
  };
});

// Gesture Handler runs without Reanimated in tests: the gesture logic does not need it, and the
// tests never drive real gestures. Registered by real path (pnpm links the package), for both
// the source and the compiled copy, as Gesture Handler's own Jest setup does.
const gestureHandler = require('path').dirname(
  require.resolve('react-native-gesture-handler/package.json'),
);
for (const file of [
  'src/handlers/gestures/reanimatedWrapper.ts',
  'lib/module/handlers/gestures/reanimatedWrapper.js',
]) {
  jest.doMock(`${gestureHandler}/${file}`, () => ({ Reanimated: undefined, Worklets: undefined }));
}
