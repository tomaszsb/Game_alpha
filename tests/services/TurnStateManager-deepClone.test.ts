import { describe, it, expect, beforeEach } from 'vitest';
import { TurnStateManager } from '../../src/services/TurnStateManager';
import { Player } from '../../src/types/StateTypes';

// v3.0.41 — deep-clone defense for REAL/TEMP state. External audit flagged
// that `{ ...realState.state }` was a shallow spread that shared nested array
// references with the stored snapshot. Today no downstream service mutates
// arrays in place (1550+ test suite green), but the pattern was a foot-gun:
// one careless .push() inside any service would corrupt Try Again. These
// tests pin the deep-clone helper so that hand/activeCards/loans/activeEffects
// arrays on a returned snapshot are independent from the stored state.

describe('TurnStateManager — deep-clone defense for REAL/TEMP state (v3.0.41)', () => {
  let manager: TurnStateManager;
  let player: Player;

  beforeEach(() => {
    manager = new TurnStateManager();
    player = {
      id: 'p1',
      name: 'Alice',
      color: '#000',
      currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First',
      money: 100000,
      timeSpent: 0,
      projectScope: 0,
      score: 0,
      hand: ['L001', 'W003'],
      activeCards: [],
      loans: [],
      moneySources: {} as any,
      expenditures: {} as any,
      costHistory: [],
      costs: {} as any,
      fundingHistory: [],
      activeEffects: [],
      spaceVisitLog: [],
      visitedSpaces: [],
      dobApprovedDestinations: ['REG-FDNY-FEE-REVIEW'],
    } as unknown as Player;
  });

  it('createTempStateFromReal — mutating TEMP.hand must NOT bleed into REAL.hand', () => {
    // First call captures REAL (from player) and creates a TEMP copy.
    const result = manager.createTempStateFromReal(
      { playerId: 'p1', spaceName: 'OWNER-SCOPE-INITIATION', visitType: 'First' },
      player,
      1
    );
    expect(result.success).toBe(true);

    // Get TEMP snapshot, mutate the hand array — this is the foot-gun
    // scenario (a downstream service grabs the snapshot and pushes).
    const temp = manager.getEffectivePlayerState('p1', player)!;
    temp.hand.push('LEAKED');

    // REAL was captured from the same source; its hand must NOT include the
    // mutation. (Pre-v3.0.41 this would have failed because the shallow
    // spread shared the array reference.)
    const real = manager['turnStateModel'].realStates['p1']!.state;
    expect(real.hand).not.toContain('LEAKED');
    expect(real.hand).toEqual(['L001', 'W003']);
  });

  it('createTempStateFromReal — mutating TEMP.dobApprovedDestinations must NOT bleed into REAL', () => {
    manager.createTempStateFromReal(
      { playerId: 'p1', spaceName: 'OWNER-SCOPE-INITIATION', visitType: 'First' },
      player,
      1
    );

    const temp = manager.getEffectivePlayerState('p1', player)!;
    temp.dobApprovedDestinations!.push('LEAKED-SPACE');

    const real = manager['turnStateModel'].realStates['p1']!.state;
    expect(real.dobApprovedDestinations).not.toContain('LEAKED-SPACE');
    expect(real.dobApprovedDestinations).toEqual(['REG-FDNY-FEE-REVIEW']);
  });

  it('getEffectivePlayerState — returned snapshot is independent from internal TEMP state', () => {
    manager.createTempStateFromReal(
      { playerId: 'p1', spaceName: 'OWNER-SCOPE-INITIATION', visitType: 'First' },
      player,
      1
    );

    const snapshot1 = manager.getEffectivePlayerState('p1', player)!;
    snapshot1.hand.push('MUTATED');

    // Second call returns a fresh deep clone of the underlying TEMP,
    // so the prior mutation must not appear.
    const snapshot2 = manager.getEffectivePlayerState('p1', player)!;
    expect(snapshot2.hand).not.toContain('MUTATED');
  });

  it('applyToRealState — mutating returned newRealState.state.hand must NOT bleed into stored REAL', () => {
    // Capture initial REAL.
    manager.createTempStateFromReal(
      { playerId: 'p1', spaceName: 'OWNER-SCOPE-INITIATION', visitType: 'First' },
      player,
      1
    );

    // Apply a benign change (no hand mutation in the changes object).
    const result = manager.applyToRealState('p1', player, { money: 95000 }, 1);
    expect(result.success).toBe(true);

    // Now mutate the returned newRealState's hand (simulating a careless caller).
    result.newRealState!.state.hand.push('LEAKED');

    // The hand on the stored REAL must be untouched.
    const real = manager['turnStateModel'].realStates['p1']!.state;
    expect(real.hand).not.toContain('LEAKED');
  });
});
