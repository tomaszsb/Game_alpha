import { describe, it, expect } from 'vitest';
import { buildEndGameStats, formatMoney, formatPercent, formatDays } from '../../src/utils/endGameStats';
import { Player } from '../../src/types/DataTypes';

// fb:cc345da9 + fb:3483b37b — pure-helper tests for the end-game stats panel
// the playtester asked for. Keeps the math testable without React or services.

// Minimal-shape Player builder. Only the fields buildEndGameStats reads are
// populated; the rest are filled with neutral defaults so each test can stay
// focused on one concern.
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Test Winner',
    currentSpace: 'FINISH',
    visitType: 'First',
    visitedSpaces: [],
    spaceVisitLog: [],
    money: 0,
    timeSpent: 0,
    projectScope: 0,
    hand: [],
    activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: [],
    score: 0,
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    expenditures: { design: 0, fees: 0, construction: 0 },
    costHistory: [],
    fundingHistory: [],
    costs: {
      bank: 0, investor: 0,
      expeditor: 0, architectural: 0, engineering: 0,
      regulatory: 0, investmentFee: 0, miscellaneous: 0,
      total: 0,
    },
    ...overrides,
  } as Player;
}

describe('buildEndGameStats', () => {
  it('returns headline numbers straight from the player snapshot', () => {
    const player = makePlayer({ timeSpent: 218, score: 847 });
    const stats = buildEndGameStats(player, { projectScope: 2400000 });
    expect(stats.projectScope).toBe(2400000);
    expect(stats.daysTotal).toBe(218);
    expect(stats.finalScore).toBe(847);
  });

  it('funding mix sums the four moneySource buckets and reports total', () => {
    const player = makePlayer({
      moneySources: { ownerFunding: 500000, bankLoans: 850000, investmentDeals: 500000, other: 100000 },
    });
    const stats = buildEndGameStats(player, { projectScope: 0 });
    expect(stats.fundingMix).toEqual({
      owner: 500000, bank: 850000, investor: 500000, other: 100000, total: 1950000,
    });
  });

  it('totalSpent sums every cost-history entry (not just the categorized subtotals)', () => {
    const player = makePlayer({
      costHistory: [
        { id: '1', category: 'architectural', amount: 120000, description: '', turn: 1, timestamp: new Date() },
        { id: '2', category: 'engineering', amount: 80000, description: '', turn: 2, timestamp: new Date() },
        { id: '3', category: 'bank', amount: 50000, description: 'loan repayment', turn: 3, timestamp: new Date() },
      ],
    });
    const stats = buildEndGameStats(player, { projectScope: 0 });
    expect(stats.totalSpent).toBe(250000);
  });

  it('feesBreakdown excludes bank + investor (those are funding repayment, not fees)', () => {
    const player = makePlayer({
      costs: {
        bank: 50000, investor: 30000,
        architectural: 120000, engineering: 80000,
        regulatory: 35000, expeditor: 25000,
        investmentFee: 10000, miscellaneous: 5000,
        total: 355000,
      },
    });
    const stats = buildEndGameStats(player, { projectScope: 0 });
    expect(stats.feesBreakdown.totalFees).toBe(120000 + 80000 + 35000 + 25000 + 10000 + 5000);
    expect(stats.feesBreakdown).not.toHaveProperty('bank');
    expect(stats.feesBreakdown).not.toHaveProperty('investor');
  });

  it('counts W cards across hand AND activeCards (B/I cards auto-activate on draw)', () => {
    const player = makePlayer({
      hand: ['W101_x', 'W102_y', 'B201_z'],
      activeCards: [
        { cardId: 'W103_a', activatedTurn: 1, isActive: true } as any,
        { cardId: 'I001_b', activatedTurn: 2, isActive: true } as any,
      ],
    });
    const stats = buildEndGameStats(player, { projectScope: 100 });
    expect(stats.construction.workCardCount).toBe(3);
    expect(stats.cardCounts).toEqual({ W: 3, B: 1, E: 0, L: 0, I: 1 });
  });

  it('exposes contractor metadata when set', () => {
    const player = makePlayer({
      contractor: { quality: 'HIGH', multiplier: 3, hiredAt: 'CON-INITIATION' },
    });
    const stats = buildEndGameStats(player, { projectScope: 0 });
    expect(stats.construction.contractorQuality).toBe('HIGH');
    expect(stats.construction.contractorMultiplier).toBe(3);
    expect(stats.construction.contractorHiredAt).toBe('CON-INITIATION');
  });

  it('normalizes the four-state ApprovalStatus enum (minor-objection is its own bucket)', () => {
    const a = buildEndGameStats(makePlayer({ dobApprovalStatus: 'approved', fdnyApprovalStatus: 'minor-objection' }), { projectScope: 0 });
    expect(a.approvals).toEqual({ dob: 'approved', fdny: 'minor-objection' });

    const b = buildEndGameStats(makePlayer({ dobApprovalStatus: 'denied', fdnyApprovalStatus: undefined as any }), { projectScope: 0 });
    expect(b.approvals).toEqual({ dob: 'denied', fdny: 'none' });

    const c = buildEndGameStats(makePlayer({ dobApprovalStatus: 'none', fdnyApprovalStatus: 'none' }), { projectScope: 0 });
    expect(c.approvals).toEqual({ dob: 'none', fdny: 'none' });
  });

  it('journey preserves spaceVisitLog order (already sorted by entryTurn)', () => {
    const player = makePlayer({
      spaceVisitLog: [
        { spaceName: 'OWNER-FUND-INITIATION', daysSpent: 3, entryTurn: 1, entryTime: 0, exitTurn: 1, exitTime: 3 },
        { spaceName: 'ARCH-INITIATION', daysSpent: 12, entryTurn: 2, entryTime: 3, exitTurn: 2, exitTime: 15 },
        { spaceName: 'ARCH-FEE-REVIEW', daysSpent: 5, entryTurn: 3, entryTime: 15 },
      ] as any,
    });
    const stats = buildEndGameStats(player, { projectScope: 0 });
    expect(stats.journey).toHaveLength(3);
    expect(stats.journey[0].spaceName).toBe('OWNER-FUND-INITIATION');
    expect(stats.journey[0].daysSpent).toBe(3);
    expect(stats.journey[2].spaceName).toBe('ARCH-FEE-REVIEW');
  });

  it('turnsTaken approximates from the final visit log entry (best per-player number)', () => {
    const player = makePlayer({
      spaceVisitLog: [
        { spaceName: 'A', daysSpent: 1, entryTurn: 1, entryTime: 0 },
        { spaceName: 'B', daysSpent: 1, entryTurn: 7, entryTime: 1 },
        { spaceName: 'FINISH', daysSpent: 0, entryTurn: 14, entryTime: 2 },
      ] as any,
    });
    expect(buildEndGameStats(player, { projectScope: 0 }).turnsTaken).toBe(14);
  });

  it('turnsTaken is 0 when visit log is empty (defensive)', () => {
    expect(buildEndGameStats(makePlayer(), { projectScope: 0 }).turnsTaken).toBe(0);
  });

  it('handles a fully-empty player without crashing (the v0/legacy-game safety net)', () => {
    const minimal = {
      id: 'x', name: 'X', currentSpace: '', visitType: 'First',
      hand: [], activeCards: [],
    } as any;
    const stats = buildEndGameStats(minimal, { projectScope: 0 });
    expect(stats.projectScope).toBe(0);
    expect(stats.totalSpent).toBe(0);
    expect(stats.fundingMix.total).toBe(0);
    expect(stats.feesBreakdown.totalFees).toBe(0);
    expect(stats.journey).toEqual([]);
    expect(stats.cardCounts).toEqual({ W: 0, B: 0, E: 0, L: 0, I: 0 });
  });
});

describe('formatMoney', () => {
  it('formats with $ + thousands separators', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(1500000)).toBe('$1,500,000');
  });

  it('prefixes negative amounts with a single minus sign', () => {
    expect(formatMoney(-250)).toBe('-$250');
  });
});

describe('formatPercent', () => {
  it('rounds to integer percent', () => {
    expect(formatPercent(33, 100)).toBe('33%');
    expect(formatPercent(2, 3)).toBe('67%');
  });

  it('returns 0% on divide-by-zero (no NaN leak)', () => {
    expect(formatPercent(5, 0)).toBe('0%');
  });
});

describe('formatDays', () => {
  it('singular vs plural', () => {
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(0)).toBe('0 days');
    expect(formatDays(218)).toBe('218 days');
  });
});
