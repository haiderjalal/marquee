import type { IncomingMessage, ServerResponse } from 'node:http';

import { createDatabaseClient, listPendingMigrations } from '@marquee/database';
import { createLogger } from '@marquee/observability';
import type { INestApplication } from '@nestjs/common';

import { loadConfig } from './config/env';
import { createApp } from './create-app';

/*
 * Serverless entry point for Vercel. Each function instance starts the Nest application once,
 * keeps it for later requests, and passes every request to the Express layer underneath Nest.
 * Start-up errors are answered with a safe 503 and logged; configuration values are never echoed.
 */

/**
 * Pool size per function instance. Kept small because Vercel can run many instances at once;
 * the runtime DATABASE_URL should point at the database provider's transaction pooler.
 */
const CONNECTIONS_PER_INSTANCE = 3;

/** Request listener type of the Express instance that Nest exposes. */
type RequestListener = (request: IncomingMessage, response: ServerResponse) => void;

/** Shared across warm invocations of the same function instance. */
let applicationReady: Promise<RequestListener> | undefined;

/**
 * Returns the running application's request listener, starting the application on first use.
 * A failed start is not cached, so a later request retries it once the cause (for example a
 * pending migration) is fixed.
 * @returns The Express request listener of the initialised application.
 */
function startApplication(): Promise<RequestListener> {
  applicationReady ??= buildApplication().catch((error: unknown) => {
    applicationReady = undefined;
    throw error;
  });
  return applicationReady;
}

/**
 * Validates configuration, refuses a stale schema, and initialises Nest without listening.
 * The database pool is closed again if any later step fails, so retries do not leak connections.
 * @returns The Express request listener of the initialised application.
 * @throws Error when configuration is invalid, migrations are pending or Nest exposes no listener.
 */
async function buildApplication(): Promise<RequestListener> {
  const config = loadConfig(process.env);
  const database = createDatabaseClient(config.databaseUrl, CONNECTIONS_PER_INSTANCE);
  try {
    const pending = await listPendingMigrations(database.pool);
    if (pending.length > 0) {
      throw new Error(`Database schema is behind (${pending.join(', ')}).`);
    }
    const application = await createApp({ config, database });
    await application.init();
    return requestListenerOf(application);
  } catch (error) {
    await database.close();
    throw error;
  }
}

/**
 * Extracts the Express instance that Nest created for its HTTP adapter.
 * @param application Initialised Nest application.
 * @returns The Express instance, callable with a request and a response.
 * @throws Error when the adapter does not expose a request listener.
 */
function requestListenerOf(application: INestApplication): RequestListener {
  const instance: unknown = application.getHttpAdapter().getInstance();
  if (!isRequestListener(instance)) {
    throw new Error('The HTTP adapter does not expose a request listener.');
  }
  return instance;
}

/**
 * Checks whether a value can receive a request and a response.
 * @param value Value read from the HTTP adapter.
 * @returns True when the value is callable as a request listener.
 */
function isRequestListener(value: unknown): value is RequestListener {
  return typeof value === 'function';
}

/**
 * Records why the application could not start. Only the message is written; the logger's
 * redaction also removes sensitive keys if a caller ever adds them.
 * @param error Failure raised while starting.
 */
function logStartupFailure(error: unknown): void {
  const logger = createLogger({ level: 'error' });
  const reason = error instanceof Error ? error.message : 'unknown start-up failure';
  logger.error('API start-up failed', { reason });
}

/**
 * Vercel request handler for every API route. Requests are delegated to the Express instance
 * that Nest created, so routing, CORS, correlation ids and error mapping are unchanged.
 * @param request Incoming HTTP request.
 * @param response Outgoing HTTP response.
 */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  let listener: RequestListener;
  try {
    listener = await startApplication();
  } catch (error) {
    logStartupFailure(error);
    response.statusCode = 503;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(
      JSON.stringify({ success: false, message: 'The service is temporarily unavailable.' }),
    );
    return;
  }
  listener(request, response);
}
