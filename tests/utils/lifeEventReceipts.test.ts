import { describe, it, expect } from 'vitest';
import {
  snapshotPlayerForLifeEvent,
  diffLifeEventSnapshot,
  type LifeEventSnapshot,
} from '../../src/utils/lifeEventReceipts';
import type { Player } from '../../src/types/DataTypes';

// v3.0.68 — the snapshot/diff logic was extracted from CardEffectHandler so the
// SpaceArrivalProcessor dice-piggyback path can share it (fb:7a2a2956). These
// tests pin the shared behavior directly.

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'P1',
    name: 'Tester',
    currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First',
    visitedSpaces: [],
    spaceVisitLog: [],
    money: 100000,
    timeSpent: 10,
    projectScope: 0,
    hand: [],
    activeCards: [],
    activeEffects: [],
    loans: [],
    score: 0,
    moneySources: {} as Player['moneySources'],
    expenditures: {} as Player['expenditures'],
    costHistory: [],
    fundingHistory: [],
    costs: {} as Player['costs'],
    ...overrides,
  } as Player;
}

describe('lifeEventReceipts', () => {
  describe('snapshotPlayerForLifeEvent', () => {
    it('returns null for a missing player', () => {
      expect(snapshotPlayerForLifeEvent(null)).toBeNull();
      expect(snapshotPlayerForLifeEvent(undefined)).toBeNull();
    });

    it('captures the narrow set of life-event fields', () => {
      const snap = snapshotPlayerForLifeEvent(
        makePlayer({
          money: 42000,
          timeSpent: 7,
          hand: ['E001', 'E002'],
          activeEffects: [{} as Player['activeEffects'][number]],
          dobApprovalStatus: 'approved',
        }),
      );
      expect(snap).toEqual<LifeEventSnapshot>({
        money: 42000,
        timeSpent: 7,
        handSize: 2,
        activeEffectsCount: 1,
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: undefined,
      });
    });
  });

  describe('diffLifeEventSnapshot', () => {
    // `before` is the PRE-draw snapshot (the L card has not landed yet); `after`
    // is POST-draw and includes it. The diff subtracts the primary card so only
    // EXTRA gains/losses surface. This matches the SpaceArrivalProcessor path,
    // which snapshots before the draw.
    const before: LifeEventSnapshot = {
      money: 100000,
      timeSpent: 10,
      handSize: 0,
      activeEffectsCount: 0,
    };
    // The L card landing bumps handSize by 1 with nothing else changed.
    const afterCardOnly: LifeEventSnapshot = { ...before, handSize: 1 };

    it('returns [] when either snapshot is missing', () => {
      expect(diffLifeEventSnapshot(null, afterCardOnly)).toEqual([]);
      expect(diffLifeEventSnapshot(before, null)).toEqual([]);
    });

    it('returns [] when only the L card landed (no measurable effect)', () => {
      expect(diffLifeEventSnapshot(before, afterCardOnly, 'L010')).toEqual([]);
    });

    it('reports a time delta with day pluralization and sign', () => {
      const out = diffLifeEventSnapshot(before, { ...afterCardOnly, timeSpent: 13 }, 'L009');
      expect(out).toEqual([{ kind: 'time', amount: 3, label: '+3 days' }]);

      const saved = diffLifeEventSnapshot(before, { ...afterCardOnly, timeSpent: 9 }, 'L043');
      expect(saved).toEqual([{ kind: 'time', amount: -1, label: '-1 day' }]);
    });

    it('reports a money delta with comma formatting', () => {
      const out = diffLifeEventSnapshot(before, { ...afterCardOnly, money: 95000 }, 'L007');
      expect(out).toEqual([{ kind: 'money', amount: -5000, label: '-$5,000' }]);
    });

    it('subtracts the primary card so only EXTRA resource gains show', () => {
      // +1 hand from the L card landing, +1 from a free Expeditor draw → 1 extra.
      const out = diffLifeEventSnapshot(before, { ...afterCardOnly, handSize: 2 }, 'L010');
      expect(out).toEqual([{ kind: 'card_gained', amount: 1, label: 'gained 1 extra resource' }]);
    });

    it('reports approval revocation', () => {
      const beforeApproved: LifeEventSnapshot = { ...before, dobApprovalStatus: 'approved' };
      const afterRevoked: LifeEventSnapshot = { ...afterCardOnly, dobApprovalStatus: 'none' };
      const out = diffLifeEventSnapshot(beforeApproved, afterRevoked, 'L099');
      expect(out).toEqual([
        { kind: 'approval_revoke', label: 'DOB approval revoked — you will need to re-apply' },
      ]);
    });

    it('orders receipts money → time → approval → card → duration', () => {
      const beforeApproved: LifeEventSnapshot = { ...before, fdnyApprovalStatus: 'approved' };
      const after: LifeEventSnapshot = {
        money: 98000,
        timeSpent: 14,
        handSize: 0, // net resource loss even after the L card landed (forced discard)
        activeEffectsCount: 2,
        fdnyApprovalStatus: 'none',
      };
      const kinds = diffLifeEventSnapshot(beforeApproved, after, 'L018').map(e => e.kind);
      expect(kinds).toEqual(['money', 'time', 'approval_revoke', 'card_lost', 'duration_start']);
    });
  });
});
