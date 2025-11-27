// E066 Card Re-roll Integration Test
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectFactory } from '../src/utils/EffectFactory';
import { EffectEngineService } from '../src/services/EffectEngineService';
import { TurnService } from '../src/services/TurnService';
import { 
  IResourceService, 
  ICardService, 
  IChoiceService, 
  IStateService, 
  IMovementService,
  ITurnService,
  IGameRulesService,
  IDataService,
  IEffectEngineService
} from '../src/types/ServiceContracts';
import { Effect, EffectContext, isTurnControlEffect } from '../src/types/EffectTypes';
import { Player, Card } from '../src/types/DataTypes';
import { GameState } from '../src/types/StateTypes';
import { TurnEffectResult } from '../src/types/StateTypes';
import { NegotiationService } from '../src/services/NegotiationService';
import {
  createMockDataService,
  createMockStateService,
  createMockResourceService,
  createMockCardService,
  createMockChoiceService,
  createMockMovementService,
  createMockGameRulesService,
  createMockNegotiationService,
  createMockLoggingService
} from './mocks/mockServices';

const createMockServices = () => ({
  dataService: createMockDataService(),
  resourceService: createMockResourceService(),
  cardService: createMockCardService(),
  choiceService: createMockChoiceService(),
  stateService: createMockStateService(),
  movementService: createMockMovementService(),
  gameRulesService: createMockGameRulesService(),
  negotiationService: createMockNegotiationService(),
  loggingService: createMockLoggingService()
});

