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
    write({ timestamp: new Date().toISOString(), level, msg, ...base, ...fields });
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (fields) => createLogger({ ...base, ...fields }, write),
  };
}

// Optional secondary sink for the process-wide logger, wired once at server
// startup (src/instrumentation.ts) to persist logs into the admin "Protokolle"
// table. Kept as a settable hook so this file stays environment-agnostic and
// never statically imports the server-only DB sink.
let sink: WriteLine | null = null;

export function setLogSink(next: WriteLine | null): void {
  sink = next;
}

function fanout(line: LogLine): void {
  writeToStdio(line);
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
