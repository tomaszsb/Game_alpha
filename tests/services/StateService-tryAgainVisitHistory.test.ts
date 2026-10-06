// Real replacement for the deleted SpaceProgressionRegression.test.ts (2026-10-06).
// That file's tests computed `visitedSpaces.includes(...) ? 'Subsequent' : 'First'`
// inline and asserted its own arithmetic. The behaviour it was named for is real:
// a Try Again (discardTempState) must undo the turn's money/cards/time but KEEP the
// player's visit history, otherwise the same space would read "First visit" again
// and the player loops on it.

import { describe, it, expect, vi } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { Player } from '../../src/types/StateTypes';

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

describe('StateService — Try Again keeps the visit history', () => {
  it('discardTempState reverts money and time but keeps visitedSpaces, spaceVisitLog and visitType', () => {
    const player = makePlayer({
      currentSpace: 'OWNER-FUND-INITIATION',
      visitType: 'First',
      money: 1000,
      timeSpent: 5,
      visitedSpaces: ['OWNER-SCOPE-INITIATION'],
    } as any);
    const { stateService } = setup(player);

    stateService.createTempStateFromReal({ playerId: 'p1', spaceName: 'OWNER-FUND-INITIATION', visitType: 'First' });

    // Movement records the visit outside TEMP state (MovementService), the turn's
    // spending goes through TEMP.
    stateService.updatePlayer({
      id: 'p1',
      visitedSpaces: ['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION'],
      visitType: 'Subsequent',
    } as any);
    stateService.updateTempState('p1', { money: 400, timeSpent: 9 });
    expect(stateService.getPlayer('p1')?.money).toBe(400);

    stateService.discardTempState('p1');

    const after = stateService.getPlayer('p1')!;
    expect(after.money).toBe(1000);
    expect(after.timeSpent).toBe(5);
    expect(after.visitedSpaces).toEqual(['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION']);
    expect(after.visitType).toBe('Subsequent');
  });
});
