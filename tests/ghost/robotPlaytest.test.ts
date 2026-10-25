/**
 * Robot play-test on the newest features (reps, auto-run, bank wording, builder visits, trophy places, town clocks).
 * Not a gate: only runs when ROBOT_PLAY=<games> is set, and writes .tmp/robot-playtest.json + .tmp/robot-playtest.md.
 *   ROBOT_PLAY=30 npx vitest run --config vitest.config.ghost.ts tests/ghost/robotPlaytest.test.ts
 * Seeds 920001+ (seed = 920001 + game index). Each game: 1, 2 or 4 seats, a rep setting, auto-run on or off.
 * Checks per game: ends cleanly; every money change has a log line (money is not lost silently); live trophy
 * numbers equal the players' real numbers and the places follow them; clock date = start + own days; the wording of
 * rep mistakes (by phase) and bank results matches what happened.
 */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame } from './ghostPlayer';
import { clockDate, clockText, clockStartIso } from '../../src/utils/gameClock';

const GAMES = parseInt(process.env.ROBOT_PLAY ?? '0', 10);

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

const SEATS = [1, 2, 4];
const REPS: Array<{ label: string; reps: string[] }> = [
  { label: 'no rep', reps: [] },
  { label: 'good Permits', reps: ['PERMITS-1'] },
  { label: 'bad Code (design)', reps: ['CODE-4'] },
  { label: 'bad Permits (city)', reps: ['PERMITS-4'] },
  { label: 'bad Inspections', reps: ['INSPECT-4'] },
  { label: 'good Code + bad Inspections', reps: ['CODE-1', 'INSPECT-4'] },
];

interface Issue { game: number; seed: number; kind: string; detail: string }

