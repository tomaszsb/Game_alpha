/**
 * Ghost Player test suite.
 *
 * This is the v3.0 Beta regression safety net. If any future change to a
 * service, space, card, or effect breaks gameplay for a randomly-playing
 * bot, this test will catch it.
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
import { playOneGame, runGhostBatch, type GhostGameResult } from './ghostPlayer';

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
    const batch = await runGhostBatch(50, { maxTurns: 300, baseSeed: 1 });
    console.log(`[ghost strict baseSeed=1] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(
      (f: GhostGameResult) => f.reason === 'EXCEPTION' || f.reason === 'INVARIANT_VIOLATION'
    );

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
    // pre-fix world where life events did nothing. 36 leaves a 3-game buffer
    // below the new deterministic 39 — it still catches a real collapse
    // (loops/state drift → many TURN_CAPs) while tolerating the now-correct,
    // harder economy (this + the v3.0.35 construction-cost / bank-loan fixes).
    expect(batch.wins, summary).toBeGreaterThanOrEqual(36);
  }, 900000);

  // TRY-AGAIN-HAPPY VARIANT — same gate as strict, but every game aggressively
  // uses Try Again on negotiable spaces. Exists to catch state-revert regressions
  // in Workstream 2 (snapshot Try Again). If snapshot restore leaks state (money
  // not reverted, cards not removed, etc.), accumulated drift over many retries
  // will crash or stall these games while the base strict test still passes.
  //
  // Threshold note: with Try Again at p=0.2, the bot frequently retries unlucky
  // turns and accumulates time, which costs win-rate. Historically ~82-88% even
  // when nothing is broken — the 90% bar was a flaky boundary. With baseSeed=100001
  // the deterministic outcome is 41/50; threshold is set to 40 (one-game buffer)
  // so the gate catches a real regression to ≤39 wins (which would also blow up
  // the hard-failure count anyway).
  it('try-again-happy: 50 games exercising Try Again, no exceptions, ≥80% wins', async () => {
    const batch = await runGhostBatch(50, { maxTurns: 300, tryAgainProbability: 0.2, baseSeed: 100001 });
    console.log(`[ghost try-again-happy baseSeed=100001] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(
      (f: GhostGameResult) => f.reason === 'EXCEPTION' || f.reason === 'INVARIANT_VIOLATION'
    );

    const summary =
      `\n[try-again-happy] ${batch.failures.length}/${batch.total} failures (${hardFailures.length} hard), ${batch.wins} wins, avgTurns=${batch.avgTurns.toFixed(1)}\n` +
      batch.failures
        .slice(0, 8)
        .map((f: GhostGameResult, i: number) => {
          const err = f.error ? f.error.split('\n')[0] : '';
          return `  #${i + 1} ${f.reason} turns=${f.turns} space=${f.finalSpace} :: ${err}\n      trail: ${f.trail.slice(-5).join(' → ')}`;
        })
        .join('\n');

    expect(hardFailures, summary).toHaveLength(0);
    expect(batch.wins, summary).toBeGreaterThanOrEqual(40);
  }, 900000);
});
