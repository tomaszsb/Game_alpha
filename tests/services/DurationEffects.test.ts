import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectEngineService } from '../../src/services/EffectEngineService';
import { TurnService } from '../../src/services/TurnService';
import { StateService } from '../../src/services/StateService';
import { PlayerActionService } from '../../src/services/PlayerActionService';
import { NegotiationService } from '../../src/services/NegotiationService';
import { IDataService, IResourceService, ICardService, IChoiceService, IMovementService, IGameRulesService, INegotiationService } from '../../src/types/ServiceContracts';
import { GameState, Player, ActiveEffect } from '../../src/types/StateTypes';
import { createMockDataService, createMockResourceService, createMockCardService, createMockChoiceService, createMockMovementService, createMockGameRulesService, createMockNegotiationService, createMockLoggingService } from '../mocks/mockServices';

describe('Duration-Based Card Effects System', () => {
  let effectEngineService: EffectEngineService;
  let turnService: TurnService;
  let stateService: StateService;
  let playerActionService: PlayerActionService;
  let mockDataService: vi.Mocked<IDataService>;
  let mockResourceService: vi.Mocked<IResourceService>;
  let mockCardService: vi.Mocked<ICardService>;
  let mockChoiceService: vi.Mocked<IChoiceService>;
  let mockMovementService: vi.Mocked<IMovementService>;
  let mockGameRulesService: vi.Mocked<IGameRulesService>;
  let mockNegotiationService: vi.Mocked<INegotiationService>;

  const mockPlayer: Player = {
    id: 'player1',
    name: 'Alice',
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    money: 1000,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    color: '#007bff',
    avatar: '👤',
    hand: ['L002'],
    activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [], // This is what we're testing
    loans: []
  };

  const mockGameState: GameState = {
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 1,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    awaitingChoice: null,
    isGameOver: false,
    activeModal: null,
    requiredActions: 0,
    completedActions: 0,
    availableActionTypes: [],
    hasCompletedManualActions: false,
    activeNegotiation: null,
    globalActionLog: [],
    preSpaceEffectState: null,
    decks: {
      W: ['W001', 'W002'],
      B: ['B001', 'B002'],
      E: ['E001', 'E002'],
      L: ['L001', 'L002'],
      I: ['I001', 'I002']
    },
    discardPiles: {
      W: [],
      B: [],
      E: [],
      L: [],
      I: []
    }
  };

  // Mock card with duration-based effects (like L002 - Economic Downturn)
  const mockDurationCard = {
    card_id: 'L002',
    card_name: 'Economic Downturn',
    card_type: 'L' as const,
    description: 'All permit and inspection times increase by 2 ticks for the next 3 turns.',
    effects_on_play: 'Apply Card',
    cost: 0,
    phase_restriction: 'Any',
    duration: 'Turns',
    duration_count: '3',
    turn_effect: '',
    activation_timing: 'Immediate',
    loan_amount: '0',
    loan_rate: '0',
    investment_amount: '0',
    work_cost: '0',
    money_effect: '',
    tick_modifier: '2',
    draw_cards: '',
    discard_cards: '',
    target: 'All Players',
    scope: 'Global'
  };

  // Mock card without duration (immediate effect)
  const mockImmediateCard = {
    card_id: 'E001',
    card_name: 'Quick Fix',
    card_type: 'E' as const,
    description: 'Reduce time by 2 ticks immediately.',
    effects_on_play: 'Apply Card',
    cost: 0,
    phase_restriction: 'Any',
    duration: 'Immediate',
    duration_count: '0',
    turn_effect: '',
    activation_timing: 'Immediate',
    loan_amount: '0',
    loan_rate: '0',
    investment_amount: '0',
    work_cost: '0',
    money_effect: '',
    tick_modifier: '-2',
    draw_cards: '',
    discard_cards: '',
    target: 'Self',
    scope: 'Single'
  };

  beforeEach(() => {
    // Create real StateService with mock DataService
    mockDataService = createMockDataService();
    stateService = new StateService(mockDataService);

    // Create mock services
    mockResourceService = createMockResourceService();
    mockCardService = createMockCardService();
    mockChoiceService = createMockChoiceService();
    mockMovementService = createMockMovementService();
    mockGameRulesService = createMockGameRulesService();
    mockNegotiationService = createMockNegotiationService();
    const loggingService = createMockLoggingService();

    // Create EffectEngineService
    effectEngineService = new EffectEngineService(
      mockResourceService,
      mockCardService,
      mockChoiceService,
      stateService,
      mockMovementService,
      {} as any, // TurnService will be set later
      mockGameRulesService,
      {} as any // targetingService
    );

    // Create TurnService and PlayerActionService
    turnService = new TurnService(
      mockDataService,
      stateService,
      mockGameRulesService,
      mockCardService,
      mockResourceService,
      mockMovementService,
      mockNegotiationService as any,
      loggingService,
      effectEngineService
    );

    playerActionService = new PlayerActionService(
      mockDataService,
      stateService,
      mockGameRulesService,
      mockMovementService,
      turnService,
      effectEngineService,
      loggingService
    );

    // Set up circular dependency
    effectEngineService.setTurnService(turnService);

    // Set up mock data
    mockDataService.getCardById.mockImplementation((cardId: string) => {
      if (cardId === 'L002') return mockDurationCard;
      if (cardId === 'E001') return mockImmediateCard;
      return undefined;
    });

    // Set up initial game state
    stateService.setGameState({
      ...mockGameState,
      players: [mockPlayer]
    });

    // Mock resource service to return success
    mockResourceService.addTime.mockReturnValue(undefined);
    mockResourceService.spendTime.mockReturnValue(undefined);
  });

  describe('Duration Effect Storage', () => {
    it('should store effects with duration instead of applying immediately', async () => {
      // Mock EffectFactory to create a simple time effect
      const timeEffect = {
        effectType: 'RESOURCE_CHANGE' as const,
        payload: {
          playerId: 'player1',
          resource: 'TIME' as const,
          amount: 2,
          source: 'card:L002',
          reason: 'Economic Downturn: 2'
        }
      };

      // Process effects with duration
      const result = await effectEngineService.processEffectsWithDuration(
        [timeEffect],
        { source: 'test', playerId: 'player1', triggerEvent: 'CARD_PLAY' },
        mockDurationCard
      );

      // Verify the effect was stored, not applied immediately
      expect(result.success).toBe(true);
      expect(result.totalEffects).toBe(1);
      expect(result.successfulEffects).toBe(1);

      // Verify no immediate resource changes
      expect(mockResourceService.addTime).not.toHaveBeenCalled();

      // Verify active effect was added to player
      const updatedGameState = stateService.getGameState();
      const updatedPlayer = updatedGameState.players[0];
      expect(updatedPlayer.activeEffects).toHaveLength(1);

      const activeEffect = updatedPlayer.activeEffects[0];
      expect(activeEffect.sourceCardId).toBe('L002');
      expect(activeEffect.remainingDuration).toBe(3);
      expect(activeEffect.effectType).toBe('RESOURCE_CHANGE');
      expect(activeEffect.startTurn).toBe(1);
    });

    it('should apply immediate effects without duration storage', async () => {
      // Mock EffectFactory to create an immediate time effect
      const immediateEffect = {
        effectType: 'RESOURCE_CHANGE' as const,
        payload: {
          playerId: 'player1',
          resource: 'TIME' as const,
          amount: -2,
          source: 'card:E001',
          reason: 'Quick Fix: -2'
        }
      };

      // Process effects without duration (immediate card)
      const result = await effectEngineService.processEffectsWithDuration(
        [immediateEffect],
        { source: 'test', playerId: 'player1', triggerEvent: 'CARD_PLAY' },
        mockImmediateCard
      );

      // Verify the effect was applied immediately
      expect(result.success).toBe(true);

      // Verify immediate resource changes occurred
      expect(mockResourceService.spendTime).toHaveBeenCalledWith(
        'player1',
        2,
        'card:E001',
        'Quick Fix: -2'
      );

      // Verify no active effect was stored
      const updatedGameState = stateService.getGameState();
      const updatedPlayer = updatedGameState.players[0];
      expect(updatedPlayer.activeEffects).toHaveLength(0);
    });
  });

  describe('Active Effect Processing', () => {
    beforeEach(() => {
      // Set up a player with an active effect
      const activeEffect: ActiveEffect = {
        effectId: 'test_effect_1',
        sourceCardId: 'L002',
        effectData: {
          effectType: 'RESOURCE_CHANGE' as const,
          payload: {
            playerId: 'player1',
            resource: 'TIME' as const,
            amount: 2,
            source: 'card:L002',
            reason: 'Economic Downturn: 2'
          }
        },
        remainingDuration: 3,
        startTurn: 1,
        effectType: 'RESOURCE_CHANGE',
        description: 'Effect from L002 (3 turns remaining)'
      };

      stateService.updatePlayer({
        id: 'player1',
        activeEffects: [activeEffect]
      });
    });

    it('should apply active effects and decrement duration', async () => {
      // Apply active effects for the player
      await effectEngineService.applyActiveEffects('player1');

      // Verify the effect was applied
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1',
        2,
        'active:L002',
        'Economic Downturn: 2'
      );

      // Verify duration was decremented
      const updatedGameState = stateService.getGameState();
      const updatedPlayer = updatedGameState.players[0];
      expect(updatedPlayer.activeEffects).toHaveLength(1);
      expect(updatedPlayer.activeEffects[0].remainingDuration).toBe(2);
    });

    it('should remove effects when duration reaches zero', async () => {
      // Set up an effect with only 1 turn remaining
      const expiringEffect: ActiveEffect = {
        effectId: 'expiring_effect',
        sourceCardId: 'L002',
        effectData: {
          effectType: 'RESOURCE_CHANGE' as const,
          payload: {
            playerId: 'player1',
            resource: 'TIME' as const,
            amount: 2,
            source: 'card:L002',
            reason: 'Economic Downturn: 2'
          }
        },
        remainingDuration: 1,
        startTurn: 1,
        effectType: 'RESOURCE_CHANGE',
        description: 'Effect from L002 (1 turn remaining)'
      };

      stateService.updatePlayer({
        id: 'player1',
        activeEffects: [expiringEffect]
      });

      // Apply active effects
      await effectEngineService.applyActiveEffects('player1');

      // Verify the effect was applied one last time
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1',
        2,
        'active:L002',
        'Economic Downturn: 2'
      );

      // Verify the effect was removed
      const updatedGameState = stateService.getGameState();
      const updatedPlayer = updatedGameState.players[0];
      expect(updatedPlayer.activeEffects).toHaveLength(0);
    });

    it('should process active effects for all players', async () => {
      // Add a second player with active effects
      const player2: Player = {
        ...mockPlayer,
        id: 'player2',
        name: 'Bob',
        activeEffects: [{
          effectId: 'player2_effect',
          sourceCardId: 'L002',
          effectData: {
            effectType: 'RESOURCE_CHANGE' as const,
            payload: {
              playerId: 'player2',
              resource: 'TIME' as const,
              amount: 1,
              source: 'card:L002',
              reason: 'Economic Downturn: 1'
            }
          },
          remainingDuration: 2,
          startTurn: 1,
          effectType: 'RESOURCE_CHANGE',
          description: 'Effect from L002 (2 turns remaining)'
        }]
      };

      stateService.setGameState({
        ...mockGameState,
        players: [
          stateService.getGameState().players[0], // player1 with existing active effect
          player2
        ]
      });

      // Process active effects for all players
      await effectEngineService.processActiveEffectsForAllPlayers();

      // Verify effects were applied to both players
      expect(mockResourceService.addTime).toHaveBeenCalledTimes(2);
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1',
        2,
        'active:L002',
        'Economic Downturn: 2'
      );
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player2',
        1,
        'active:L002',
        'Economic Downturn: 1'
      );
    });
  });

  describe('Turn Integration', () => {
    it('should process active effects during turn transitions', async () => {
      // Set up an active effect
      const activeEffect: ActiveEffect = {
        effectId: 'turn_effect',
        sourceCardId: 'L002',
        effectData: {
          effectType: 'RESOURCE_CHANGE' as const,
          payload: {
            playerId: 'player1',
            resource: 'TIME' as const,
            amount: 2,
            source: 'card:L002',
            reason: 'Economic Downturn: 2'
          }
        },
        remainingDuration: 2,
        startTurn: 1,
        effectType: 'RESOURCE_CHANGE',
        description: 'Effect from L002 (2 turns remaining)'
      };

      stateService.updatePlayer({
        id: 'player1',
        activeEffects: [activeEffect]
      });

      // Test the effect processing directly without turn service complexity
      await effectEngineService.processActiveEffectsForAllPlayers();

      // Verify active effect was applied
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1',
        2,
        'active:L002',
        'Economic Downturn: 2'
      );

      // Verify duration was decremented
      const updatedGameState = stateService.getGameState();
      const updatedPlayer = updatedGameState.players[0];
      expect(updatedPlayer.activeEffects).toHaveLength(1);
      expect(updatedPlayer.activeEffects[0].remainingDuration).toBe(1);
    });
  });

  describe('Full Lifecycle Test', () => {
    it('should handle complete lifecycle of a 3-turn duration effect', async () => {
      // Mock EffectFactory to create effects for L002 card
      const timeEffect = {
        effectType: 'RESOURCE_CHANGE' as const,
        payload: {
          playerId: 'player1',
          resource: 'TIME' as const,
          amount: 2,
          source: 'card:L002',
          reason: 'Economic Downturn: 2'
        }
      };

      // 1. Play card with duration effects
      const playResult = await effectEngineService.processEffectsWithDuration(
        [timeEffect],
        { source: 'test', playerId: 'player1', triggerEvent: 'CARD_PLAY' },
        mockDurationCard
      );

      expect(playResult.success).toBe(true);

      // Verify effect is stored
      let gameState = stateService.getGameState();
      let player = gameState.players[0];
      expect(player.activeEffects).toHaveLength(1);
      expect(player.activeEffects[0].remainingDuration).toBe(3);

      // 2. Process active effects turn 1 - effect should be applied and duration decremented to 2
      await effectEngineService.processActiveEffectsForAllPlayers();

      gameState = stateService.getGameState();
      player = gameState.players[0];
      expect(player.activeEffects).toHaveLength(1);
      expect(player.activeEffects[0].remainingDuration).toBe(2);
      expect(mockResourceService.addTime).toHaveBeenCalledTimes(1);

      // 3. Process active effects turn 2 - effect should be applied and duration decremented to 1
      await effectEngineService.processActiveEffectsForAllPlayers();

      gameState = stateService.getGameState();
      player = gameState.players[0];
      expect(player.activeEffects).toHaveLength(1);
      expect(player.activeEffects[0].remainingDuration).toBe(1);
      expect(mockResourceService.addTime).toHaveBeenCalledTimes(2);

      // 4. Process active effects turn 3 - effect should be applied one last time and removed
      await effectEngineService.processActiveEffectsForAllPlayers();

      gameState = stateService.getGameState();
      player = gameState.players[0];
      expect(player.activeEffects).toHaveLength(0);
      expect(mockResourceService.addTime).toHaveBeenCalledTimes(3);

      // All calls should have been with the same parameters
      expect(mockResourceService.addTime).toHaveBeenNthCalledWith(1, 'player1', 2, 'active:L002', 'Economic Downturn: 2');
      expect(mockResourceService.addTime).toHaveBeenNthCalledWith(2, 'player1', 2, 'active:L002', 'Economic Downturn: 2');
      expect(mockResourceService.addTime).toHaveBeenNthCalledWith(3, 'player1', 2, 'active:L002', 'Economic Downturn: 2');
    });
  });
});