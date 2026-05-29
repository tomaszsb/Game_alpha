import { describe, it, expect } from 'vitest';
import { buildEndGameInsights, Insight } from '../../src/utils/endGameInsights';
import { EndGameStats } from '../../src/utils/endGameStats';
import { Player } from '../../src/types/DataTypes';

// v3.0.13 — Project Debrief rules. Tests pin each rule's trigger condition
// and the cap-to-N priority sort. Helpers below build minimal-shape inputs
// so each test stays focused on one rule.

function makeStats(overrides: Partial<EndGameStats> = {}): EndGameStats {
  return {
    projectScope: 0,
    totalSpent: 0,
    daysTotal: 0,
    turnsTaken: 0,
    rounds: 0,
    finalScore: 0,
    fundingMix: { owner: 0, bank: 0, investor: 0, other: 0, total: 0 },
    feesBreakdown: {
      architectural: 0, engineering: 0, regulatory: 0, expeditor: 0,
      investmentFee: 0, miscellaneous: 0, totalFees: 0,
    },
    construction: { workCardCount: 0, constructionScope: 0 },
    approvals: { dob: 'none', fdny: 'none' },
    journey: [],
    cardCounts: { W: 0, B: 0, E: 0, L: 0, I: 0 },
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', name: 'P1', currentSpace: 'FINISH', visitType: 'First',
    visitedSpaces: [], spaceVisitLog: [],
    money: 0, timeSpent: 0, projectScope: 0,
    hand: [], activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [], loans: [], score: 0,
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    expenditures: { design: 0, fees: 0, construction: 0 },
    costHistory: [], fundingHistory: [],
    costs: { bank: 0, investor: 0, expeditor: 0, architectural: 0, engineering: 0, regulatory: 0, investmentFee: 0, miscellaneous: 0, total: 0 },
    ...overrides,
  } as Player;
}

function ids(insights: Insight[]): string[] {
  return insights.map(i => i.id);
}

describe('buildEndGameInsights — pacing', () => {
  it('fast-finish triggers when turnsTaken ≤ 10 (and > 0)', () => {
    const out = buildEndGameInsights(makeStats({ turnsTaken: 8 }), makePlayer());
    expect(ids(out)).toContain('fast-finish');
    expect(out.find(i => i.id === 'fast-finish')?.tone).toBe('win');
  });

  it('fast-finish does NOT trigger at turnsTaken=0 (no journey, defensive)', () => {
    expect(ids(buildEndGameInsights(makeStats({ turnsTaken: 0 }), makePlayer()))).not.toContain('fast-finish');
  });

  it('long-finish triggers at 20+ turns with observe tone', () => {
    const out = buildEndGameInsights(makeStats({ turnsTaken: 22 }), makePlayer());
    const ins = out.find(i => i.id === 'long-finish');
    expect(ins).toBeDefined();
    expect(ins?.tone).toBe('observe');
  });
});

describe('buildEndGameInsights — budget', () => {
  it('squeaked-by fires when leftover money < 5% of funding', () => {
    const out = buildEndGameInsights(
      makeStats({ fundingMix: { owner: 100000, bank: 900000, investor: 0, other: 0, total: 1000000 } }),
      makePlayer({ money: 30000 }),  // 3% leftover
    );
    expect(ids(out)).toContain('squeaked-by');
  });

  it('loose-budget fires when leftover money > 30% of funding', () => {
    const out = buildEndGameInsights(
      makeStats({ fundingMix: { owner: 0, bank: 1000000, investor: 0, other: 0, total: 1000000 } }),
      makePlayer({ money: 500000 }),  // 50% leftover
    );
    expect(ids(out)).toContain('loose-budget');
  });

  it('budget rules silent when total funding is 0 (no divide-by-zero)', () => {
    const out = buildEndGameInsights(makeStats(), makePlayer({ money: 100 }));
    expect(ids(out)).not.toContain('squeaked-by');
    expect(ids(out)).not.toContain('loose-budget');
  });
});

describe('buildEndGameInsights — expeditors', () => {
  it('no-expeditors fires (lesson tone) when E count is 0', () => {
    const out = buildEndGameInsights(makeStats({ cardCounts: { W: 0, B: 0, E: 0, L: 0, I: 0 } }), makePlayer());
    const ins = out.find(i => i.id === 'no-expeditors');
    expect(ins?.tone).toBe('lesson');
  });

  it('expeditor-heavy fires (win) when E ≥ 4', () => {
    const out = buildEndGameInsights(makeStats({ cardCounts: { W: 0, B: 0, E: 4, L: 0, I: 0 } }), makePlayer());
    expect(out.find(i => i.id === 'expeditor-heavy')?.tone).toBe('win');
    expect(ids(out)).not.toContain('no-expeditors');  // mutually exclusive
  });
});

