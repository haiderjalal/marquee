import { defineConfig } from 'vitest/config';

// Real PostgreSQL integration suites (constraints, locks, races, tenant FKs).
// They start an embedded PostgreSQL 17 instance through the test-harness in
// packages/database. Run serially because each suite owns its own database.
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.int.test.ts', 'apps/*/test/**/*.int.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    passWithNoTests: false,
  },
});
