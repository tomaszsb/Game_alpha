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
//
// Currently dormant (2026-07-18): tests/ghost/** is now excluded from this
// config entirely (see the `exclude` array below), so `isGhost` never
// matches and this sorts identically to BaseSequencer. Left in place —
// harmless no-op — in case tests/ghost/** is ever folded back into this
// config's `include`, at which point the starvation fix above is needed
// again.
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
      // `npm test` hang root cause (2026-07-18): tests/ghost/ contains 4
      // regression gates (coverage, ghostPlayerStrict, ghostPlayerNegotiateCoverage,
      // ghostPlayerSmartBot) each running 50 full game simulations. Their own
      // `it()` timeouts are 1,200,000-1,800,000ms (20-30 min) — deliberately
      // calibrated that high because a passing run genuinely takes that long
      // (see in-file comments: "50 games... need ~15-20 min", "sibling
      // negotiate-coverage run takes ~17 min"). vitest.config.dev.ts's own
      // header calls this "SPEED and fast feedback loops", but its broad
      // `tests/**/*.test.ts` include was quietly pulling in these ~20-30-min
      // gates too — so plain `npm test` was never actually deadlocked, it was
      // correctly running a 20-30+ minute job that looked identical to a hang
      // to anyone who (reasonably) didn't wait that long. The project's own
      // trusted workaround (tests/scripts/run-tests-batch-fixed.sh) has never
      // included tests/ghost/ — it runs an explicit whitelist of files — so
      // this exclude just makes the default `npm test` match that convention.
      // Run the gate explicitly with `npm run test:ghost` (see
      // vitest.config.ghost.ts) — kept as a separate config file rather than
      // an env-var toggle here because `npm run` always shells out via
      // cmd.exe on Windows regardless of the invoking shell, so an inline
      // `VAR=1 vitest ...` script (the pattern test:debug/test:verbose already
      // use) silently fails outside a POSIX shell.
      'tests/ghost/**',
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
