import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NegotiationService } from '../../src/services/NegotiationService';
import { IStateService, IEffectEngineService } from '../../src/types/ServiceContracts';
import { NegotiationResult, NegotiationState } from '../../src/types/StateTypes';

describe('NegotiationService', () => {
  let negotiationService: NegotiationService;
  let mockStateService: any;
  let mockEffectEngineService: any;

  // Mock data
  const mockPlayerId = 'player1';
  const mockTargetPlayerId = 'player2';
  const mockPlayer = {
    id: mockPlayerId,
    name: 'Test Player',
    hand: ['card1', 'card2', 'card3'],
    money: 100,
    timeRemaining: 120
  };
  const mockTargetPlayer = {
    id: mockTargetPlayerId,
    name: 'Target Player',
    hand: ['card4', 'card5'],
    money: 150,
    timeRemaining: 100
  };
  const mockGameState = {
    players: [mockPlayer, mockTargetPlayer],
    currentPlayer: mockPlayerId,
    activeNegotiation: null
  };

  beforeEach(() => {
    // Create comprehensive mocks for dependencies
    mockStateService = {
      getGameState: vi.fn().mockReturnValue(mockGameState),
      getGameStateDeepCopy: vi.fn().mockReturnValue(JSON.parse(JSON.stringify(mockGameState))),
      getPlayer: vi.fn().mockImplementation((playerId: string) => {
        return playerId === mockPlayerId ? mockPlayer : mockTargetPlayer;
      }),
      getAllPlayers: vi.fn().mockReturnValue([mockPlayer, mockTargetPlayer]),
      updateNegotiationState: vi.fn(),
      updatePlayer: vi.fn(),
      logToActionHistory: vi.fn()
    };

    mockEffectEngineService = {
      processEffects: vi.fn().mockResolvedValue({ success: true }),
      processEffect: vi.fn().mockResolvedValue({ success: true }),
      validateEffect: vi.fn().mockReturnValue(true),
      validateEffects: vi.fn().mockReturnValue(true)
    };

    // Initialize service with mocked dependencies
    negotiationService = new NegotiationService(mockStateService, mockEffectEngineService);
  });

  describe('initiateNegotiation', () => {
    it('should initiate a negotiation and update the game state', async () => {
      // Arrange
      const context = {
        targetPlayerId: mockTargetPlayerId,
        type: 'card_exchange'
      };

      // Act
      const result = await negotiationService.initiateNegotiation(mockPlayerId, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('started successfully');
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(
        expect.objectContaining({
          initiatorId: mockPlayerId,
          status: 'pending',
          context: context
        })
      );
    });

    it('should fail if there is already an active negotiation', async () => {
      // Arrange
      const existingNegotiation: NegotiationState = {
        negotiationId: 'existing-negotiation',
        initiatorId: 'other-player',
        status: 'pending',
        context: { type: 'existing' },
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        offers: []
      };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: existingNegotiation
      });

      const context = {
        targetPlayerId: mockTargetPlayerId,
        type: 'card_exchange'
      };

      // Act
      const result = await negotiationService.initiateNegotiation(mockPlayerId, context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Another negotiation is already in progress');
      expect(mockStateService.updateNegotiationState).not.toHaveBeenCalled();
    });
  });

  describe('makeOffer', () => {
    beforeEach(() => {
      // Set up an active negotiation for offer tests
      const activeNegotiation: NegotiationState = {
        negotiationId: 'test-negotiation',
        initiatorId: mockPlayerId,
        status: 'pending',
        context: { type: 'card_exchange' },
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        offers: []
      };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: activeNegotiation
      });
    });

    it('should allow a player to make a card offer in an active negotiation', async () => {
      // Arrange
      const offer = {
        cards: ['card1', 'card2']
      };

      // Act
      const result = await negotiationService.makeOffer(mockPlayerId, offer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Offer made successfully');
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_progress',
          offers: expect.arrayContaining([
            expect.objectContaining({
              playerId: mockPlayerId,
              offerData: { cards: ['card1', 'card2'] }
            })
          ])
        })
      );
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPlayerId,
          hand: ['card3'] // Remaining cards after offering card1 and card2
        })
      );
    });

    it('should fail if no active negotiation exists', async () => {
      // Arrange
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: null
      });

      const offer = {
        cards: ['card1']
      };

      // Act
      const result = await negotiationService.makeOffer(mockPlayerId, offer);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active negotiation to make offer in');
      expect(mockStateService.updateNegotiationState).not.toHaveBeenCalled();
    });

    it('should fail if player does not own the offered cards', async () => {
      // Arrange
      const offer = {
        cards: ['card_not_owned', 'another_missing_card']
      };

      // Act
      const result = await negotiationService.makeOffer(mockPlayerId, offer);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Player does not own card');
      expect(mockStateService.updateNegotiationState).not.toHaveBeenCalled();
    });
  });

  describe('acceptOffer', () => {
    it('should accept an offer successfully', async () => {
      // Act
      const result = await negotiationService.acceptOffer(mockPlayerId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Offer accepted successfully');
      expect(result.data?.accepted).toBe(true);
    });
  });

  describe('declineOffer', () => {
    it('should decline an offer successfully', async () => {
      // Act
      const result = await negotiationService.declineOffer(mockPlayerId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Offer declined');
      expect(result.data?.declined).toBe(true);
    });
  });

  describe('cancelNegotiation', () => {
    it('should cancel negotiation and restore player states', async () => {
      // Arrange
      const negotiationId = 'test-negotiation-id';
      const activeNegotiation: NegotiationState = {
        negotiationId: negotiationId,
        initiatorId: mockPlayerId,
        status: 'in_progress',
        context: { type: 'card_exchange' },
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        playerSnapshots: [{
          id: mockPlayerId,
          hand: ['card1', 'card2'],
          negotiationOffer: ['card1']
        }]
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: activeNegotiation
      });

      // Act
      const result = await negotiationService.cancelNegotiation(negotiationId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled successfully');
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPlayerId,
          hand: expect.arrayContaining(['card1', 'card2']) // Cards restored
        })
      );
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(null);
    });

    it('should fail if negotiation does not exist', async () => {
      // Arrange
      const negotiationId = 'non-existent-negotiation';
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: null
      });

      // Act
      const result = await negotiationService.cancelNegotiation(negotiationId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active negotiation');
    });
  });

  describe('completeNegotiation', () => {
    it('should complete negotiation successfully', async () => {
      // Arrange
      const negotiationId = 'test-negotiation-id';
      const agreement = { termsAccepted: true };
      const activeNegotiation: NegotiationState = {
        negotiationId: negotiationId,
        initiatorId: mockPlayerId,
        status: 'in_progress',
        context: { type: 'card_exchange' },
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: activeNegotiation
      });

      // Act
      const result = await negotiationService.completeNegotiation(negotiationId, agreement);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('completed successfully');
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(null);
    });
  });

  describe('getActiveNegotiation', () => {
    it('should return active negotiation if exists', () => {
      // Arrange
      const activeNegotiation: NegotiationState = {
        negotiationId: 'test-negotiation',
        initiatorId: mockPlayerId,
        status: 'pending',
        context: { type: 'card_exchange' },
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: activeNegotiation
      });

      // Act
      const result = negotiationService.getActiveNegotiation();

      // Assert
      expect(result).toEqual(activeNegotiation);
    });

    it('should return null if no active negotiation', () => {
      // Arrange
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: null
      });

      // Act
      const result = negotiationService.getActiveNegotiation();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('hasActiveNegotiation', () => {
    it('should return true if active negotiation exists', () => {
      // Arrange
      const activeNegotiation: NegotiationState = {
        negotiationId: 'test-negotiation',
        initiatorId: mockPlayerId,
        status: 'pending',
        context: { type: 'card_exchange' },
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: activeNegotiation
      });

      // Act & Assert
      expect(negotiationService.hasActiveNegotiation()).toBe(true);
    });

    it('should return false if no active negotiation', () => {
      // Arrange
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        activeNegotiation: null
      });

      // Act & Assert
      expect(negotiationService.hasActiveNegotiation()).toBe(false);
    });
  });
});