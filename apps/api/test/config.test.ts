import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env';

/** A syntactically valid database URL, so each test changes only the variable it names. */
const DATABASE_URL = 'postgres://postgres:test-only@127.0.0.1:5432/marquee_test';

describe('loadConfig authentication mode', () => {
  it('allows development sign-in outside production', () => {
    expect(loadConfig({ DATABASE_URL, NODE_ENV: 'development' }).authMode).toBe('dev');
  });

  it('refuses development sign-in in production', () => {
    expect(() => loadConfig({ DATABASE_URL, NODE_ENV: 'production', AUTH_MODE: 'dev' })).toThrow(
      /Development authentication cannot run in production/,
    );
  });

  it('allows public-only mode in production', () => {
    const config = loadConfig({ DATABASE_URL, NODE_ENV: 'production', AUTH_MODE: 'disabled' });

    expect(config.authMode).toBe('disabled');
    expect(config.nodeEnv).toBe('production');
  });

  it('rejects an unknown authentication mode', () => {
    expect(() => loadConfig({ DATABASE_URL, AUTH_MODE: 'anything' })).toThrow(/AUTH_MODE/);
  });
});
