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
const mockCreateEffectsFromCard = EffectFactory.createEffectsFromCard as any;

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
  const mockPlayer: any = {
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

  const mockGameState: any = {
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
      const playerWithoutCard: any = {
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

  // Phase 2.1 audit (2026-06-04): rollDice + endTurn methods deleted from
  // PlayerActionService as dead code (superseded by DiceRollProcessor.rollDiceWithFeedback
  // and TurnService.endTurnWithMovement, the live UI's actual call paths).
  // Originally ~230 lines of tests for rollDice and ~20 lines for endTurn removed
  // from this file. The single retained test asserts `playCard` doesn't sneakily
  // end the turn — still a meaningful behavior pin for playCard.

  describe('playCard interactions with turn lifecycle', () => {
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