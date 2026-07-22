import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, logger, setLogSink, type LogLine } from './logger';

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

describe('setLogSink', () => {
  afterEach(() => {
    setLogSink(null);
    vi.restoreAllMocks();
  });

  it('fans the singleton out to the sink as well as stdout', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const received: LogLine[] = [];
    setLogSink((line) => received.push(line));
    logger.info('server started');
    expect(received).toEqual([
      { timestamp: expect.any(String), level: 'info', msg: 'server started' },
    ]);
    expect(stdout).toHaveBeenCalledOnce();
  });

  it('stops calling the sink once it is cleared', () => {
    const received: LogLine[] = [];
    setLogSink((line) => received.push(line));
    setLogSink(null);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    logger.info('no sink now');
    expect(received).toEqual([]);
  });

  it('keeps logging and reports on stderr when the sink throws', () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    setLogSink(() => {
      throw new Error('sink down');
    });
    expect(() => logger.info('still fine')).not.toThrow();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('sink down'));
  });
});
