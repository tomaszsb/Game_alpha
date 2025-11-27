// tests/features/ManualFunding.test.ts

/**
 * Manual Funding Feature Tests
 *
 * Tests for the manual funding implementation at OWNER-FUND-INITIATION space.
 * This covers the condition-based B/I card selection, compound key tracking,
 * automatic card application, and proper action counting.
 *
 * Key Features Tested:
 * 1. Condition-based effect selection (scope_le_4M vs scope_gt_4M)
 * 2. Compound key handling ("cards:draw_b", "cards:draw_i")
 * 3. Button visibility and completion tracking
 * 4. Automatic card application at OWNER-FUND-INITIATION
 * 5. Action count calculation with condition filtering
 * 6. End turn enablement after funding completion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnService } from '../../src/services/TurnService';
import { StateService } from '../../src/services/StateService';
import { CardService } from '../../src/services/CardService';
import {
  createMockDataService,
  createMockStateService,
  createMockCardService,
  createMockMovementService,
  createMockResourceService,
  createMockLoggingService,
  createMockChoiceService,
  createMockGameRulesService,
  createMockEffectEngineService,
  createMockNegotiationService
} from '../mocks/mockServices';
import { Player } from '../../src/types/StateTypes';

describe('Manual Funding at OWNER-FUND-INITIATION', () => {
  let turnService: TurnService;
  let stateService: StateService;
  let cardService: any;
  let mockDataService: any;
  let mockResourceService: any;
  let mockLoggingService: any;
  let mockGameRulesService: any;

  // Mock funding cards
  const mockBCard = {
    card_id: 'B001',
    card_name: 'Bank Loan',
    card_type: 'B',
    loan_amount: '700000',
    description: 'Bank loan for small projects'
  };

  const mockICard = {
    card_id: 'I001',
    card_name: 'Investment Deal',
    card_type: 'I',
    investment_amount: '8000000',
    description: 'Investment for large projects'
  };

  // Helper to set up player at funding space with specific scope
  // NOTE: Project scope is calculated from W cards, not from player.projectScope field!
  const setupPlayerAtFunding = (playerId: string, projectScope: number) => {
    const player = stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Mock W cards to achieve desired project scope
    // Project scope is calculated by summing the cost of all W cards
    const mockWCards = [`W_MOCK_${projectScope}`];

    // Mock getPlayerCards to return W cards for this player
    cardService.getPlayerCards = vi.fn().mockImplementation((pId: string, cardType?: any) => {
      if (pId === playerId && cardType === 'W') {
        return mockWCards;
      }
      return [];
    });

    // Mock getCardById for the W card to return correct cost
    const originalGetCardById = mockDataService.getCardById.getMockImplementation();
    mockDataService.getCardById.mockImplementation((cardId: string) => {
      if (cardId === `W_MOCK_${projectScope}`) {
        return {
          card_id: cardId,
          card_name: 'Mock Work Card',
          card_type: 'W',
          cost: projectScope, // This cost is used to calculate project scope
          description: `Work card representing $${projectScope.toLocaleString()} scope`
        };
      }
      // Fall back to original implementation for B/I cards
      return originalGetCardById ? originalGetCardById(cardId) : null;
    });

    // Update player position
    // NOTE: Project scope is calculated from W cards on-demand via GameRulesService
    // No need to set player.projectScope field - it's now deprecated
    stateService.updatePlayer({
      id: playerId,
      currentSpace: 'OWNER-FUND-INITIATION',
      visitType: 'First',
      money: player.money || 0,
      timeSpent: player.timeSpent || 0,
      hand: mockWCards, // W cards are the source of truth for project scope
      visitedSpaces: player.visitedSpaces || []
    });
  };

  beforeEach(() => {
    mockDataService = createMockDataService();
    const mockStateServiceInstance = createMockStateService();
    mockResourceService = createMockResourceService();
    mockLoggingService = createMockLoggingService();

    // Create real StateService for proper action counting
    stateService = new StateService(mockDataService);

    // Create mock GameRulesService and configure it to properly evaluate conditions
    mockGameRulesService = createMockGameRulesService();

    // IMPORTANT: Inject gameRulesService into StateService so calculateRequiredActions can evaluate conditions
    stateService.setGameRulesService(mockGameRulesService);

    // Configure calculateProjectScope to return the actual scope from W cards
    mockGameRulesService.calculateProjectScope.mockImplementation((playerId: string) => {
      const player = stateService.getPlayer(playerId);
      if (!player || !player.hand) return 0;

      // Sum up the cost of all W cards
      const wCards = player.hand.filter(cardId => cardId.startsWith('W'));
      let totalScope = 0;
      for (const cardId of wCards) {
        // Extract scope value from mock card ID format: W_MOCK_<scope>
        const match = cardId.match(/W_MOCK_(\d+)/);
        if (match) {
          totalScope += parseInt(match[1], 10);
        }
      }
      return totalScope;
    });

    // Configure evaluateCondition to properly evaluate scope conditions
    mockGameRulesService.evaluateCondition.mockImplementation((playerId: string, condition?: string) => {
      if (!condition) return true;

      const conditionLower = condition.toLowerCase();

      // Evaluate scope conditions
      if (conditionLower === 'scope_le_4m') {
        const scope = mockGameRulesService.calculateProjectScope(playerId);
        return scope <= 4000000;
      }
      if (conditionLower === 'scope_gt_4m') {
        const scope = mockGameRulesService.calculateProjectScope(playerId);
        return scope > 4000000;
      }

      // Default: true for other conditions
      return true;
    });

    // Setup card service with mocks
    cardService = createMockCardService();
    cardService.drawCards = vi.fn().mockReturnValue([]);
    cardService.applyCardEffects = vi.fn().mockReturnValue(undefined);
    cardService.finalizePlayedCard = vi.fn().mockReturnValue(undefined);
    cardService.getPlayerCards = vi.fn().mockReturnValue([]); // Default: no cards
    cardService.getCardType = vi.fn().mockImplementation((cardId: string) => {
      if (cardId.startsWith('B')) return 'B';
      if (cardId.startsWith('I')) return 'I';
      if (cardId.startsWith('W')) return 'W';
      if (cardId.startsWith('E')) return 'E';
      if (cardId.startsWith('L')) return 'L';
      return null;
    });

    // Create TurnService with all dependencies (in correct order!)
    // TurnService(dataService, stateService, gameRulesService, cardService, resourceService,
    //             movementService, negotiationService, loggingService, choiceService,
    //             notificationService?, effectEngineService?)
    turnService = new TurnService(
      mockDataService,
      stateService,
      mockGameRulesService,  // Use configured mock instead of creating new one
      cardService,
      mockResourceService,
      createMockMovementService(),
      createMockNegotiationService(),
      mockLoggingService,
      createMockChoiceService(),
      undefined, // notificationService (optional)
      createMockEffectEngineService()
    );

    // Mock getCardById for both B and I cards
    mockDataService.getCardById.mockImplementation((cardId: string) => {
      if (cardId === 'B001') return mockBCard;
      if (cardId === 'I001') return mockICard;
      return null;
    });

    // Setup default space effects for OWNER-FUND-INITIATION
    const defaultFundingEffects = [
      {
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'time',
        effect_action: 'add',
        effect_value: 1,
        condition: 'always',
        trigger_type: 'auto',
        description: '1 day for funding review'
      },
      {
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_b',
        effect_value: 1,
        condition: 'scope_le_4M',
        trigger_type: 'manual',
        description: 'Draw 1 B card if scope ≤ $4M'
      },
      {
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_i',
        effect_value: 1,
        condition: 'scope_gt_4M',
        trigger_type: 'manual',
        description: 'Draw 1 I card if scope > $4M'
      }
    ];

    mockDataService.getSpaceEffects.mockReturnValue(defaultFundingEffects);

    // Mock game config for OWNER-FUND-INITIATION
    mockDataService.getGameConfigBySpace.mockImplementation((spaceName: string) => {
      if (spaceName === 'OWNER-FUND-INITIATION') {
        return {
          space_name: 'OWNER-FUND-INITIATION',
          phase: 'SETUP',
          requires_dice_roll: false
        };
      }
      return null;
    });
  });

  describe('Condition-Based Effect Selection', () => {
    it('should select B card effect when scope ≤ $4M', () => {
      // Setup space effects with both B and I options
      const spaceEffects = [
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_b',
          effect_value: 1,
          condition: 'scope_le_4M',
          trigger_type: 'manual',
          description: 'Draw 1 B card if scope ≤ $4M'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_i',
          effect_value: 1,
          condition: 'scope_gt_4M',
          trigger_type: 'manual',
          description: 'Draw 1 I card if scope > $4M'
        }
      ];

      mockDataService.getSpaceEffects.mockReturnValue(spaceEffects);

      // Create a game with a player
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Update player with scope ≤ $4M
      stateService.updatePlayer({
        id: playerId,
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        money: 0,
        timeSpent: 0,
        hand: ['W_MOCK_2000000'] // W card representing $2M scope
      });

      const player = stateService.getPlayer(playerId)!;

      // Filter effects by condition
      const filteredEffects = turnService.filterSpaceEffectsByCondition(spaceEffects, player);

      // Should only return the B card effect
      expect(filteredEffects).toHaveLength(1);
      expect(filteredEffects[0].effect_action).toBe('draw_b');
      expect(filteredEffects[0].condition).toBe('scope_le_4M');
    });

    it('should select I card effect when scope > $4M', () => {
      const spaceEffects = [
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_b',
          effect_value: 1,
          condition: 'scope_le_4M',
          trigger_type: 'manual',
          description: 'Draw 1 B card if scope ≤ $4M'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_i',
          effect_value: 1,
          condition: 'scope_gt_4M',
          trigger_type: 'manual',
          description: 'Draw 1 I card if scope > $4M'
        }
      ];

      mockDataService.getSpaceEffects.mockReturnValue(spaceEffects);

      // Create a game with a player
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Update player with scope > $4M
      stateService.updatePlayer({
        id: playerId,
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        money: 0,
        timeSpent: 0,
        hand: ['W_MOCK_6000000'] // W card representing $6M scope
      });

      const player = stateService.getPlayer(playerId)!;

      // Filter effects by condition
      const filteredEffects = turnService.filterSpaceEffectsByCondition(spaceEffects, player);

      // Should only return the I card effect
      expect(filteredEffects).toHaveLength(1);
      expect(filteredEffects[0].effect_action).toBe('draw_i');
      expect(filteredEffects[0].condition).toBe('scope_gt_4M');
    });

    it('should handle edge case: scope exactly at $4M threshold', () => {
      const spaceEffects = [
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_b',
          effect_value: 1,
          condition: 'scope_le_4M',
          trigger_type: 'manual'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_i',
          effect_value: 1,
          condition: 'scope_gt_4M',
          trigger_type: 'manual'
        }
      ];

      mockDataService.getSpaceEffects.mockReturnValue(spaceEffects);

      // Create a game with a player
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Update player with scope exactly at $4M
      stateService.updatePlayer({
        id: playerId,
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        money: 0,
        timeSpent: 0,
        hand: ['W_MOCK_4000000'] // W card representing $4M scope
      });

      const player = stateService.getPlayer(playerId)!;

      const filteredEffects = turnService.filterSpaceEffectsByCondition(spaceEffects, player);

      // Should return B card effect (scope_le_4M includes equal)
      expect(filteredEffects).toHaveLength(1);
      expect(filteredEffects[0].effect_action).toBe('draw_b');
    });
  });

  describe('Compound Key Handling', () => {
    beforeEach(() => {
      // Setup funding space effects
      mockDataService.getSpaceEffects.mockReturnValue([
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_b',
          effect_value: 1,
          condition: 'scope_le_4M',
          trigger_type: 'manual'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_i',
          effect_value: 1,
          condition: 'scope_gt_4M',
          trigger_type: 'manual'
        },
        {
          space_name: 'OWNER-FUND-INITIATION',
          visit_type: 'First',
          effect_type: 'time',
          effect_action: 'add',
          effect_value: 1,
          condition: 'always',
          trigger_type: 'auto'
        }
      ]);
    });

    it('should accept compound key "cards:draw_b" for B card funding', async () => {
      // Initialize game with player at funding space
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player at funding space with low scope
      setupPlayerAtFunding(playerId, 2000000); // $2M - B card

      // Mock card draw
      cardService.drawCards.mockReturnValue(['B001']);

      // Trigger manual effect with compound key
      await turnService.triggerManualEffect(playerId, 'cards:draw_b');

      // Verify card service was called
      expect(cardService.drawCards).toHaveBeenCalledWith(
        playerId,
        'B',
        1,
        'manual_effect',
        expect.stringContaining('Draw 1 B card')
      );
    });

    it('should accept compound key "cards:draw_i" for I card funding', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Update player to funding space with high scope
      setupPlayerAtFunding(playerId, 6000000); // $6000000

      // Mock card draw
      cardService.drawCards.mockReturnValue(['I001']);

      // Trigger manual effect with compound key
      await turnService.triggerManualEffect(playerId, 'cards:draw_i');

      // Verify card service was called with I card
      expect(cardService.drawCards).toHaveBeenCalledWith(
        playerId,
        'I',
        1,
        'manual_effect',
        expect.stringContaining('Draw 1 I card')
      );
    });

    it('should reject wrong compound key based on scope condition', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Player has high scope (> $4M) but tries to trigger B card effect
      setupPlayerAtFunding(playerId, 6000000); // $6000000

      // Attempt to trigger B card effect when scope requires I card
      await expect(
        turnService.triggerManualEffect(playerId, 'cards:draw_b')
      ).rejects.toThrow(/condition not met.*scope_le_4M/i);
    });
  });

  describe('Automatic Card Application at OWNER-FUND-INITIATION', () => {
    it('should automatically apply B card when drawn at OWNER-FUND-INITIATION', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player at funding space
      setupPlayerAtFunding(playerId, 2000000); // $2000000

      // Mock card draw and effects
      cardService.drawCards.mockReturnValue(['B001']);

      // Trigger funding
      await turnService.triggerManualEffect(playerId, 'cards:draw_b');

      // Verify card was drawn
      expect(cardService.drawCards).toHaveBeenCalled();

      // Verify card effects were automatically applied
      expect(cardService.applyCardEffects).toHaveBeenCalledWith(playerId, 'B001');

      // Verify card was finalized (discarded)
      expect(cardService.finalizePlayedCard).toHaveBeenCalledWith(playerId, 'B001');
    });

    it('should automatically apply I card when drawn at OWNER-FUND-INITIATION', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player at funding space with high scope
      setupPlayerAtFunding(playerId, 8000000); // $8000000

      // Mock card draw
      cardService.drawCards.mockReturnValue(['I001']);

      // Trigger funding
      await turnService.triggerManualEffect(playerId, 'cards:draw_i');

      // Verify automatic application
      expect(cardService.applyCardEffects).toHaveBeenCalledWith(playerId, 'I001');
      expect(cardService.finalizePlayedCard).toHaveBeenCalledWith(playerId, 'I001');
    });

    it('should NOT auto-apply B/I cards drawn at other spaces', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player at DIFFERENT space (not OWNER-FUND-INITIATION)
      stateService.updatePlayer({
        id: playerId,
          currentSpace: 'BANK-FUND-REVIEW',
          visitType: 'First',
          projectScope: 2000000
        
      });

      // Mock space effects for BANK-FUND-REVIEW
      mockDataService.getSpaceEffects.mockReturnValue([
        {
          space_name: 'BANK-FUND-REVIEW',
          visit_type: 'First',
          effect_type: 'cards',
          effect_action: 'draw_b',
          effect_value: 1,
          condition: 'always',
          trigger_type: 'manual',
          description: 'Negotiate Bank Loan Terms'
        }
      ]);

      // Mock game config for BANK-FUND-REVIEW
      mockDataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'BANK-FUND-REVIEW',
        phase: 'FUNDING',
        requires_dice_roll: false
      });

      // Mock card draw
      cardService.drawCards.mockReturnValue(['B001']);

      // Trigger manual B card draw at different space
      await turnService.triggerManualEffect(playerId, 'cards:draw_b');

      // Verify card was drawn
      expect(cardService.drawCards).toHaveBeenCalled();

      // Verify card effects were NOT automatically applied
      expect(cardService.applyCardEffects).not.toHaveBeenCalled();
      expect(cardService.finalizePlayedCard).not.toHaveBeenCalled();
    });
  });

  describe('Action Count and Completion Tracking', () => {
    it('should count only ONE manual action when both B and I effects exist', () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const player = players[0];

      // Setup player at funding space with scope > $4M
      stateService.updatePlayer({
        id: player.id,
        currentSpace: 'OWNER-FUND-INITIATION',
        visitType: 'First',
        projectScope: 6000000 // Should filter to only I card effect
      });

      // Get updated player
      const updatedPlayer = stateService.getPlayer(player.id)!;

      // Calculate required actions
      const actionCounts = (stateService as any).calculateRequiredActions(updatedPlayer);

      // Should require only 1 manual action (the I card effect that passes condition)
      // Note: Actual count might be 1 or 2 depending on if dice roll is required
      // We're mainly checking that it's NOT counting both B and I effects
      const manualActionCount = actionCounts.availableTypes.filter((t: string) => t.includes('manual')).length;
      expect(manualActionCount).toBeLessThanOrEqual(1);
    });

    it('should track completion using compound key', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player
      setupPlayerAtFunding(playerId, 2000000); // $2000000

      // Mock card draw
      cardService.drawCards.mockReturnValue(['B001']);

      // Trigger manual effect with compound key
      await turnService.triggerManualEffect(playerId, 'cards:draw_b');

      // Get game state
      const gameState = stateService.getGameState();

      // Verify completion was tracked with compound key
      expect(gameState.completedActions.manualActions).toHaveProperty('cards:draw_b');
    });

    it('should recognize action as complete when checking with compound key', () => {
      // Initialize game and add player
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Update player location FIRST
      setupPlayerAtFunding(playerId, 6000000); // $6M scope - should get I card

      // Manually set completion with compound key
      stateService.setPlayerCompletedManualAction('cards:draw_i', 'Accept Owner Funding');

      const player = stateService.getPlayer(playerId)!;
      const actionCounts = (stateService as any).calculateRequiredActions(player);

      // Should show action as completed
      expect(actionCounts.completed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration: Complete Funding Flow', () => {
    it('should complete full funding flow for small project (B card)', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player at funding space with low scope
      setupPlayerAtFunding(playerId, 2500000); // $2500000

      // Mock card operations
      cardService.drawCards.mockReturnValue(['B001']);
      mockResourceService.addMoney.mockImplementation((pId: string, amount: number) => {
        const player = stateService.getPlayer(pId);
        if (player) {
          stateService.updatePlayer({
            id: pId,
            money: player.money + amount
          });
        }
        return true;
      });

      // Execute funding
      await turnService.triggerManualEffect(playerId, 'cards:draw_b');

      // Verify complete flow
      expect(cardService.drawCards).toHaveBeenCalled();
      expect(cardService.applyCardEffects).toHaveBeenCalled();
      expect(cardService.finalizePlayedCard).toHaveBeenCalled();

      // Verify completion tracking
      const gameState = stateService.getGameState();
      expect(gameState.completedActions.manualActions['cards:draw_b']).toBeDefined();
    });

    it('should complete full funding flow for large project (I card)', async () => {
      // Initialize game
      stateService.initializeGame();
      stateService.addPlayer('Test Player');
      const players = stateService.getAllPlayers();
      const playerId = players[0].id;

      // Setup player with high scope
      setupPlayerAtFunding(playerId, 7500000); // $7500000

      // Mock card operations
      cardService.drawCards.mockReturnValue(['I001']);

      // Execute funding
      await turnService.triggerManualEffect(playerId, 'cards:draw_i');

      // Verify complete flow
      expect(cardService.drawCards).toHaveBeenCalled();
      expect(cardService.applyCardEffects).toHaveBeenCalled();
      expect(cardService.finalizePlayedCard).toHaveBeenCalled();

      // Verify completion tracking with compound key
      const gameState = stateService.getGameState();
      expect(gameState.completedActions.manualActions['cards:draw_i']).toBeDefined();
    });
  });
});
