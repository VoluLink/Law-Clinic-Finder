import { sanitizeLogFields } from './log-privacy';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;
export type LogLine = LogFields & { timestamp: string; level: LogLevel; msg: string };

export type Logger = {
  debug: (msg: string, fields?: LogFields) => void;
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
  child: (fields: LogFields) => Logger;
};

export type WriteLine = (line: LogLine) => void;

function writeToStdio(line: LogLine): void {
  const stream = line.level === 'error' || line.level === 'warn' ? 'stderr' : 'stdout';
  process[stream].write(`${JSON.stringify(line)}\n`);
}

export function createLogger(base: LogFields = {}, write: WriteLine = writeToStdio): Logger {
  const emit = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (level === 'debug' && process.env.LOG_DEBUG !== '1') return;
    /* Sanitizing here rather than at the call sites means one forgotten
     * `logger.error('failed', { error })` cannot leak an address or a token
     * into stdout or the admin log. `msg` is a literal at every call site but
     * goes through the same pass, because a template string is one edit away. */
    const safe = sanitizeLogFields({ msg, ...base, ...fields });
    write({ ...safe, timestamp: new Date().toISOString(), level, msg: String(safe.msg) });
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (fields) => createLogger({ ...base, ...fields }, write),
  };
}

/*
 * Optional secondary sink for the process-wide logger, wired once at server
 * startup (src/instrumentation.ts) to persist logs into the admin "Protokolle"
 * view. Kept as a settable hook so this file stays environment-agnostic and
 * never statically imports the server-only DB sink.
 *
 * The reference lives on `globalThis`, not in a module-level variable. Next.js
 * bundles instrumentation, route handlers and server components into separate
 * graphs, so a module-scoped `let` can be instantiated more than once per
 * process — instrumentation would set the sink on its own copy while every
 * request logger read a copy that was still null, and the admin log stayed
 * empty while stdout looked healthy. A global registry has exactly one slot
 * per process regardless of how many times this module is evaluated.
 */
const SINK_KEY = Symbol.for('law-clinic-finder.logSink');

type SinkRegistry = { [SINK_KEY]?: WriteLine | null };

function registry(): SinkRegistry {
  return globalThis as unknown as SinkRegistry;
}

export function setLogSink(next: WriteLine | null): void {
  registry()[SINK_KEY] = next;
}

function fanout(line: LogLine): void {
  writeToStdio(line);
  const sink = registry()[SINK_KEY];
  if (!sink) return;
  try {
    sink(line);
  } catch (error) {
    // A failing sink must never break the request path or recurse back through
    // the logger. Report it on stderr and carry on.
    const reason = error instanceof Error ? error.message : 'unknown';
    process.stderr.write(`log sink failed: ${reason}\n`);
  }
}

export const logger = createLogger({}, fanout);
