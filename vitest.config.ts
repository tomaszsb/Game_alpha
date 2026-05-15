import { defineConfig, defineProject } from 'vitest/config';
import path from 'path';

// Files that need forks pool because they mock window.location
// (non-configurable property in vmThreads jsdom)
const forksFiles = [
  'tests/utils/networkDetection.test.ts',
  'tests/utils/dictionaryBridge.test.ts',
  'tests/utils/dictionaryBridge_embedded.test.ts',
  'tests/components/modals/EndGameModal.test.tsx',
  'tests/dictionary/terms.test.ts',
];

const commonExclude = [
  'tests/**/*.lightweight.test.ts',  // Exclude Jest-specific optimized tests
  'tests/**/*.optimized.test.ts',    // Exclude Jest-specific optimized tests
  'tests/debug-*.test.ts',           // Exclude debug files
  'node_modules/**',
  'dist/**'
];

export default defineConfig({
  test: {
    projects: [
      // Most tests: fast VM-based isolation (~1s/file instead of ~15s/file)
      defineProject({
        test: {
          name: 'vmThreads',
          environment: 'jsdom',
          include: [
            'tests/**/*.test.ts',
            'tests/**/*.test.tsx'
          ],
          exclude: [...commonExclude, ...forksFiles],
          globals: true,
          setupFiles: ['tests/vitest.setup.ts'],
          pool: 'vmThreads',
          testTimeout: 30000,
          isolate: true,
          clearMocks: true,
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, './src')
          }
        }
      }),
      // Tests that mock window.location: need full process isolation
      defineProject({
        test: {
          name: 'forks',
          environment: 'jsdom',
          include: forksFiles,
          globals: true,
          setupFiles: ['tests/vitest.setup.ts'],
          pool: 'forks',
          testTimeout: 30000,
          isolate: true,
          clearMocks: true,
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, './src')
          }
        }
      }),
    ],

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
