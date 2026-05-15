import { describe, it, expect } from 'vitest';
import { buildResourceSnapshot } from '../../src/utils/resourceSnapshot';
import type { Player } from '../../src/types/StateTypes';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Test',
    color: '#000',
    currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First' as const,
    visitedSpaces: [],
    hand: [],
    activeCards: [],
    money: 1_000_000,
    timeSpent: 5,
    projectScope: 0,
    lastDiceRoll: { roll1: 0, roll2: 0, total: 0 },
    spaceEntrySnapshot: undefined,
    turnModifiers: undefined,
    usedTryAgain: false,
    activeEffects: [],
    loans: [],
    score: 0,
    ...overrides,
  } as Player;
}

describe('buildResourceSnapshot', () => {
  it('captures money, scope, time, and an empty card breakdown for an empty hand', () => {
    const snap = buildResourceSnapshot(makePlayer({ hand: [], money: 1_500_000, timeSpent: 12 }), 800_000);
    expect(snap).toEqual({
      money: 1_500_000,
      projectScope: 800_000,
      timeSpent: 12,
      handCount: 0,
      cardCountsByType: { W: 0, B: 0, E: 0, I: 0, L: 0 },
    });
  });

  it('counts cards by first-letter type', () => {
    const snap = buildResourceSnapshot(
      makePlayer({ hand: ['W001', 'W002', 'B003', 'E004', 'E005', 'E006'] }),
      0,
    );
    expect(snap.handCount).toBe(6);
    expect(snap.cardCountsByType).toEqual({ W: 2, B: 1, E: 3, I: 0, L: 0 });
  });

  it('handles full ID format like W001_123_abc_0', () => {
    const snap = buildResourceSnapshot(
      makePlayer({ hand: ['W001_123_abc_0', 'L045_456_def_1', 'I012_789_ghi_2'] }),
      0,
    );
    expect(snap.cardCountsByType).toEqual({ W: 1, B: 0, E: 0, I: 1, L: 1 });
  });

  it('ignores unknown first letters defensively', () => {
    const snap = buildResourceSnapshot(makePlayer({ hand: ['X999', '?abc', ''] }), 0);
    expect(snap.handCount).toBe(3);
    expect(snap.cardCountsByType).toEqual({ W: 0, B: 0, E: 0, I: 0, L: 0 });
  });

  it('is case-insensitive on the first letter', () => {
    const snap = buildResourceSnapshot(makePlayer({ hand: ['w001', 'e002'] }), 0);
    expect(snap.cardCountsByType).toEqual({ W: 1, B: 0, E: 1, I: 0, L: 0 });
  });
});
