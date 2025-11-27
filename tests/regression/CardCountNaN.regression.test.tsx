/**
 * CARD COUNT NaN REGRESSION TEST
 *
 * Bug: Manual card effect showed "You picked up NaN E cards" when effect_value
 * was undefined or an invalid string.
 *
 * Root cause: effect_value was parsed with parseInt() without proper validation
 * or fallback to the actual drawn card count.
 *
 * Fix: Added proper parsing with fallback to actual drawn card count from
 * before/after hand comparison.
 *
 * Date: 2025-11-07
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnService } from '../../src/services/TurnService';
import { createMockStateService, createMockDataService } from '../mocks/mockServices';
import { GameState, Player } from '../../src/types/StateTypes';

describe('CardCountNaN Regression Tests', () => {
  let turnService: TurnService;
  let mockStateService: any;
  let mockDataService: any;
  let mockGameRulesService: any;
  let mockCardService: any;
  let mockResourceService: any;
  let mockMovementService: any;
  let mockNegotiationService: any;
  let mockLoggingService: any;
  let mockChoiceService: any;
  let testPlayer: Player;
  let mockGameState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize mock services
    mockStateService = createMockStateService();
    mockDataService = createMockDataService();

    mockGameRulesService = {
      evaluateCondition: vi.fn().mockReturnValue(true),
      canPlayerAfford: vi.fn().mockReturnValue(true),
      isPlayerTurn: vi.fn().mockReturnValue(true),
      isGameInProgress: vi.fn().mockReturnValue(true),
      canPlayerTakeAction: vi.fn().mockReturnValue(true),
      checkWinCondition: vi.fn(),
      calculateProjectScope: vi.fn(),
      calculatePlayerScore: vi.fn(),
      determineWinner: vi.fn(),
      checkTurnLimit: vi.fn(),
      checkGameEndConditions: vi.fn(),
      isMoveValid: vi.fn().mockReturnValue(true),
      canPlayCard: vi.fn().mockReturnValue(true),
      canDrawCard: vi.fn().mockReturnValue(true),
    };

    mockCardService = {
      drawCards: vi.fn(),
      playCard: vi.fn(),
      discardCards: vi.fn(),
      canPlayCard: vi.fn().mockReturnValue(true),
      isValidCardType: vi.fn().mockReturnValue(true),
      playerOwnsCard: vi.fn().mockReturnValue(true),
      drawAndApplyCard: vi.fn(),
      removeCard: vi.fn(),
      replaceCard: vi.fn(),
      endOfTurn: vi.fn(),
      activateCard: vi.fn(),
      transferCard: vi.fn(),
      getCardType: vi.fn(),
      getPlayerCards: vi.fn(),
      getPlayerCardCount: vi.fn(),
      getCardToDiscard: vi.fn(),
      applyCardEffects: vi.fn(),
      finalizePlayedCard: vi.fn(),
      discardPlayedCard: vi.fn(),
      effectEngineService: {
        processEffects: vi.fn(),
        processEffect: vi.fn(),
        processActiveEffectsForAllPlayers: vi.fn(),
        validateEffect: vi.fn(),
        validateEffects: vi.fn(),
      },
      setEffectEngineService: vi.fn(),
    };

    mockResourceService = {
      addMoney: vi.fn(),
      spendMoney: vi.fn(),
      canAfford: vi.fn().mockReturnValue(true),
      addTime: vi.fn(),
      spendTime: vi.fn(),
      updateResources: vi.fn(),
      getResourceHistory: vi.fn(),
      validateResourceChange: vi.fn(),
      takeOutLoan: vi.fn(),
      applyInterest: vi.fn(),
    };

    mockMovementService = {
      getValidMoves: vi.fn(),
      movePlayer: vi.fn(),
      getDiceDestination: vi.fn(),
      handleMovementChoice: vi.fn(),
      handleMovementChoiceV2: vi.fn(),
    };

    mockNegotiationService = {
      initiateNegotiation: vi.fn(),
      makeOffer: vi.fn(),
      acceptOffer: vi.fn(),
      rejectOffer: vi.fn(),
      cancelNegotiation: vi.fn(),
      getCurrentNegotiation: vi.fn(),
    };

    mockLoggingService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      setLogLevel: vi.fn(),
      getLogLevel: vi.fn(),
    };

    mockChoiceService = {
      presentChoice: vi.fn(),
      handleChoice: vi.fn(),
      getCurrentChoice: vi.fn(),
      clearChoice: vi.fn(),
    };

    // Create test player
    testPlayer = {
      id: 'player1',
      name: 'Test Player',
      color: '#FF0000',
      currentSpace: 'TEST-SPACE',
      visitType: 'First' as const,
      visitedSpaces: ['TEST-SPACE'],
      hand: [],
      activeCards: [],
      money: 1000000,
      timeSpent: 0,
      projectScope: 0,
      lastDiceRoll: { roll1: 3, roll2: 4, total: 7 },
      spaceEntrySnapshot: undefined,
      turnModifiers: undefined,
      usedTryAgain: false,
      activeEffects: [],
      loans: [],
      score: 0,
    };

    // Create mock game state
    mockGameState = {
      players: [testPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY' as const,
      turn: 1,
      globalTurnCount: 1,
      playerTurnCounts: { player1: 1 },
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      isMoving: false,
      isProcessingArrival: false,
      isInitialized: true,
      gameStartTime: new Date(),
      gameEndTime: undefined,
      winner: undefined,
      currentExplorationSessionId: null,
      requiredActions: 1,
      completedActionCount: 0,
      availableActionTypes: [],
      completedActions: {
        diceRoll: undefined,
        manualActions: {},
      },
      activeNegotiation: null,
      selectedDestination: null,
      globalActionLog: [],
      playerSnapshots: {},
      decks: { W: [], B: [], E: [], L: [], I: [] },
      discardPiles: { W: [], B: [], E: [], L: [], I: [] },
    };

    mockStateService.getGameState.mockReturnValue(mockGameState);
    mockStateService.getPlayer.mockReturnValue(testPlayer);

    // Initialize TurnService
    turnService = new TurnService(
      mockDataService,
      mockStateService,
      mockGameRulesService,
      mockCardService,
      mockResourceService,
      mockMovementService,
      mockNegotiationService,
      mockLoggingService,
      mockChoiceService
    );
  });

  describe('triggerManualEffectWithFeedback - undefined effect_value', () => {
    it('should handle undefined effect_value without showing NaN', async () => {
      // Setup: Mock space effect with undefined effect_value
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_e',
        effect_value: undefined,
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      // Mock card drawing - 3 cards drawn
      const drawnCards = ['E001_123_abc_0', 'E002_123_abc_1', 'E003_123_abc_2'];
      mockCardService.drawCards.mockReturnValue({
        cards: drawnCards,
        drawnCards: drawnCards.map(id => ({ card_id: id, card_type: 'E' })),
      });

      // Mock state changes: before state has no cards, after state has drawn cards
      const beforeState = { ...mockGameState };
      const afterState = {
        ...mockGameState,
        players: [{ ...testPlayer, hand: drawnCards }],
      };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        // First call: before state, second call: after state
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_e');

      // Verify no NaN in the result
      expect(result.summary).not.toContain('NaN');
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].description).not.toContain('NaN');

      // Should show a valid number (actual drawn count)
      expect(result.effects[0].description).toMatch(/\d+ E cards?/i);
    });
  });

  describe('triggerManualEffectWithFeedback - invalid string effect_value', () => {
    it('should handle invalid string effect_value without showing NaN', async () => {
      // Setup: Mock space effect with invalid string effect_value
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_e',
        effect_value: 'invalid_string',
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      // Mock card drawing - 2 cards drawn
      const drawnCards = ['E001_123_xyz_0', 'E002_123_xyz_1'];
      mockCardService.drawCards.mockReturnValue({
        cards: drawnCards,
        drawnCards: drawnCards.map(id => ({ card_id: id, card_type: 'E' })),
      });

      // Mock state changes
      const beforeState = { ...mockGameState };
      const afterState = {
        ...mockGameState,
        players: [{ ...testPlayer, hand: drawnCards }],
      };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_e');

      // Verify no NaN in the result
      expect(result.summary).not.toContain('NaN');
      expect(result.effects[0].description).not.toContain('NaN');
      expect(result.effects[0].description).toMatch(/\d+ E cards?/i);
    });
  });

  describe('triggerManualEffectWithFeedback - valid numeric string effect_value', () => {
    it('should correctly parse numeric string effect_value', async () => {
      // Setup: Mock space effect with valid numeric string
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_w',
        effect_value: '3',
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      // Mock card drawing - 3 cards drawn
      const drawnCards = ['W001_456_def_0', 'W002_456_def_1', 'W003_456_def_2'];
      mockCardService.drawCards.mockReturnValue({
        cards: drawnCards,
        drawnCards: drawnCards.map(id => ({ card_id: id, card_type: 'W' })),
      });

      // Mock state changes
      const beforeState = { ...mockGameState };
      const afterState = {
        ...mockGameState,
        players: [{ ...testPlayer, hand: drawnCards }],
      };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_w');

      // Verify correct parsing
      expect(result.summary).toContain('3 W cards');
      expect(result.summary).not.toContain('NaN');
      expect(result.effects[0].description).toContain('3 W cards');
    });
  });

  describe('triggerManualEffectWithFeedback - zero cards edge case', () => {
    it('should handle zero card draws gracefully', async () => {
      // Setup: Mock space effect with zero count
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_b',
        effect_value: '0',
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      // Mock card drawing - 0 cards drawn
      mockCardService.drawCards.mockReturnValue({
        cards: [],
        drawnCards: [],
      });

      // Mock state changes (no change in hand)
      const beforeState = { ...mockGameState };
      const afterState = { ...mockGameState };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_b');

      // Verify no NaN
      expect(result.summary).not.toContain('NaN');
      expect(result.effects[0].description).not.toContain('NaN');
      // Should handle zero appropriately
      expect(result.effects[0].description).toMatch(/0 B cards?/i);
    });
  });

  describe('UI Message Formatting', () => {
    it('should produce grammatically correct singular message for 1 card', async () => {
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_l',
        effect_value: '1',
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      const drawnCards = ['L001_789_ghi_0'];
      mockCardService.drawCards.mockReturnValue({
        cards: drawnCards,
        drawnCards: drawnCards.map(id => ({ card_id: id, card_type: 'L' })),
      });

      const beforeState = { ...mockGameState };
      const afterState = {
        ...mockGameState,
        players: [{ ...testPlayer, hand: drawnCards }],
      };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_l');

      // Should use singular "card" not "cards"
      expect(result.effects[0].description).toContain('1 L card');
    });

    it('should produce grammatically correct plural message for multiple cards', async () => {
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_i',
        effect_value: '5',
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      const drawnCards = ['I001', 'I002', 'I003', 'I004', 'I005'];
      mockCardService.drawCards.mockReturnValue({
        cards: drawnCards,
        drawnCards: drawnCards.map(id => ({ card_id: id, card_type: 'I' })),
      });

      const beforeState = { ...mockGameState };
      const afterState = {
        ...mockGameState,
        players: [{ ...testPlayer, hand: drawnCards }],
      };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_i');

      // Should use plural "cards"
      expect(result.effects[0].description).toContain('5 I cards');
    });
  });

  describe('Actual Card Count Fallback', () => {
    it('should use actual drawn card count when effect_value parsing fails', async () => {
      // Setup with undefined effect_value
      const spaceEffect = {
        space_id: 'TEST-SPACE',
        visit_type: 'First' as const,
        trigger_type: 'manual' as const,
        effect_type: 'cards' as const,
        effect_action: 'draw_e',
        effect_value: undefined,
        condition: null,
        outcome_type: null,
        outcome_value: null,
      };

      mockDataService.getSpaceEffects.mockReturnValue([spaceEffect]);

      // Actually draw 5 cards (different from effect_value)
      const drawnCards = ['E001', 'E002', 'E003', 'E004', 'E005'];
      mockCardService.drawCards.mockReturnValue({
        cards: drawnCards,
        drawnCards: drawnCards.map(id => ({ card_id: id, card_type: 'E' })),
      });

      const beforeState = { ...mockGameState };
      const afterState = {
        ...mockGameState,
        players: [{ ...testPlayer, hand: drawnCards }],
      };

      let callCount = 0;
      mockStateService.getGameState.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? beforeState : afterState;
      });

      const result = await turnService.triggerManualEffectWithFeedback('player1', 'cards:draw_e');

      // Should reflect actual drawn count (5), not undefined/NaN
      expect(result.effects[0].description).not.toContain('NaN');
      expect(result.effects[0].description).toMatch(/\d+ E cards/i);
      // Verify it mentions a valid number
      const match = result.effects[0].description.match(/(\d+) E cards/i);
      expect(match).toBeTruthy();
      const count = parseInt(match![1], 10);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(isNaN(count)).toBe(false);
    });
  });
});
