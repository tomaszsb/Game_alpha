import { defineConfig } from 'vitest/config';
import path from 'path';

// Development configuration optimized for SPEED and fast feedback loops
export default defineConfig({
  test: {
    // Use Node environment by default - much faster than jsdom for service tests
    // But automatically switch to jsdom for React component tests
    environment: 'node',
    environmentMatchGlobs: [
      // Use jsdom for React component tests (.tsx files)
      ['**/*.tsx', 'jsdom'],
      ['**/components/**/*.test.ts', 'jsdom'],
      ['**/components/**/*.test.tsx', 'jsdom']
    ],

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

    // STABLE EXECUTION: Single-threaded to avoid worker crashes
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true      // Run all tests in single process
      }
    },

    // Standard timeouts
    testTimeout: 30000,       // 30 seconds

    // Proper isolation for reliability
    isolate: true,            // Isolated environment between tests
    clearMocks: true,         // Still clear mocks for test reliability

    // Faster reporter
    reporter: ['default'],

    // Skip coverage for development speed (use test:coverage for coverage)
    coverage: {
      enabled: false
    },

    // Faster test discovery
    passWithNoTests: true
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});