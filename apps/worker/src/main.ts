import { createDatabaseClient } from '@marquee/database';
import { createLogger, type LogLevel } from '@marquee/observability';
import { z } from 'zod';

import { dispatchOnce } from './dispatcher';
import { LogNotificationSink } from './log-sink';

/** Worker configuration read from the environment at start-up. */
const workerEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'DATABASE_URL must be a postgres:// connection string.'),
  WORKER_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(25),
  WORKER_LEASE_SECONDS: z.coerce.number().int().min(30).max(900).default(120),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Runs the dispatch loop until a termination signal arrives. Each pass is independent, so a
 * failed pass is logged and the loop continues after the poll interval.
 */
async function main(): Promise<void> {
  const env = workerEnvSchema.parse(process.env);
  const logLevel: LogLevel = env.LOG_LEVEL;
  const logger = createLogger({ level: logLevel });
  const database = createDatabaseClient(env.DATABASE_URL, 4);
  const sink = new LogNotificationSink(logger);
  const clock = { now: () => new Date() };
  const lifecycle = { running: true };

  const stop = (): void => {
    lifecycle.running = false;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  logger.info('worker started', { pollMs: env.WORKER_POLL_MS, batchSize: env.WORKER_BATCH_SIZE });
  while (lifecycle.running) {
    try {
      const report = await dispatchOnce({
        database,
        sink,
        clock,
        logger,
        options: {
          batchSize: env.WORKER_BATCH_SIZE,
          leaseSeconds: env.WORKER_LEASE_SECONDS,
          maxAttempts: env.WORKER_MAX_ATTEMPTS,
        },
      });
      if (report.claimed > 0) {
        logger.info('dispatch pass complete', { ...report });
      }
    } catch (error) {
      logger.error('dispatch pass failed', {
        errorName: error instanceof Error ? error.name : 'unknown',
      });
    }
    await sleep(env.WORKER_POLL_MS);
  }
  await database.close();
  logger.info('worker stopped');
}

/**
 * Waits for a duration.
 * @param milliseconds Duration to wait.
 * @returns A promise that resolves after the wait.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown start-up failure';
  process.stderr.write(`Worker failed to start: ${message}\n`);
  process.exitCode = 1;
});
