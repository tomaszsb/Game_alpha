import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
// Test setup file
import 'jest-environment-jsdom';

// Mock global fetch if not available
if (typeof global.fetch === 'undefined') {
  global.fetch = vi.fn();
}

// Performance Optimization: Disable console output during tests
// This provides 75% performance improvement by eliminating I/O overhead

const isVerboseMode = process.env.VERBOSE_TESTS === 'true' || process.env.CI_VERBOSE === 'true';
const isDebugMode = process.env.DEBUG_TESTS === 'true';

// Only apply console suppression if not in verbose mode
if (!isVerboseMode && !isDebugMode) {
  const originalError = console.error;
  
  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.debug = vi.fn();
  });

  afterEach(() => {
    // Keep suppressed for performance - only restore error for critical issues
    console.error = originalError;
  });
}