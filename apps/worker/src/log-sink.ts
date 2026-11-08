import type { ClaimedOutboxMessage } from '@marquee/database';
import type { Logger } from '@marquee/observability';

import type { NotificationSink } from './dispatcher';

/**
 * The only channel configured today. It records that a message was handled, using
 * identifiers only. No email, SMS or WhatsApp provider is connected: provider evaluation and
 * consent review come first (see docs/implementation-status.md).
 */
export class LogNotificationSink implements NotificationSink {
  private readonly logger: Logger;

  /**
   * @param logger Structured logger.
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Records a delivery. Never logs the payload.
   * @param message Leased outbox message.
   * @returns A resolved promise; the log channel cannot fail.
   */
  deliver(message: ClaimedOutboxMessage): Promise<void> {
    this.logger.info('outbox message handled by log channel', {
      messageId: message.id,
      tenantId: message.tenantId,
      topic: message.topic,
      dedupKey: message.dedupKey,
      attempts: message.attempts,
    });
    return Promise.resolve();
  }
}
