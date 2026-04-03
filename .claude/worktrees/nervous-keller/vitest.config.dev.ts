import { defineConfig } from 'vitest/config';
import path from 'path';

// Development configuration optimized for SPEED and fast feedback loops
export default defineConfig({
  test: {
    // Use jsdom for all tests (component tests need it, service tests work with it)
    environment: 'jsdom',

    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx'
    ],
    exclude: [
      'tests/**/*.lightweight.test.ts',  // Exclude Jest-specific optimized tests
      'tests/**/*.optimized.test.ts',    // Exclude Jest-specific optimized tests
      'tests/debug-*.test.ts',           // Exclude debug files
      'node_modules/**',
      'dist/**'
    ],
    globals: true,
    setupFiles: ['tests/vitest.setup.ts'],

    // Parallel threads with limited workers for WSL2 stability
    // Force-exit reporter prevents post-test hang from open handles
    pool: 'threads',
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 2,

    // Standard timeouts
    testTimeout: 30000,       // 30 seconds

    // Proper isolation for reliability
    isolate: true,            // Isolated environment between tests
    clearMocks: true,         // Still clear mocks for test reliability

    // Default reporter + force-exit reporter (prevents hanging after tests complete)
    reporter: ['default', 'tests/vitest.forceExit.ts'],

    // Skip coverage for development speed (use test:coverage for coverage)
    coverage: {
      enabled: false
    },

    // Faster test discovery
    passWithNoTests: true,

    // Low teardown timeout to prevent hanging
    teardownTimeout: 3000
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
