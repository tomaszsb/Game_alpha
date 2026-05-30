// Workstream 7 follow-up — Try Again restores revoked approvals.
//
// Background: prior to 2026-05-29, ApprovalService writes (dice-roll grants at
// REG-DOB-PLAN-EXAM / REG-FDNY-PLAN-EXAM / REG-DOB-AUDIT, plus W-card scope-
// change DOB revoke and L-card `revokes_approval` mechanics) went straight to
// real player state via `stateService.updatePlayer`. The W draw / L draw
// themselves rolled back via TEMP, but the linked approval revoke did not —
// leaving the player with the card un-drawn but the approval still wiped.
//
// Fix: extended MutablePlayerState with the 4 approval fields, routed all 3
// write sites through `updateTempState`, and added the fields to the
// discardTempState restore list in StateService.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { Player, CreateTempOptions } from '../../src/types/StateTypes';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Player 1',
    color: '#ff0000',
    avatar: '',
    currentSpace: 'REG-DOB-PLAN-EXAM',
    visitType: 'First',
    money: 0,
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    timeSpent: 0,
    hand: [],
    activeCards: [],
    discardedCards: [],
    transactionHistory: [],
    log: [],
    completedActions: { manualActions: {} },
    skipNextTurn: false,
    skipNextTurnReason: null,
    loans: [],
    expenditures: { construction: 0, design: 0, regulatory: 0, other: 0 },
    costHistory: [],
    costs: { construction: 0, design: 0, regulatory: 0, other: 0 },
    fundingHistory: [],
    activeEffects: [],
    spaceVisitLog: [],
    score: 0,
    projectScope: 0,
    ...overrides,
  } as unknown as Player;
}

function setup(player: Player) {
  const dataService = {
    isLoaded: vi.fn().mockReturnValue(true),
    getGameConfig: vi.fn().mockReturnValue([{
      space_name: player.currentSpace,
      is_starting_space: false,
      starting_money: 0,
      starting_cards: [],
      min_players: 1,
      max_players: 4,
    }]),
    getGameConfigBySpace: vi.fn().mockReturnValue({
      space_name: player.currentSpace,
      requires_dice_roll: false,
      phase: 'REGULATORY',
    }),
    getMovement: vi.fn(),
    getSpaceEffects: vi.fn().mockReturnValue([]),
    getSpaceContent: vi.fn(),
    getCardsByType: vi.fn().mockReturnValue([]),
    getDiceOutcome: vi.fn(),
    getAllDiceOutcomes: vi.fn().mockReturnValue([]),
    getAllSpaces: vi.fn().mockReturnValue([]),
  } as any;

  const stateService = new StateService(dataService);
  stateService.setGameState({
    ...stateService.getGameState(),
    players: [player],
    currentPlayerId: player.id,
    gamePhase: 'PLAY',
  });
  return { stateService };
}

describe('StateService — Try Again restores revoked approvals', () => {
  let stateService: StateService;

  it('Try Again restores DOB approval after a W-card revoke during the turn', () => {
    const player = makePlayer({
      dobApprovalStatus: 'approved',
      dobApprovedDestinations: ['REG-FDNY-FEE-REVIEW'],
    } as any);
    ({ stateService } = setup(player));

    // Open a TEMP state for the turn (captures the approved status as the rollback point).
    const tempOpts: CreateTempOptions = {
      playerId: 'p1',
      spaceName: player.currentSpace,
      visitType: 'First',
    };
    stateService.createTempStateFromReal(tempOpts);

    // Simulate the W-card scope-change DOB revoke via the same path the
    // production code now uses.
    stateService.updateTempState('p1', {
      dobApprovalStatus: 'none',
      dobApprovedDestinations: [],
    });

    // Mid-turn UI sees the revoke.
    expect(stateService.getPlayer('p1')?.dobApprovalStatus).toBe('none');
    expect(stateService.getPlayer('p1')?.dobApprovedDestinations).toEqual([]);

    // Try Again: discard TEMP, then re-open TEMP (the production
    // tryAgainOnSpace flow). Restored player should be back to 'approved'.
    stateService.discardTempState('p1');

    const restored = stateService.getPlayer('p1');
    expect(restored?.dobApprovalStatus).toBe('approved');
    expect(restored?.dobApprovedDestinations).toEqual(['REG-FDNY-FEE-REVIEW']);
  });

  it('Try Again restores FDNY approval after an L-card revokes_approval revoke', () => {
    const player = makePlayer({
      fdnyApprovalStatus: 'approved',
      fdnyApprovedDestinations: ['REG-DOB-FINAL-REVIEW'],
    } as any);
    ({ stateService } = setup(player));

    stateService.createTempStateFromReal({
      playerId: 'p1',
      spaceName: player.currentSpace,
      visitType: 'First',
    });

    stateService.updateTempState('p1', {
      fdnyApprovalStatus: 'none',
      fdnyApprovedDestinations: [],
    });

    expect(stateService.getPlayer('p1')?.fdnyApprovalStatus).toBe('none');

    stateService.discardTempState('p1');

    expect(stateService.getPlayer('p1')?.fdnyApprovalStatus).toBe('approved');
    expect(stateService.getPlayer('p1')?.fdnyApprovedDestinations).toEqual(['REG-DOB-FINAL-REVIEW']);
  });

  it('End Turn (commit) makes the dice-roll grant stick into REAL state', () => {
    const player = makePlayer({
      dobApprovalStatus: 'none',
      dobApprovedDestinations: [],
    } as any);
    ({ stateService } = setup(player));

    stateService.createTempStateFromReal({
      playerId: 'p1',
      spaceName: 'REG-DOB-PLAN-EXAM',
      visitType: 'First',
    });

    // Simulate the DiceRollProcessor approval grant.
    stateService.updateTempState('p1', {
      dobApprovalStatus: 'approved',
      dobApprovedDestinations: ['REG-FDNY-FEE-REVIEW'],
    });

    stateService.commitTempToReal('p1');

    const committed = stateService.getPlayer('p1');
    expect(committed?.dobApprovalStatus).toBe('approved');
    expect(committed?.dobApprovedDestinations).toEqual(['REG-FDNY-FEE-REVIEW']);
  });

  it('Try Again rolls back a dice-roll grant when the player retries instead of committing', () => {
    const player = makePlayer({
      dobApprovalStatus: 'none',
      dobApprovedDestinations: [],
    } as any);
    ({ stateService } = setup(player));

    stateService.createTempStateFromReal({
      playerId: 'p1',
      spaceName: 'REG-DOB-PLAN-EXAM',
      visitType: 'First',
    });

    stateService.updateTempState('p1', {
      dobApprovalStatus: 'approved',
      dobApprovedDestinations: ['REG-FDNY-FEE-REVIEW'],
    });

    // Mid-turn sees the grant.
    expect(stateService.getPlayer('p1')?.dobApprovalStatus).toBe('approved');

    // Player negotiates / hits Try Again instead of ending the turn.
    stateService.discardTempState('p1');

    const restored = stateService.getPlayer('p1');
    expect(restored?.dobApprovalStatus).toBe('none');
    expect(restored?.dobApprovedDestinations).toEqual([]);
  });
});
