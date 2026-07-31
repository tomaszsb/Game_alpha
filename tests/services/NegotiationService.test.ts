import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NegotiationService } from '../../src/services/NegotiationService';
import { NegotiationState } from '../../src/types/StateTypes';

describe('NegotiationService', () => {
  let negotiationService: NegotiationService;
  let mockStateService: any;
  let mockEffectEngineService: any;
  let mockResourceService: any;
  let mockChoiceService: any;

  const mockPlayerId = 'player1';
  const mockTargetPlayerId = 'player2';
  let mockPlayer: any;
  let mockTargetPlayer: any;
  let mockGameState: any;

  beforeEach(() => {
    mockPlayer = {
      id: mockPlayerId,
      name: 'Test Player',
      hand: ['card1', 'card2', 'card3'],
      money: 100,
    };
    mockTargetPlayer = {
      id: mockTargetPlayerId,
      name: 'Target Player',
      hand: ['card4', 'card5'],
      money: 150,
    };
    mockGameState = {
      players: [mockPlayer, mockTargetPlayer],
      currentPlayer: mockPlayerId,
      activeNegotiation: null
    };

    mockStateService = {
      getGameState: vi.fn().mockImplementation(() => mockGameState),
      getPlayer: vi.fn().mockImplementation((playerId: string) => {
        if (playerId === mockPlayerId) return mockPlayer;
        if (playerId === mockTargetPlayerId) return mockTargetPlayer;
        return undefined;
      }),
      updateNegotiationState: vi.fn(),
      updatePlayer: vi.fn(),
    };

    mockEffectEngineService = {
      processEffects: vi.fn().mockResolvedValue({ success: true }),
    };

    mockResourceService = {
      spendMoney: vi.fn().mockReturnValue(true),
      addMoney: vi.fn().mockReturnValue(true),
    };

    mockChoiceService = {
      createChoice: vi.fn().mockResolvedValue('accept'),
    };

    negotiationService = new NegotiationService(
      mockStateService,
      mockEffectEngineService,
      mockResourceService,
      mockChoiceService
    );
  });

  describe('initiateNegotiation', () => {
    it('should initiate a negotiation with the chosen partner and update the game state', async () => {
      const result = await negotiationService.initiateNegotiation(mockPlayerId, mockTargetPlayerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('started successfully');
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(
        expect.objectContaining({
          initiatorId: mockPlayerId,
          partnerId: mockTargetPlayerId,
          status: 'pending',
        })
      );
    });

    it('should fail if there is already an active negotiation', async () => {
      const existingNegotiation: NegotiationState = {
        negotiationId: 'existing-negotiation',
        initiatorId: 'other-player',
        partnerId: mockTargetPlayerId,
        status: 'pending',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        offers: []
      };
      mockGameState.activeNegotiation = existingNegotiation;

      const result = await negotiationService.initiateNegotiation(mockPlayerId, mockTargetPlayerId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Another negotiation is already in progress');
      expect(mockStateService.updateNegotiationState).not.toHaveBeenCalled();
    });

    it('should fail if the partner does not exist', async () => {
      const result = await negotiationService.initiateNegotiation(mockPlayerId, 'ghost-player');

      expect(result.success).toBe(false);
      expect(mockStateService.updateNegotiationState).not.toHaveBeenCalled();
    });
  });

  describe('makeOffer', () => {
    beforeEach(() => {
      const activeNegotiation: NegotiationState = {
        negotiationId: 'test-negotiation',
        initiatorId: mockPlayerId,
        partnerId: mockTargetPlayerId,
        status: 'pending',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        offers: []
      };
      mockGameState.activeNegotiation = activeNegotiation;
    });

    it('should ask the partner via ChoiceService and deliver cards + money on accept', async () => {
      mockChoiceService.createChoice.mockResolvedValue('accept');

      const result = await negotiationService.makeOffer(mockPlayerId, { money: 50, cards: ['card1', 'card2'] });

      // Asked the PARTNER, not the initiator — same mechanism PLAYER_AGREEMENT_REQUIRED
      // and E009's opponent picker use.
      expect(mockChoiceService.createChoice).toHaveBeenCalledWith(
        mockTargetPlayerId,
        'GENERAL',
        expect.stringContaining('Accept?'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'accept' }),
          expect.objectContaining({ id: 'decline' }),
        ])
      );

      // Cards removed from initiator's hand at offer time
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockPlayerId, hand: ['card3'] })
      );

      // Money actually moves (previously silently dropped)
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(mockPlayerId, 50, 'negotiation', expect.any(String));
      expect(mockResourceService.addMoney).toHaveBeenCalledWith(mockTargetPlayerId, 50, 'negotiation', expect.any(String));

      // Cards actually delivered to the partner (previously never happened)
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockTargetPlayerId,
          hand: expect.arrayContaining(['card4', 'card5', 'card1', 'card2'])
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ accepted: true }));
      expect(mockStateService.updateNegotiationState).toHaveBeenLastCalledWith(null);
    });

    it('should return the offered cards to the initiator on decline and move no money', async () => {
      mockChoiceService.createChoice.mockResolvedValue('decline');

      const result = await negotiationService.makeOffer(mockPlayerId, { money: 50, cards: ['card1'] });

      expect(mockResourceService.spendMoney).not.toHaveBeenCalled();
      expect(mockResourceService.addMoney).not.toHaveBeenCalled();

      // Cards restored to the initiator (previously lost forever on decline)
      expect(mockStateService.updatePlayer).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: mockPlayerId, hand: expect.arrayContaining(['card1', 'card2', 'card3']) })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ accepted: false }));
      expect(mockStateService.updateNegotiationState).toHaveBeenLastCalledWith(null);
    });

    it('should fail if no active negotiation exists', async () => {
      mockGameState.activeNegotiation = null;

      const result = await negotiationService.makeOffer(mockPlayerId, { cards: ['card1'] });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No active negotiation to make offer in');
      expect(mockChoiceService.createChoice).not.toHaveBeenCalled();
    });

    it('should fail if player does not own the offered cards', async () => {
      const result = await negotiationService.makeOffer(mockPlayerId, { cards: ['card_not_owned'] });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Player does not own card');
      expect(mockChoiceService.createChoice).not.toHaveBeenCalled();
    });

    it('should still deliver cards but skip the money transfer if the initiator can no longer afford it by accept time', async () => {
      mockChoiceService.createChoice.mockResolvedValue('accept');
      mockResourceService.spendMoney.mockReturnValue(false);

      await negotiationService.makeOffer(mockPlayerId, { money: 999999, cards: ['card1'] });

      expect(mockResourceService.addMoney).not.toHaveBeenCalled();
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockTargetPlayerId, hand: expect.arrayContaining(['card1']) })
      );
    });
  });

  describe('acceptOffer / declineOffer', () => {
    it('acceptOffer is a harmless no-op — accept/decline now resolves inline inside makeOffer', async () => {
      const result = await negotiationService.acceptOffer(mockPlayerId);
      expect(result.success).toBe(true);
    });

    it('declineOffer is a harmless no-op — accept/decline now resolves inline inside makeOffer', async () => {
      const result = await negotiationService.declineOffer(mockPlayerId);
      expect(result.success).toBe(true);
    });
  });

  describe('cancelNegotiation', () => {
    it('should cancel a negotiation and restore player states from snapshots', async () => {
      const negotiationId = 'test-negotiation-id';
      const activeNegotiation: NegotiationState = {
        negotiationId,
        initiatorId: mockPlayerId,
        partnerId: mockTargetPlayerId,
        status: 'in_progress',
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        playerSnapshots: [{
          id: mockPlayerId,
          hand: ['card1', 'card2'],
          negotiationOffer: ['card1']
        }]
      };
      mockGameState.activeNegotiation = activeNegotiation;

      const result = await negotiationService.cancelNegotiation(negotiationId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled successfully');
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockPlayerId, hand: expect.arrayContaining(['card1', 'card2']) })
      );
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(null);
    });

    it('should fail if negotiation does not exist', async () => {
      mockGameState.activeNegotiation = null;

      const result = await negotiationService.cancelNegotiation('non-existent-negotiation');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No active negotiation');
    });
  });

  describe('completeNegotiation', () => {
    it('should complete a negotiation and clear it', async () => {
      const negotiationId = 'test-negotiation-id';
      const activeNegotiation: NegotiationState = {
        negotiationId,
        initiatorId: mockPlayerId,
        partnerId: mockTargetPlayerId,
        status: 'in_progress',
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      };
      mockGameState.activeNegotiation = activeNegotiation;

      const result = await negotiationService.completeNegotiation(negotiationId, { termsAccepted: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('completed successfully');
      expect(mockStateService.updateNegotiationState).toHaveBeenCalledWith(null);
    });
  });

  describe('getActiveNegotiation / hasActiveNegotiation', () => {
    it('should return the active negotiation if one exists', () => {
      const activeNegotiation: NegotiationState = {
        negotiationId: 'test-negotiation',
        initiatorId: mockPlayerId,
        partnerId: mockTargetPlayerId,
        status: 'pending',
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      };
      mockGameState.activeNegotiation = activeNegotiation;

      expect(negotiationService.getActiveNegotiation()).toEqual(activeNegotiation);
      expect(negotiationService.hasActiveNegotiation()).toBe(true);
    });

    it('should return null/false if no active negotiation exists', () => {
      mockGameState.activeNegotiation = null;

      expect(negotiationService.getActiveNegotiation()).toBeNull();
      expect(negotiationService.hasActiveNegotiation()).toBe(false);
    });
  });
});
