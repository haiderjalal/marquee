import { createLogger } from '@marquee/observability';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { RootModule } from './app.module';
import { correlationMiddleware, CORRELATION_HEADER } from './core/correlation';
import { ApiExceptionFilter } from './core/api-exception.filter';
import { type AppDependencies } from './core/tokens';

/** Path prefix for every route in this version of the API. */
export const API_PREFIX = 'api/v1';

/** Request headers browsers may send to the API. */
const ALLOWED_HEADERS = [
  'content-type',
  'idempotency-key',
  'x-dev-user-id',
  'x-tenant-id',
  CORRELATION_HEADER,
];

/**
 * Composition root: builds the Nest application with validated configuration, the global
 * error mapper, correlation ids and CORS limited to configured origins.
 * @param dependencies Configuration and infrastructure handles.
 * @returns An initialised application that has not started listening.
 */
export async function createApp(dependencies: AppDependencies): Promise<INestApplication> {
  const logger = dependencies.logger ?? createLogger({ level: dependencies.config.logLevel });
  const app = await NestFactory.create(RootModule.forRoot({ ...dependencies, logger }), {
    logger: false,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: [...dependencies.config.corsOrigins],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: [...ALLOWED_HEADERS],
    exposedHeaders: [CORRELATION_HEADER],
    maxAge: 600,
  });
  app.use(correlationMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  return app;
}
