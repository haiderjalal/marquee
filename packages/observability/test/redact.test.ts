import { describe, expect, it } from 'vitest';

import { createLogger, redact } from '../src';

describe('log redaction', () => {
  it('replaces personal data and secrets at any depth', () => {
    const redacted = redact({
      reference: 'ENQ-ABCDEFGH',
      mobile: '+923001234567',
      nested: { email: 'person@example.com', authorization: 'Bearer abc' },
      list: [{ password: 'hunter2' }],
    });
    expect(redacted).toEqual({
      reference: 'ENQ-ABCDEFGH',
      mobile: '[redacted]',
      nested: { email: '[redacted]', authorization: '[redacted]' },
      list: [{ password: '[redacted]' }],
    });
  });

  it('never writes a phone number through the logger', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'info', write: (line) => lines.push(line) });
    logger.info('enquiry received', { mobile: '+923001234567', guests: 200 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('+923001234567');
    expect(lines[0]).toContain('"guests":200');
  });

  it('suppresses lines below the configured level', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'warn', write: (line) => lines.push(line) });
    logger.info('quiet');
    logger.error('loud');
    expect(lines).toHaveLength(1);
  });
});
