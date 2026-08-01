import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/testing/tests/**/*.test.ts'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
