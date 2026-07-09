/**
 * Ghost Player — strict gate.
 *
 * This is the v3.0 Beta regression safety net. If any future change to a
 * service, space, card, or effect breaks gameplay for a randomly-playing
 * bot, this test will catch it.
 *
 * Split from the original ghostPlayer.test.ts (2026-07-09) so this batch runs
 * on its own worker in parallel with the negotiate-coverage and smart-bot
 * batches below (siblings: ghostPlayerNegotiateCoverage.test.ts,
 * ghostPlayerSmartBot.test.ts), instead of all three running one after
 * another in a single file. The custom sequencer in vitest.config.dev.ts
 * already runs every tests/ghost/ file last as a group; this split lets that
 * group finish in ~max(batch) instead of ~sum(batches).
 *
 * Current state (2026-04-04):
 *   - Infrastructure: WORKING. The bot runs real services, picks random
 *     valid actions, and reports detailed findings.
 *   - First run found a real Alpha bug on turn 0 — see
 *     docs/core/GHOST_PLAYER_FINDINGS.md finding #1. The "strict" test is
 *     marked .skip until that bug is fixed. The "diagnostic" test always
 *     runs and surfaces findings so regressions can't hide.
 */

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame, runGhostBatch, isHardFailure, type GhostGameResult } from './ghostPlayer';

describe('Ghost Player', () => {
  it('diagnostic: runs one game and reports findings (never fails CI)', async () => {
    const services = await bootstrapHeadlessServices();
    const result = await playOneGame(services, { maxTurns: 300 });

    // Always print the outcome — diagnostic information, not a pass/fail gate.
    // When the bug in finding #1 is fixed, convert this into a real assertion.
    console.log('\n=== Ghost Player diagnostic run ===');
    console.log(`outcome: ${result.reason} (success=${result.success})`);
    console.log(`turns: ${result.turns}, finalSpace: ${result.finalSpace}`);
    if (result.error) console.log(`error: ${result.error.split('\n')[0]}`);
    console.log('last 15 trail entries:');
    result.trail.slice(-15).forEach((t) => console.log('  ' + t));
    console.log('===================================\n');

    // Sanity: the bot infrastructure itself ran (at least got past startup)
    expect(result.turns).toBeGreaterThanOrEqual(0);
  }, 60000);

  // STRICT MODE — the real CI gate. Finding #1 (CardEffectHandler wiring gap
  // in the headless bootstrap) was resolved 2026-04-04.
  //
  // Assertion policy: ZERO exceptions and ZERO invariant violations are hard
  // failures — those catch real bugs introduced by future changes and remain
  // the primary purpose of this gate.
  //
  // The bot uses a forward-bias + least-visited heuristic at choice-movement
  // spaces (see pickDestination in ghostPlayer.ts). Without the heuristic the
  // random-move bot looped at PM-DECISION-CHECK and won ~70%; with it, win
  // rate is ~93% over 30 games and ~94% projected over 50.
  // Seeded: baseSeed makes the batch deterministic so the win-rate threshold
  // is no longer a flaky boundary. Each game in the batch runs with
  // Math.random = mulberry32(baseSeed + i), giving identical outcomes across
  // CI runs. Changes to game logic that affect bot win rate will move the
  // count by a known amount, and we can update the threshold consciously
  // rather than chase phantom flakes.
  it('strict: 50 games with no exceptions or invariants, win-rate floor', async () => {
    const batch = await runGhostBatch(50, {
      maxTurns: 300,
      baseSeed: 1,
      progressLabel: 'strict',
      // Per-game cap doubled 30s → 60s (2026-07-09, split into a parallel
      // file): this batch now runs concurrently with two sibling 50-game
      // batches instead of alone on a shared worker.
      //
      // CORRECTION: this was written expecting the raise to be pure headroom
      // with no effect on the win count. The calibration run instead showed
      // 50/50 — the 30s default was ALREADY quietly counting some legitimately-
      // finishing-but-slow games as non-wins (TURN_CAP) purely because they
      // didn't beat a machine-speed-dependent stopwatch, the exact effect
      // already documented for why the smart-bot variant needed a 120s cap.
      // Doubling the cap here surfaced the same effect for this batch — not a
      // game-balance change, a measurement artifact going away. Hard failures
      // stayed at 0 either way (that's still the primary gate).
      //
      // Deliberately did NOT tighten the win-rate floor below to match the new
      // 50/50 deterministic result — re-tightening a balance-signal gate is a
      // separate decision from a test-infra timing fix, and the existing ≥36
      // floor still does its job (catches a real collapse) with more headroom
      // now, not less. Revisit consciously if wanted, not as a side effect.
      perGameTimeoutMs: 60000,
    });
    console.log(`[ghost strict baseSeed=1] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(isHardFailure);

    const summary =
      `\n${batch.failures.length}/${batch.total} failures (${hardFailures.length} hard), ${batch.wins} wins, avgTurns=${batch.avgTurns.toFixed(1)}\n` +
      batch.failures
        .slice(0, 8)
        .map((f: GhostGameResult, i: number) => {
          const err = f.error ? f.error.split('\n')[0] : '';
          return `  #${i + 1} ${f.reason} turns=${f.turns} space=${f.finalSpace} :: ${err}\n      trail: ${f.trail.slice(-5).join(' → ')}`;
        })
        .join('\n');

    expect(hardFailures, summary).toHaveLength(0);
    // Deterministic threshold (baseSeed=1). Hard failures
    // (EXCEPTION/INVARIANT_VIOLATION) are the PRIMARY gate; win rate is a
    // secondary "bot isn't stuck in a loop" floor.
    //
    // Recalibrated v3.0.37 (2026-05-29): 45 → 36. Life events (L cards) now
    // actually apply their money/time effects on auto-draw — before, they were
    // silent no-ops. Life events net-penalize a player who can't strategize, so
    // the *random* bot's deterministic win count dropped 45 → 39 (avgTurns
    // ~unchanged, still 0 hard failures). The old ≥45 (90%) bar reflected the
    // pre-fix world where life events did nothing.
    //
    // Recalibrated again 2026-07-09: 36 → 38 (a fixed ≥75% policy, maintainer
    // choice). The per-game timeout fix above (30s → 60s) revealed the
    // deterministic win count was actually 50/50, not 39/50 — the old number
    // undercounted games that were finishing fine but got cut off by the
    // stopwatch. 38 (75% of 50) is deliberately NOT tightened all the way to
    // "measured − small buffer" (~45-47) — leaves real headroom below the
    // current 50/50 so normal future balance drift doesn't flake the gate,
    // while still meaningfully raising the bar from the old 72% (36/50).
    expect(batch.wins, summary).toBeGreaterThanOrEqual(38);
    // Timeout raised 900000 → 1800000 (2026-06-14): 50 games at the current
    // game length need ~15-20 min (the sibling negotiate-coverage run takes
    // ~17 min), so the old 15-min budget timed out before reaching the
    // assertions — same fix v3.0.70 made for the smart-bot test. The per-game
    // 60s cap (the real pathological-loop guard) is unchanged. v3.0.79's FDNY
    // auto-answers route the blind bot correctly through the regulatory path
    // (a few more turns/game) instead of randomly skipping ahead, which is
    // what tipped the borderline budget over.
  }, 1800000);
});
