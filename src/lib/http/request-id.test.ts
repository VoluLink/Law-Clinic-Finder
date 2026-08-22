import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LogLine } from '@/lib/logger';

import { requestLogger } from './request-id';

describe(requestLogger, () => {
  it('adds the proxy-provided request ID to every child log line', () => {
    const lines: LogLine[] = [];
    const base = createLogger({}, (line) => lines.push(line));
    const request = new Request('https://example.test/api', {
      headers: { 'x-request-id': '6b54240d-bc70-4ae0-b70a-840f70746a61' },
    });
    requestLogger(request, base).info('handled');
    expect(lines[0]?.requestId).toBe('6b54240d-bc70-4ae0-b70a-840f70746a61');
  });

  it('does not trust a malformed direct-request ID', () => {
    const lines: LogLine[] = [];
    const base = createLogger({}, (line) => lines.push(line));
    const randomId = vi.fn().mockReturnValue('963bdbf2-1bde-4d7d-8377-6e454d864001');
    const request = new Request('https://example.test/api', {
      headers: { 'x-request-id': 'attacker-controlled' },
    });
    requestLogger(request, base, randomId).info('handled');
    expect(lines[0]?.requestId).toBe('963bdbf2-1bde-4d7d-8377-6e454d864001');
  });
});
