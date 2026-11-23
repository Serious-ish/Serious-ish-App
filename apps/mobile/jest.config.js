const { transformIgnorePatterns } = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Phosphor ships its icons as TypeScript source, so Jest compiles them like Expo's packages.
  transformIgnorePatterns: transformIgnorePatterns.map((p) =>
    p.replace('|react-native|', '|react-native|phosphor-react-native|'),
  ),
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
