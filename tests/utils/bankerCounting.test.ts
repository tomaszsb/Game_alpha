// Counting test for the robot banker: 400 projects built from the real work-package cards, each offered
// every real bank card, first visit and return visit. Shows how the approve / counter / refuse share moves
// with project size. The shares are written to BANKER_COUNT_OUT (a file) when that variable is set, because a
// passing vitest run swallows console output.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { bootstrapHeadlessServices } from '../../src/headless/bootstrapServices';
import { decide } from '../../src/utils/bankerRules';
import { bankerInputs, cappedBankOffer } from '../../src/utils/bankerInputs';
import { computeProjectFinances } from '../../src/utils/projectFinances';
import type { Player } from '../../src/types/StateTypes';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tally = { approve: number; counter: number; refuse: number; n: number };
const empty = (): Tally => ({ approve: 0, counter: 0, refuse: 0, n: 0 });

describe('robot banker over 400 real projects', () => {
  it('counts approve / counter / refuse by project size, first vs return visit', async () => {
    const { dataService, gameRulesService } = await bootstrapHeadlessServices();
    void gameRulesService;
    const wCards = dataService.getCardsByType('W');
    const bCards = dataService.getCardsByType('B');
    expect(wCards.length).toBeGreaterThan(100);
    expect(bCards.length).toBe(60);
    const lookup = (id: string) => dataService.getCardById(id);
    const rand = rng(20261024);

    const projects: Array<{ player: Player; scope: number; planned: number; pushBacks: number }> = [];
    for (let i = 0; i < 400; i++) {
      const k = 1 + Math.floor(rand() * 4);
      const picked = new Set<string>();
      while (picked.size < k) picked.add(wCards[Math.floor(rand() * wCards.length)].card_id);
      const hand = [...picked];
      const cards = hand.map(id => lookup(id)!);
      const scope = cards.reduce((s, c) => s + (parseFloat(String(c.cost)) || 0), 0);
      const types = new Set(cards.map(c => c.work_type_restriction).filter(Boolean));
      const planned = Math.round((300 + types.size * 100) * 1.1);
      const owner = Math.round((scope * (0.8 + rand() * 0.4)) / 10000) * 10000;
      const hasExp = rand() < 0.3;
      const pr = rand();
      const pushBacks = pr < 0.6 ? 0 : pr < 0.85 ? 1 : pr < 0.95 ? 2 : 3;
      const hasBuilder = rand() < 0.2;
      const player = {
        id: 'p', name: 'p', hand: hasExp ? [...hand, 'E001'] : hand, activeCards: [], money: owner,
        timeSpent: Math.round(30 + rand() * 130), contractor: hasBuilder ? { quality: 'MED', multiplier: 1 } : undefined, loans: [],
        moneySources: { ownerFunding: owner, bankLoans: 0, investmentDeals: 0, other: 0 },
        expenditures: { design: 0, fees: 0, construction: 0 }, bankRefusals: 0,
      } as unknown as Player;
      projects.push({ player, scope, planned, pushBacks });
    }
    const scopes = projects.map(p => p.scope).sort((a, b) => a - b);
    const t1 = scopes[Math.floor(scopes.length / 3)];
    const t2 = scopes[Math.floor((2 * scopes.length) / 3)];
    const size = (s: number) => (s <= t1 ? 'small' : s <= t2 ? 'medium' : 'large');

    const result: Record<string, Record<string, Tally>> = { first: {}, return: {} };
    let noGap = 0;
    for (const p of projects) {
      const gap = computeProjectFinances(p.player, lookup as never).fundingGap;
      for (const b of bCards) {
        const offer = cappedBankOffer(parseInt(String(b.loan_amount), 10), parseFloat(String(b.loan_rate)), gap);
        if (offer.amount <= 0) { noGap++; continue; }
        for (const visit of ['first', 'return'] as const) {
          const player = { ...p.player, moneySources: { ...p.player.moneySources, bankLoans: visit === 'return' ? 1 : 0 } } as Player;
          const s = bankerInputs(player, { getCardById: lookup as never, plannedDays: p.planned, pushBacks: p.pushBacks });
          const d = decide(offer, s);
          for (const bucket of [size(p.scope), 'all']) {
            const t = (result[visit][bucket] ||= empty());
            t[d.answer]++;
            t.n++;
          }
        }
      }
    }
    const lines: string[] = [`thresholds: small<=${t1}, medium<=${t2}; offers with no gap skipped: ${noGap}`];
    for (const visit of ['first', 'return']) {
      for (const bucket of ['small', 'medium', 'large', 'all']) {
        const t = result[visit][bucket];
        if (!t) continue;
        const pct = (x: number) => ((100 * x) / t.n).toFixed(1).padStart(5) + '%';
        lines.push(`${visit.padEnd(6)} ${bucket.padEnd(6)} n=${String(t.n).padStart(6)}  approve ${pct(t.approve)}  counter ${pct(t.counter)}  refuse ${pct(t.refuse)}`);
      }
    }
    if (process.env.BANKER_COUNT_OUT) fs.writeFileSync(process.env.BANKER_COUNT_OUT, lines.join('\n') + '\n');
    const all1 = result.first.all;
    expect(all1.approve).toBeGreaterThan(0);
    expect(all1.counter).toBeGreaterThan(0);
    expect(all1.refuse).toBeGreaterThan(0);
  });
});
