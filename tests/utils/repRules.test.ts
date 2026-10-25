import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_REP_ROWS, buildRepRules, configureRepRules, resetRepRules, getRepRules, repAreaOf, visitShift, salaryDue,
  salaryOnLeaving, pickOffers, rollHits, raiseAccepted, raisedSalary, stopWorkOptions, robotStopWork, repsDueForRoll,
  newHeldRep, getRepDef, weeklyPay,
} from '../../src/utils/repRules';
import type { HeldRep } from '../../src/types/DataTypes';

function parseCsv(text: string) {
  // The files used here have quoted commas but no quoted newlines.
  return text.split(/\r?\n/).filter(Boolean).slice(1).map(line => {
    const cells: string[] = [];
    let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { cells.push(cur); cur = ''; } else cur += c;
    }
    cells.push(cur);
    return { kind: cells[0], key: cells[1], value: cells[2], text: cells[3] ?? '' };
  });
}

const held = (id: string, billed = 0): HeldRep => ({ id, salary: getRepDef(id)!.salary, hiredDay: billed, salaryBilledThroughDay: billed });

describe('REPS.csv', () => {
  it('is the same table as the built-in defaults', () => {
    const file = parseCsv(fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES/REPS.csv'), 'utf-8'));
    expect(file).toEqual(DEFAULT_REP_ROWS);
  });

  it('has three areas of reps, each with good and bad ones', () => {
    const r = buildRepRules(DEFAULT_REP_ROWS);
    for (const area of ['Code', 'Permits', 'Inspections']) {
      const inArea = r.reps.filter(x => x.area === area);
      expect(inArea.some(x => x.sign === 'good')).toBe(true);
      expect(inArea.some(x => x.sign === 'bad')).toBe(true);
    }
    // A bad rep is cheaper: that is the temptation.
    const bad = r.reps.filter(x => x.sign === 'bad').map(x => x.salary);
    const good = r.reps.filter(x => x.sign === 'good').map(x => x.salary);
    expect(Math.max(...bad)).toBeLessThan(Math.min(...good));
  });

  it('a file with no usable rep rows keeps the built-in table', () => {
    configureRepRules([{ kind: 'junk', key: '<html>', value: '', text: '' }]);
    expect(getRepRules().reps.length).toBe(buildRepRules(DEFAULT_REP_ROWS).reps.length);
    resetRepRules();
  });
});

describe('areas', () => {
  it('names the area of a space, and null for the office and the bank', () => {
    expect(repAreaOf('ARCH-INITIATION')).toBe('Code');
    expect(repAreaOf('ENG-SCOPE-CHECK')).toBe('Code');
    expect(repAreaOf('REG-DOB-PLAN-EXAM')).toBe('Permits');
    expect(repAreaOf('REG-FDNY-FEE-REVIEW')).toBe('Permits');
    expect(repAreaOf('SI-HIRE')).toBe('Inspections');
    expect(repAreaOf('CON-INSPECT')).toBe('Inspections');
    expect(repAreaOf('PM-DECISION-CHECK')).toBeNull();
    expect(repAreaOf('BANK-FUND-REVIEW')).toBeNull();
    expect(repAreaOf(undefined)).toBeNull();
  });
});

describe('visits', () => {
  it('a good rep takes 3 days off a visit in its area, a bad rep adds 3, others do nothing', () => {
    expect(visitShift([held('CODE-1')], 'ARCH-FEE-REVIEW', 15).delta).toBe(-3);
    expect(visitShift([held('CODE-4')], 'ARCH-FEE-REVIEW', 15).delta).toBe(3);
    expect(visitShift([held('PERMITS-1')], 'ARCH-FEE-REVIEW', 15).delta).toBe(0);
    expect(visitShift([held('CODE-1')], 'PM-DECISION-CHECK', 5).delta).toBe(0);
  });

  it('two reps in one area stack, and a good rep never takes off more than the visit costs', () => {
    expect(visitShift([held('CODE-1'), held('CODE-2')], 'ARCH-FEE-REVIEW', 15).delta).toBe(-6);
    expect(visitShift([held('CODE-1'), held('CODE-2')], 'ARCH-INITIATION', 5).delta).toBe(-5);
    expect(visitShift([held('CODE-1')], 'ARCH-INITIATION', 0).delta).toBe(0);
    expect(visitShift([held('CODE-1'), held('CODE-4')], 'ARCH-FEE-REVIEW', 15).delta).toBe(0);
  });

  it('no roster is no change', () => {
    expect(visitShift(undefined, 'ARCH-INITIATION', 5)).toEqual({ delta: 0, helped: [], hurt: [] });
  });
});

describe('salary', () => {
  it('bills whole weeks only: 6 days owes nothing, 14 days owes two weeks, 20 days still two', () => {
    const h = held('CODE-1', 10);
    expect(salaryDue(h, 16).amount).toBe(0);
    expect(salaryDue(h, 24)).toEqual({ weeks: 2, amount: 1000 });
    expect(salaryDue(h, 30)).toEqual({ weeks: 2, amount: 1000 });
  });

  it('hiring sets the clock to today: no back pay', () => {
    const r = newHeldRep(getRepDef('CODE-1')!, 120);
    expect(r.salaryBilledThroughDay).toBe(120);
    expect(salaryDue(r, 126).amount).toBe(0);
  });

  it('a rep who leaves early is paid for the days since the last bill, pro rata', () => {
    expect(salaryOnLeaving(held('CODE-1', 0), 5)).toBe(Math.round(5 * 500 / 7));
    expect(salaryOnLeaving(held('CODE-1', 0), 0)).toBe(0);
  });

  it('adds up the weekly pay of a roster', () => {
    expect(weeklyPay([held('CODE-1'), held('CODE-4')])).toBe(750);
    expect(weeklyPay(undefined)).toBe(0);
  });
});

describe('the 1-in-20 roll', () => {
  it('hits about 1 time in 20', () => {
    let seed = 7;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (rollHits(rng)) hits++;
    expect(hits / 20000).toBeGreaterThan(0.04);
    expect(hits / 20000).toBeLessThan(0.06);
  });

  it('is made at most once per rep per 7 days, and only for reps in the area', () => {
    const a = { ...held('CODE-1'), lastRollDay: 10 };
    const b = held('PERMITS-1');
    expect(repsDueForRoll([a, b], 'Code', 14)).toEqual([]);
    expect(repsDueForRoll([a, b], 'Code', 17).map(r => r.id)).toEqual(['CODE-1']);
    expect(repsDueForRoll([a, b], 'Permits', 14).map(r => r.id)).toEqual(['PERMITS-1']);
  });
});

describe('raises', () => {
  it('10, 20 and 30 percent are accepted 1, 2 and 3 times in 4', () => {
    for (const [pct, chances] of [[10, 1], [20, 2], [30, 3]] as const) {
      let yes = 0;
      for (let i = 0; i < 4; i++) if (raiseAccepted(pct, () => (i + 0.5) / 4)) yes++;
      expect(yes).toBe(chances);
    }
  });

  it('a raise is a percent of the CURRENT salary', () => {
    expect(raisedSalary(500, 30)).toBe(650);
    expect(raisedSalary(650, 10)).toBe(715);
  });
});

describe('hire offers', () => {
  it('shows three different reps, never more than one bad, never one you hold', () => {
    let seed = 3;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let i = 0; i < 300; i++) {
      const o = pickOffers(['CODE-1'], rng);
      expect(o.length).toBe(3);
      expect(new Set(o.map(r => r.id)).size).toBe(3);
      expect(o.filter(r => r.sign === 'bad').length).toBeLessThanOrEqual(1);
      expect(o.map(r => r.id)).not.toContain('CODE-1');
    }
  });
});

