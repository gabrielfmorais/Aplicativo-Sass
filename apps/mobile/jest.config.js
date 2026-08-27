/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // The first render in a React Native suite pays the jest-expo cold start, which alone can exceed
  // Jest's 5s default on a CI runner. This is a wall-clock budget, not an assertion: no test waits
  // this long when things work, and a genuine hang still fails.
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@app/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
};
