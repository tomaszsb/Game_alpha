import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import path from 'path';

// Full-suite flake fix (2026-07-09): the two tests/ghost/ simulation files are
// ~94% of the suite's total CPU (measured 1,989s of 2,125s cumulative), and
// vitest's default sequencer schedules slowest-first — so both ghost files
// started immediately, pinned 2 of the 4 workers with tight CPU loops for the
// whole run, and starved whichever heavyweight E2E test happened to share the
// machine past the 30s timeout (E2E-AllPaths flaked in one session's full run,
// E2E-Multiplayer4P in another; each passes in <1s in isolation). Running the
// ghost files LAST gives the rest of the suite an uncontended machine, then
// lets the ghost sims have all workers to themselves. Preserves the default
// slowest-first order within each group. If a starvation flake ever recurs
// despite this, the next lever is a generous per-test timeout on the affected
// E2E game-loop test — not lowering the ghost gate.
class GhostLastSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    const isGhost = (f: TestSpecification) =>
      f.moduleId.replace(/\\/g, '/').includes('/tests/ghost/');
    return [...sorted.filter((f) => !isGhost(f)), ...sorted.filter(isGhost)];
  }
}

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

    // Ghost simulation files run after everything else — see GhostLastSequencer above.
    sequence: {
      sequencer: GhostLastSequencer,
    },

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
      '@': path.resolve(__dirname, './src'),
      // @jalez/react-flow-smart-edge ships a CJS dist/index.js inside an
      // ESM package, and its ESM build named-imports CJS-only `pathfinding`.
      // Both crash Node's loader under jsdom. Real edge geometry isn't
      // tested anywhere, so route the import to a no-op stub used only
      // in tests. Production builds use the real package via Vite's ESM
      // resolution (`module` field).
      '@jalez/react-flow-smart-edge': path.resolve(
        __dirname,
        'tests/stubs/smartEdgeStub.ts'
      ),
    }
  }
});
