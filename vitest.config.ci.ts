import { defineConfig } from 'vitest/config';
import path from 'path';

// CI configuration optimized for RELIABILITY and complete isolation
export default defineConfig({
  test: {
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

    // RELIABILITY OPTIMIZATIONS: Sequential execution with full isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,          // Sequential execution for CI reliability
        minForks: 1,
        isolate: true         // Complete isolation between tests
      }
    },

    // Conservative timeout for CI environments
    testTimeout: 30000,       // 30 seconds

    // Complete isolation between tests for CI reliability
    isolate: true,
    clearMocks: true,

    // Detailed reporter for CI
    reporter: ['default', 'junit'],

    // Full coverage configuration for CI
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*'],
      exclude: ['src/types/**/*', 'src/**/*.d.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // CI-specific settings
    passWithNoTests: false,   // Fail if no tests found (catch CI issues)
    bail: 1,                  // Stop on first failure in CI
    retry: 2                  // Retry flaky tests in CI
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});