/**
 * Three-trophy measurement (Job 3): how long games run with 1-4 seats, and how far apart the three
 * percentages spread. Not a gate — it only runs when TROPHY_MEASURE=<games per table size> is set, and
 * writes its report to .claude/trophy-measure.md. Run:
 *   TROPHY_MEASURE=20 npx vitest run --config vitest.config.ghost.ts tests/ghost/trophyMeasure.test.ts
 *
 * "Before" is computed from the SAME games, not a second run: under the old rule the game stopped at
 * the first moment anyone finished or went out, and until that moment the games are identical (same
 * seed, same turn order), so min(finishedAtTurn, outAtTurn) over the players IS the old end.
 */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame, type GhostGameResult } from './ghostPlayer';

const GAMES = parseInt(process.env.TROPHY_MEASURE ?? '0', 10);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

describe.skipIf(!GAMES)('trophy measurement', () => {
  it('measures game length and trophy spread for 1-4 seats', async () => {
    const out: string[] = ['# Three-trophy measurement', '', `Bot: smart Try Again (15% push-back rate 0.2), ${GAMES} games per table size, seeds 700001+.`, ''];
    const lenRows: string[] = ['| Players | Old rule: total turns to game end (median / mean) | New rule: total turns (median / mean) | Old: turns per seat (mean) | New: turns per seat (mean) | Games with a winner | Players out per game |', '|---|---|---|---|---|---|---|'];
    const spreadRows: string[] = ['| Players | Time % (median, min-max) | Money % | Quality % | Decided by 2 trophies | Decided by lowest total | Winner held the 3 trophies |', '|---|---|---|---|---|---|---|'];

    for (const seats of [1, 2, 3, 4]) {
      const oldEnds: number[] = [];
      const newEnds: number[] = [];
      let withWinner = 0;
      let outs = 0;
      let games = 0;
      let byTrophies = 0;
      let bySum = 0;
      let three = 0;
      const time: number[] = [];
      const money: number[] = [];
      const quality: number[] = [];
      const failures: GhostGameResult[] = [];
      const original = Math.random;
      try {
        for (let i = 0; i < GAMES; i++) {
          Math.random = mulberry32(700001 + i);
          const services = await bootstrapHeadlessServices();
          const r = await playOneGame(services, { players: seats, maxTurns: 300, tryAgainProbability: 0.2, smartTryAgain: true });
          if (!r.success || !r.timeline) { failures.push(r); continue; }
          games++;
          const events = r.timeline.map(t => t.finishedAtTurn ?? t.outAtTurn).filter((x): x is number => x !== undefined);
          oldEnds.push(Math.min(...events));
          newEnds.push(r.gameTurns ?? 0);
          outs += r.timeline.filter(t => t.outAtTurn !== undefined).length;
          if (r.standings?.winnerId) {
            withWinner++;
            if (r.standings.decidedBy === 'trophies') byTrophies++; else bySum++;
            const w = r.standings.rows.find(x => x.playerId === r.standings!.winnerId)!;
            if (w.trophies.length === 3) three++;
          }
          for (const row of r.standings?.rows ?? []) {
            if (row.status !== 'finished') continue;
            time.push(row.time); money.push(row.money); quality.push(row.quality);
          }
        }
      } finally {
        Math.random = original;
      }
      const rng = (xs: number[]) => `${f1(median(xs))} (${f1(Math.min(...xs))}-${f1(Math.max(...xs))})`;
      lenRows.push(`| ${seats} | ${median(oldEnds)} / ${f1(mean(oldEnds))} | ${median(newEnds)} / ${f1(mean(newEnds))} | ${f1(mean(oldEnds) / seats)} | ${f1(mean(newEnds) / seats)} | ${withWinner}/${games} | ${f1(outs / Math.max(1, games))} |`);
      spreadRows.push(`| ${seats} | ${rng(time)} | ${rng(money)} | ${rng(quality)} | ${byTrophies} | ${bySum} | ${three}/${withWinner} |`);
      if (failures.length) out.push(`(${seats} seats: ${failures.length} game(s) did not end cleanly: ${failures.map(f => f.reason).join(', ')})`, '');
    }

    out.push('## Game length', '', ...lenRows, '', '## Spread of the three percentages (finished players only)', '', ...spreadRows, '');
    mkdirSync('.claude', { recursive: true });
    writeFileSync('.claude/trophy-measure.md', out.join('\n'));
  }, 3_600_000);
});
