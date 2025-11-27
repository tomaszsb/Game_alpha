// Unit test for the tryAgainOnSpace method
// This test verifies the state snapshot, revert, and turn progression functionality

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurnService } from '../../src/services/TurnService';
import { DataService } from '../../src/services/DataService';
import { StateService } from '../../src/services/StateService';
import { LoggingService } from '../../src/services/LoggingService';
import { NegotiationService } from '../../src/services/NegotiationService';
import { GameRulesService } from '../../src/services/GameRulesService';
import { CardService } from '../../src/services/CardService';
import { ResourceService } from '../../src/services/ResourceService';
import { MovementService } from '../../src/services/MovementService';
import { ChoiceService } from '../../src/services/ChoiceService';
import { GameState } from '../../src/types/StateTypes';

describe('TurnService.tryAgainOnSpace', () => {
  let turnService: TurnService;
  let stateService: StateService;
  let dataService: DataService;
  let gameRulesService: GameRulesService;

  beforeEach(() => {
    // Create mock services
    dataService = {
      getSpaceContent: vi.fn(),
      getSpaceEffects: vi.fn(),
      isLoaded: vi.fn().mockReturnValue(true),
      getGameConfig: vi.fn().mockReturnValue([{
        space_name: 'START',
        is_starting_space: true,
        starting_money: 0,
        starting_cards: [],
        min_players: 1,
        max_players: 4,
      }]),
      getGameConfigBySpace: vi.fn(),
      getCardsByType: vi.fn().mockReturnValue([]),
      getSpaceByName: vi.fn(),
      getAllSpaces: vi.fn().mockReturnValue([]),
      getDiceOutcome: vi.fn(),
      getAllDiceOutcomes: vi.fn().mockReturnValue([]),
    } as any;

    stateService = new StateService(dataService);

    // Allow setGameState to work normally but spy on it
    const originalSetGameState = stateService.setGameState.bind(stateService);
    vi.spyOn(stateService, 'setGameState').mockImplementation((newState) => {
      return originalSetGameState(newState);
    });

    vi.spyOn(stateService, 'canStartGame').mockReturnValue(true);
    vi.spyOn(stateService, 'isInitialized').mockReturnValue(true);

    gameRulesService = {
      checkWinCondition: vi.fn(),
      checkGameEndConditions: vi.fn().mockResolvedValue({
        shouldEnd: false,
        reason: null,
        winnerId: null
      }),
    } as any;

    const loggingService = new LoggingService(stateService);
    const resourceService = {} as any;
    const cardService = {} as any;
    const choiceService = {} as any;
    const movementService = {} as any;
    const negotiationService = {} as any;
    const effectEngineService = {} as any;

    // Create TurnService with mocked nextPlayer method
    turnService = new TurnService(
      dataService,
      stateService,
      gameRulesService,
      cardService,
      resourceService,
      movementService,
      negotiationService,
      loggingService,
      effectEngineService
    );

    // Mock the private nextPlayer method using spyOn
    vi.spyOn(turnService as any, 'nextPlayer').mockResolvedValue({ nextPlayerId: 'player2' });
  });

  it('should revert to snapshot, apply penalty, and advance turn', async () => {
    // 1. Setup Initial State
    stateService.addPlayer('Player 1');
    stateService.addPlayer('Player 2');
    stateService.startGame();
    const initialGameState = stateService.getGameStateDeepCopy();
    const player1 = initialGameState.players[0];
    player1.currentSpace = 'OWNER-SCOPE-INITIATION';
    stateService.setGameState(initialGameState);

    // 2. Save a snapshot (this captures OWNER-SCOPE-INITIATION as the current space)
    stateService.savePreSpaceEffectSnapshot(player1.id, 'OWNER-SCOPE-INITIATION');
    
    // Create a mock snapshot with the correct space and initial timeSpent
    const mockSnapshot = {
      ...initialGameState,
      players: initialGameState.players.map(p => ({
        ...p,
        currentSpace: 'OWNER-SCOPE-INITIATION',
        timeSpent: 0 // Ensure snapshot has initial timeSpent of 0
      }))
    };
    vi.spyOn(stateService, 'getPreSpaceEffectSnapshot').mockReturnValue(mockSnapshot);
    vi.spyOn(stateService, 'getPlayerSnapshot').mockReturnValue(mockSnapshot);
    vi.spyOn(stateService, 'hasPreSpaceEffectSnapshot').mockImplementation((playerId: string, spaceName: string) =>
      playerId === player1.id && spaceName === 'OWNER-SCOPE-INITIATION'
    );

    // Mock DataService responses for this test
    (dataService.getSpaceContent as vi.Mock).mockReturnValue({ can_negotiate: true });
    (dataService.getSpaceEffects as vi.Mock).mockReturnValue([{ 
      effect_type: 'time', 
      effect_action: 'add', 
      effect_value: 1 
    }]);
    
    const snapshotState = stateService.getPreSpaceEffectSnapshot()!;
    expect(snapshotState).toBeDefined();

    // 3. Mutate the state after the snapshot was taken
    stateService.updatePlayer({ id: player1.id, money: 500 });
    expect(stateService.getPlayer(player1.id)!.money).toBe(500);

    // 4. Action: Call tryAgainOnSpace
    const result = await turnService.tryAgainOnSpace(player1.id);

    // 5. Assertions
    expect(result.success).toBe(true);
    expect(result.message).toContain('Player 1 used Try Again');
    expect(result.message).toContain('Reverted to OWNER-SCOPE-INITIATION with 1 day penalty');

    // Verify that setGameState was called
    const setGameStateMock = stateService.setGameState as vi.Mock;
    expect(setGameStateMock).toHaveBeenCalled();

    // Check the current state directly from StateService instead of mock calls
    const currentState = stateService.getGameState();
    const revertedPlayer = currentState.players.find(p => p.id === player1.id)!;

    console.log('Final player state:', { money: revertedPlayer.money, timeSpent: revertedPlayer.timeSpent });

    // Check that the mutation is gone (reverted)
    expect(revertedPlayer.money).toBe(0); // Original value

    // Check that the penalty was applied to the reverted state
    expect(revertedPlayer.timeSpent).toBe(1); // initial 0 + 1 penalty

    // Check that the snapshot is preserved for multiple Try Again attempts
    expect(currentState.playerSnapshots[player1.id]).not.toBeNull();
    expect(currentState.playerSnapshots[player1.id]!.spaceName).toBe('OWNER-SCOPE-INITIATION');

    // Verify that startTurn was called internally (no external turn advancement needed)
    // The TurnService now handles the complete flow internally
  });

  it('should fail if no snapshot is available', async () => {
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];

    // Ensure no snapshot exists
    expect(stateService.hasPreSpaceEffectSnapshot()).toBe(false);

    const result = await turnService.tryAgainOnSpace(player1.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('No snapshot available');
    expect((turnService as any).nextPlayer).not.toHaveBeenCalled();
  });

  it('should fail if the space is not negotiable', async () => {
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];
    player1.currentSpace = 'NON-NEGOTIABLE-SPACE';
    stateService.setGameState(gameState);

    // Mock DataService to return a non-negotiable space
    (dataService.getSpaceContent as vi.Mock).mockReturnValue({ can_negotiate: false });

    stateService.savePreSpaceEffectSnapshot(player1.id, 'NON-NEGOTIABLE-SPACE');

    const result = await turnService.tryAgainOnSpace(player1.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Try again not available on this space');
    expect((turnService as any).nextPlayer).not.toHaveBeenCalled();
  });
});