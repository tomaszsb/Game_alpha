/**
 * Ghost Player — try-again smart-bot gate.
 *
 * Split from the original ghostPlayer.test.ts (2026-07-09) so this batch runs
 * on its own worker in parallel with the strict and negotiate-coverage
 * batches (siblings: ghostPlayerStrict.test.ts,
 * ghostPlayerNegotiateCoverage.test.ts). See ghostPlayerStrict.test.ts's
 * header for the full split rationale.
 */

import { describe, it, expect } from 'vitest';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runGhostBatch, isHardFailure, type GhostGameResult } from './ghostPlayer';

// Which CODE produced this row? Until 2026-09-04 the history recorded only the
// numbers, so two identical rows were equally consistent with "two different
// configurations now agree" (a proof) and "the same configuration ran twice"
// (proof of nothing) — that ambiguity blocked verifying the v3.2.48 RNG fix.
// `head` is the commit; `tree` hashes the uncommitted delta (tracked diff +
// porcelain status, so untracked scratch files count too). Two rows with the
// same head+tree are the SAME code; different tree = different code.
function codeFingerprint(): { head: string; tree: string } {
  try {
    const git = (args: string[]): string =>
      execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const head = git(['rev-parse', '--short', 'HEAD']).trim();
    const delta = git(['status', '--porcelain']) + git(['diff', 'HEAD']);
    const tree = delta.trim() === ''
      ? 'clean'
      : createHash('sha1').update(delta).digest('hex').slice(0, 12);
    return { head, tree };
  } catch {
    return { head: 'unknown', tree: 'unknown' };
  }
}

// Append one ghost-batch result (one JSON object per line) to
// .claude/ghost-history.jsonl so the win count is NEVER lost — vitest swallows
// a passing test's console.log, so the only durable record is a file write.
// Runs before the assertions, so it records on a FAIL too. Closes TODO #107.
function recordGhostHistory(entry: Record<string, unknown>): void {
  try {
    const path = '.claude/ghost-history.jsonl';
    mkdirSync(dirname(path), { recursive: true });
    const { head, tree } = codeFingerprint();
    appendFileSync(
      path,
      JSON.stringify({ ts: new Date().toISOString(), head, tree, ...entry }) + '\n'
    );
  } catch {
    // Non-fatal: history logging must never break the test.
  }
}

describe('Ghost Player', () => {
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
      // Unchanged by the 2026-07-09 parallel-file split — this was already
      // generous enough to absorb sibling-batch contention.
      perGameTimeoutMs: 120000,
      // Rational play must never soft-lock: a 300-turn non-finish that is an
      // exact space-cycle is a LOOP (hard failure), not a tolerated slow loss.
      // This is the gate that would have caught the Prof Cert loop (v3.0.79).
      detectLoops: true,
      progressLabel: 'smart-bot',
    });
    console.log(`[ghost try-again smart baseSeed=100001] ${batch.wins}/${batch.total} wins, avgTurns=${batch.avgTurns.toFixed(1)}`);

    const hardFailures = batch.failures.filter(isHardFailure);

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
    // with perGameTimeoutMs=120000. Re-measured 2026-06-16 after adding detectLoops:
    // now 50/50 wins, avgTurns=83.6, 0 hard failures, 0 LOOPs (was 47/50 avgTurns=149
    // on 2026-06-08 — the v3.0.79/80 FDNY auto-answer + Prof Cert routing fixes let
    // rational play finish faster and more reliably). Floor stays 43 (a minimum, not
    // a target — leave headroom so a small balance shift doesn't flake the gate).
    // detectLoops:true means a 300-turn exact-cycle non-finish would now count as a
    // hard LOOP failure; 0 today confirms rational play never soft-locks. Each run is
    // appended to .claude/ghost-history.jsonl.
    expect(batch.wins, summary).toBeGreaterThanOrEqual(43);
  }, 2_700_000);
});
