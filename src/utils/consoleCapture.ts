// src/utils/consoleCapture.ts
// Captures console.error and console.warn into a ring buffer for bug reports

interface ConsoleEntry {
  level: 'error' | 'warn' | 'log';
  message: string;
  timestamp: string;
}

const MAX_ENTRIES = 50;
const buffer: ConsoleEntry[] = [];
let installed = false;

function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); }
      catch { return String(arg); }
    }
    return String(arg);
  }).join(' ');
}

export function installConsoleCapture(): void {
  if (installed) return;
  installed = true;

  const origError = console.error;
  const origWarn = console.warn;

  console.error = (...args: any[]) => {
    buffer.push({
      level: 'error',
      message: formatArgs(args).slice(0, 500),
      timestamp: new Date().toISOString(),
    });
    if (buffer.length > MAX_ENTRIES) buffer.shift();
    origError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    buffer.push({
      level: 'warn',
      message: formatArgs(args).slice(0, 500),
      timestamp: new Date().toISOString(),
    });
    if (buffer.length > MAX_ENTRIES) buffer.shift();
    origWarn.apply(console, args);
  };

  // Also capture unhandled errors
  window.addEventListener('error', (event) => {
    buffer.push({
      level: 'error',
      message: `Unhandled: ${event.message} at ${event.filename}:${event.lineno}`.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
    if (buffer.length > MAX_ENTRIES) buffer.shift();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error
      ? `${event.reason.name}: ${event.reason.message}`
      : String(event.reason);
    buffer.push({
      level: 'error',
      message: `Unhandled rejection: ${reason}`.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
    if (buffer.length > MAX_ENTRIES) buffer.shift();
  });
}

export function getConsoleLogs(): ConsoleEntry[] {
  return [...buffer];
}
