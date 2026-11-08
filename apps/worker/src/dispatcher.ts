import {
  type ClaimedOutboxMessage,
  claimDueOutboxMessages,
  type DatabaseClient,
  markOutboxDelivered,
  recordOutboxFailure,
} from '@marquee/database';
import type { Logger } from '@marquee/observability';

/**
 * Outbox delivery. A message is written in the same transaction as the business change, and
 * the worker delivers it afterwards. Delivery is at-least-once: a crash after a send and
 * before the status update causes a resend, so consumers deduplicate by dedup key. The worker
 * never claims exactly-once delivery to an external provider.
 */

/** Channel that performs the external effect for one message. */
export interface NotificationSink {
  /**
   * Performs the side effect for a message. Must reject on failure.
   * @param message Leased message.
   */
  deliver(message: ClaimedOutboxMessage): Promise<void>;
}

/** Tuning knobs for one dispatch pass. */
export interface DispatchOptions {
  readonly batchSize: number;
  readonly leaseSeconds: number;
  readonly maxAttempts: number;
}

/** Everything one dispatch pass needs. */
export interface DispatchDependencies {
  readonly database: DatabaseClient;
  readonly sink: NotificationSink;
  readonly clock: { now(): Date };
  readonly logger: Logger;
  readonly options: DispatchOptions;
}

/** Counts from one dispatch pass. */
export interface DispatchReport {
  readonly claimed: number;
  readonly delivered: number;
  readonly retried: number;
  readonly deadLettered: number;
}

/** Ceiling for the retry backoff: one hour. */
const MAX_BACKOFF_MS = 60 * 60_000;

/** Base retry delay: one minute, doubled for each further attempt. */
const BASE_BACKOFF_MS = 60_000;

/**
 * Leases a batch of due messages, delivers each one, and records the outcome.
 * @param dependencies Database, sink, clock, logger and options.
 * @returns Counts for monitoring.
 */
export async function dispatchOnce(dependencies: DispatchDependencies): Promise<DispatchReport> {
  const { database, sink, clock, logger, options } = dependencies;
  const now = clock.now();
  const batch = await claimDueOutboxMessages(database.db, {
    limit: options.batchSize,
    leaseSeconds: options.leaseSeconds,
    now,
  });

  let delivered = 0;
  let retried = 0;
  let deadLettered = 0;
  for (const message of batch) {
    try {
      await sink.deliver(message);
      await markOutboxDelivered(database.db, message.id);
      delivered += 1;
    } catch (error) {
      const dead = message.attempts >= options.maxAttempts;
      const category = errorCategory(error);
      await recordOutboxFailure(database.db, {
        id: message.id,
        retryAt: new Date(now.getTime() + backoffMs(message.attempts)),
        dead,
        errorCategory: category,
      });
      if (dead) {
        deadLettered += 1;
      } else {
        retried += 1;
      }
      logger.warn('outbox delivery failed', {
        messageId: message.id,
        topic: message.topic,
        attempts: message.attempts,
        dead,
        errorCategory: category,
      });
    }
  }
  return { claimed: batch.length, delivered, retried, deadLettered };
}

/**
 * Exponential backoff after a failed attempt: 1, 2, 4, 8 ... minutes, capped at one hour.
 * @param attempts Attempts made so far, starting at 1.
 * @returns Delay in milliseconds.
 */
export function backoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BASE_BACKOFF_MS * 2 ** exponent, MAX_BACKOFF_MS);
}

/**
 * Reduces a thrown value to a non-sensitive category. Provider messages can echo recipient
 * details, so only the error class name is stored or logged.
 * @param error Thrown value.
 * @returns A short category such as "TypeError" or "unknown".
 */
export function errorCategory(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
