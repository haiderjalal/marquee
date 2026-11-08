import { createDatabaseClient } from './client';
import { applyMigrations } from './migrate';

/**
 * Command-line entry point: applies pending migrations to DATABASE_URL.
 * Exits non-zero on failure so CI and deployment jobs stop.
 */
async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example and configure a database.');
  }
  const client = createDatabaseClient(url, 2);
  try {
    const report = await applyMigrations(client.pool);
    process.stdout.write(
      `Applied: ${report.applied.length ? report.applied.join(', ') : 'none'}. ` +
        `Already present: ${report.alreadyApplied.length}.\n`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown migration failure';
  process.stderr.write(`Migration failed: ${message}\n`);
  process.exitCode = 1;
});
