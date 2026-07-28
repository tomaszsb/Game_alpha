// tests/helpers/seededRandom.ts
//
// Makes the heavy E2E game-loop tests deterministic.
//
// StateService.startGame() shuffles all five card decks with Fisher-Yates over
// unseeded `Math.random()` (StateService.ts:1771), and these tests never seeded
// it. Every setupGame() therefore dealt a different hand, so each run walked a
// slightly different path through the game. That is almost certainly why the
// long-running E2E timeout flake picks a different victim file and sub-test on
// every run (TODO.md, logged since 2026-07-13) — and why debugging it meant
// chasing a moving target: you could never re-run the failure you just saw.
//
// Seeding does not by itself fix the hang. It converts an unreproducible ghost
// into something you can re-run on demand and attach a debugger to.
//
// Usage:
//   E2E_SEED=12345 npx vitest run --config vitest.config.dev.ts tests/E2E-AllPaths.test.ts
//
// Sweeping for a seed that reproduces the hang is the intended workflow — see
// scripts/sweep-e2e-seeds.sh.

import { vi } from 'vitest';

/** Fixed default so an ordinary `npm test` is reproducible run to run. */
export const DEFAULT_E2E_SEED = 20260728;

/** The seed in force for this run: `E2E_SEED` if set and numeric, else the default. */
export function currentSeed(): number {
  const raw = process.env.E2E_SEED;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_E2E_SEED;
}

/**
 * Replace `Math.random` with a deterministic mulberry32 PRNG for the rest of
 * the test. Call it BEFORE anything that shuffles — i.e. before
 * `stateService.startGame()`.
 *
 * Returns a restore function. Callers generally don't need it: each
 * `setupGame()` re-installs a fresh generator from the same seed, so every
 * test starts from an identical deck regardless of what ran before it.
 */
export function seedMathRandom(seed: number = currentSeed()): () => void {
  let a = seed >>> 0;

  const mulberry32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32);
  return () => spy.mockRestore();
}
