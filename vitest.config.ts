import { defineConfig } from 'vitest/config';
import path from 'path';

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
    
    // Optimized configuration for reliability over speed
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1, // Sequential execution
        minForks: 1,
        isolate: true
      }
    },

    // Reasonable timeout
    testTimeout: 30000, // 30 seconds

    // Complete isolation between tests
    isolate: true,
    clearMocks: true,
    
    // Reporter configuration
    reporter: ['default'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: ['src/types/**/*', 'src/**/*.d.ts']
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});