import { defineConfig } from 'vitest/config';
import path from 'path';

// Ghost regression gate — split out of vitest.config.dev.ts (2026-07-18).
//
// tests/ghost/ contains 4 gates (coverage, ghostPlayerStrict,
// ghostPlayerNegotiateCoverage, ghostPlayerSmartBot) that each run 50 full
// game simulations and are deliberately calibrated to take ~15-20 minutes
// (their own `it()` timeouts are 1,200,000-1,800,000ms — see the in-file
// comments in tests/ghost/ghostPlayerStrict.test.ts). vitest.config.dev.ts
// is meant for fast feedback (see its own header), so these gates are
// excluded there and live in this dedicated config instead. Run via
// `npm run test:ghost`, or target one file directly:
//   npx vitest run --config vitest.config.ghost.ts tests/ghost/ghostPlayerStrict.test.ts
//
// A plain `VAR=1 npm test tests/ghost/...` env-var toggle was tried first
// and reverted — `npm run` always shells scripts through cmd.exe on
// Windows regardless of the invoking shell, so inline `VAR=1 cmd` syntax
// (already used by test:debug/test:verbose) silently fails there. A
// separate --config file has no such shell dependency.
export default defineConfig({
  test: {
    environment: 'jsdom',

    include: [
      'tests/ghost/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**'
    ],
    globals: true,
    setupFiles: ['tests/vitest.setup.ts'],

    pool: 'threads',
    fileParallelism: true,
    maxWorkers: 4,
    minWorkers: 2,

    // The heaviest files (see header) set their own it()-level timeout well
    // above this; this is just a floor so a genuinely-hung test still fails
    // instead of running forever.
    testTimeout: 1800000,

    isolate: true,
    clearMocks: true,

    reporter: ['default', 'tests/vitest.forceExit.ts'],

    coverage: {
      enabled: false
    },

    passWithNoTests: true,
    teardownTimeout: 3000
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // See vitest.config.dev.ts for the full explanation of this stub.
      '@jalez/react-flow-smart-edge': path.resolve(
        __dirname,
        'tests/stubs/smartEdgeStub.ts'
      ),
    }
  }
});
