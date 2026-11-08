import { defineConfig } from 'vitest/config';

// Unit and property tests. Integration tests that need a real PostgreSQL
// instance live in vitest.integration.config.ts and are excluded here.
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    exclude: ['**/*.int.test.ts', '**/node_modules/**'],
    environment: 'node',
    passWithNoTests: false,
  },
});