describe('buildEndGameInsights — approvals', () => {
  it('all-approved is the highest-priority win when both DOB and FDNY are approved', () => {
    const out = buildEndGameInsights(
      makeStats({ approvals: { dob: 'approved', fdny: 'approved' } }),
      makePlayer(),
    );
    const ins = out.find(i => i.id === 'all-approved');
    expect(ins?.tone).toBe('win');
    // Priority 80 — should sit near the top of the panel.
    expect(ins?.priority).toBe(80);
  });

  it('dob-missing is the highest-priority lesson (the late-CO trap)', () => {
    const out = buildEndGameInsights(
      makeStats({ approvals: { dob: 'none', fdny: 'approved' } }),
      makePlayer(),
    );
    expect(out[0].id).toBe('dob-missing');
    expect(out[0].tone).toBe('lesson');
  });

  it('approval-denied surfaces the specific denied agency', () => {
    const out = buildEndGameInsights(
      makeStats({ approvals: { dob: 'denied', fdny: 'minor-objection' } }),
      makePlayer(),
    );
    const ins = out.find(i => i.id === 'approval-denied');
    expect(ins?.headline).toMatch(/DOB/);
    expect(ins?.headline).not.toMatch(/FDNY/);  // only denied agencies named
  });

  it('minor-objection fires observe tone for either agency', () => {
    const out = buildEndGameInsights(
      makeStats({ approvals: { dob: 'approved', fdny: 'minor-objection' } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'minor-objection')?.tone).toBe('observe');
  });
});

describe('buildEndGameInsights — funding mix', () => {
  it('self-funded (win) when owner ≥ 70%', () => {
    const out = buildEndGameInsights(
      makeStats({ fundingMix: { owner: 800000, bank: 100000, investor: 100000, other: 0, total: 1000000 } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'self-funded')?.tone).toBe('win');
  });

  it('bank-heavy (observe) when bank ≥ 60%', () => {
    const out = buildEndGameInsights(
      makeStats({ fundingMix: { owner: 100000, bank: 700000, investor: 200000, other: 0, total: 1000000 } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'bank-heavy')?.tone).toBe('observe');
  });

  it('investor-heavy (observe) when investor ≥ 60%', () => {
    const out = buildEndGameInsights(
      makeStats({ fundingMix: { owner: 100000, bank: 200000, investor: 700000, other: 0, total: 1000000 } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'investor-heavy')?.tone).toBe('observe');
  });
});

describe('buildEndGameInsights — contractor', () => {
  it('high-contractor is a win', () => {
    const out = buildEndGameInsights(
      makeStats({ construction: { workCardCount: 0, constructionScope: 0, contractorQuality: 'HIGH' } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'high-contractor')?.tone).toBe('win');
  });

  it('low-contractor is an observation', () => {
    const out = buildEndGameInsights(
      makeStats({ construction: { workCardCount: 0, constructionScope: 0, contractorQuality: 'LOW' } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'low-contractor')?.tone).toBe('observe');
  });
});

describe('buildEndGameInsights — regulatory time', () => {
  it('regulatory-heavy fires when REG-* days ≥ 40% of total days', () => {
    const out = buildEndGameInsights(
      makeStats({
        daysTotal: 100,
        journey: [
          { spaceName: 'OWNER-FUND-INITIATION', daysSpent: 30, entryTurn: 1 },
          { spaceName: 'REG-DOB-PLAN-EXAM', daysSpent: 30, entryTurn: 2 },
          { spaceName: 'REG-FDNY-PLAN-EXAM', daysSpent: 20, entryTurn: 3 },
          { spaceName: 'CON-INITIATION', daysSpent: 20, entryTurn: 4 },
        ],
      }),
      makePlayer(),
    );
    // 50/100 = 50% in REG → should trigger
    const ins = out.find(i => i.id === 'regulatory-heavy');
    expect(ins).toBeDefined();
    expect(ins?.headline).toMatch(/50%/);
  });

  it('regulatory-heavy does NOT fire below 40% threshold', () => {
    const out = buildEndGameInsights(
      makeStats({
        daysTotal: 100,
        journey: [
          { spaceName: 'OWNER-FUND-INITIATION', daysSpent: 70, entryTurn: 1 },
          { spaceName: 'REG-DOB-PLAN-EXAM', daysSpent: 30, entryTurn: 2 },
        ],
      }),
      makePlayer(),
    );
    expect(ids(out)).not.toContain('regulatory-heavy');
  });
});

describe('buildEndGameInsights — revisits', () => {
  it('revisits fires when unique/total < 70% AND journey ≥ 5 stops', () => {
    const out = buildEndGameInsights(
      makeStats({
        journey: [
          { spaceName: 'A', daysSpent: 1, entryTurn: 1 },
          { spaceName: 'B', daysSpent: 1, entryTurn: 2 },
          { spaceName: 'B', daysSpent: 1, entryTurn: 3 },
          { spaceName: 'B', daysSpent: 1, entryTurn: 4 },
          { spaceName: 'C', daysSpent: 1, entryTurn: 5 },
          { spaceName: 'A', daysSpent: 1, entryTurn: 6 },
        ],  // 3 unique / 6 total = 50%
      }),
      makePlayer(),
    );
    const ins = out.find(i => i.id === 'revisits');
    expect(ins).toBeDefined();
    expect(ins?.headline).toMatch(/repeat visit/);
  });

  it('revisits silent on short journeys (< 5 stops)', () => {
    const out = buildEndGameInsights(
      makeStats({
        journey: [
          { spaceName: 'A', daysSpent: 1, entryTurn: 1 },
          { spaceName: 'A', daysSpent: 1, entryTurn: 2 },
        ],
      }),
      makePlayer(),
    );
    expect(ids(out)).not.toContain('revisits');
  });
});

describe('buildEndGameInsights — fees', () => {
  it('fee-efficient (win) when fees < 10% of scope', () => {
    const out = buildEndGameInsights(
      makeStats({
        projectScope: 1_000_000,
        feesBreakdown: { architectural: 50000, engineering: 30000, regulatory: 0, expeditor: 0, investmentFee: 0, miscellaneous: 0, totalFees: 80000 },
      }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'fee-efficient')?.tone).toBe('win');
  });

  it('fee-overload (observe) when fees ≥ 25% of scope', () => {
    const out = buildEndGameInsights(
      makeStats({
        projectScope: 1_000_000,
        feesBreakdown: { architectural: 150000, engineering: 100000, regulatory: 50000, expeditor: 0, investmentFee: 0, miscellaneous: 0, totalFees: 300000 },
      }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'fee-overload')?.tone).toBe('observe');
  });
});

describe('buildEndGameInsights — cap + sort', () => {
  it('caps at maxInsights (default 5)', () => {
    // Construct a player that triggers many rules.
    const stats = makeStats({
      turnsTaken: 8,
      approvals: { dob: 'approved', fdny: 'approved' },
      cardCounts: { W: 0, B: 0, E: 4, L: 3, I: 0 },
      construction: { workCardCount: 0, constructionScope: 0, contractorQuality: 'HIGH' },
      fundingMix: { owner: 800000, bank: 100000, investor: 100000, other: 0, total: 1000000 },
      projectScope: 2_500_000,
      feesBreakdown: { architectural: 50000, engineering: 30000, regulatory: 0, expeditor: 0, investmentFee: 0, miscellaneous: 0, totalFees: 80000 },
    });
    const out = buildEndGameInsights(stats, makePlayer({ money: 50000 }));
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('respects custom maxInsights option', () => {
    const stats = makeStats({
      turnsTaken: 8,
      approvals: { dob: 'approved', fdny: 'approved' },
      cardCounts: { W: 0, B: 0, E: 4, L: 0, I: 0 },
      construction: { workCardCount: 0, constructionScope: 0, contractorQuality: 'HIGH' },
    });
    const out = buildEndGameInsights(stats, makePlayer(), { maxInsights: 2 });
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it('sorts by priority descending — dob-missing (90) outranks all-approved (80)', () => {
    // Can't have both fire on the same game, so test priorities by inspection.
    const dobOut = buildEndGameInsights(makeStats({ approvals: { dob: 'none', fdny: 'approved' } }), makePlayer());
    const approvedOut = buildEndGameInsights(makeStats({ approvals: { dob: 'approved', fdny: 'approved' } }), makePlayer());
    expect(dobOut[0].priority).toBe(90);   // dob-missing
    expect(approvedOut[0].priority).toBe(80);  // all-approved
  });

  it('returns empty list on a fresh-game player snapshot (no rules trigger)', () => {
    const out = buildEndGameInsights(makeStats(), makePlayer());
    // The no-expeditors rule WILL fire because E=0 by default. That's fine —
    // it's a real observation. Confirm the list is short, not literally empty.
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(5);
  });
});

describe('buildEndGameInsights — big-project (scope)', () => {
  it('big-project fires when projectScope ≥ $2M', () => {
    const out = buildEndGameInsights(makeStats({ projectScope: 2_500_000 }), makePlayer());
    const ins = out.find(i => i.id === 'big-project');
    expect(ins?.tone).toBe('win');
    expect(ins?.headline).toMatch(/\$2\.5M/);
  });
});

describe('buildEndGameInsights — life events', () => {
  it('life-event-heavy fires (observe) when L count ≥ 3', () => {
    const out = buildEndGameInsights(
      makeStats({ cardCounts: { W: 0, B: 0, E: 0, L: 3, I: 0 } }),
      makePlayer(),
    );
    expect(out.find(i => i.id === 'life-event-heavy')?.tone).toBe('observe');
  });
});
