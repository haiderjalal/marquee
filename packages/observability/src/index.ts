/**
 * Structured JSON logging with redaction. Personal data (phone, email) and secrets
 * (tokens, passwords, authorisation headers) are replaced before a line is written,
 * so a logging call cannot leak them even when a caller passes a whole object.
 */

/** Supported severities, lowest to highest. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured fields attached to a log line. */
export type LogFields = Record<string, unknown>;

/** Logger handle injected into services. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Keys whose values must never be written to logs. */
const SENSITIVE_KEY =
  /mobile|phone|email|authori[sz]ation|token|secret|password|cookie|cnic|session/i;

/** Maximum nesting depth explored when redacting; deeper values are dropped. */
const MAX_REDACTION_DEPTH = 6;

/**
 * Returns a copy of a value with every sensitive key's value replaced by a marker.
 * @param value Any JSON-like value.
 * @param depth Current recursion depth.
 * @returns The redacted copy.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACTION_DEPTH) {
    return '[truncated]';
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redact(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(nested, depth + 1);
    }
    return output;
  }
  return value;
}

/**
 * Creates a logger that writes one JSON object per line.
 * @param options Minimum level and an optional sink (defaults to stdout and stderr).
 * @returns A logger.
 */
export function createLogger(options: {
  readonly level: LogLevel;
  readonly write?: (line: string, level: LogLevel) => void;
}): Logger {
  const write = options.write ?? defaultWrite;
  const threshold = LEVEL_RANK[options.level];

  /**
   * Emits one line when the level passes the threshold.
   * @param level Severity of the line.
   * @param message Human-readable message.
   * @param fields Structured fields, redacted before writing.
   */
  const emit = (level: LogLevel, message: string, fields: LogFields = {}): void => {
    if (LEVEL_RANK[level] < threshold) {
      return;
    }
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...asRecord(redact(fields)),
    });
    write(line, level);
  };

  return {
    debug: (message, fields) => {
      emit('debug', message, fields);
    },
    info: (message, fields) => {
      emit('info', message, fields);
    },
    warn: (message, fields) => {
      emit('warn', message, fields);
    },
    error: (message, fields) => {
      emit('error', message, fields);
    },
  };
}

/**
 * Narrows a redacted value to a plain object so it can be spread into a log line.
 * @param value Redacted value.
 * @returns The object, or an empty record when the value is not an object.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}

/**
 * Default sink: informational lines to stdout, problems to stderr.
 * @param line Serialised log line.
 * @param level Severity used to pick the stream.
 */
function defaultWrite(line: string, level: LogLevel): void {
  const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}
