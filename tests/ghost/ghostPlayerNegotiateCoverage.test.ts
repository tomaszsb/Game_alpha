/**
 * Ghost Player — negotiate-coverage gate.
 *
 * Split from the original ghostPlayer.test.ts (2026-07-09) so this batch runs
 * on its own worker in parallel with the strict and smart-bot batches
 * (siblings: ghostPlayerStrict.test.ts, ghostPlayerSmartBot.test.ts). See
 * ghostPlayerStrict.test.ts's header for the full split rationale.
 */

import { describe, it, expect } from 'vitest';
import { runGhostBatch, isHardFailure, type GhostGameResult } from './ghostPlayer';

describe('Ghost Player', () => {
  // NEGOTIATE-COVERAGE VARIANT — a bot that aggressively hammers Try Again on
  // negotiable spaces (blind p=0.2, regardless of whether the turn went well).
  // Its SOLE job is to stress the snapshot-revert path (Workstream 2): if a
  // restore ever leaks state — money not reverted, cards not removed, a fresh
  // approval grant not rolled back — accumulated drift over hundreds of retries
  // surfaces here as an EXCEPTION or INVARIANT_VIOLATION while the strict gate
  // stays green.
  //
  // Win-rate is deliberately NOT a tight assertion here. Blind Try Again throws
  // away approval stamps the bot just earned (they live in TEMP until end-of-turn),
  // and the Stage-1 gate at FINAL-REVIEW then routes the un-approved bot back to
  // the examiner — a regulatory loop that costs ~36% of games (deterministic
  // 32/50, avgTurns≈119). That's the reckless bot sabotaging itself, NOT a
  // game-balance signal — verified 2026-06-07: 0 hard failures, the gate and the
  // approval-revert both behaved correctly. The meaningful win floor lives on the
  // smart-bot variant (ghostPlayerSmartBot.test.ts). The coarse floor here only
  // catches Try Again stalling EVERY game outright (deadlock with no crash).
  it('negotiate-coverage: aggressive Try Again across spaces never crashes or leaks state', async () => {
    const batch = await runGhostBatch(50, {
      maxTurns: 300,
      tryAgainProbability: 0.2,
      baseSeed: 100001,
      progressLabel: 'negotiate-coverage',
      // Per-game cap doubled 30s → 60s (2026-07-09, split into a parallel
      // file) — see ghostPlayerStrict.test.ts's full note (same correction
      // applies here: the calibration run showed 50/50, up from the
      // historical ~32/50, because the 30s default was quietly counting some
      // legitimately-finishing-slow games as TURN_CAP non-wins — a measurement
      // artifact, not a balance change; 0 hard failures either way). Doubly
      // true here since this test's win floor was never meant to be a tight
      // balance signal in the first place (see the docstring above) — left at
      // ≥20 deliberately.
      perGameTimeoutMs: 60000,
    });
    console.log(`[ghost negotiate-coverage baseSeed=100001] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(isHardFailure);

    const summary =
      `\n[negotiate-coverage] ${batch.failures.length}/${batch.total} failures (${hardFailures.length} hard), ${batch.wins} wins, avgTurns=${batch.avgTurns.toFixed(1)}\n` +
      batch.failures
        .slice(0, 8)
        .map((f: GhostGameResult, i: number) => {
          const err = f.error ? f.error.split('\n')[0] : '';
          return `  #${i + 1} ${f.reason} turns=${f.turns} space=${f.finalSpace} :: ${err}\n      trail: ${f.trail.slice(-5).join(' → ')}`;
        })
        .join('\n');

    // PRIMARY gate: zero crashes / invariant violations — the whole point.
    expect(hardFailures, summary).toHaveLength(0);
    // Coarse sanity floor ONLY — guards against a regression that makes Try Again
    // deadlock every game (no crash, just stall). Far below the blind 32/50 so a
    // normal balance shift never trips it. NOT a balance assertion.
    expect(batch.wins, summary).toBeGreaterThanOrEqual(20);
  }, 1_200_000);
});
