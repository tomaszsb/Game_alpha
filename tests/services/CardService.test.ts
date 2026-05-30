import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CardService } from '../../src/services/CardService';
import { IDataService, IStateService, IResourceService, ILoggingService, IEffectEngineService, IGameRulesService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { CardType } from '../../src/types/DataTypes';
import { Effect } from '../../src/types/EffectTypes';
import { createMockDataService, createMockStateService, createMockResourceService, createMockLoggingService, createMockGameRulesService } from '../mocks/mockServices';

describe('CardService - Enhanced Coverage', () => {
  let cardService: CardService;
  let mockDataService: any;
  let mockStateService: any;
  let mockResourceService: any;
  let mockLoggingService: any;
  let mockGameRulesService: any;
  let mockEffectEngineService: any;

  const mockPlayer: any = {
    id: 'player1',
    name: 'Alice',
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    money: 100,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    color: '#007bff',
    avatar: '👤',
    hand: ['W_active_001'], // Player now has a simple hand array
    activeCards: [
      { cardId: 'W_expired_001', expirationTurn: 2 },  // Should expire
      { cardId: 'B_active_001', expirationTurn: 5 }    // Should remain active
    ],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: []
  };

  const mockGameState: any = {
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    turn: 3,
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
    decks: {
      W: ['W001', 'W002', 'W003'], // Mock deck with sample cards
      B: ['B001', 'B002'],
      E: ['E001', 'E002', 'E003'],
      L: ['L001'],
      I: ['I001', 'I002']
    },
    discardPiles: {
      W: [], // Empty discard piles
      B: [],
      E: [],
      L: [],
      I: []
    }
  };

  beforeEach(() => {
    // Create mocks using centralized creators
    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    mockResourceService = createMockResourceService();
    mockResourceService.canAfford.mockReturnValue(true);
    mockResourceService.spendMoney.mockReturnValue(true);
    mockResourceService.addMoney.mockReturnValue(true);
    mockLoggingService = createMockLoggingService();
    mockGameRulesService = createMockGameRulesService();
    
    // Create mock EffectEngineService
    mockEffectEngineService = {
      processEffects: vi.fn().mockResolvedValue({
        success: true,
        totalEffects: 1,
        successfulEffects: 1,
        failedEffects: 0,
        results: [],
        errors: []
      }),
      processEffect: vi.fn().mockResolvedValue({
        success: true,
        effectType: 'RESOURCE_CHANGE'
      }),
      processCardEffects: vi.fn().mockResolvedValue({
        success: true,
        totalEffects: 1,
        successfulEffects: 1,
        failedEffects: 0,
        results: [],
        errors: []
      }),
      processEffectsWithTargeting: vi.fn().mockResolvedValue({
        success: true,
        totalEffects: 1,
        successfulEffects: 1,
        failedEffects: 0,
        results: [],
        errors: []
      }),
      processEffectsWithDuration: vi.fn().mockResolvedValue({
        success: true,
        totalEffects: 1,
        successfulEffects: 1,
        failedEffects: 0,
        results: [],
        errors: []
      }),
      applyActiveEffects: vi.fn().mockResolvedValue(undefined),
      addActiveEffect: vi.fn(),
      processActiveEffectsForAllPlayers: vi.fn().mockResolvedValue(undefined),
      validateEffect: vi.fn().mockReturnValue(true),
      validateEffects: vi.fn().mockReturnValue(true)
    };

    // Setup default mock responses
    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.getPlayer.mockReturnValue(mockPlayer);
    mockStateService.getAllPlayers.mockReturnValue([mockPlayer]);
    mockStateService.updatePlayer.mockReturnValue(mockGameState);
    mockStateService.updateGameState.mockReturnValue(mockGameState);

    // Setup GameRulesService mock responses
    mockGameRulesService.canPlayCard.mockReturnValue(true); // Default to allowing cards

    // Setup card data
    mockDataService.getCardById.mockImplementation((cardId: string) => {
      const baseCard = {
        card_id: cardId,
        card_name: 'Test Card',
        description: 'Test card with $1000 cost',
        effects_on_play: 'Test effect',
        cost: 10,
        phase_restriction: ''
      };
      
      if (cardId.startsWith('W_')) return { ...baseCard, card_type: 'W' };
      if (cardId.startsWith('B_')) return { ...baseCard, card_type: 'B' };
      if (cardId.startsWith('E_')) return { ...baseCard, card_type: 'E' };
      if (cardId.startsWith('L_')) return { ...baseCard, card_type: 'L' };
      if (cardId.startsWith('I_')) return { ...baseCard, card_type: 'I' };
      return undefined;
    });

    // Setup getCardsByType mock to return sample cards for each type
    mockDataService.getCardsByType.mockImplementation((cardType: CardType) => {
      const sampleCards = {
        W: [
          { card_id: 'W001', card_name: 'Work Card 1', card_type: 'W' as const, description: 'Test work card' },
          { card_id: 'W002', card_name: 'Work Card 2', card_type: 'W' as const, description: 'Test work card' },
          { card_id: 'W003', card_name: 'Work Card 3', card_type: 'W' as const, description: 'Test work card' }
        ],
        B: [
          { card_id: 'B001', card_name: 'Business Card 1', card_type: 'B' as const, description: 'Test business card' }
        ],
        E: [
          { card_id: 'E001', card_name: 'Economic Card 1', card_type: 'E' as const, description: 'Test economic card' }
        ],
        L: [
          { card_id: 'L001', card_name: 'Loan Card 1', card_type: 'L' as const, description: 'Test loan card' }
        ],
        I: [
          { card_id: 'I001', card_name: 'Investment Card 1', card_type: 'I' as const, description: 'Test investment card' }
        ]
      };
      return sampleCards[cardType] || [];
    });

    cardService = new CardService(mockDataService, mockStateService, mockResourceService, mockLoggingService, mockGameRulesService);
    
    // Set the effect engine service on the card service
    cardService.setEffectEngineService(mockEffectEngineService);
  });

  describe('Card Expiration System', () => {
    it('should process card expirations correctly on endOfTurn', () => {
      cardService.endOfTurn();

      // Should update player via TEMP state to remove expired cards and keep active ones
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        expect.objectContaining({
          activeCards: [
            { cardId: 'B_active_001', expirationTurn: 5 }
          ]
        })
      );
    });

    it('should process multiple players during endOfTurn', () => {
      // Clear previous mock calls to ensure accurate count
      vi.clearAllMocks();

      const player2: any = {
        ...mockPlayer,
        id: 'player2',
        name: 'Player2',
        activeCards: [{ cardId: 'B_expired_002', expirationTurn: 1 }],
        hand: [] // Ensure player2 has the new hand structure
      };

      // Create a modified game state with both players
      const gameStateWithTwoPlayers = {
        ...mockGameState,
        players: [mockPlayer, player2]
      };

      // Re-setup mocks for this test
      mockStateService.getGameState.mockReturnValue(gameStateWithTwoPlayers);
      mockStateService.getAllPlayers.mockReturnValue([mockPlayer, player2]);
      mockStateService.updatePlayer.mockReturnValue(gameStateWithTwoPlayers);
      mockStateService.updateTempState.mockReturnValue({ success: true });
      mockStateService.updateGameState.mockReturnValue(gameStateWithTwoPlayers);

      cardService.endOfTurn();

      // Should update both players via TEMP state (both have expired cards)
      expect(mockStateService.updateTempState).toHaveBeenCalledTimes(2);
    });

    it('should handle player with no active cards', () => {
      const playerWithNoActiveCards: any = {
        ...mockPlayer,
        activeCards: []
      };
      
      mockStateService.getAllPlayers.mockReturnValue([playerWithNoActiveCards]);

      expect(() => cardService.endOfTurn()).not.toThrow();
    });
  });

  describe('Card Transfer System', () => {
    it('should transfer cards between players successfully', () => {
      const targetPlayer: any = {
        id: 'player2',
        name: 'Bob',
        currentSpace: 'TEST-SPACE',
        visitType: 'First',
        money: 50,
        timeSpent: 3,
        projectScope: 0,
        score: 0,
        color: '#28a745',
        avatar: '🧑',
        hand: [],
        activeCards: [],
        turnModifiers: { skipTurns: 0 },
        activeEffects: [],
        loans: []
      };

      mockStateService.getAllPlayers.mockReturnValue([mockPlayer, targetPlayer]);
      // Use a transferable card type (E and L cards are transferable)
      const transferablePlayer: any = {
        ...mockPlayer,
        hand: ['E_transferable_001'] // E cards are transferable
      };
      
      // Mock getPlayer to return the correct players for the transfer operation
      mockStateService.getPlayer.mockImplementation((playerId: string) => {
        if (playerId === 'player1') return transferablePlayer;
        if (playerId === 'player2') return targetPlayer;
        return undefined;
      });

      const result = cardService.transferCard('player1', 'player2', 'E_transferable_001');

      expect(result).toEqual(mockGameState);

      // Should update source player via TEMP state to remove card from hand
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        expect.objectContaining({
          hand: []  // Card removed from hand
        })
      );

      // Should update target player via TEMP state to add card to hand
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player2',
        expect.objectContaining({
          hand: ['E_transferable_001']  // Card added to hand
        })
      );
    });

    it('should handle transfer errors gracefully', () => {
      // Setup getPlayer to return undefined for non-existent players
      mockStateService.getPlayer.mockImplementation((playerId: string) => {
        if (playerId === 'player1') return mockPlayer;
        return undefined;
      });

      expect(() => {
        cardService.transferCard('nonexistent', 'player1', 'W_active_001');
      }).toThrow(/Source player nonexistent not found/);

      expect(() => {
        cardService.transferCard('player1', 'nonexistent', 'W_active_001');
      }).toThrow(/Target player nonexistent not found/);

      expect(() => {
        cardService.transferCard('player1', 'player1', 'E_transferable_001');
      }).toThrow(/Cannot transfer to yourself/);

      // Test non-transferable card types
      mockStateService.getPlayer.mockReturnValue(mockPlayer);  // Reset mock
      expect(() => {
        cardService.transferCard('player1', 'player2', 'W_active_001');
      }).toThrow(/W cards cannot be transferred/);
    });
  });

  describe('Card Collection Management', () => {
    it('should check card ownership across all collections', () => {
      // Reset mock to return proper player data
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      
      // Test available cards
      expect(cardService.playerOwnsCard('player1', 'W_active_001')).toBe(true);
      
      // Test active cards  
      expect(cardService.playerOwnsCard('player1', 'W_expired_001')).toBe(true);
      
      // Test non-existent card
      expect(cardService.playerOwnsCard('player1', 'X_nonexistent')).toBe(false);
      
      // Test non-existent player
      mockStateService.getPlayer.mockImplementation((playerId: string) => {
        return playerId === 'player1' ? mockPlayer : undefined;
      });
      expect(cardService.playerOwnsCard('nonexistent', 'W_active_001')).toBe(false);
    });

    it('should draw cards from stateful decks and update player hand', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Arrange: Ensure getPlayer returns the mock player with initial hand
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      // Act: Draw 2 'W' cards from the deck
      const drawnCards = cardService.drawCards('player1', 'W', 2);

      // Assert: Should return the drawn card IDs
      expect(drawnCards).toHaveLength(2);
      expect(drawnCards).toEqual(['W003', 'W002']); // Cards drawn from top of deck (LIFO)

      // Assert: Should update global deck state (no longer includes players)
      expect(mockStateService.updateGameState).toHaveBeenCalledWith(
        expect.objectContaining({
          decks: expect.objectContaining({
            W: ['W001'] // Deck should have 1 card remaining (original 3 - 2 drawn)
          })
        })
      );

      // Assert: Should update player hand via TEMP state
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        expect.objectContaining({
          hand: ['W_active_001', 'W003', 'W002'] // Original card + 2 new cards
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Card Type Detection', () => {
    it('should extract card type from card ID via DataService', () => {
      const cardType = cardService.getCardType('W_test_123');
      expect(cardType).toBe('W');
      expect(mockDataService.getCardById).toHaveBeenCalledWith('W_test_123');
    });

    it('should fallback to ID parsing when DataService fails', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockDataService.getCardById.mockReturnValue(undefined);

      const cardType = cardService.getCardType('B_fallback_456');
      expect(cardType).toBe('B');
      
      consoleSpy.mockRestore();
    });

    it('should return null for invalid card ID format', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDataService.getCardById.mockReturnValue(undefined);

      const cardType = cardService.getCardType('invalid');
      expect(cardType).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Phase Restriction System', () => {
    const mockConstructionCard = {
      card_id: 'L001',
      card_name: 'Construction Card',
      card_type: 'L' as const,
      description: 'Test construction card',
      phase_restriction: 'CONSTRUCTION',
      cost: 0
    };

    const mockDesignCard = {
      card_id: 'E001',
      card_name: 'Design Card',
      card_type: 'E' as const,
      description: 'Test design card',
      phase_restriction: 'DESIGN',
      cost: 0
    };

    const mockFundingCard = {
      card_id: 'E066',
      card_name: 'Funding Card',
      card_type: 'E' as const,
      description: 'Test funding card',
      phase_restriction: 'FUNDING',
      cost: 0
    };

    const mockRegulatoryCard = {
      card_id: 'E005',
      card_name: 'Regulatory Card',
      card_type: 'E' as const,
      description: 'Test regulatory card',
      phase_restriction: 'REGULATORY_REVIEW',
      cost: 0
    };

    const mockAnyPhaseCard = {
      card_id: 'B001',
      card_name: 'Any Phase Card',
      card_type: 'B' as const,
      description: 'Test any phase card',
      phase_restriction: 'Any',
      cost: 0
    };

    const mockNoPhaseRestrictionCard = {
      card_id: 'W001',
      card_name: 'No Phase Card',
      card_type: 'W' as const,
      description: 'Test no phase restriction card',
      cost: 0
    };

    beforeEach(() => {
      // Set up player with cards in hand
      const playerWithCards = {
        ...mockPlayer,
        hand: ['W001', 'B001', 'E001', 'E066', 'E005', 'L001'] // All cards now in hand
      };
      mockStateService.getPlayer.mockReturnValue(playerWithCards);

      // Mock card data responses
      mockDataService.getCardById.mockImplementation((cardId: string) => {
        switch (cardId) {
          case 'L001': return mockConstructionCard;
          case 'E001': return mockDesignCard;
          case 'E066': return mockFundingCard;
          case 'E005': return mockRegulatoryCard;
          case 'B001': return mockAnyPhaseCard;
          case 'W001': return mockNoPhaseRestrictionCard;
          default: return undefined;
        }
      });
    });

    it('should allow construction cards only on construction spaces', () => {
      // Setup: Player on construction space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'CON-INITIATION',
        phase: 'CONSTRUCTION',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      // Test: Can play construction card
      expect(cardService.canPlayCard('player1', 'L001')).toBe(true);

      // Test: Construction card validates properly
      const validation = (cardService as any).validateCardPlay('player1', 'L001');
      expect(validation.isValid).toBe(true);
    });

    it('should prevent construction cards on non-construction spaces', () => {
      // Setup: Player on design space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'ARCH-INITIATION',
        phase: 'DESIGN',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      // Mock GameRulesService to return false for this specific case
      mockGameRulesService.canPlayCard.mockImplementation((playerId: string, cardId: string) => {
        return cardId !== 'L001'; // Prevent L001 (construction card) from being played
      });

      // Test: Cannot play construction card
      expect(cardService.canPlayCard('player1', 'L001')).toBe(false);

      // Test: Construction card validation fails with proper message
      const validation = (cardService as any).validateCardPlay('player1', 'L001');
      expect(validation.isValid).toBe(false);
      expect(validation.errorMessage).toContain('Card can only be played during CONSTRUCTION phase');
      expect(validation.errorMessage).toContain('Current activity: DESIGN');
    });

    it('should allow design cards only on design spaces', () => {
      // Setup: Player on design space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'ARCH-INITIATION',
        phase: 'DESIGN',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      // Test: Can play design card
      expect(cardService.canPlayCard('player1', 'E001')).toBe(true);

      // Test: Design card validates properly
      const validation = (cardService as any).validateCardPlay('player1', 'E001');
      expect(validation.isValid).toBe(true);
    });

    it('should allow funding cards only on funding spaces', () => {
      // Setup: Player on funding space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'BANK-FUND-REVIEW',
        phase: 'FUNDING',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      // Test: Can play funding card
      expect(cardService.canPlayCard('player1', 'E066')).toBe(true);

      // Test: Funding card validates properly
      const validation = (cardService as any).validateCardPlay('player1', 'E066');
      expect(validation.isValid).toBe(true);
    });

    it('should allow regulatory cards only on regulatory spaces', () => {
      // Setup: Player on regulatory space  
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'REG-DOB-FEE-REVIEW',
        phase: 'REGULATORY',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      // Test: Can play regulatory card
      expect(cardService.canPlayCard('player1', 'E005')).toBe(true);

      // Test: Regulatory card validates properly
      const validation = (cardService as any).validateCardPlay('player1', 'E005');
      expect(validation.isValid).toBe(true);
    });

    it('should allow "Any" phase cards on any space', () => {
      // Test on construction space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'CON-INITIATION',
        phase: 'CONSTRUCTION',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      expect(cardService.canPlayCard('player1', 'B001')).toBe(true);

      // Test on design space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'ARCH-INITIATION',
        phase: 'DESIGN',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      expect(cardService.canPlayCard('player1', 'B001')).toBe(true);
    });

    it('should allow cards with no phase restriction on any space', () => {
      // Test on construction space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'CON-INITIATION',
        phase: 'CONSTRUCTION',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      expect(cardService.canPlayCard('player1', 'W001')).toBe(true);

      // Test on design space
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'ARCH-INITIATION',
        phase: 'DESIGN',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      expect(cardService.canPlayCard('player1', 'W001')).toBe(true);
    });

    it('should allow any card when player is on a space without a phase', () => {
      // Setup: Player on a space with no phase (like START or generic spaces)
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'GENERIC-SPACE',
        phase: '', // No phase
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false,
        space_order: 1
      });

      // Test: All restricted cards should be allowed
      expect(cardService.canPlayCard('player1', 'L001')).toBe(true); // Construction card
      expect(cardService.canPlayCard('player1', 'E001')).toBe(true); // Design card
      expect(cardService.canPlayCard('player1', 'E066')).toBe(true); // Funding card
      expect(cardService.canPlayCard('player1', 'E005')).toBe(true); // Regulatory card
    });

    it('should allow any card when space config is not found', () => {
      // Setup: Player on unknown space
      mockDataService.getGameConfigBySpace.mockReturnValue(undefined);

      // Test: All restricted cards should be allowed due to no space config
      expect(cardService.canPlayCard('player1', 'L001')).toBe(true); // Construction card
      expect(cardService.canPlayCard('player1', 'E001')).toBe(true); // Design card
      expect(cardService.canPlayCard('player1', 'E066')).toBe(true); // Funding card
      expect(cardService.canPlayCard('player1', 'E005')).toBe(true); // Regulatory card
    });

    it('should handle player not found gracefully', () => {
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Mock GameRulesService to return false for nonexistent player
      mockGameRulesService.canPlayCard.mockImplementation((playerId: string, cardId: string) => {
        return playerId !== 'nonexistent'; // Return false for nonexistent player
      });

      expect(cardService.canPlayCard('nonexistent', 'L001')).toBe(false);

      const validation = (cardService as any).validateCardPlay('nonexistent', 'L001');
      expect(validation.isValid).toBe(false);
      expect(validation.errorMessage).toContain('Player nonexistent not found');
    });
  });

  describe('Unified Effect Engine Integration', () => {
    it('should parse card with money_effect into MODIFY_RESOURCE effect', () => {
      const testCard = {
        card_id: 'TEST001',
        card_name: 'Money Card',
        card_type: 'B',
        money_effect: '1000',
        description: 'Test money card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      const result = cardService.applyCardEffects('player1', 'TEST001');

      // Verify UnifiedEffectEngine was called with RESOURCE_CHANGE effect
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'RESOURCE_CHANGE',
            payload: expect.objectContaining({
              playerId: 'player1',
              resource: 'MONEY',
              amount: 1000,
              source: 'card:TEST001',
              reason: 'Money Card: +$1,000'
            })
          })
        ]),
        expect.objectContaining({
          source: 'card:TEST001',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY'
        }),
        testCard
      );
    });

    it('should parse card with tick_modifier into TIME effect', () => {
      const testCard = {
        card_id: 'TIME001',
        card_name: 'Time Card',
        card_type: 'E',
        tick_modifier: '-3',
        description: 'Test time card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      const result = cardService.applyCardEffects('player1', 'TIME001');

      // Verify UnifiedEffectEngine was called with TIME RESOURCE_CHANGE effect
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'RESOURCE_CHANGE',
            payload: expect.objectContaining({
              playerId: 'player1',
              resource: 'TIME',
              amount: -3,
              source: 'card:TIME001',
              reason: 'Time Card: -3 days'
            })
          })
        ]),
        expect.anything(),
        testCard
      );
    });

    it('should parse card with draw_cards into DRAW_CARDS effect', () => {
      const testCard = {
        card_id: 'DRAW001',
        card_name: 'Draw Card',
        card_type: 'E',
        draw_cards: '2 E',
        description: 'Test draw card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      const result = cardService.applyCardEffects('player1', 'DRAW001');

      // Verify UnifiedEffectEngine was called with CARD_DRAW effect
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              playerId: 'player1',
              cardType: 'E',
              count: 2,
              source: 'card:DRAW001',
              reason: 'Draw Card: Draw 2 E cards'
            })
          })
        ]),
        expect.anything(),
        testCard
      );
    });

    it('should fan out draw_cards to every player when scope is Global (L049 regression)', () => {
      // L049 "Permitting Process Overhaul" — text promises "Each player draws 1 Expeditor Card".
      // Before the fix the CARD_DRAW effect only fired for the playing player; the global-scope
      // branch was missing on the DRAW path (it existed only on tick_modifier). Mirrors fb:2fe0db6c.
      const testCard = {
        card_id: 'L049',
        card_name: 'Permitting Process Overhaul',
        card_type: 'L',
        draw_cards: '1 E',
        target: 'All Players',
        scope: 'Global',
        description: 'Each player draws 1 Expeditor Card.'
      };

      const player2: any = { ...mockPlayer, id: 'player2', name: 'Player2', hand: [] };
      const player3: any = { ...mockPlayer, id: 'player3', name: 'Player3', hand: [] };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, player2, player3]
      });
      mockDataService.getCardById.mockReturnValue(testCard);

      cardService.applyCardEffects('player1', 'L049');

      const drawEffectsByPlayer = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'CARD_DRAW')
        .map((e: any) => e.payload.playerId)
        .sort();

      expect(drawEffectsByPlayer).toEqual(['player1', 'player2', 'player3']);
    });

    it('should keep draw_cards single-player when scope is Single (control)', () => {
      const testCard = {
        card_id: 'E007',
        card_name: 'Expeditor Insight',
        card_type: 'E',
        draw_cards: '2 E',
        target: 'Self',
        scope: 'Single',
        description: 'Draw 2 Expeditor Cards.'
      };

      const player2: any = { ...mockPlayer, id: 'player2', name: 'Player2', hand: [] };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, player2]
      });
      mockDataService.getCardById.mockReturnValue(testCard);

      cardService.applyCardEffects('player1', 'E007');

      const drawEffectsByPlayer = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'CARD_DRAW')
        .map((e: any) => e.payload.playerId);

      expect(drawEffectsByPlayer).toEqual(['player1']);
    });

    it('should fan global tick_modifier to all players when affected_phase is empty (L042-shape regression)', () => {
      // Existing behavior preserved when no phase filter is set — the time
      // delta applies to every player regardless of where they're standing.
      // This control test guards against regressions in the v3.0.17 phase-filter
      // refactor that could over-narrow the broadcast.
      const testCard = {
        card_id: 'TEST_GLOBAL_TICK',
        card_name: 'Global Tick (no phase filter)',
        card_type: 'L',
        tick_modifier: '2',
        target: 'All Players',
        scope: 'Global',
        // affected_phase intentionally undefined
        description: 'Each player gains 2 days.'
      };

      const p2: any = { ...mockPlayer, id: 'player2', currentSpace: 'ARCH-INITIATION', hand: [] };
      const p3: any = { ...mockPlayer, id: 'player3', currentSpace: 'REG-DOB-PLAN-EXAM', hand: [] };
      mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [mockPlayer, p2, p3] });
      mockDataService.getCardById.mockReturnValue(testCard);

      cardService.applyCardEffects('player1', 'TEST_GLOBAL_TICK');

      const tickEffectsByPlayer = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME')
        .map((e: any) => e.payload.playerId)
        .sort();

      expect(tickEffectsByPlayer).toEqual(['player1', 'player2', 'player3']);
    });

    // L012 "Soil Contamination" — card_mechanic='work_type_conditional'. The +4
    // days only applies if the player's project involves groundwork, i.e. they
    // hold a W card whose work type is ground-disturbing (Foundation, Earth Work,
    // Earthwork Only, Support of Excavation, New Building, or a Demolition). <!-- fb:feedback-1779810408636-776e3ba7 -->
    const L012_CARD = {
      card_id: 'L012',
      card_name: 'Soil Contamination',
      card_type: 'L',
      tick_modifier: '4',
      target: 'Self',
      scope: 'Single',
      card_mechanic: 'work_type_conditional',
      description: 'If the current project involves groundwork increase the filing time by 4 days.'
    };

    it('should apply L012 +4 days when the player holds a groundwork W card', () => {
      mockStateService.getPlayer.mockReturnValue({ ...mockPlayer, hand: ['W_ground'] });
      mockDataService.getCardById.mockImplementation((cardId: string) => {
        if (cardId === 'L012') return L012_CARD;
        if (cardId === 'W_ground') return { card_id: 'W_ground', card_name: 'Mat Foundation', card_type: 'W', work_type_restriction: 'Foundation', description: '' };
        return undefined;
      });

      cardService.applyCardEffects('player1', 'L012');

      const timeEffects = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME');
      expect(timeEffects).toHaveLength(1);
      expect(timeEffects[0].payload.amount).toBe(4);
    });

    it('should NOT apply L012 +4 days when the player holds only non-groundwork W cards', () => {
      mockStateService.getPlayer.mockReturnValue({ ...mockPlayer, hand: ['W_plumb'] });
      mockDataService.getCardById.mockImplementation((cardId: string) => {
        if (cardId === 'L012') return L012_CARD;
        if (cardId === 'W_plumb') return { card_id: 'W_plumb', card_name: 'Sprinkler Upgrade', card_type: 'W', work_type_restriction: 'Plumbing', description: '' };
        return undefined;
      });

      cardService.applyCardEffects('player1', 'L012');

      // L012's only effect is the (now-suppressed) time modifier, so the engine
      // may be invoked with an empty effect list or not at all — either way no
      // TIME effect should appear in any call.
      const timeEffects = mockEffectEngineService.processCardEffects.mock.calls
        .flatMap((c: any) => c[0] ?? [])
        .filter((e: any) => e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME');
      expect(timeEffects).toHaveLength(0);
    });

    it('should filter global tick_modifier by affected_phase=REGULATORY (L026/L030/L036/L047 shape)', () => {
      // L026 "All permit filing times decrease by 1 day this turn." with
      // affected_phase=REGULATORY should only tick down players currently on a
      // REGULATORY-phase space. Players in CONSTRUCTION, DESIGN, etc. are skipped.
      const testCard = {
        card_id: 'L026',
        card_name: 'Community Outreach',
        card_type: 'L',
        tick_modifier: '-1',
        target: 'All Players',
        scope: 'Global',
        affected_phase: 'REGULATORY',
        description: 'All permit filing times decrease by 1 day this turn.'
      };

      const p1: any = { ...mockPlayer, id: 'player1', currentSpace: 'REG-DOB-PLAN-EXAM' };
      const p2: any = { ...mockPlayer, id: 'player2', currentSpace: 'ARCH-INITIATION', hand: [] };
      const p3: any = { ...mockPlayer, id: 'player3', currentSpace: 'REG-FDNY-FEE-REVIEW', hand: [] };
      const p4: any = { ...mockPlayer, id: 'player4', currentSpace: 'CON-INITIATION', hand: [] };
      mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [p1, p2, p3, p4] });
      mockDataService.getCardById.mockReturnValue(testCard);

      // Per-space phase dispatch
      mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
        const map: Record<string, string> = {
          'REG-DOB-PLAN-EXAM': 'REGULATORY',
          'REG-FDNY-FEE-REVIEW': 'REGULATORY',
          'ARCH-INITIATION': 'DESIGN',
          'CON-INITIATION': 'CONSTRUCTION',
        };
        return map[spaceName] ? { space_name: spaceName, phase: map[spaceName] } as any : undefined;
      });

      cardService.applyCardEffects('player1', 'L026');

      const tickEffectsByPlayer = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME')
        .map((e: any) => e.payload.playerId)
        .sort();

      // Only player1 + player3 (REGULATORY) — player2 (DESIGN) and player4 (CONSTRUCTION) skipped.
      expect(tickEffectsByPlayer).toEqual(['player1', 'player3']);
    });

    it('should filter global tick_modifier by affected_phase=CONSTRUCTION (L033 shape)', () => {
      // L033 "All construction times increase by 3 days this turn." with
      // affected_phase=CONSTRUCTION only ticks players on construction spaces.
      const testCard = {
        card_id: 'L033',
        card_name: 'Worksite Injury',
        card_type: 'L',
        tick_modifier: '3',
        target: 'All Players',
        scope: 'Global',
        affected_phase: 'CONSTRUCTION',
        description: 'All construction times increase by 3 days this turn.'
      };

      const p1: any = { ...mockPlayer, id: 'player1', currentSpace: 'CON-INITIATION' };
      const p2: any = { ...mockPlayer, id: 'player2', currentSpace: 'REG-DOB-PLAN-EXAM', hand: [] };
      mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [p1, p2] });
      mockDataService.getCardById.mockReturnValue(testCard);

      mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
        const map: Record<string, string> = {
          'CON-INITIATION': 'CONSTRUCTION',
          'REG-DOB-PLAN-EXAM': 'REGULATORY',
        };
        return map[spaceName] ? { space_name: spaceName, phase: map[spaceName] } as any : undefined;
      });

      cardService.applyCardEffects('player1', 'L033');

      const tickEffectsByPlayer = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME')
        .map((e: any) => e.payload.playerId);

      // Only player1 (CONSTRUCTION) — player2 (REGULATORY) skipped.
      expect(tickEffectsByPlayer).toEqual(['player1']);
    });

    it('should parse card with discard_cards into CARD_DISCARD effect', () => {
      const testCard = {
        card_id: 'DISCARD001',
        card_name: 'Discard Card',
        card_type: 'L',
        discard_cards: '1 E',
        description: 'Test discard card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      const result = cardService.applyCardEffects('player1', 'DISCARD001');

      // Verify UnifiedEffectEngine was called with CARD_DISCARD effect
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'CARD_DISCARD',
            payload: expect.objectContaining({
              playerId: 'player1',
              cardIds: [],
              cardType: 'E',
              count: 1,
              source: 'card:DISCARD001',
              reason: 'Discard Card: Discard 1 E card'
            })
          })
        ]),
        expect.anything(),
        testCard
      );
    });

    it('should fan out discard_cards to every player when scope is Global (L003/L048 regression)', () => {
      // L003 "All players must discard 1 Expeditor card" — same shape as L049
      // was for DRAW, but for DISCARD. Prior to v3.0.17 the discard branch
      // emitted only one CARD_DISCARD effect targeting the playing player,
      // so the other players' hands stayed intact — silent partial no-op.
      const testCard = {
        card_id: 'L003',
        card_name: 'New Safety Regulations',
        card_type: 'L',
        discard_cards: '1 E',
        target: 'All Players',
        scope: 'Global',
        description: 'All players must discard 1 Expeditor card.'
      };

      const p2: any = { ...mockPlayer, id: 'player2', name: 'Player2', hand: [] };
      const p3: any = { ...mockPlayer, id: 'player3', name: 'Player3', hand: [] };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, p2, p3]
      });
      mockDataService.getCardById.mockReturnValue(testCard);

      cardService.applyCardEffects('player1', 'L003');

      const discardEffects = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'CARD_DISCARD');

      // One CARD_DISCARD effect per player, each with their own playerId.
      const playerIds = discardEffects.map((e: any) => e.payload.playerId).sort();
      expect(playerIds).toEqual(['player1', 'player2', 'player3']);

      // Each fanned effect must carry requiresUserChoice so the handler
      // shows a per-player modal instead of auto-picking oldest.
      const allRequireChoice = discardEffects.every((e: any) => e.payload.requiresUserChoice === true);
      expect(allRequireChoice).toBe(true);
    });

    it('should keep discard_cards single-player when scope is Single (control)', () => {
      // Existing single-scope behavior must not regress: card-source discards
      // without scope=Global emit one effect for the playing player and do
      // NOT set requiresUserChoice (so the existing auto-pick path stays).
      const testCard = {
        card_id: 'TEST_SINGLE_DISCARD',
        card_name: 'Single Discard',
        card_type: 'E',
        discard_cards: '1 W',
        target: 'Self',
        scope: 'Single',
        description: 'Discard 1 W card.'
      };

      const p2: any = { ...mockPlayer, id: 'player2', name: 'Player2', hand: [] };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, p2]
      });
      mockDataService.getCardById.mockReturnValue(testCard);

      cardService.applyCardEffects('player1', 'TEST_SINGLE_DISCARD');

      const discardEffects = mockEffectEngineService.processCardEffects.mock.calls[0][0]
        .filter((e: any) => e.effectType === 'CARD_DISCARD');

      expect(discardEffects.length).toBe(1);
      expect(discardEffects[0].payload.playerId).toBe('player1');
      expect(discardEffects[0].payload.requiresUserChoice).toBeUndefined();
    });

    it('should parse card with multiple effects into multiple Effect objects', () => {
      const testCard = {
        card_id: 'MULTI001',
        card_name: 'Multi Effect Card',
        card_type: 'E',
        money_effect: '500',
        tick_modifier: '-2',
        draw_cards: '1 W',
        description: 'Test multi-effect card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      const result = cardService.applyCardEffects('player1', 'MULTI001');

      // Verify UnifiedEffectEngine was called with all three effects
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          // Money effect
          expect.objectContaining({
            effectType: 'RESOURCE_CHANGE',
            payload: expect.objectContaining({
              resource: 'MONEY',
              amount: 500
            })
          }),
          // Time effect
          expect.objectContaining({
            effectType: 'RESOURCE_CHANGE',
            payload: expect.objectContaining({
              resource: 'TIME',
              amount: -2
            })
          }),
          // Draw effect
          expect.objectContaining({
            effectType: 'CARD_DRAW',
            payload: expect.objectContaining({
              cardType: 'W',
              count: 1
            })
          })
        ]),
        expect.anything(),
        testCard
      );

      // Should have called with exactly 3 effects
      const callArgs = mockEffectEngineService.processCardEffects.mock.calls[0];
      expect(callArgs[0]).toHaveLength(3);
    });

    it('should handle cards with no parseable effects gracefully', () => {
      const testCard = {
        card_id: 'EMPTY001',
        card_name: 'Empty Card',
        card_type: 'W',
        description: 'Test empty card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      const result = cardService.applyCardEffects('player1', 'EMPTY001');

      // Should still call legacy effects but not UnifiedEffectEngine for parsing
      expect(mockEffectEngineService.processCardEffects).not.toHaveBeenCalled();
    });

    it('should handle EffectEngine processing failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const testCard = {
        card_id: 'FAIL001',
        card_name: 'Failing Card',
        card_type: 'E',
        money_effect: '1000',
        description: 'Test failing card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      // Mock EffectEngine to return failure
      mockEffectEngineService.processCardEffects.mockResolvedValueOnce({
        success: false,
        totalEffects: 1,
        successfulEffects: 0,
        failedEffects: 1,
        results: [],
        errors: ['Effect processing failed']
      });

      // applyCardEffects now throws on failure, so we expect it to throw
      await expect(cardService.applyCardEffects('player1', 'FAIL001')).rejects.toThrow('Effect processing failed');

      consoleSpy.mockRestore();
    });

    it('should handle EffectEngine exceptions gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const testCard = {
        card_id: 'ERROR001',
        card_name: 'Error Card',
        card_type: 'E',
        money_effect: '1000',
        description: 'Test error card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      // Mock EffectEngine to throw exception
      mockEffectEngineService.processCardEffects.mockRejectedValueOnce(new Error('Engine crashed'));

      // applyCardEffects now propagates exceptions, so we expect it to throw
      await expect(cardService.applyCardEffects('player1', 'ERROR001')).rejects.toThrow('Engine crashed');

      consoleSpy.mockRestore();
    });

    it('should integrate playCard() with UnifiedEffectEngine', async () => {
      const testCard = {
        card_id: 'PLAY001',
        card_name: 'Playable Card',
        card_type: 'E',
        money_effect: '200',
        cost: 50,
        description: 'Test playable card'
      };

      mockDataService.getCardById.mockReturnValue(testCard);

      // Mock player with the card in hand
      const playerWithCard = {
        ...mockPlayer,
        hand: ['PLAY001'],
        money: 100 // Enough money to play the card
      };
      mockStateService.getPlayer.mockReturnValue(playerWithCard);

      const result = await cardService.playCard('player1', 'PLAY001');

      // Verify that the UnifiedEffectEngine was called as part of playCard
      expect(mockEffectEngineService.processCardEffects).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: 'RESOURCE_CHANGE',
            payload: expect.objectContaining({
              resource: 'MONEY',
              amount: 200
            })
          })
        ]),
        expect.objectContaining({
          source: 'card:PLAY001',
          playerId: 'player1',
          triggerEvent: 'CARD_PLAY'
        }),
        testCard
      );
    });
  });

  // Kid A (2026-05-29) — approval-revoke from auto-drawn life events.
  // Before this fix, the L-card `revokes_approval` branch was gated behind
  // !options?.onlyResourceEffects, so the auto-draw path (SpaceArrivalProcessor
  // / CardEffectHandler) which passes onlyResourceEffects:true never wiped DOB
  // on L003 / L020. Safe now because chunk 3 routes the revoke through TEMP.
  describe('Kid A — approval-revoke on auto-drawn life events', () => {
    it('L003 "New Safety Regulations" revokes DOB approval on the auto-draw path', async () => {
      const approvalSpy = vi.fn().mockReturnValue({ dobApprovalStatus: 'none', dobApprovedDestinations: [] });
      const approvalService: any = { revoke: approvalSpy };
      const localCardService = new CardService(
        mockDataService,
        mockStateService,
        mockResourceService,
        mockLoggingService,
        mockGameRulesService,
        undefined,
        approvalService
      );
      localCardService.setEffectEngineService(mockEffectEngineService);

      mockDataService.getCardById.mockReturnValue({
        card_id: 'L003',
        card_name: 'New Safety Regulations',
        card_type: 'L',
        description: 'All players must discard 1 Expeditor card.',
        revokes_approval: 'dob',
      });

      await localCardService.applyCardEffects('player1', 'L003', { onlyResourceEffects: true });

      expect(approvalSpy).toHaveBeenCalledWith('dob');
      expect(mockStateService.updateTempState).toHaveBeenCalledWith('player1', {
        dobApprovalStatus: 'none',
        dobApprovedDestinations: [],
      });
    });

    it('Kid B — L005 "Positive Press" applies its free E-card draw on the auto path', async () => {
      // L005: -3 days + draw 1 E. With Kid B both effects should fire.
      mockDataService.getCardById.mockReturnValue({
        card_id: 'L005',
        card_name: 'Positive Press',
        card_type: 'L',
        description: 'The current high-profile client filing takes 3 days less time. Draw 1 Expeditor Card.',
        tick_modifier: -3,
        draw_cards: '1 E',
        target: 'Self',
        scope: 'Single',
      });

      await cardService.applyCardEffects('player1', 'L005', { onlyResourceEffects: true });

      // processCardEffects should receive BOTH the RESOURCE_CHANGE (time) AND
      // the CARD_DRAW(E, self).
      const sentEffects = mockEffectEngineService.processCardEffects.mock.calls[0][0];
      const hasTimeChange = sentEffects.some((e: any) =>
        e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME'
      );
      const hasEDraw = sentEffects.some((e: any) =>
        e.effectType === 'CARD_DRAW' && e.payload.cardType === 'E' && e.payload.playerId === 'player1'
      );
      expect(hasTimeChange).toBe(true);
      expect(hasEDraw).toBe(true);
    });

    it('Kid C — L002 "Economic Downturn" (Global+duration) emits ONE effect for engine fan-out', async () => {
      // L002: All Players +2 days for 3 turns. Before Kid C, parseCardIntoEffects
      // fanned out N players × N duration turns × N targetRule expansions =
      // N×N effects per player. Each player ended up with N copies of the
      // tick, firing every turn for N turns → N× over-application.
      //
      // Kid C: when scope=Global AND duration=Turns, emit a single effect and
      // let EffectEngineService.processCardEffects's targetRule loop expand
      // it to one active effect per player.
      const p2: any = { ...mockPlayer, id: 'player2', name: 'Player2' };
      const p3: any = { ...mockPlayer, id: 'player3', name: 'Player3' };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, p2, p3]
      });

      mockDataService.getCardById.mockReturnValue({
        card_id: 'L002',
        card_name: 'Economic Downturn',
        card_type: 'L',
        description: 'All permit and inspection times increase by 2 days for the next 3 turns.',
        tick_modifier: 2,
        target: 'All Players',
        scope: 'Global',
        duration: 'Turns',
        duration_count: '3',
      });

      await cardService.applyCardEffects('player1', 'L002', { onlyResourceEffects: true });

      const calls = mockEffectEngineService.processCardEffects.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const [sentEffects, _ctx, cardData] = calls[0];

      // Exactly ONE time RESOURCE_CHANGE effect — engine will fan out by targetRule.
      const timeEffects = sentEffects.filter((e: any) =>
        e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME'
      );
      expect(timeEffects.length).toBe(1);
      expect(timeEffects[0].payload.amount).toBe(2);

      // Card metadata carries duration so EffectEngineService routes to active.
      expect(cardData?.duration).toBe('Turns');
      expect(cardData?.duration_count).toBe('3');
      expect(cardData?.target).toBe('All Players');
    });

    it('Kid C — L008 "Materials Shortage" (Global, no duration) still fans per-player at parser level', async () => {
      // L008: All Players +3 days (immediate, no duration). The parser-side
      // fan-out is preserved for this case so the phase filter (affected_phase=
      // CONSTRUCTION) can use each player's *current* space — there's no
      // apply-time loop to delegate to.
      const p2: any = { ...mockPlayer, id: 'player2', name: 'Player2' };
      const p3: any = { ...mockPlayer, id: 'player3', name: 'Player3' };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, p2, p3]
      });

      mockDataService.getCardById.mockReturnValue({
        card_id: 'L008',
        card_name: 'Materials Shortage',
        card_type: 'L',
        description: 'All players’ current construction phase takes 3 days more time.',
        tick_modifier: 3,
        target: 'All Players',
        scope: 'Global',
        // No duration_count → immediate-fire, parser fans out per player.
      });

      await cardService.applyCardEffects('player1', 'L008', { onlyResourceEffects: true });

      const calls = mockEffectEngineService.processCardEffects.mock.calls;
      const sentEffects = calls[0][0];
      const timeEffects = sentEffects.filter((e: any) =>
        e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME'
      );
      // 3 players × 1 effect each = 3 effects (existing immediate-global behavior).
      expect(timeEffects.length).toBe(3);
    });

    it('Kid D — L009 on a matching roll (2 → range 1-3) applies +5 days', async () => {
      // L009: dice_conditional. Range 1-3 → +5 days, range 4-6 → 0 days.
      // applyCardEffects with diceRoll=2 should patch the card's tick_modifier
      // to +5 before parseCardIntoEffects runs.
      mockDataService.getCardById.mockReturnValue({
        card_id: 'L009',
        card_name: 'NIMBY Lawsuit',
        card_type: 'L',
        description: 'Roll a die. On 1-3 +5 days. On 4-6 no effect.',
        card_mechanic: 'dice_conditional',
        tick_modifier: 5,
        dice_range_1_min: 1,
        dice_range_1_max: 3,
        dice_range_1_time: 5,
        dice_range_2_min: 4,
        dice_range_2_max: 6,
        dice_range_2_time: 0,
        target: 'Self',
        scope: 'Single',
      });

      await cardService.applyCardEffects('player1', 'L009', { onlyResourceEffects: true, diceRoll: 2 });

      const calls = mockEffectEngineService.processCardEffects.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sentEffects = calls[0][0];
      const timeEffects = sentEffects.filter((e: any) =>
        e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME'
      );
      expect(timeEffects.length).toBe(1);
      expect(timeEffects[0].payload.amount).toBe(5);
    });

    it('Kid D — L009 on a non-matching roll (5 → range 4-6) applies 0 days (no effect)', async () => {
      mockDataService.getCardById.mockReturnValue({
        card_id: 'L009',
        card_name: 'NIMBY Lawsuit',
        card_type: 'L',
        description: 'Roll a die. On 1-3 +5 days. On 4-6 no effect.',
        card_mechanic: 'dice_conditional',
        tick_modifier: 5,
        dice_range_1_min: 1,
        dice_range_1_max: 3,
        dice_range_1_time: 5,
        dice_range_2_min: 4,
        dice_range_2_max: 6,
        dice_range_2_time: 0,
        target: 'Self',
        scope: 'Single',
      });

      await cardService.applyCardEffects('player1', 'L009', { onlyResourceEffects: true, diceRoll: 5 });

      // With tick_modifier patched to 0, parseCardIntoEffects emits no TIME effect.
      const calls = mockEffectEngineService.processCardEffects.mock.calls;
      if (calls.length > 0) {
        const sentEffects = calls[0][0];
        const timeEffects = sentEffects.filter((e: any) =>
          e.effectType === 'RESOURCE_CHANGE' && e.payload.resource === 'TIME'
        );
        expect(timeEffects.length).toBe(0);
      }
    });

    it('Kid D — dice_conditional cards STILL skip when no diceRoll is provided (CardEffectHandler path)', async () => {
      mockDataService.getCardById.mockReturnValue({
        card_id: 'L009',
        card_name: 'NIMBY Lawsuit',
        card_type: 'L',
        card_mechanic: 'dice_conditional',
        dice_range_1_min: 1,
        dice_range_1_max: 3,
        dice_range_1_time: 5,
        target: 'Self',
        scope: 'Single',
      });

      // No diceRoll option (CardEffectHandler unconditional-draw path).
      await cardService.applyCardEffects('player1', 'L009', { onlyResourceEffects: true });

      // Early-returned before reaching processCardEffects.
      expect(mockEffectEngineService.processCardEffects).not.toHaveBeenCalled();
    });

    it('Kid E — L003 forced discard survives the auto-path filter and overrides target to Self', async () => {
      // L003 with onlyResourceEffects: the parser fans CARD_DISCARD per
      // player; the filter now lets CARD_DISCARD through; effectiveCard.target
      // is overridden to 'Self' so the engine does NOT re-fan via targetRule
      // (which would create N² discards per player).
      const p2: any = { ...mockPlayer, id: 'player2', name: 'Player2' };
      const p3: any = { ...mockPlayer, id: 'player3', name: 'Player3' };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        players: [mockPlayer, p2, p3]
      });

      mockDataService.getCardById.mockReturnValue({
        card_id: 'L003',
        card_name: 'New Safety Regulations',
        card_type: 'L',
        description: 'All players must discard 1 Expeditor card.',
        discard_cards: '1 E',
        target: 'All Players',
        scope: 'Global',
        tick_modifier: 3,
      });

      await cardService.applyCardEffects('player1', 'L003', { onlyResourceEffects: true });

      const calls = mockEffectEngineService.processCardEffects.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const [sentEffects, _ctx, cardData] = calls[0];

      // Exactly 3 CARD_DISCARD effects — one per player (no engine re-fan).
      const discardEffects = sentEffects.filter((e: any) => e.effectType === 'CARD_DISCARD');
      expect(discardEffects.length).toBe(3);
      const playerIds = discardEffects.map((e: any) => e.payload.playerId).sort();
      expect(playerIds).toEqual(['player1', 'player2', 'player3']);

      // Engine target rewritten to Self so processEffectsWithTargeting takes
      // its fast-path (no re-clone per target).
      expect(cardData?.target).toBe('Self');
    });

    it('Kid B — non-E draws (e.g. W) are still filtered out on the auto path', async () => {
      // Defensive: if a future life-event author sets draw_cards="1 W", we
      // don't want it to leak through (W draws trigger downstream scope-change
      // approval machinery this Kid B fix isn't validated for).
      mockDataService.getCardById.mockReturnValue({
        card_id: 'L_TEST_W_DRAW',
        card_name: 'Test',
        card_type: 'L',
        description: 'Draw 1 Work Package.',
        draw_cards: '1 W',
        target: 'Self',
        scope: 'Single',
      });

      await cardService.applyCardEffects('player1', 'L_TEST_W_DRAW', { onlyResourceEffects: true });

      // Either nothing was sent (no surviving effects → early return) or what
      // was sent contains no CARD_DRAW. Both are acceptable outcomes.
      const calls = mockEffectEngineService.processCardEffects.mock.calls;
      if (calls.length > 0) {
        const sentEffects = calls[0][0];
        const hasWDraw = sentEffects.some((e: any) =>
          e.effectType === 'CARD_DRAW' && e.payload.cardType === 'W'
        );
        expect(hasWDraw).toBe(false);
      }
    });

    it('skips the revoke when ApprovalService is not injected (ghost-bootstrap parity)', async () => {
      // CardService without approvalService — should not blow up.
      const localCardService = new CardService(
        mockDataService,
        mockStateService,
        mockResourceService,
        mockLoggingService,
        mockGameRulesService,
      );
      localCardService.setEffectEngineService(mockEffectEngineService);

      mockDataService.getCardById.mockReturnValue({
        card_id: 'L003',
        card_type: 'L',
        revokes_approval: 'dob',
      });

      await expect(
        localCardService.applyCardEffects('player1', 'L003', { onlyResourceEffects: true })
      ).resolves.toBeDefined();
      expect(mockStateService.updateTempState).not.toHaveBeenCalled();
    });
  });
});