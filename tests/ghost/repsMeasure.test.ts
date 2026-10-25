/**
 * What reps do to a game (BETA_PLAN_V3.md N3 item 2: "same seeded games with 0, 1, 2 and 3 reps").
 * Not a gate: it only runs when REPS_MEASURE=<games per setting> is set, and writes .claude/reps-measure.md. Run:
 *   REPS_MEASURE=30 npx vitest run --config vitest.config.ghost.ts tests/ghost/repsMeasure.test.ts
 *
 * Every setting plays the SAME seeded games (seeds 910001+). The bot is the smart-Try-Again one at 1 seat; it
 * never hires, so reps are handed to it on day 0. It answers every rep pop-up by the rules in repRules.ts
 * (a good rep who asks for a raise gets the biggest one; a stop work order is paid by the robot rule).
 * Recorded per setting: finished games, median days used, time % and money % of plan (lower is better in both),
 * bankruptcies, and how many quits and stop work orders there were per game.
 */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame, type GhostGameResult } from './ghostPlayer';

const GAMES = parseInt(process.env.REPS_MEASURE ?? '0', 10);

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
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

const SETTINGS: Array<{ label: string; reps: string[] }> = [
  { label: '0 reps', reps: [] },
  { label: '1 good (Permits)', reps: ['PERMITS-1'] },
  { label: '2 good (Permits, Code)', reps: ['PERMITS-1', 'CODE-1'] },
  { label: '3 good (Permits, Code, Inspections)', reps: ['PERMITS-1', 'CODE-1', 'INSPECT-1'] },
  { label: '1 bad (Permits)', reps: ['PERMITS-4'] },
];

describe.skipIf(!GAMES)('reps measurement', () => {
  it('plays the same seeded games with 0, 1, 2 and 3 reps', async () => {
    const out: string[] = ['# Reps measurement', '', `Bot: smart Try Again (rate 0.2), 1 seat, ${GAMES} games per setting, seeds 910001+. The bot is handed its reps on day 0 and never hires or fires on its own.`, ''];
    const rows: string[] = ['| Setting | Finished | Days used (median / mean) | Time % of plan (median) | Money % of plan (median) | Team pay per game | Lost | Quits per game | Stop work orders per game |', '|---|---|---|---|---|---|---|---|---|'];
    const original = Math.random;
    for (const setting of SETTINGS) {
      const days: number[] = []; const time: number[] = []; const money: number[] = []; const pay: number[] = [];
      let finished = 0; let lost = 0; let quits = 0; let stops = 0; let games = 0;
      const failures: GhostGameResult[] = [];
      try {
        for (let i = 0; i < GAMES; i++) {
          Math.random = mulberry32(910001 + i);
          const services = await bootstrapHeadlessServices();
          const log = services.loggingService as unknown as { info: (m: string, p?: { action?: string }) => void };
          const info = log.info.bind(log);
          let q = 0; let sw = 0;
          log.info = (m, p) => { if (p?.action === 'rep_left' && /left the team/.test(m)) q++; if (p?.action === 'rep_stop_work') sw++; return info(m, p); };
          const r = await playOneGame(services, { players: 1, maxTurns: 300, tryAgainProbability: 0.2, smartTryAgain: true, startReps: setting.reps });
          if (!r.success) { failures.push(r); continue; }
          games++;
          quits += q; stops += sw;
          const p = services.stateService.getAllPlayers()[0];
          if (r.reason === 'FINISHED') {
            finished++;
            days.push(p.timeSpent ?? 0);
            pay.push(p.expenditures?.team ?? 0);
            const row = r.standings?.rows[0];
            if (row) { time.push(row.time); money.push(row.money); }
          } else lost++;
        }
      } finally {
        Math.random = original;
      }
      rows.push(`| ${setting.label} | ${finished}/${games} | ${median(days)} / ${f1(mean(days))} | ${f1(median(time))} | ${f1(median(money))} | $${Math.round(mean(pay)).toLocaleString()} | ${lost} | ${f1(quits / Math.max(1, games))} | ${f1(stops / Math.max(1, games))} |`);
      if (failures.length) out.push(`(${setting.label}: ${failures.length} game(s) did not end cleanly: ${failures.map(f => f.reason).join(', ')})`, '');
    }
    out.push(...rows, '');
    mkdirSync('.claude', { recursive: true });
    writeFileSync('.claude/reps-measure.md', out.join('\n'));
  }, 3_600_000);
});
