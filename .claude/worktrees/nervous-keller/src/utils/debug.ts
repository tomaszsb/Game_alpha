// Debug mode utility for development and troubleshooting
// Toggle from browser console: window.__debug.enable()

const STORAGE_KEY = 'game_debug_mode';

function isEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function enable(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'true' }));
  console.log('[DebugMode] Debug mode ENABLED');
}

function disable(): void {
  localStorage.setItem(STORAGE_KEY, 'false');
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'false' }));
  console.log('[DebugMode] Debug mode DISABLED');
}

function toggle(): void {
  if (isEnabled()) {
    disable();
  } else {
    enable();
  }
}

function log(...args: unknown[]): void {
  if (isEnabled()) {
    console.log('[Debug]', ...args);
  }
}

function warn(...args: unknown[]): void {
  if (isEnabled()) {
    console.warn('[Debug]', ...args);
  }
}

function error(...args: unknown[]): void {
  if (isEnabled()) {
    console.error('[Debug]', ...args);
  }
}

export const DebugMode = {
  isEnabled,
  enable,
  disable,
  toggle,
  log,
  warn,
  error,
};

// Expose on window for browser console access
declare global {
  interface Window {
    __debug: typeof DebugMode;
  }
}

window.__debug = DebugMode;