describe('stop work order', () => {
  it('offers the good-rep way only when there is a good rep in the area, and drops prices the player cannot pay (except the cheapest)', () => {
    expect(stopWorkOptions(true, 100000).map(o => o.id)).toEqual(['a', 'b', 'c']);
    expect(stopWorkOptions(false, 100000).map(o => o.id)).toEqual(['b', 'c']);
    expect(stopWorkOptions(true, 12000).map(o => o.id)).toEqual(['b', 'c']);
    expect(stopWorkOptions(true, 100).map(o => o.id)).toEqual(['c']);
  });

  it('the three ways cost $15,000/7 days, $10,000/10 days, $5,000/15 days', () => {
    const o = stopWorkOptions(true, 1e9);
    expect(o.map(x => [x.cost, x.days])).toEqual([[15000, 7], [10000, 10], [5000, 15]]);
  });

  it('the robot picks do-it-yourself when short of cash, else the good rep, else the culprit', () => {
    expect(robotStopWork(stopWorkOptions(true, 20000), 20000)).toBe('c');
    expect(robotStopWork(stopWorkOptions(true, 100000), 100000)).toBe('a');
    expect(robotStopWork(stopWorkOptions(false, 100000), 100000)).toBe('b');
  });
});

describe('each way wins in its own band of what a day is worth', () => {
  const total = { a: { cost: 15000, days: 7 }, b: { cost: 10000, days: 10 }, c: { cost: 5000, days: 15 } };
  const best = (d: number) => (['a', 'b', 'c'] as const).reduce((x, y) => (total[y].cost + total[y].days * d < total[x].cost + total[x].days * d ? y : x));
  it('(c) under $1,000 a day, (b) between $1,000 and $1,670, (a) above $1,670', () => {
    expect(best(500)).toBe('c');
    expect(best(1300)).toBe('b');
    expect(best(2000)).toBe('a');
  });
});

beforeEach(() => resetRepRules());
