import { PlayerActionService } from '../../src/services/PlayerActionService';
import { IDataService, IStateService, IGameRulesService, IMovementService, ITurnService, IEffectEngineService, ILoggingService } from '../../src/types/ServiceContracts';
import { Player, Card } from '../../src/types/DataTypes';
import { GameState } from '../../src/types/StateTypes';
import { createMockDataService, createMockStateService, createMockGameRulesService, createMockMovementService, createMockTurnService, createMockEffectEngineService, createMockLoggingService } from '../mocks/mockServices';
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock EffectFactory to prevent real logic execution
vi.mock('../../src/utils/EffectFactory', () => ({
  EffectFactory: {
    createEffectsFromCard: vi.fn()
  }
}));

// Import the mocked module to get access to the mocked functions
import { EffectFactory } from '../../src/utils/EffectFactory';
const mockCreateEffectsFromCard = EffectFactory.createEffectsFromCard as vi.MockedFunction<typeof EffectFactory.createEffectsFromCard>;

// Suppress console.log calls from service
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = vi.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

// Mock the services using centralized creators
const mockDataService: any = createMockDataService();
const mockStateService: any = createMockStateService();
const mockGameRulesService: any = createMockGameRulesService();
const mockMovementService: any = createMockMovementService();
const mockTurnService: any = createMockTurnService();
const mockEffectEngineService: any = createMockEffectEngineService();
const mockLoggingService: any = createMockLoggingService();

