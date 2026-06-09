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
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame, runGhostBatch, type GhostGameResult } from './ghostPlayer';

// Append one ghost-batch result (one JSON object per line) to
// .claude/ghost-history.jsonl so the win count is NEVER lost — vitest swallows
// a passing test's console.log, so the only durable record is a file write.
// Runs before the assertions, so it records on a FAIL too. Closes TODO #107.
function recordGhostHistory(entry: Record<string, unknown>): void {
  try {
    const path = '.claude/ghost-history.jsonl';
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // Non-fatal: history logging must never break the test.
  }
}

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
  // smart-bot variant below. The coarse floor here only catches Try Again
  // stalling EVERY game outright (deadlock with no crash).
  it('negotiate-coverage: aggressive Try Again across spaces never crashes or leaks state', async () => {
    const batch = await runGhostBatch(50, { maxTurns: 300, tryAgainProbability: 0.2, baseSeed: 100001 });
    console.log(`[ghost negotiate-coverage baseSeed=100001] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(
      (f: GhostGameResult) => f.reason === 'EXCEPTION' || f.reason === 'INVARIANT_VIOLATION'
    );

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

  // SMART-BOT WIN-RATE VARIANT — same aggressive Try Again (p=0.2), but the bot
  // plays it like a real person: it never undoes a turn on which it just earned a
  // DOB or FDNY approval stamp (smartTryAgain). That single rule breaks the
  // regulatory loop the blind bot falls into, so win-rate becomes a usable
  // balance signal instead of a measure of the bot fighting itself. Floor is
  // calibrated to the deterministic baseSeed=100001 result with a buffer, same
  // policy as the strict gate. Hard failures remain the primary gate.
  it('try-again smart-bot: 50 games, rational Try Again, no exceptions, win-rate floor', async () => {
    const batch = await runGhostBatch(50, {
      maxTurns: 300,
      tryAgainProbability: 0.2,
      smartTryAgain: true,
      baseSeed: 100001,
      // Pursuing the 90% win-rate goal: give every game enough wall-clock to
      // reach its NATURAL end (win, or the 300-turn cap) instead of being cut
      // off at 30s. Removes the machine-speed dependence so the win count is
      // deterministic and a usable balance signal. Worst-case batch ~25 min.
      perGameTimeoutMs: 120000,
    });
    console.log(`[ghost try-again smart baseSeed=100001] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(
      (f: GhostGameResult) => f.reason === 'EXCEPTION' || f.reason === 'INVARIANT_VIOLATION'
    );

    const summary =
      `\n[try-again smart-bot] ${batch.failures.length}/${batch.total} failures (${hardFailures.length} hard), ${batch.wins} wins, avgTurns=${batch.avgTurns.toFixed(1)}\n` +
      batch.failures
        .slice(0, 8)
        .map((f: GhostGameResult, i: number) => {
          const err = f.error ? f.error.split('\n')[0] : '';
          return `  #${i + 1} ${f.reason} turns=${f.turns} space=${f.finalSpace} :: ${err}\n      trail: ${f.trail.slice(-5).join(' → ')}`;
        })
        .join('\n');

    recordGhostHistory({
      test: 'smart-bot',
      baseSeed: 100001,
      wins: batch.wins,
      total: batch.total,
      avgTurns: Number(batch.avgTurns.toFixed(1)),
      longGames: batch.longGames,
      failures: batch.failures.length,
      hardFailures: hardFailures.length,
      perGameTimeoutMs: 120000,
      deterministic: true,
    });

    expect(hardFailures, summary).toHaveLength(0);
    // Calibrated 2026-06-08 to the DETERMINISTIC (games-finish) run, baseSeed=100001
    // with perGameTimeoutMs=120000: 47/50 wins (94%), avgTurns=149, 0 hard failures,
    // 3 genuine losses. Floor = measured − 4 = 43 (strict-gate buffer policy). This
    // run is machine-independent — no game reaches the 120s cap (the longest grind
    // to the 300-turn limit is ~50–80s), so the 3 losses are real, not timeouts.
    // The prior 31/50 was timeout-contaminated (30s cap); 16 of those 19 "losses"
    // were just unfinished games that win when given time. The 90% win-rate goal is
    // MET. The live signal now is game LENGTH (avgTurns 149, 40/50 long games) —
    // see ghost-win-rate TODO. Each run is appended to .claude/ghost-history.jsonl.
    expect(batch.wins, summary).toBeGreaterThanOrEqual(43);
  }, 2_700_000);
});
