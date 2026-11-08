import type { DatabaseClient } from '@marquee/database';
import type { Logger } from '@marquee/observability';

import type { AppConfig } from '../config/env';

/**
 * Injection tokens. Every constructor parameter uses an explicit @Inject(TOKEN):
 * tsx compiles with esbuild, which does not emit decorator metadata, so reflection
 * based injection would silently receive nothing.
 */
export const APP_CONFIG = 'APP_CONFIG';
export const DATABASE = 'DATABASE';
export const CLOCK = 'CLOCK';
export const ID_GENERATOR = 'ID_GENERATOR';
export const LOGGER = 'LOGGER';
export const RATE_LIMITER = 'RATE_LIMITER';

/** Source of the current instant. Injected so time-dependent rules are testable. */
export interface Clock {
  now(): Date;
}

/** Source of new identifiers. Production uses random UUIDs. */
export interface IdGenerator {
  next(): string;
}

/** Everything the composition root must provide to build the application. */
export interface AppDependencies {
  readonly config: AppConfig;
  readonly database: DatabaseClient;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly logger?: Logger;
}

/** Re-exported for providers that need the database handle type. */
export type { DatabaseClient, Logger };
