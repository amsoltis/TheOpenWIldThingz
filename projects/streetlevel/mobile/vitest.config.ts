import { defineConfig } from 'vitest/config';

/**
 * Only pure logic is under test here. There is no native runtime in CI, so
 * anything that reaches for expo-sqlite, expo-haptics or react-native is
 * deliberately kept out of these modules — see src/state and src/api/errors.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
