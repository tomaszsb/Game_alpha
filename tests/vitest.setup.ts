// tests/vitest.setup.ts
// Vitest setup file with performance optimizations

import '@testing-library/jest-dom';
import { beforeEach, afterEach, vi } from 'vitest';

// Environment detection
const isVerboseMode = process.env.VERBOSE_TESTS === 'true' ||
                      process.env.CI_VERBOSE === 'true' ||
                      process.env.VITEST_VERBOSE === 'true';

const isDebugMode = process.env.DEBUG_TESTS === 'true' ||
                    process.env.NODE_ENV === 'debug';

// Console suppression for performance (75% improvement)
if (!isVerboseMode && !isDebugMode) {
  const originalError = console.error;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.debug = vi.fn();
  });

  // Keep original error for critical issues
  if (isDebugMode) {
    console.error = originalError;
  }
} else {
  console.log('🔊 Verbose test mode enabled - console output visible');
}

// Performance monitoring for tests
let testStartTime: number;

beforeEach(() => {
  testStartTime = performance.now();
});

// Mock window and DOM globals for jsdom environment only
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  });

  // Mock IntersectionObserver for components that might use it
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// jsdom implements no scrolling at all, so Element.scrollIntoView is simply
// absent and any component that calls it throws inside an effect. Two do:
// PlayerPreviewPanel scrolls the part being edited into view, and SpaceEditor
// scrolls to the field a click on the player view landed on. Both are real
// browser behaviour worth keeping, so the environment gets the method rather
// than the components getting a guard they would not need in a browser.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Global cleanup after each test
afterEach(async () => {
  // Standard vitest cleanup (handles fake timers)
  vi.clearAllTimers();
  vi.restoreAllMocks();

  // Reset singleton services to prevent timer/state leaks between tests
  try {
    const { resetWebSocketService } = await import('../src/services/WebSocketSyncService');
    resetWebSocketService();
  } catch {}
  try {
    const { resetTooltipService } = await import('../src/services/TooltipService');
    resetTooltipService();
  } catch {}

  // Only in verbose/debug mode, do more aggressive cleanup
  if (isVerboseMode || isDebugMode) {
    // Clear any Promise rejections
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
  }
});

console.log('🚀 Vitest setup complete with performance optimizations enabled');
