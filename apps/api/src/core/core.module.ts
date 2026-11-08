import { createLogger } from '@marquee/observability';
import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { FixedWindowRateLimiter } from './rate-limit';
import {
  type AppDependencies,
  APP_CONFIG,
  CLOCK,
  type Clock,
  DATABASE,
  ID_GENERATOR,
  type IdGenerator,
  LOGGER,
  RATE_LIMITER,
} from './tokens';

/** Production clock: the system time. */
const systemClock: Clock = { now: () => new Date() };

/** Production identifier source: random version 4 UUIDs. */
const randomIds: IdGenerator = { next: () => randomUUID() };

/** Public submissions allowed per client per window. */
const PUBLIC_SUBMISSIONS_PER_WINDOW = 20;

/** Length of the public submission window. */
const PUBLIC_WINDOW_MS = 10 * 60_000;

/**
 * Global module that exposes configuration, the database, clock, identifiers, logger and
 * rate limiter to every feature module. Built with explicit dependencies so tests can
 * replace the clock, identifiers or database.
 */
@Global()
@Module({})
export class CoreModule {
  /**
   * Builds the core module from the composition root's dependencies.
   * @param dependencies Configuration and infrastructure handles.
   * @returns A dynamic module definition.
   */
  static forRoot(dependencies: AppDependencies): DynamicModule {
    const clock = dependencies.clock ?? systemClock;
    const providers: Provider[] = [
      { provide: APP_CONFIG, useValue: dependencies.config },
      { provide: DATABASE, useValue: dependencies.database },
      { provide: CLOCK, useValue: clock },
      { provide: ID_GENERATOR, useValue: dependencies.ids ?? randomIds },
      {
        provide: LOGGER,
        useValue: dependencies.logger ?? createLogger({ level: dependencies.config.logLevel }),
      },
      {
        provide: RATE_LIMITER,
        useValue: new FixedWindowRateLimiter(
          PUBLIC_SUBMISSIONS_PER_WINDOW,
          PUBLIC_WINDOW_MS,
          clock,
        ),
      },
    ];
    return {
      module: CoreModule,
      providers,
      exports: [APP_CONFIG, DATABASE, CLOCK, ID_GENERATOR, LOGGER, RATE_LIMITER],
    };
  }
}
