import { describe, expect, it } from 'vitest';

import { createLogger, type LogLine } from './logger';

function captureLogger(base?: Record<string, unknown>) {
  const lines: LogLine[] = [];
  const logger = createLogger(base, (line) => lines.push(line));
  return { logger, lines };
}

describe(createLogger, () => {
  it('emits timestamp, level and msg', () => {
    const { logger, lines } = captureLogger();
    logger.info('server started');
    expect(lines).toEqual([
      { timestamp: expect.any(String), level: 'info', msg: 'server started' },
    ]);
  });

  it('merges base fields and per-call fields', () => {
    const { logger, lines } = captureLogger({ requestId: 'req-1' });
    logger.warn('suspicious input', { field: 'email' });
    expect(lines[0]).toMatchObject({ requestId: 'req-1', field: 'email', level: 'warn' });
  });

  it('child loggers extend the base fields', () => {
    const { logger, lines } = captureLogger({ requestId: 'req-1' });
    logger.child({ userId: 'user-1' }).error('lookup failed');
    expect(lines[0]).toMatchObject({ requestId: 'req-1', userId: 'user-1', level: 'error' });
  });

  it('suppresses debug unless LOG_DEBUG is enabled', () => {
    const { logger, lines } = captureLogger();
    logger.debug('verbose detail');
    expect(lines).toEqual([]);
  });
});
