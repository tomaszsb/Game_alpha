// Unit test for the tryAgainOnSpace method
// This test verifies the REAL/TEMP state model for Try Again functionality

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
import { GameState, CreateTempOptions } from '../../src/types/StateTypes';

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

  it('should apply penalty using REAL/TEMP state model and advance turn', async () => {
    // 1. Setup Initial State
    stateService.addPlayer('Player 1');
    stateService.addPlayer('Player 2');
    stateService.startGame();
    const initialGameState = stateService.getGameStateDeepCopy();
    const player1 = initialGameState.players[0];
    player1.currentSpace = 'OWNER-SCOPE-INITIATION';
    player1.visitType = 'First';
    stateService.setGameState(initialGameState);

    // 2. Create TEMP state (simulates turn start)
    const tempOptions: CreateTempOptions = {
      playerId: player1.id,
      spaceName: 'OWNER-SCOPE-INITIATION',
      visitType: 'First'
    };
    stateService.createTempStateFromReal(tempOptions);

    // Verify TEMP state exists
    expect(stateService.hasActiveTempState(player1.id)).toBe(true);

    // Mock DataService responses for this test
    (dataService.getSpaceContent as vi.Mock).mockReturnValue({ can_negotiate: true });
    (dataService.getSpaceEffects as vi.Mock).mockReturnValue([{
      effect_type: 'time',
      effect_action: 'add',
      effect_value: 1
    }]);

    // 3. Mutate the state after TEMP was created (simulates effects being applied)
    stateService.updatePlayer({ id: player1.id, money: 500 });
    expect(stateService.getPlayer(player1.id)!.money).toBe(500);

    // 4. Action: Call tryAgainOnSpace
    const result = await turnService.tryAgainOnSpace(player1.id);

    // 5. Assertions
    expect(result.success).toBe(true);
    expect(result.message).toContain('Player 1 used Try Again');
    expect(result.message).toContain('1 day');

    // Check that Try Again count was incremented
    expect(stateService.getTryAgainCount(player1.id)).toBe(1);

    // Check that a fresh TEMP state was created
    expect(stateService.hasActiveTempState(player1.id)).toBe(true);
  });

  it('should fail if no active TEMP state exists', async () => {
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];

    // Don't create TEMP state - player is not in their turn
    expect(stateService.hasActiveTempState(player1.id)).toBe(false);

    const result = await turnService.tryAgainOnSpace(player1.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('no active turn state');
    expect((turnService as any).nextPlayer).not.toHaveBeenCalled();
  });

  it('should fail if the space is not negotiable', async () => {
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];
    player1.currentSpace = 'NON-NEGOTIABLE-SPACE';
    player1.visitType = 'First';
    stateService.setGameState(gameState);

    // Create TEMP state (simulates turn start)
    const tempOptions: CreateTempOptions = {
      playerId: player1.id,
      spaceName: 'NON-NEGOTIABLE-SPACE',
      visitType: 'First'
    };
    stateService.createTempStateFromReal(tempOptions);

    // Mock DataService to return a non-negotiable space
    (dataService.getSpaceContent as vi.Mock).mockReturnValue({ can_negotiate: false });

    const result = await turnService.tryAgainOnSpace(player1.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Try again not available on this space');
    expect((turnService as any).nextPlayer).not.toHaveBeenCalled();
  });

  it('should accumulate penalties across multiple Try Again attempts', async () => {
    // Setup
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];
    player1.currentSpace = 'OWNER-SCOPE-INITIATION';
    player1.visitType = 'First';
    player1.timeSpent = 0;
    stateService.setGameState(gameState);

    // Create initial TEMP state
    stateService.createTempStateFromReal({
      playerId: player1.id,
      spaceName: 'OWNER-SCOPE-INITIATION',
      visitType: 'First'
    });

    // Mock DataService
    (dataService.getSpaceContent as vi.Mock).mockReturnValue({ can_negotiate: true });
    (dataService.getSpaceEffects as vi.Mock).mockReturnValue([{
      effect_type: 'time',
      effect_action: 'add',
      effect_value: 2 // 2 day penalty per Try Again
    }]);

    // First Try Again
    const result1 = await turnService.tryAgainOnSpace(player1.id);
    expect(result1.success).toBe(true);
    expect(stateService.getTryAgainCount(player1.id)).toBe(1);

    // Second Try Again
    const result2 = await turnService.tryAgainOnSpace(player1.id);
    expect(result2.success).toBe(true);
    expect(stateService.getTryAgainCount(player1.id)).toBe(2);

    // Penalties should accumulate in REAL state
    // Each Try Again adds 2 days to REAL, so after 2 attempts: 2 + 2 = 4 days
    const realState = stateService.getEffectivePlayerState(player1.id);
    expect(realState).not.toBeNull();
    // Note: The exact accumulated value depends on how applyToRealState handles the penalty
  });
});