describe('E066 Card - Re-roll Mechanics Integration', () => {
  let effectEngineService: EffectEngineService;
  let turnService: TurnService;
  let mockServices: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mockServices = createMockServices();
    
    // Setup essential GameRulesService mocks
    mockServices.gameRulesService.checkGameEndConditions.mockResolvedValue({
      shouldEnd: false,
      reason: null,
      winnerId: null
    });
    
    effectEngineService = new EffectEngineService(
      mockServices.resourceService,
      mockServices.cardService,
      mockServices.choiceService,
      mockServices.stateService,
      mockServices.movementService,
      {} as ITurnService,
      mockServices.gameRulesService,
      {} as any // targetingService
    );

    turnService = new TurnService(
      mockServices.dataService,
      mockServices.stateService,
      mockServices.gameRulesService,
      mockServices.cardService,
      mockServices.resourceService,
      mockServices.movementService,
      mockServices.negotiationService as any,
      mockServices.loggingService,
      effectEngineService
    );

    // Set the effect engine service on turn service for circular dependency
    turnService.setEffectEngineService(effectEngineService);
  });

  it('should parse E066 card and create GRANT_REROLL effect', () => {
    const e066Card: Card = {
      card_id: 'E066',
      card_name: 'Investor Pitch Preparation',
      description: 'Gain 1 extra die throw this turn if you do not like the outcome of first throw.',
      card_type: 'E'
    };

    const effects = EffectFactory.createEffectsFromCard(e066Card, 'player1');

    // E066 generates GRANT_REROLL effect plus a LOG effect
    expect(effects.length).toBeGreaterThanOrEqual(1);
    
    const rerollEffect = effects.find(e => e.effectType === 'TURN_CONTROL');
    expect(rerollEffect).toBeDefined();
    expect(rerollEffect?.effectType).toBe('TURN_CONTROL');
    
    if (rerollEffect && isTurnControlEffect(rerollEffect)) {
      const payload = rerollEffect.payload;
      expect(payload.action).toBe('GRANT_REROLL');
      expect(payload.playerId).toBe('player1');
      expect(payload.source).toBe('card:E066');
      expect(payload.reason).toContain('extra die throw');
    }
  });

  it('should process GRANT_REROLL effect and set canReRoll flag', async () => {
    const grantRerollEffect: Effect = {
      effectType: 'TURN_CONTROL',
      payload: {
        action: 'GRANT_REROLL',
        playerId: 'player1',
        source: 'card:E066',
        reason: 'Investor Pitch Preparation: Gain 1 extra die throw this turn'
      }
    };

    const mockPlayer: Player = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST_SPACE',
      visitType: 'First',
      money: 100,
      timeSpent: 10,
      projectScope: 50,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);

    const context: EffectContext = {
      source: 'Card Play',
      playerId: 'player1',
      triggerEvent: 'CARD_PLAY'
    };

    const result = await effectEngineService.processEffect(grantRerollEffect, context);

    expect(result.success).toBe(true);
    expect(mockServices.stateService.updatePlayer).toHaveBeenCalledWith({
      id: 'player1',
      turnModifiers: {
        skipTurns: 0,
        canReRoll: true
      }
    });
  });

  it('should include canReRoll in rollDiceWithFeedback result when flag is set', async () => {
    const mockPlayer: Player = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST_SPACE',
      visitType: 'First',
      money: 100,
      timeSpent: 10,
      projectScope: 50,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0, canReRoll: true },
      activeEffects: [],
      loans: []
    };

    // Mock game state with the test player
    const mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as const,
      turn: 1
    };
    
    mockServices.stateService.getGameState.mockReturnValue(mockGameState as any);
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceEffects.mockReturnValue([]);

    // Mock the rollDice method to return a fixed value
    vi.spyOn(turnService as any, 'rollDice').mockReturnValue(4);

    const result = await turnService.rollDiceWithFeedback('player1');

    expect(result.canReRoll).toBe(true);
    expect(result.diceValue).toBe(4);
  });

  it('should not include canReRoll when flag is not set', async () => {
    const mockPlayer: Player = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST_SPACE',
      visitType: 'First',
      money: 100,
      timeSpent: 10,
      projectScope: 50,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0, canReRoll: false },
      activeEffects: [],
      loans: []
    };

    // Mock game state with the test player
    const mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as const,
      turn: 1
    };
    
    mockServices.stateService.getGameState.mockReturnValue(mockGameState as any);
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceEffects.mockReturnValue([]);

    // Mock the rollDice method to return a fixed value
    vi.spyOn(turnService as any, 'rollDice').mockReturnValue(3);

    const result = await turnService.rollDiceWithFeedback('player1');

    expect(result.canReRoll).toBe(false);
    expect(result.diceValue).toBe(3);
  });

  it('should successfully execute rerollDice when player has canReRoll flag', async () => {
    const mockPlayer: Player = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST_SPACE',
      visitType: 'First',
      money: 100,
      timeSpent: 10,
      projectScope: 50,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0, canReRoll: true },
      activeEffects: [],
      loans: []
    };

    // Mock game state with the test player
    const mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as const,
      turn: 1
    };
    
    mockServices.stateService.getGameState.mockReturnValue(mockGameState as any);
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.dataService.getSpaceEffects.mockReturnValue([]);
    mockServices.dataService.getDiceEffects.mockReturnValue([]);

    // Mock the rollDice method to return a different value for re-roll
    vi.spyOn(turnService as any, 'rollDice').mockReturnValue(6);

    const result = await turnService.rerollDice('player1');

    expect(result.diceValue).toBe(6);
    expect(result.canReRoll).toBe(false); // Should be consumed after use
    
    // Should consume the re-roll ability
    expect(mockServices.stateService.updatePlayer).toHaveBeenCalledWith({
      id: 'player1',
      turnModifiers: {
        skipTurns: 0,
        canReRoll: false
      }
    });
  });

  it('should throw error when trying to reroll without canReRoll flag', async () => {
    const mockPlayer: Player = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST_SPACE',
      visitType: 'First',
      money: 100,
      timeSpent: 10,
      projectScope: 50,
      score: 0,
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0, canReRoll: false },
      activeEffects: [],
      loans: []
    };

    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);

    await expect(turnService.rerollDice('player1')).rejects.toThrow(
      'Player player1 does not have re-roll ability'
    );
  });

  it('should reset canReRoll flag at end of turn', async () => {
    const mockGameState: GameState = {
      players: [{
        id: 'player1',
        name: 'Test Player',
        currentSpace: 'TEST_SPACE',
        visitType: 'First',
        money: 100,
        timeSpent: 10,
        projectScope: 50,
        score: 0,
        hand: [],
        activeCards: [],
        turnModifiers: { skipTurns: 0, canReRoll: true },
        activeEffects: [],
        loans: []
      }],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      turn: 1,
      globalTurnCount: 1,
      playerTurnCounts: { player1: 1 },
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: true,
      isGameOver: false,
      requiredActions: 1,
      completedActions: 1,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      decks: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      },
      discardPiles: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      }
    };

    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.stateService.getPlayer.mockReturnValue(mockGameState.players[0]);
    mockServices.gameRulesService.checkWinCondition = vi.fn().mockResolvedValue(false);

    // Execute nextPlayer (which is called by endTurn)
    const nextPlayerMethod = (turnService as any).nextPlayer.bind(turnService);
    const result = await nextPlayerMethod();

    expect(mockServices.stateService.updatePlayer).toHaveBeenCalledWith({
      id: 'player1',
      turnModifiers: {
        skipTurns: 0,
        canReRoll: false
      }
    });
  });
});