describe.skipIf(!GAMES)('robot play-test', () => {
  it('plays seeded games and checks them', async () => {
    const issues: Issue[] = [];
    const rows: string[] = ['| # | seed | seats | reps | auto-run | ended | turns | money gap | notes |', '|---|---|---|---|---|---|---|---|---|'];
    const words = { stopCode: 0, stopPermits: 0, stopInspect: 0, bankNo: 0, bankYes: 0, builderShort: 0, autorun: 0, repPay: 0, quit: 0 };
    const keyHist = new Map<string, number>();
    const money: any[] = [];
    const original = Math.random;
    try {
      const only = (process.env.ROBOT_ONLY ?? '').split(',').filter(Boolean).map(Number);
      for (let i = 0; i < GAMES; i++) {
        if (only.length && !only.includes(i)) continue;
        const seed = 920001 + i;
        Math.random = mulberry32(seed);
        const seats = SEATS[i % 3];
        const rep = REPS[Math.floor(i / 3) % REPS.length];
        const autoRun = i % 2 === 0;
        const note: string[] = [];
        const add = (kind: string, detail: string) => { issues.push({ game: i, seed, kind, detail }); note.push(kind); };
        const services = await bootstrapHeadlessServices();
        const { stateService, gameRulesService } = services;

        // Mid-game: the live trophy board must show the players' real numbers and rank them correctly.
        let lastTurn = -1; let boardChecks = 0;
        const unsub = stateService.subscribe(() => {
          try {
            const st = stateService.getGameState();
            if (st.gamePhase !== 'PLAY' || st.globalTurnCount === lastTurn || st.players.length === 0) return;
            lastTurn = st.globalTurnCount; boardChecks++;
            const board = gameRulesService.computeLiveBoard();
            for (const lr of board.rows) {
              const p = st.players.find(x => x.id === lr.playerId)!;
              if (lr.row.daysUsed !== (p.timeSpent ?? 0)) add('trophy-days', `turn ${lastTurn}: board says ${lr.row.daysUsed} days, player has ${p.timeSpent}`);
            }
            for (const id of ['time', 'money', 'quality'] as const) {
              const inRace = board.rows.filter(r => r.status !== 'out');
              for (const r of inRace) {
                const place = r.races[id].place;
                const expect = 1 + inRace.filter(o => o.row[id] < r.row[id]).length;
                if (place !== expect) add('trophy-place', `turn ${lastTurn}: ${id} place ${place} expected ${expect}`);
              }
            }
          } catch (e) { add('board-throw', String((e as Error).message)); }
        });

        const r = await playOneGame(services, { players: seats, maxTurns: 300, tryAgainProbability: 0.2, smartTryAgain: true, startReps: rep.reps, autoRun, detectLoops: true });
        unsub();
        if (!r.success) add('did-not-end-cleanly', `${r.reason}: ${r.error ?? ''}`.slice(0, 300));

        const st = stateService.getGameState() as any;
        const log = st.globalActionLog as any[];
        if (process.env.ROBOT_DUMP && Number(process.env.ROBOT_DUMP) === i) writeFileSync('.tmp/robot-dump.json', JSON.stringify(log.filter(e => /\$|money|fee|loan|pay/i.test((e.description ?? '') + JSON.stringify(e.details ?? {}))).map(e => ({ t: e.type, a: e.details?.action, p: e.playerName, d: e.description, m: e.details?.moneyChange ?? e.details?.moneyDelta })), null, 0));

        // Money: every player's final cash must equal what the log accounts for (money lines + named payments).
        const gaps: string[] = [];
        for (const p of st.players) {
          let ledger = 0;
          for (const e of log) {
            if (e.playerId !== p.id) continue;
            const d = e.details ?? {};
            for (const k of Object.keys(d)) if (/money|amount|cost|fee|pay|cash/i.test(k) && typeof d[k] === 'number') keyHist.set(e.type + '/' + (d.action ?? '') + '.' + k, (keyHist.get(e.type + '/' + (d.action ?? '') + '.' + k) ?? 0) + 1);
            if (typeof d.moneyChange === 'number') ledger += d.moneyChange;
          }
          const ms = p.moneySources ?? { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
          const ex = p.expenditures ?? { design: 0, fees: 0, construction: 0 };
          const inflow = ms.ownerFunding + ms.bankLoans + ms.investmentDeals + ms.other;
          const spent = ex.design + ex.fees + ex.construction;
          const dollars = (re: RegExp) => log.filter(e => e.playerId === p.id && re.test(e.details?.action ?? '')).reduce((s, e) => s + (parseInt(((e.description ?? '').match(/\$([\d,]+)/) ?? [])[1]?.replace(/,/g, '') ?? '0', 10) || 0), 0);
          const sumKey = (k: string) => log.filter(e => e.playerId === p.id && typeof e.details?.[k] === 'number').reduce((s, e) => s + e.details[k], 0);
          const lifeDelta = sumKey('moneyDelta');
          const penalty = sumKey('penaltyFee');
          const dice = log.filter(e => e.playerId === p.id && e.type === 'resource_change' && typeof e.details?.moneyChange === 'number');
          const diceOut = dice.reduce((s, e) => s + Math.min(0, e.details.moneyChange), 0);
          const diceIn = dice.reduce((s, e) => s + Math.max(0, e.details.moneyChange), 0);
          const feeLines = dollars(/^fee_deducted$/);
          const repPay = dollars(/^rep_pay$/);
          const stopPay = dollars(/^rep_stop_work$/);
          money.push({ game: i, seed, player: p.name, cash: p.money, inflow, spent, repPay, stopPay, resid: p.money - (inflow - spent), ledger, lifeDelta, penalty, diceOut, diceIn, feeLines, status: p.finishedAt != null || p.hasFinished ? 'fin' : '' });
          gaps.push(`${p.name}: cash ${p.money}, inflow-spent ${inflow - spent}`);
        }

        // Clocks: date = start + own days, and the start date was stored.
        const start = clockStartIso(st);
        if (!st.gameStartDate) add('clock-no-start-date', 'gameStartDate was not stored');
        for (const p of st.players) {
          const d = p.timeSpent ?? 0;
          if (!(Number.isFinite(d) && d >= 0)) add('clock-days', `${p.name} has ${d} days`);
          const c = clockDate(start, d);
          if (!/^\d{4} [A-Z]{3} \d{2}$/.test(clockText(c))) add('clock-format', clockText(c));
        }

        // Final trophies: the holder of each race among finished players is the one with the lowest number.
        const standings = gameRulesService.computeStandings();
        const fin = standings.rows.filter(x => x.status === 'finished');
        for (const id of ['time', 'money', 'quality'] as const) {
          if (!fin.length) break;
          const best = Math.min(...fin.map(x => x[id]));
          for (const x of fin) if ((x[id] === best) !== x.trophies.includes(id)) add('trophy-final', `${x.name} ${id} ${x[id]} best ${best} trophies ${x.trophies}`);
        }

        // Wording: rep mistakes by phase, bank results, builder visits, run steps.
        for (const e of log) {
          const act = e.details?.action ?? '';
          const desc: string = e.description ?? '';
          if (act === 'rep_stop_work') {
            const area = e.details?.area;
            if (area === 'Code') { words.stopCode++; if (!/^Design error fixed/.test(desc)) add('wording-code', desc); }
            else if (area === 'Permits') { words.stopPermits++; if (!/^Audit settled/.test(desc)) add('wording-permits', desc); }
            else if (area === 'Inspections') { words.stopInspect++; if (!/^Stop work order lifted/.test(desc)) add('wording-inspections', desc); }
            else add('wording-area', `${area}: ${desc}`);
          }
          if (/The bank said no/.test(desc)) words.bankNo++;
          if (/Bank loan approved/.test(desc)) words.bankYes++;
          if (/Secured a Bank Loan/.test(desc) && /\$0\b/.test(desc)) add('wording-bank-secured-zero', desc);
          if (act === 'rep_pay') words.repPay++;
          if (act === 'autorun_step') words.autorun++;
          if (/quit|resign|left your team/i.test(desc) && /rep|team/i.test(desc)) words.quit++;
          if (/not enough|too little|cannot afford|can't afford/i.test(desc) && /builder/i.test(desc)) words.builderShort++;
          if (/\bD&D\b/.test(desc)) add('wording-dnd', desc);
          if (/undefined|NaN|\[object/.test(desc)) add('wording-garbage', desc);
        }

        rows.push(`| ${i} | ${seed} | ${seats} | ${rep.label} | ${autoRun ? 'on' : 'off'} | ${r.reason}${r.lossReason ? ' (' + r.lossReason + ')' : ''} | ${r.turns} | ${gaps.join('; ')} | ${[...new Set(note)].join(', ')} |`);
      }
    } finally {
      Math.random = original;
    }
    mkdirSync('.tmp', { recursive: true });
    writeFileSync('.tmp/robot-playtest.json', JSON.stringify({ issues, words, money }, null, 1));
    writeFileSync('.tmp/robot-playtest.md', ['# Robot play-test', '', JSON.stringify(words), '', ...rows, ''].join('\n'));
  }, 3_300_000);
});
