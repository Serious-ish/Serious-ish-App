// The component gallery, development builds only (FT-004). The root layout's guard closes the
// route in every other build, and because __DEV__ is false there the bundler drops the gallery
// code from the app entirely.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export default __DEV__ ? require('@/dev/Gallery').default : () => null;
