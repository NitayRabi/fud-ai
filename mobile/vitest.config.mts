import { defineConfig } from 'vitest/config';

// Domain tests only: pure TypeScript under src/domain and src/state/createStore, no React Native.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
