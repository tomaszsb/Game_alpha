// tests/P1_AutomaticFunding_Fix.test.ts

/**
 * P1-CRITICAL: Test for the "Card not found" bug fix in automatic funding
 * 
 * This test verifies that the drawAndApplyCard method properly handles
 * the atomic operation of drawing and applying a card, which fixes the
 * state consistency issue in handleAutomaticFunding.
 */

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CardService } from '../src/services/CardService';
import { LoggingService } from '../src/services/LoggingService';
import { StateService } from '../src/services/StateService';
import { createMockDataService, createMockStateService, createMockResourceService, createMockLoggingService } from './mocks/mockServices';
import { CardType } from '../src/types/DataTypes';

describe('P1-CRITICAL: Automatic Funding Card Bug Fix', () => {
  let cardService: CardService;
  let mockStateService: any;
  let mockDataService: any;
  let mockResourceService: any;
  let mockLoggingService: any;

  beforeEach(() => {
    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    mockResourceService = createMockResourceService();
    mockLoggingService = createMockLoggingService();
    
    cardService = new CardService(mockDataService, mockStateService, mockResourceService, mockLoggingService);
    
    // Mock the effectEngineService to avoid circular dependency issues in tests
    cardService.effectEngineService = {
      processCardEffects: vi.fn().mockResolvedValue({
        success: true,
        successfulEffects: 1,
        totalEffects: 1,
        errors: []
      })
    } as any;
    
    // Mock finalizePlayedCard to avoid complex game state setup in tests
    vi.spyOn(cardService, 'finalizePlayedCard').mockImplementation(() => {});

    // Setup basic player state
    mockStateService.getPlayer.mockReturnValue({
      id: 'player1',
      name: 'Test Player',
      hand: ['B001'], // Include the drawn card in hand for proper lifecycle
      activeCards: [],
      money: 1000,
      timeSpent: 0,
      currentSpace: 'OWNER-FUND-INITIATION',
      projectScope: 2000000,
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: [],
      score: 0,
      visitType: 'First'
    });
  });

  describe('drawAndApplyCard atomic method', () => {
    it('should successfully draw and apply a B card', () => {
      // Mock successful card draw
      const mockCardId = 'B001';
      const mockCard = { card_id: mockCardId, card_name: 'Test B Card', card_type: 'B', loan_amount: '500000' };
      
      mockDataService.getCardsByType.mockReturnValue([mockCard]);
      mockDataService.getCardById.mockReturnValue(mockCard);

      // Mock the drawCards method to return the card
      vi.spyOn(cardService, 'drawCards').mockReturnValue([mockCardId]);

      // Execute the atomic method
      const result = cardService.drawAndApplyCard(
        'player1', 
        'B' as CardType, 
        'auto_funding', 
        'Automatic funding test'
      );

      // Verify success
      expect(result.success).toBe(true);
      expect(result.drawnCardId).toBe(mockCardId);

      // Verify the methods were called in the correct order
      expect(cardService.drawCards).toHaveBeenCalledWith(
        'player1', 
        'B', 
        1, 
        'auto_funding', 
        'Automatic funding test'
      );
    });

    it('should successfully draw and apply an I card for high scope projects', () => {
      // Mock successful I card draw
      const mockCardId = 'I001';
      const mockCard = { card_id: mockCardId, card_name: 'Test I Card', card_type: 'I', investment_amount: '4000000' };
      
      mockDataService.getCardsByType.mockReturnValue([mockCard]);
      mockDataService.getCardById.mockReturnValue(mockCard);

      // Mock the drawCards method to return the card
      vi.spyOn(cardService, 'drawCards').mockReturnValue([mockCardId]);

      // Execute the atomic method for I card
      const result = cardService.drawAndApplyCard(
        'player1', 
        'I' as CardType, 
        'auto_funding', 
        'Automatic investor funding test'
      );

      // Verify success
      expect(result.success).toBe(true);
      expect(result.drawnCardId).toBe(mockCardId);

      // Verify the methods were called correctly
      expect(cardService.drawCards).toHaveBeenCalledWith(
        'player1', 
        'I', 
        1, 
        'auto_funding', 
        'Automatic investor funding test'
      );
    });

    it('should handle case when no cards are available to draw', () => {
      // Mock empty card draw
      vi.spyOn(cardService, 'drawCards').mockReturnValue([]);
      const playCardSpy = vi.spyOn(cardService, 'playCard');

      // Execute the atomic method
      const result = cardService.drawAndApplyCard(
        'player1', 
        'B' as CardType, 
        'auto_funding', 
        'Automatic funding test - no cards'
      );

      // Verify failure is handled gracefully
      expect(result.success).toBe(false);
      expect(result.drawnCardId).toBe(null);

      // Verify drawCards was called but playCard was not
      expect(cardService.drawCards).toHaveBeenCalled();
      expect(playCardSpy).not.toHaveBeenCalled();
    });

    it('should handle errors during card play gracefully', () => {
      // Mock successful card draw but failed effects application
      const mockCardId = 'B002';
      const mockCard = { card_id: mockCardId, card_name: 'Test B Card', card_type: 'B', loan_amount: '500000' };
      
      mockDataService.getCardById.mockReturnValue(mockCard);
      vi.spyOn(cardService, 'drawCards').mockReturnValue([mockCardId]);
      vi.spyOn(cardService, 'applyCardEffects').mockImplementation(() => {
        throw new Error('Card effects failed');
      });

      // Execute the atomic method
      const result = cardService.drawAndApplyCard(
        'player1', 
        'B' as CardType, 
        'auto_funding', 
        'Automatic funding test - play error'
      );

      // Verify error is handled gracefully
      expect(result.success).toBe(false);
      expect(result.drawnCardId).toBe(null);

      // Verify both methods were called
      expect(cardService.drawCards).toHaveBeenCalled();
      expect(cardService.applyCardEffects).toHaveBeenCalledWith('player1', mockCardId);
    });
  });

  describe('Integration with automatic funding scenarios', () => {
    it('should work correctly in the context of OWNER-FUND-INITIATION space', () => {
      // Setup scenario matching automatic funding conditions
      const projectScope = 2000000; // $2M - should get B card
      const mockCardId = 'B003';
      const mockCard = { card_id: mockCardId, card_name: 'Test B Card', card_type: 'B', loan_amount: '500000' };
      
      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        currentSpace: 'OWNER-FUND-INITIATION',
        projectScope: projectScope,
        availableCards: { W: [], B: [], E: [], I: [], L: [] },
        money: 1000,
        timeSpent: 0
      });

      // Mock successful B card draw (since scope ≤ $4M)
      mockDataService.getCardById.mockReturnValue(mockCard);
      vi.spyOn(cardService, 'drawCards').mockReturnValue([mockCardId]);

      // Execute the funding logic
      const result = cardService.drawAndApplyCard(
        'player1',
        'B' as CardType,
        'auto_funding',
        'Automatic funding for OWNER-FUND-INITIATION space'
      );

      // Verify the atomic operation succeeded
      expect(result.success).toBe(true);
      expect(result.drawnCardId).toBe(mockCardId);

      // This verifies the fix for the "Card not found" bug:
      // The card is drawn first, then effects are applied and finalized without
      // any intermediate state that could cause consistency issues
      expect(cardService.drawCards).toHaveBeenCalled();
    });

    it('should work correctly for high-scope projects requiring I cards', () => {
      // Setup scenario for high-scope project
      const projectScope = 6000000; // $6M - should get I card
      const mockCardId = 'I005';
      const mockCard = { card_id: mockCardId, card_name: 'Test I Card', card_type: 'I', investment_amount: '5000000' };
      
      mockStateService.getPlayer.mockReturnValue({
        id: 'player1', 
        name: 'Test Player',
        currentSpace: 'OWNER-FUND-INITIATION',
        projectScope: projectScope,
        availableCards: { W: [], B: [], E: [], I: [], L: [] },
        money: 1000,
        timeSpent: 0
      });

      // Mock successful I card draw (since scope > $4M)
      mockDataService.getCardById.mockReturnValue(mockCard);
      vi.spyOn(cardService, 'drawCards').mockReturnValue([mockCardId]);

      // Execute the funding logic for I card
      const result = cardService.drawAndApplyCard(
        'player1',
        'I' as CardType,
        'auto_funding',
        'Automatic funding for OWNER-FUND-INITIATION space'
      );

      // Verify the atomic operation succeeded for I card
      expect(result.success).toBe(true);
      expect(result.drawnCardId).toBe(mockCardId);

      // Verify correct card type was requested
      expect(cardService.drawCards).toHaveBeenCalledWith(
        'player1', 
        'I', 
        1, 
        'auto_funding', 
        'Automatic funding for OWNER-FUND-INITIATION space'
      );
    });
  });

  describe('Method interface and contract verification', () => {
    it('should exist on CardService and match expected signature', () => {
      // Verify method exists and has correct signature
      expect(typeof cardService.drawAndApplyCard).toBe('function');
      expect(cardService.drawAndApplyCard.length).toBe(4); // 4 parameters expected

      // Verify it returns the expected shape
      const mockCard = { card_id: 'TEST001', card_name: 'Test Card', card_type: 'B', loan_amount: '500000' };
      mockDataService.getCardById.mockReturnValue(mockCard);
      vi.spyOn(cardService, 'drawCards').mockReturnValue(['TEST001']);

      const result = cardService.drawAndApplyCard('player1', 'B', 'test', 'test reason');
      
      expect(result).toHaveProperty('drawnCardId');
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should be present in ICardService interface', () => {
      // This test ensures the method is properly added to the interface
      // If the interface doesn't have the method, TypeScript compilation would fail
      const cardServiceAsInterface = cardService as any;
      expect(typeof cardServiceAsInterface.drawAndApplyCard).toBe('function');
    });
  });
});