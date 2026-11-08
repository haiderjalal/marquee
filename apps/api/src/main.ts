import { createDatabaseClient, listPendingMigrations } from '@marquee/database';

import { loadConfig } from './config/env';
import { API_PREFIX, createApp } from './create-app';

/**
 * Process entry point. Validates configuration, refuses to start against a stale schema,
 * starts listening on the loopback interface (a reverse proxy terminates TLS in deployment)
 * and closes the pool on termination signals.
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const database = createDatabaseClient(config.databaseUrl);

  const pending = await listPendingMigrations(database.pool);
  if (pending.length > 0) {
    await database.close();
    throw new Error(
      `Database schema is behind (${pending.join(', ')}). Run npm run db:migrate before starting the API.`,
    );
  }

  const app = await createApp({ config, database });
  await app.listen(config.port, '127.0.0.1');
  process.stdout.write(`API listening on http://127.0.0.1:${config.port}/${API_PREFIX}\n`);

  const shutdown = (): void => {
    app
      .close()
      .then(() => database.close())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown shutdown failure';
        process.stderr.write(`Shutdown was not clean: ${message}\n`);
        process.exitCode = 1;
      })
      .finally(() => process.exit());
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown start-up failure';
  process.stderr.write(`API failed to start: ${message}\n`);
  process.exitCode = 1;
});
