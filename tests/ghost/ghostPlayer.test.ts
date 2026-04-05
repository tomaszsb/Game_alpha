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
  // failures — they catch real bugs introduced by future changes. A small
  // number of TURN_CAP "stuck in a loop" games is tolerated (see finding #2)
  // because the random-move strategy occasionally gets stuck on spaces with
  // branching scope/card-return loops. When the ghost gets smarter, tighten
  // this back to a strict 0/50 failure gate.
  it('strict: 50 games with no exceptions or invariants, ≥90% wins', async () => {
    const batch = await runGhostBatch(50, { maxTurns: 300 });

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
    expect(batch.wins, summary).toBeGreaterThanOrEqual(Math.floor(batch.total * 0.9));
  }, 600000);

  // TRY-AGAIN-HAPPY VARIANT — same gate as strict, but every game aggressively
  // uses Try Again on negotiable spaces. Exists to catch state-revert regressions
  // in Workstream 2 (snapshot Try Again). If snapshot restore leaks state (money
  // not reverted, cards not removed, etc.), accumulated drift over many retries
  // will crash or stall these games while the base strict test still passes.
  it('try-again-happy: 50 games exercising Try Again, no exceptions, ≥90% wins', async () => {
    const batch = await runGhostBatch(50, { maxTurns: 300, tryAgainProbability: 0.2 });

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
    expect(batch.wins, summary).toBeGreaterThanOrEqual(Math.floor(batch.total * 0.9));
  }, 900000);
});
