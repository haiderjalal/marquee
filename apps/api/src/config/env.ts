import { z } from 'zod';

/** Validated runtime configuration. Built once at startup; never read from env again. */
export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly databaseUrl: string;
  readonly corsOrigins: readonly string[];
  readonly authMode: 'dev';
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** Schema for every environment variable the API reads. Unknown variables are ignored. */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\/.+/, 'DATABASE_URL must be a postgres:// connection string.'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    AUTH_MODE: z.enum(['dev']).default('dev'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((env, context) => {
    // Typed as string: the mode set widens when an identity provider is added.
    const authMode: string = env.AUTH_MODE;
    if (env.NODE_ENV === 'production' && authMode === 'dev') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message:
          'Development authentication cannot run in production. Configure the identity provider first.',
      });
    }
  });

/**
 * Validates environment values and returns typed configuration.
 * @param source Environment map, usually process.env.
 * @returns Typed configuration.
 * @throws Error listing every invalid variable, so a misconfigured deployment fails at startup.
 */
export function loadConfig(source: Readonly<Record<string, string | undefined>>): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration: ${problems.join('; ')}`);
  }
  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT,
    databaseUrl: env.DATABASE_URL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    authMode: env.AUTH_MODE,
    logLevel: env.LOG_LEVEL,
  };
}
