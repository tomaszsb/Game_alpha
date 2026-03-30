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

    // Pay-and-wait: shouldAdvanceTurn must be true so the turn ends
    expect(result.shouldAdvanceTurn).toBe(true);

    // TEMP state should be discarded (turn is ending)
    expect(stateService.hasActiveTempState(player1.id)).toBe(false);
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
    expect(result.shouldAdvanceTurn).toBe(false);
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
    expect(result.shouldAdvanceTurn).toBe(false);
    expect(result.message).toContain('Try again not available on this space');
    expect((turnService as any).nextPlayer).not.toHaveBeenCalled();
  });

  it('should apply time penalty to REAL state and discard TEMP', async () => {
    // Setup
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];
    player1.currentSpace = 'OWNER-SCOPE-INITIATION';
    player1.visitType = 'First';
    player1.timeSpent = 5;
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
      effect_value: 2 // 2 day penalty
    }]);

    const result = await turnService.tryAgainOnSpace(player1.id);
    expect(result.success).toBe(true);
    expect(result.shouldAdvanceTurn).toBe(true);

    // TEMP should be discarded (turn is ending)
    expect(stateService.hasActiveTempState(player1.id)).toBe(false);

    // Player's main state should reflect the penalty (restored from REAL which has penalty)
    const player = stateService.getPlayer(player1.id)!;
    expect(player.timeSpent).toBe(7); // 5 + 2 day penalty
  });

  it('should cancel any pending choice when Try Again is used', async () => {
    // Setup with a mock choiceService that has an active choice
    const mockChoiceService = {
      getActiveChoice: vi.fn().mockReturnValue({ id: 'choice-123', type: 'CARD_REPLACEMENT' }),
      skipChoice: vi.fn().mockReturnValue(true),
      createChoice: vi.fn(),
      resolveChoice: vi.fn(),
      hasActiveChoice: vi.fn().mockReturnValue(true)
    };

    const loggingService2 = new LoggingService(stateService);

    // Create a new TurnService with the mock choiceService in the correct position
    const turnService2 = new TurnService(
      dataService,
      stateService,
      gameRulesService,
      {} as any,  // cardService
      {} as any,  // resourceService
      {} as any,  // movementService
      {} as any,  // negotiationService
      loggingService2,
      mockChoiceService as any  // choiceService (9th arg)
    );
    vi.spyOn(turnService2 as any, 'nextPlayer').mockResolvedValue({ nextPlayerId: 'player2' });

    // Setup player
    stateService.addPlayer('Player 1');
    stateService.startGame();
    const gameState = stateService.getGameStateDeepCopy();
    const player1 = gameState.players[0];
    player1.currentSpace = 'OWNER-SCOPE-INITIATION';
    player1.visitType = 'First';
    stateService.setGameState(gameState);
    stateService.createTempStateFromReal({
      playerId: player1.id,
      spaceName: 'OWNER-SCOPE-INITIATION',
      visitType: 'First'
    });

    (dataService.getSpaceContent as any).mockReturnValue({ can_negotiate: true });
    (dataService.getSpaceEffects as any).mockReturnValue([{
      effect_type: 'time', effect_action: 'add', effect_value: 1
    }]);

    const result = await turnService2.tryAgainOnSpace(player1.id);

    expect(result.success).toBe(true);
    // Verify the pending choice was cancelled
    expect(mockChoiceService.getActiveChoice).toHaveBeenCalled();
    expect(mockChoiceService.skipChoice).toHaveBeenCalledWith('choice-123');
  });
});