describe('PlayerActionService', () => {
  let playerActionService: PlayerActionService;
  
  // Test data
  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    money: 1000,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    color: '#007bff',
    avatar: '👤',
    hand: ['W001', 'W002', 'B001', 'E001'], // New hand structure - player owns these cards
    activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
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
    requiredActions: 1,
    completedActions: 0,
    availableActionTypes: [],
    hasCompletedManualActions: false,
    activeNegotiation: null,
    globalActionLog: [],
    preSpaceEffectState: null,
    // New stateful deck properties
    decks: {
      W: ['W003', 'W004', 'W005'],
      B: ['B002', 'B003'],
      E: ['E002', 'E003', 'E004'],
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

  const mockCard: Card = {
    card_id: 'W001',
    card_name: 'Strategic Planning',
    card_type: 'W',
    description: 'Plan your next moves carefully.',
    effects_on_play: 'Draw 2 additional cards and gain 1 time unit.',
    cost: 100,
    phase_restriction: 'Planning'
  };

  const mockFreeCard: Card = {
    card_id: 'W002',
    card_name: 'Free Action',
    card_type: 'W',
    description: 'A free action card.',
    effects_on_play: 'Gain 1 time unit.',
    cost: 0,
    phase_restriction: 'Any'
  };

  const mockExpensiveCard: Card = {
    card_id: 'B001',
    card_name: 'Expensive Investment',
    card_type: 'B',
    description: 'A very expensive card.',
    effects_on_play: 'Gain massive advantage.',
    cost: 2000,
    phase_restriction: 'Any'
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default EffectFactory mock
    mockCreateEffectsFromCard.mockReturnValue([]);
    
    // Create service instance
    playerActionService = new PlayerActionService(
      mockDataService,
      mockStateService,
      mockGameRulesService,
      mockMovementService,
      mockTurnService,
      mockEffectEngineService,
      mockLoggingService
    );

    // Setup default EffectEngineService mock - return immediately
    mockEffectEngineService.processEffects.mockResolvedValue({
      success: true,
      totalEffects: 0,
      successfulEffects: 0,
      failedEffects: 0,
      results: [],
      errors: []
    });
    mockEffectEngineService.processCardEffects.mockResolvedValue({
      success: true,
      totalEffects: 0,
      successfulEffects: 0,
      failedEffects: 0,
      results: [],
      errors: []
    });
    mockEffectEngineService.processEffect.mockResolvedValue({
      success: true,
      effectType: 'RESOURCE_CHANGE'
    });
    mockEffectEngineService.processEffects.mockResolvedValue({
      success: true,
      totalEffects: 0,
      successfulEffects: 0,
      failedEffects: 0,
      results: [],
      errors: []
    });
    mockEffectEngineService.validateEffect.mockReturnValue(true);
    mockEffectEngineService.validateEffects.mockReturnValue(true);

    // Setup default mock implementations
    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.getPlayer.mockReturnValue(mockPlayer);
    
    // Setup default MovementService mock implementations
    mockMovementService.getValidMoves.mockReturnValue([]);
    mockMovementService.getDiceDestination.mockReturnValue(null);
    mockMovementService.movePlayer.mockReturnValue(mockGameState);
    
    // Setup default TurnService mock implementations - all synchronous returns
    mockTurnService.endTurn.mockResolvedValue({ nextPlayerId: 'player2' });
    mockTurnService.canPlayerTakeTurn.mockReturnValue(true);
    mockTurnService.getCurrentPlayerTurn.mockReturnValue('player1');
    mockTurnService.rollDiceAndProcessEffects.mockResolvedValue({ diceRoll: 3 });
    mockTurnService.endTurnWithMovement.mockResolvedValue({ nextPlayerId: 'player2' });
    mockTurnService.processTurnEffects.mockResolvedValue({
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      turn: 1,
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      requiredActions: 0,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      decks: {
        W: ['W003', 'W004', 'W005'],
        B: ['B002', 'B003'],
        E: ['E002', 'E003', 'E004'],
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
    });
    mockTurnService.rollDiceWithFeedback.mockResolvedValue({
      diceValue: 3,
      spaceName: 'TEST-SPACE',
      effects: [],
      summary: 'Dice rolled successfully',
      hasChoices: false
    });
    mockTurnService.triggerManualEffectWithFeedback.mockReturnValue({
      diceValue: 0,
      spaceName: 'TEST-SPACE',
      effects: [],
      summary: 'Manual effect triggered',
      hasChoices: false
    });
    mockTurnService.performNegotiation.mockResolvedValue({ success: true, message: 'Negotiation completed' });
    mockTurnService.setTurnModifier.mockReturnValue(true);
  });

  describe('playCard', () => {
    it('should successfully play a valid card', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(mockCard);
      mockGameRulesService.canPlayCard.mockReturnValue(true);
      mockGameRulesService.canPlayerAfford.mockReturnValue(true);

      // Act
      await playerActionService.playCard('player1', 'W001');

      // Assert - PlayerActionService should orchestrate, not directly manipulate state
      expect(mockDataService.getCardById).toHaveBeenCalledWith('W001');
      expect(mockGameRulesService.canPlayCard).toHaveBeenCalledWith('player1', 'W001');
      expect(mockGameRulesService.canPlayerAfford).toHaveBeenCalledWith('player1', 100);
      
      // Most important: Verify EffectEngineService orchestration
      // Current implementation uses processCardEffects() with effects from EffectFactory
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        [], // Effects from EffectFactory.createEffectsFromCard
        {
          source: 'player_action:card_play',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY',
          metadata: {
            cardId: 'W001',
            cardName: 'Strategic Planning',
            cardType: 'W',
            playerName: 'Test Player'
          }
        },
        expect.objectContaining({
          card_id: 'W001',
          card_name: 'Strategic Planning',
          card_type: 'W'
        })
      );
      
      // Verify final PLAY_CARD effect is processed for card lifecycle
      expect(mockEffectEngineService.processEffect).toHaveBeenCalledWith(
        {
          effectType: 'PLAY_CARD',
          payload: {
            playerId: 'player1',
            cardId: 'W001',
            source: 'card_lifecycle:W001'
          }
        },
        {
          source: 'player_action:card_play',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY',
          metadata: {
            cardId: 'W001',
            cardName: 'Strategic Planning',
            cardType: 'W',
            playerName: 'Test Player'
          }
        }
      );
    });

    it('should successfully play a free card (cost 0)', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(mockFreeCard);
      mockGameRulesService.canPlayCard.mockReturnValue(true);

      // Act
      await playerActionService.playCard('player1', 'W002');

      // Assert
      expect(mockGameRulesService.canPlayerAfford).not.toHaveBeenCalled(); // Should not check affordability for free cards
      
      // Verify orchestration through EffectEngineService
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        [], // Effects from EffectFactory.createEffectsFromCard
        {
          source: 'player_action:card_play',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY',
          metadata: {
            cardId: 'W002',
            cardName: 'Free Action',
            cardType: 'W',
            playerName: 'Test Player'
          }
        },
        expect.any(Object)
      );
    });

    it('should successfully play a card with undefined cost', async () => {
      // Arrange
      const cardWithoutCost: Card = {
        ...mockCard,
        cost: undefined
      };
      mockDataService.getCardById.mockReturnValue(cardWithoutCost);
      mockGameRulesService.canPlayCard.mockReturnValue(true);

      // Act
      await playerActionService.playCard('player1', 'W001');

      // Assert
      expect(mockGameRulesService.canPlayerAfford).not.toHaveBeenCalled(); // Should not check affordability for undefined cost
      
      // Verify orchestration
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        [],
        {
          source: 'player_action:card_play',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY',
          metadata: {
            cardId: 'W001',
            cardName: 'Strategic Planning',
            cardType: 'W',
            playerName: 'Test Player'
          }
        },
        expect.any(Object)
      );
    });

    it('should throw error when player not found', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Act & Assert
      await expect(playerActionService.playCard('nonexistent', 'W001'))
        .rejects.toThrow("Failed to play card: Player with ID 'nonexistent' not found");
    });

    it('should throw error when card not found', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(undefined);

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'NONEXISTENT'))
        .rejects.toThrow("Failed to play card: Card with ID 'NONEXISTENT' not found");
    });

    it('should throw error when card play validation fails', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(mockCard);
      mockGameRulesService.canPlayCard.mockReturnValue(false);

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'W001'))
        .rejects.toThrow("Failed to play card: Player 'Test Player' cannot play card 'Strategic Planning'. Validation failed.");
    });

    it('should throw error when player cannot afford the card', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(mockExpensiveCard);
      mockGameRulesService.canPlayCard.mockReturnValue(true);
      mockGameRulesService.canPlayerAfford.mockReturnValue(false);

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'B001'))
        .rejects.toThrow("Failed to play card: Player 'Test Player' cannot afford card 'Expensive Investment'. Cost: $2000, Available: $1000");
    });

    it('should throw error when player does not have the card in their hand', async () => {
      // Arrange
      const cardNotInHand: Card = {
        card_id: 'W999',
        card_name: 'Not Owned Card',
        card_type: 'W',
        description: 'A card the player does not have.',
        cost: 0
      };
      
      // Set up player without the card in their hand
      const playerWithoutCard: Player = {
        ...mockPlayer,
        hand: ['W001', 'W002', 'B001', 'E001'] // W999 not in hand
      };
      mockStateService.getPlayer.mockReturnValue(playerWithoutCard);
      
      mockDataService.getCardById.mockReturnValue(cardNotInHand);
      mockGameRulesService.canPlayCard.mockReturnValue(false); // Should return false for card not in hand

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'W999'))
        .rejects.toThrow("Failed to play card: Player 'Test Player' cannot play card 'Not Owned Card'. Validation failed.");
    });

    it('should handle cards from different types correctly', async () => {
      // Arrange - Test playing a B card
      const bCard: Card = {
        card_id: 'B001',
        card_name: 'Budget Card',
        card_type: 'B',
        description: 'A budget card.',
        cost: 50
      };
      
      mockDataService.getCardById.mockReturnValue(bCard);
      mockGameRulesService.canPlayCard.mockReturnValue(true);
      mockGameRulesService.canPlayerAfford.mockReturnValue(true);

      // Act
      await playerActionService.playCard('player1', 'B001');

      // Assert - Focus on orchestration
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        [],
        {
          source: 'player_action:card_play',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY',
          metadata: {
            cardId: 'B001',
            cardName: 'Budget Card',
            cardType: 'B',
            playerName: 'Test Player'
          }
        },
        expect.any(Object)
      );
    });

    it('should handle cards not in player hand correctly', async () => {
      // Arrange - Player tries to play a card not in their hand
      const lCard: Card = {
        card_id: 'L001',
        card_name: 'Life Events Card',
        card_type: 'L',
        description: 'A life events card.',
        cost: 0
      };
      
      mockDataService.getCardById.mockReturnValue(lCard);
      mockGameRulesService.canPlayCard.mockReturnValue(false); // Should return false for card not in hand

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'L001'))
        .rejects.toThrow("Failed to play card: Player 'Test Player' cannot play card 'Life Events Card'. Validation failed.");
    });

    it('should handle cards without effects gracefully', async () => {
      // Arrange
      const cardWithoutEffects: Card = {
        card_id: 'W001',
        card_name: 'Simple Card',
        card_type: 'W',
        description: 'A simple card.',
        cost: 10,
        effects_on_play: undefined
      };
      
      mockDataService.getCardById.mockReturnValue(cardWithoutEffects);
      mockGameRulesService.canPlayCard.mockReturnValue(true);
      mockGameRulesService.canPlayerAfford.mockReturnValue(true);

      // Act
      await playerActionService.playCard('player1', 'W001');

      // Assert - verify the card was played successfully through orchestration
      expect(mockDataService.getCardById).toHaveBeenCalledWith('W001');
      expect(mockGameRulesService.canPlayCard).toHaveBeenCalledWith('player1', 'W001');
      expect(mockGameRulesService.canPlayerAfford).toHaveBeenCalledWith('player1', 10);
      
      // Should still process through EffectEngineService even without effects
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        [],
        {
          source: 'player_action:card_play',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY',
          metadata: {
            cardId: 'W001',
            cardName: 'Simple Card',
            cardType: 'W',
            playerName: 'Test Player'
          }
        },
        expect.any(Object)
      );
    });

    it('should handle EffectEngineService errors gracefully', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(mockCard);
      mockGameRulesService.canPlayCard.mockReturnValue(true);
      mockGameRulesService.canPlayerAfford.mockReturnValue(true);
      mockEffectEngineService.processCardEffects.mockRejectedValue(new Error('Effect processing failed'));

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'W001'))
        .rejects.toThrow('Failed to play card: Effect processing failed');

      // Verify that validation methods were still called before the error
      expect(mockDataService.getCardById).toHaveBeenCalledWith('W001');
      expect(mockGameRulesService.canPlayCard).toHaveBeenCalledWith('player1', 'W001');
      expect(mockGameRulesService.canPlayerAfford).toHaveBeenCalledWith('player1', 100);
    });
  });

  describe('service integration', () => {
    it('should call services in the correct order for orchestration', async () => {
      // Arrange
      const callOrder: string[] = [];
      
      mockStateService.getGameState.mockImplementation(() => {
        callOrder.push('getGameState');
        return mockGameState;
      });
      
      mockStateService.getPlayer.mockImplementation(() => {
        callOrder.push('getPlayer');
        return mockPlayer;
      });
      
      mockDataService.getCardById.mockImplementation(() => {
        callOrder.push('getCardById');
        return mockCard;
      });
      
      mockGameRulesService.canPlayCard.mockImplementation(() => {
        callOrder.push('canPlayCard');
        return true;
      });
      
      mockGameRulesService.canPlayerAfford.mockImplementation(() => {
        callOrder.push('canPlayerAfford');
        return true;
      });
      
      mockEffectEngineService.processCardEffects.mockImplementation(async () => {
        callOrder.push('processCardEffects');
        return {
          success: true,
          totalEffects: 0,
          successfulEffects: 0,
          failedEffects: 0,
          results: [],
          errors: []
        };
      });

      mockEffectEngineService.processEffect.mockImplementation(async () => {
        callOrder.push('processEffect');
        return {
          success: true,
          effectType: 'PLAY_CARD'
        };
      });

      // Act
      await playerActionService.playCard('player1', 'W001');

      // Assert - New orchestration pattern
      expect(callOrder).toEqual([
        'getGameState',
        'getPlayer',
        'getCardById',
        'canPlayCard',
        'canPlayerAfford',
        'processCardEffects', // Card effects processing
        'processEffect'   // Card lifecycle processing
      ]);
    });

    it('should not call EffectEngineService if validation fails early', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Act & Assert
      await expect(playerActionService.playCard('player1', 'W001'))
        .rejects.toThrow();

      // Verify EffectEngineService was not called when validation fails
      expect(mockEffectEngineService.processEffects).not.toHaveBeenCalled();
      expect(mockEffectEngineService.processEffect).not.toHaveBeenCalled();
    });
  });

  describe('rollDice', () => {
    it('should successfully roll dice and return result with single die value (1-6)', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert
      expect(result).toBeDefined();
      expect(result.roll1).toBeGreaterThanOrEqual(1);
      expect(result.roll1).toBeLessThanOrEqual(6);
      expect(result.roll2).toBe(result.roll1); // Same value for interface compatibility
      expect(result.total).toBe(result.roll1); // Total equals the single die roll
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(6);
    });

    it('should call StateService to update player with dice roll result', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert
      expect(mockStateService.getGameState).toHaveBeenCalled();
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('player1');
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        lastDiceRoll: {
          roll1: result.roll1,
          roll2: result.roll2,
          total: result.total
        }
      });
    });

    it('should throw error when player not found', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Act & Assert
      await expect(playerActionService.rollDice('nonexistent'))
        .rejects.toThrow("Failed to roll dice: Player with ID 'nonexistent' not found");

      // Verify updatePlayer was not called
      expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
    });

    it('should handle state service errors gracefully', async () => {
      // Arrange
      mockStateService.updatePlayer.mockImplementation(() => {
        throw new Error('State update failed');
      });

      // Act & Assert
      await expect(playerActionService.rollDice('player1'))
        .rejects.toThrow('Failed to roll dice: State update failed');

      // Verify that player lookup was still attempted
      expect(mockStateService.getGameState).toHaveBeenCalled();
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('player1');
    });

    it('should generate different dice rolls on multiple calls', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);
      const results: Array<{ roll1: number; roll2: number; total: number }> = [];

      // Act - roll dice multiple times
      for (let i = 0; i < 10; i++) {
        const result = await playerActionService.rollDice('player1');
        results.push(result);
      }

      // Assert - verify that we get some variation (not all the same)
      const uniqueResults = new Set(results.map(r => r.total));
      expect(uniqueResults.size).toBeGreaterThan(1); // Should have some variation

      // Verify all results are valid
      results.forEach(result => {
        expect(result.roll1).toBeGreaterThanOrEqual(1);
        expect(result.roll1).toBeLessThanOrEqual(6);
        expect(result.roll2).toBe(result.roll1); // Same value for interface compatibility
        expect(result.total).toBe(result.roll1); // Total equals the single die roll
      });
    });

    it('should call services in the correct order', async () => {
      // Arrange
      const callOrder: string[] = [];
      
      mockStateService.getGameState.mockImplementation(() => {
        callOrder.push('getGameState');
        return mockGameState;
      });
      
      mockStateService.getPlayer.mockImplementation(() => {
        callOrder.push('getPlayer');
        return mockPlayer;
      });
      
      mockStateService.updatePlayer.mockImplementation(() => {
        callOrder.push('updatePlayer');
        return mockGameState;
      });

      // Act
      await playerActionService.rollDice('player1');

      // Assert
      expect(callOrder).toEqual([
        'getGameState',
        'getPlayer',
        'updatePlayer',
        'getPlayer' // Called again in handlePlayerMovement
      ]);
    });

    it('should return dice result with correct structure', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert - verify structure
      expect(typeof result).toBe('object');
      expect(typeof result.roll1).toBe('number');
      expect(typeof result.roll2).toBe('number');
      expect(typeof result.total).toBe('number');
      expect(Object.keys(result)).toEqual(['roll1', 'roll2', 'total']);
    });

    it('should trigger movement after successful dice roll', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);
      mockMovementService.getValidMoves.mockReturnValue(['DESTINATION-1', 'DESTINATION-2']);
      mockMovementService.getDiceDestination.mockReturnValue('DESTINATION-1');
      mockMovementService.movePlayer.mockReturnValue(mockGameState);

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert
      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('player1');
      expect(mockMovementService.getDiceDestination).toHaveBeenCalledWith(
        'START-SPACE', 
        'First', 
        result.total
      );
      expect(mockMovementService.movePlayer).toHaveBeenCalledWith('player1', 'DESTINATION-1');
    });

    it('should handle terminal spaces (no movement possible)', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);
      mockMovementService.getValidMoves.mockReturnValue([]); // No valid moves

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert
      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('player1');
      expect(mockMovementService.getDiceDestination).not.toHaveBeenCalled();
      expect(mockMovementService.movePlayer).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle no destination found for dice roll', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);
      mockMovementService.getValidMoves.mockReturnValue(['DESTINATION-1']);
      mockMovementService.getDiceDestination.mockReturnValue(null); // No destination for this roll

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert
      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('player1');
      expect(mockMovementService.getDiceDestination).toHaveBeenCalledWith(
        'START-SPACE',
        'First',
        result.total
      );
      expect(mockMovementService.movePlayer).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle movement service errors gracefully', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);
      mockMovementService.getValidMoves.mockImplementation(() => {
        throw new Error('Movement validation failed');
      });

      // Act & Assert
      await expect(playerActionService.rollDice('player1'))
        .rejects.toThrow('Failed to roll dice: Failed to handle player movement: Movement validation failed');

      expect(mockMovementService.getValidMoves).toHaveBeenCalledWith('player1');
    });

    it('should call processTurnEffects after successful dice roll', async () => {
      // Arrange
      mockStateService.updatePlayer.mockReturnValue(mockGameState);
      mockMovementService.getValidMoves.mockReturnValue(['DEST-1']);
      mockMovementService.getDiceDestination.mockReturnValue('DEST-1');
      mockMovementService.movePlayer.mockReturnValue(mockGameState);

      // Act
      const result = await playerActionService.rollDice('player1');

      // Assert - processTurnEffects should be called with dice roll result
      expect(mockTurnService.processTurnEffects).toHaveBeenCalledWith('player1', result.total);
      // endTurn should NOT be called automatically anymore
      expect(mockTurnService.endTurn).not.toHaveBeenCalled();
    });

    it('should not call endTurn if dice roll fails', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined); // Cause failure

      // Act & Assert
      await expect(playerActionService.rollDice('player1')).rejects.toThrow();

      // Assert - endTurn should not be called if dice roll fails
      expect(mockTurnService.endTurn).not.toHaveBeenCalled();
    });
  });

  describe('explicit turn management', () => {
    it('should provide endTurn method that calls TurnService', async () => {
      // Arrange
      mockTurnService.endTurn.mockResolvedValue({ nextPlayerId: 'player2' });

      // Act
      await playerActionService.endTurn();

      // Assert
      expect(mockTurnService.endTurn).toHaveBeenCalled();
    });

    it('should handle TurnService errors in endTurn', async () => {
      // Arrange
      mockTurnService.endTurn.mockRejectedValue(new Error('Turn service error'));

      // Act & Assert
      await expect(playerActionService.endTurn())
        .rejects.toThrow('Failed to end turn: Turn service error');
    });

    it('should not call endTurn automatically after card play', async () => {
      // Arrange
      mockDataService.getCardById.mockReturnValue(mockCard);
      mockGameRulesService.canPlayCard.mockReturnValue(true);
      mockGameRulesService.canPlayerAfford.mockReturnValue(true);
      mockStateService.updatePlayer.mockReturnValue(mockGameState);

      // Act
      await playerActionService.playCard('player1', 'W001');

      // Assert - endTurn should NOT be called automatically
      expect(mockTurnService.endTurn).not.toHaveBeenCalled();
    });
  });
});