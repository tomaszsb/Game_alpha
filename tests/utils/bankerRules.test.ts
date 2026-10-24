import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  decide, settlementAmount, configureBankerRules, resetBankerRules, DEFAULT_BANKER_ROWS, BankerSituation, BankerRow,
} from '../../src/utils/bankerRules';

const base: BankerSituation = {
  costToFinish: 5_000_000, cash: 500_000, daysUsed: 20, plannedDays: 300,
  pushBacks: 0, hasBuilderBid: false, hasExpeditor: false, bankLentBefore: false, refusals: 0,
};

function parseCsv(text: string): BankerRow[] {
  const rows: BankerRow[] = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const m = line.match(/^([^,]*),([^,]*),([^,]*),(.*)$/);
    if (!m) continue;
    let t = m[4];
    if (t.startsWith('"')) t = t.slice(1, -1).replace(/""/g, '"');
    rows.push({ kind: m[1], key: m[2], value: m[3], text: t });
  }
  return rows;
}

afterEach(() => resetBankerRules());

describe('robot banker decide()', () => {
  it('approves a small, early, comfortable loan as drawn', () => {
    const d = decide({ amount: 1_000_000, rate: 10 }, base);
    expect(d.answer).toBe('approve');
    expect(d.amount).toBe(1_000_000);
    expect(d.rate).toBe(10);
    expect(d.reasons.length).toBeGreaterThan(0);
  });

  it('refuses a huge loan on a project already past its schedule', () => {
    const d = decide({ amount: 5_000_000, rate: 5 }, { ...base, daysUsed: 400, pushBacks: 3 });
    expect(d.answer).toBe('refuse');
    expect(d.amount).toBe(0);
  });

  it('counters (smaller amount or higher rate) in the middle band', () => {
    const s = { ...base, daysUsed: 200 };
    const d = decide({ amount: 2_500_000, rate: 5 }, s);
    expect(['counter', 'refuse', 'approve']).toContain(d.answer);
    if (d.answer === 'counter') {
      expect(d.amount > 0).toBe(true);
      expect(d.amount <= 2_500_000).toBe(true);
      expect(d.rate >= 5 && d.rate <= 15).toBe(true);
    }
  });

  it('first visit is stricter than a return visit once the bank has lent', () => {
    const s = { ...base, daysUsed: 90 };
    const offer = { amount: 2_000_000, rate: 10 };
    const first = decide(offer, s);
    const back = decide(offer, { ...s, bankLentBefore: true });
    const rank = { refuse: 0, counter: 1, approve: 2 };
    expect(rank[back.answer]).toBeGreaterThanOrEqual(rank[first.answer]);
  });

  it('a student refused earlier (bank never lent) is judged like a new one', () => {
    const s = { ...base, daysUsed: 90, refusals: 1 };
    const offer = { amount: 2_000_000, rate: 10 };
    expect(decide(offer, s).answer).toBe(decide(offer, { ...s, refusals: 0 }).answer);
  });

  it('declines for good after two refusals, even for a lovely loan', () => {
    const d = decide({ amount: 500_000, rate: 15 }, { ...base, refusals: 2 });
    expect(d.answer).toBe('refuse');
    expect(d.final).toBe(true);
  });

  it('the second refusal is the final one; the first is not', () => {
    const bad = { ...base, daysUsed: 500, pushBacks: 4 };
    expect(decide({ amount: 5_000_000, rate: 5 }, { ...bad, refusals: 0 }).final).toBe(false);
    expect(decide({ amount: 5_000_000, rate: 5 }, { ...bad, refusals: 1 }).final).toBe(true);
  });

  it('is weighted 50/50: a bigger loan at a higher rate raises profit and lowers safe', () => {
    const small = decide({ amount: 500_000, rate: 5 }, base);
    const big = decide({ amount: 3_000_000, rate: 15 }, base);
    expect(big.profit).toBeGreaterThan(small.profit);
    expect(big.safe).toBeLessThan(small.safe);
  });

  it('reason lines are plain words: no scores, dice or card talk', () => {
    for (const r of DEFAULT_BANKER_ROWS.filter(x => x.kind === 'reason')) {
      expect(r.text).not.toMatch(/\bscore\b|\bdie\b|\bdice\b|\bcard\b|🎲|🃏/i);
    }
  });

  it('data file: BANKER.csv is the built-in table, row for row', () => {
    const csv = fs.readFileSync(path.resolve(__dirname, '../../public/data/CLEAN_FILES/BANKER.csv'), 'utf-8');
    expect(parseCsv(csv)).toEqual(DEFAULT_BANKER_ROWS);
  });

  it('a retuned data file changes the answer (cut-offs live in data)', () => {
    const offer = { amount: 1_000_000, rate: 10 };
    expect(decide(offer, base).answer).toBe('approve');
    configureBankerRules([{ kind: 'param', key: 'approve_first', value: '0.99', text: '' }, { kind: 'param', key: 'counter_first', value: '0.98', text: '' }]);
    expect(decide(offer, base).answer).toBe('refuse');
  });
});

describe('finish settlement (Tom\'s accepted table)', () => {
  const loan = 1_000_000;
  const interest = 100_000;
  it('10% or more early: the bank gives back 25% of the interest', () => {
    expect(settlementAmount(loan, interest, 300, 270)).toBe(-25_000);
  });
  it('within 10% either way: nothing', () => {
    expect(settlementAmount(loan, interest, 300, 300)).toBe(0);
    expect(settlementAmount(loan, interest, 300, 330)).toBe(0);
  });
  it('11 to 50% late: 0.5% of the loan', () => {
    expect(settlementAmount(loan, interest, 300, 340)).toBe(5_000);
    expect(settlementAmount(loan, interest, 300, 450)).toBe(5_000);
  });
  it('51 to 100% late: 1%; more than twice the plan: 2%', () => {
    expect(settlementAmount(loan, interest, 300, 460)).toBe(10_000);
    expect(settlementAmount(loan, interest, 300, 600)).toBe(10_000);
    expect(settlementAmount(loan, interest, 300, 700)).toBe(20_000);
  });
  it('no loan, no settlement', () => {
    expect(settlementAmount(0, 0, 300, 900)).toBe(0);
  });
});
