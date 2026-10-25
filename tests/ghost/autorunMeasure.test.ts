/**
 * What the filing rep's auto-run does to a game (BETA_PLAN_V3.md N3 item 4: "same seeded games: careful hand-play,
 * good rep, bad rep"). Not a gate: it only runs when AUTORUN_MEASURE=<games per setting> is set, and writes
 * .claude/autorun-measure.md. Run:
 *   AUTORUN_MEASURE=30 npx vitest run --config vitest.config.ghost.ts tests/ghost/autorunMeasure.test.ts
 *
 * Every setting plays the SAME seeded games (seeds 910001+), smart-Try-Again bot at 1 seat. The bot is handed its rep
 * on day 0 (it never hires). "Hand" settings never use the run; "run" settings send the rep after two send-backs.
 * Recorded per setting: finished games, median days used, time % and money % of plan (lower is better in both),
 * bankruptcies, how many games had a run at all, and how many stops the runs skipped per game.
 * A run only starts when the student is sent back twice in a row AND a rep is still on the team (reps can quit).
 */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame, type GhostGameResult } from './ghostPlayer';

const GAMES = parseInt(process.env.AUTORUN_MEASURE ?? '0', 10);

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

const SETTINGS: Array<{ label: string; reps: string[]; autoRun: boolean }> = [
  { label: 'Careful hand-play (no rep)', reps: [], autoRun: false },
  { label: 'Good rep, played by hand', reps: ['PERMITS-1'], autoRun: false },
  { label: 'Good rep, sent on the run', reps: ['PERMITS-1'], autoRun: true },
  { label: 'Bad rep, sent on the run', reps: ['PERMITS-4'], autoRun: true },
];

describe.skipIf(!GAMES)('auto-run measurement', () => {
  it('plays the same seeded games by hand and on the run', async () => {
    const out: string[] = ['# Auto-run measurement', '', `Bot: smart Try Again (rate 0.2), 1 seat, ${GAMES} games per setting, seeds 910001+. The bot is handed its rep on day 0; on the run it sends the rep after two send-backs in a row.`, ''];
    const rows: string[] = ['| Setting | Finished | Days used (median / mean) | Time % of plan (median) | Money % of plan (median) | Lost | Games with a run | Runs per game | Skipped stops per game |', '|---|---|---|---|---|---|---|---|---|'];
    const original = Math.random;
    for (const setting of SETTINGS) {
      const days: number[] = []; const time: number[] = []; const money: number[] = [];
      let finished = 0; let lost = 0; let games = 0; let steps = 0; let runs = 0; let gamesWithRun = 0;
      const failures: GhostGameResult[] = [];
      try {
        for (let i = 0; i < GAMES; i++) {
          Math.random = mulberry32(910001 + i);
          const services = await bootstrapHeadlessServices();
          const ar = services.autoRunService;
          const startRun = ar.run.bind(ar);
          let myRuns = 0;
          ar.run = async (id: string) => { myRuns++; return startRun(id); };
          const r = await playOneGame(services, { players: 1, maxTurns: 300, tryAgainProbability: 0.2, smartTryAgain: true, startReps: setting.reps, autoRun: setting.autoRun });
          if (!r.success) { failures.push(r); continue; }
          games++;
          const log = services.stateService.getGameState().globalActionLog;
          const stepLines = log.filter(e => e.details?.action === 'autorun_step');
          steps += stepLines.length;
          runs += myRuns; if (myRuns) gamesWithRun++;
          const p = services.stateService.getAllPlayers()[0];
          if (r.reason === 'FINISHED') {
            finished++;
            days.push(p.timeSpent ?? 0);
            const row = r.standings?.rows[0];
            if (row) { time.push(row.time); money.push(row.money); }
          } else lost++;
        }
      } finally {
        Math.random = original;
      }
      rows.push(`| ${setting.label} | ${finished}/${games} | ${median(days)} / ${f1(mean(days))} | ${f1(median(time))} | ${f1(median(money))} | ${lost} | ${gamesWithRun}/${games} | ${f1(runs / Math.max(1, games))} | ${f1(steps / Math.max(1, games))} |`);
      if (failures.length) out.push(`(${setting.label}: ${failures.length} game(s) did not end cleanly: ${failures.map(f => f.reason).join(', ')})`, '');
    }
    out.push(...rows, '');
    mkdirSync('.claude', { recursive: true });
    writeFileSync('.claude/autorun-measure.md', out.join('\n'));
  }, 3_600_000);
});
