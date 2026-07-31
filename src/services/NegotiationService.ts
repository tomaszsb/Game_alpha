// src/services/NegotiationService.ts

import { IStateService, IEffectEngineService, IResourceService, IChoiceService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { NegotiationResult, NegotiationState, Player } from '../types/StateTypes';

/**
 * Negotiation Service
 *
 * This service manages the state and logic of negotiation events between players.
 * It handles the creation, progression, and resolution of negotiations: an offer
 * (money + cards) proposed by the initiator, and a single accept/decline response
 * from the partner — no counter-offers in this version.
 *
 * The service is designed to be self-contained and can be triggered from space actions,
 * card effects, or other game events that require player-to-player negotiations.
 *
 * The partner's accept/decline goes through ChoiceService/ChoiceModal — the same
 * proven mechanism already used to ask a non-current-turn player a yes/no question
 * (see EffectEngineService's PLAYER_AGREEMENT_REQUIRED case, and E009's own
 * opponent picker in CardService) — rather than a bespoke per-tab sync, since that
 * mechanism already handles per-phone vs. shared-screen viewing correctly.
 */
export class NegotiationService {
  private stateService: IStateService;
  private effectEngineService: IEffectEngineService;
  private resourceService: IResourceService;
  private choiceService: IChoiceService;

  constructor(
    stateService: IStateService,
    effectEngineService: IEffectEngineService,
    resourceService: IResourceService,
    choiceService: IChoiceService
  ) {
    this.stateService = stateService;
    this.effectEngineService = effectEngineService;
    this.resourceService = resourceService;
    this.choiceService = choiceService;
  }

  /**
   * Start a new negotiation between players
   *
   * @param playerId - The ID of the player initiating the negotiation
   * @param partnerId - The ID of the player being proposed a trade
   * @returns Promise resolving to the negotiation result
   */
  public async initiateNegotiation(playerId: string, partnerId: string): Promise<NegotiationResult> {

    try {
      // Get current game state
      const gameState = this.stateService.getGameState();

      // Validate player exists
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        throw new Error(`Player ${playerId} not found`);
      }

      const partner = this.stateService.getPlayer(partnerId);
      if (!partner) {
        throw new Error(`Player ${partnerId} not found`);
      }

      // Check if there's already an active negotiation
      if (gameState.activeNegotiation) {
        debugWarn(`   Active negotiation already exists: ${gameState.activeNegotiation.negotiationId}`);
        return {
          success: false,
          message: 'Another negotiation is already in progress',
          effects: []
        };
      }

      // Generate unique negotiation ID
      const negotiationId = `negotiation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create negotiation state
      const negotiationState: NegotiationState = {
        negotiationId: negotiationId,
        initiatorId: playerId,
        partnerId: partnerId,
        status: 'pending',
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };

      // Update game state with active negotiation
      this.stateService.updateNegotiationState(negotiationState);


      // Return complete result with negotiation tracking
      return {
        success: true,
        message: `Negotiation ${negotiationId} started successfully`,
        negotiationId: negotiationId,
        effects: [
          // Log effect to track negotiation start
          {
            effectType: 'LOG',
            payload: {
              message: `Negotiation started by ${player.name || playerId}: ${negotiationId}`,
              level: 'INFO',
              source: `negotiation:${negotiationId}`,
              action: 'negotiation_resolved'
            }
          }
        ]
      };

    } catch (error) {
      console.error(`❌ Error starting negotiation:`, error);
      return {
        success: false,
        message: `Failed to start negotiation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        effects: []
      };
    }
  }

  /**
   * Make an offer in an active negotiation, then ask the partner to accept
   * or decline it and resolve the trade immediately once they answer. No
   * counter-offers in this version — one proposal, one response.
   *
   * @param playerId - The ID of the player making the offer (the initiator)
   * @param offer - The offer details: money and/or cards to offer
   * @returns Promise resolving once the partner has responded and the trade
   *   (or its rollback, on decline) has been applied
   */
  public async makeOffer(playerId: string, offer: { money?: number; cards?: string[] }): Promise<NegotiationResult> {

    try {
      // Get current game state
      const gameState = this.stateService.getGameState();

      // Validate player exists
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        throw new Error(`Player ${playerId} not found`);
      }

      // Check if there's an active negotiation
      if (!gameState.activeNegotiation) {
        return {
          success: false,
          message: 'No active negotiation to make offer in',
          effects: []
        };
      }

      const negotiation = gameState.activeNegotiation;

      // Validate player can participate in this negotiation
      if (negotiation.status !== 'pending' && negotiation.status !== 'in_progress') {
        return {
          success: false,
          message: `Cannot make offer - negotiation status is ${negotiation.status}`,
          effects: []
        };
      }

      const money = offer.money && offer.money > 0 ? offer.money : 0;
      const cardIds = offer.cards || [];

      // Validate player owns any offered cards
      for (const cardId of cardIds) {
        if (!this.playerHasCard(player, cardId)) {
          return {
            success: false,
            message: `Player does not own card ${cardId}`,
            effects: []
          };
        }
      }

      // Hold offered cards aside for the duration of the negotiation — moved
      // to the partner on accept (resolveAccepted), returned to the
      // initiator on decline (resolveDeclined). Money is deducted/credited
      // only on accept, so there's nothing to roll back for it on decline.
      if (cardIds.length > 0) {
        const updatedPlayer = this.removeCardsFromPlayer(player, cardIds);
        this.stateService.updatePlayer(updatedPlayer);
      }

      const playerSnapshot = {
        id: playerId,
        hand: [...player.hand],
        negotiationOffer: cardIds
      };

      const updatedNegotiation: NegotiationState = {
        ...negotiation,
        status: 'in_progress',
        offers: [...negotiation.offers, {
          playerId: playerId,
          offerData: { money, cards: cardIds },
          timestamp: new Date()
        }],
        playerSnapshots: [...(negotiation.playerSnapshots || []), playerSnapshot],
        lastUpdatedAt: new Date()
      };

      this.stateService.updateNegotiationState(updatedNegotiation);

      const partner = this.stateService.getPlayer(negotiation.partnerId);
      const cardCount = cardIds.length;
      const parts: string[] = [];
      if (money > 0) parts.push(`$${money.toLocaleString()}`);
      if (cardCount > 0) parts.push(`${cardCount} card${cardCount === 1 ? '' : 's'}`);
      const offerDescription = parts.length > 0 ? parts.join(' and ') : 'a trade';
      const prompt = `${player.name || 'A team'} offers you ${offerDescription}. Accept?`;

      // Ask the partner — same proven cross-device mechanism used elsewhere
      // (see class doc comment above). Resolves once they answer on
      // whichever device is actually theirs.
      const response = await this.choiceService.createChoice(
        negotiation.partnerId,
        'GENERAL',
        prompt,
        [
          { id: 'accept', label: 'Accept' },
          { id: 'decline', label: 'Decline' }
        ]
      );

      if (response === 'accept') {
        return this.resolveAccepted(negotiation.negotiationId, playerId, negotiation.partnerId, money, cardIds);
      }
      return this.resolveDeclined(negotiation.negotiationId, playerId, cardIds, partner?.name);

    } catch (error) {
      console.error(`❌ Error making offer:`, error);
      return {
        success: false,
        message: `Failed to make offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        effects: []
      };
    }
  }

  /**
   * Deliver an accepted trade: money moves from initiator to partner (if
   * the initiator can still afford it — trades are discretionary spending,
   * same guard CardService uses for card plays), held-aside cards move to
   * the partner. Cards are always delivered since they were already safely
   * removed from the initiator's hand when the offer was made.
   */
  private resolveAccepted(negotiationId: string, initiatorId: string, partnerId: string, money: number, cardIds: string[]): NegotiationResult {
    const initiator = this.stateService.getPlayer(initiatorId);
    const partner = this.stateService.getPlayer(partnerId);

    let moneyMoved = false;
    if (money > 0) {
      const spent = this.resourceService.spendMoney(initiatorId, money, 'negotiation', `Trade with ${partner?.name || partnerId}`);
      if (spent) {
        moneyMoved = this.resourceService.addMoney(partnerId, money, 'negotiation', `Trade with ${initiator?.name || initiatorId}`);
      }
    }

    if (cardIds.length > 0) {
      const currentPartner = this.stateService.getPlayer(partnerId);
      if (currentPartner) {
        const updatedPartner = this.addCardsToPlayer(currentPartner, cardIds);
        this.stateService.updatePlayer(updatedPartner);
      }
    }

    this.stateService.updateNegotiationState(null);

    return {
      success: true,
      message: `Negotiation ${negotiationId} completed - offer accepted`,
      negotiationId,
      data: { accepted: true, moneyMoved, cardsMoved: cardIds.length },
      effects: [
        {
          effectType: 'LOG',
          payload: {
            message: `${partner?.name || partnerId} accepted ${initiator?.name || initiatorId}'s trade offer`,
            level: 'INFO',
            source: `negotiation:${negotiationId}`,
            action: 'negotiation_resolved'
          }
        }
      ]
    };
  }

  /**
   * Roll back a declined trade: return held-aside cards to the initiator.
   * Money was never deducted at offer-time, so there's nothing to restore.
   */
  private resolveDeclined(negotiationId: string, initiatorId: string, cardIds: string[], partnerName?: string): NegotiationResult {
    if (cardIds.length > 0) {
      const initiator = this.stateService.getPlayer(initiatorId);
      if (initiator) {
        const restoredInitiator = this.addCardsToPlayer(initiator, cardIds);
        this.stateService.updatePlayer(restoredInitiator);
      }
    }

    this.stateService.updateNegotiationState(null);

    return {
      success: true,
      message: `Negotiation ${negotiationId} declined - offer withdrawn`,
      negotiationId,
      data: { accepted: false },
      effects: [
        {
          effectType: 'LOG',
          payload: {
            message: `${partnerName || 'The other team'} declined the trade offer`,
            level: 'INFO',
            source: `negotiation:${negotiationId}`,
            action: 'negotiation_resolved'
          }
        }
      ]
    };
  }

  /**
   * Cancel an active negotiation and restore player states
   * 
   * @param negotiationId - The ID of the negotiation to cancel
   * @returns Promise resolving to the negotiation result
   */
  public async cancelNegotiation(negotiationId: string): Promise<NegotiationResult> {
    
    try {
      const gameState = this.stateService.getGameState();
      const negotiation = gameState.activeNegotiation;
      
      if (!negotiation || negotiation.negotiationId !== negotiationId) {
        return {
          success: false,
          message: `No active negotiation with ID ${negotiationId}`,
          effects: []
        };
      }
      
      // Restore player states from snapshots
      if (negotiation.playerSnapshots) {
        for (const snapshot of negotiation.playerSnapshots) {
          const player = this.stateService.getPlayer(snapshot.id);
          if (player && snapshot.negotiationOffer) {
            // Restore cards from negotiation offer back to player's hand
            const restoredPlayer = this.addCardsToPlayer(player, snapshot.negotiationOffer);
            this.stateService.updatePlayer(restoredPlayer);
          }
        }
      }
      
      // Clear active negotiation
      this.stateService.updateNegotiationState(null);
      
      
      return {
        success: true,
        message: `Negotiation ${negotiationId} cancelled successfully`,
        negotiationId: negotiationId,
        effects: [
          {
            effectType: 'LOG',
            payload: {
              message: `Negotiation ${negotiationId} was cancelled and player cards restored`,
              level: 'INFO',
              source: `negotiation:${negotiationId}`,
              action: 'negotiation_resolved'
            }
          }
        ]
      };
      
    } catch (error) {
      console.error(`❌ Error cancelling negotiation:`, error);
      return {
        success: false,
        message: `Failed to cancel negotiation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        effects: []
      };
    }
  }

  /**
   * Complete a negotiation with agreed terms
   * 
   * @param negotiationId - The ID of the negotiation to complete
   * @param agreement - The agreed terms of the negotiation
   * @returns Promise resolving to the negotiation result
   */
  public async completeNegotiation(negotiationId: string, _agreement: Record<string, unknown>): Promise<NegotiationResult> {
    
    try {
      const gameState = this.stateService.getGameState();
      const negotiation = gameState.activeNegotiation;
      
      if (!negotiation || negotiation.negotiationId !== negotiationId) {
        return {
          success: false,
          message: `No active negotiation with ID ${negotiationId}`,
          effects: []
        };
      }
      
      // Execute agreed terms (cards remain transferred as per agreement)
      // Clear active negotiation
      this.stateService.updateNegotiationState(null);
      
      
      return {
        success: true,
        message: `Negotiation ${negotiationId} completed successfully`,
        negotiationId: negotiationId,
        effects: [
          {
            effectType: 'LOG',
            payload: {
              message: `Negotiation ${negotiationId} completed with agreement`,
              level: 'INFO',
              source: `negotiation:${negotiationId}`,
              action: 'negotiation_resolved'
            }
          }
        ]
      };
      
    } catch (error) {
      console.error(`❌ Error completing negotiation:`, error);
      return {
        success: false,
        message: `Failed to complete negotiation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        effects: []
      };
    }
  }

  /**
   * Get the current active negotiation (if any)
   * 
   * @returns The active negotiation state or null
   */
  public getActiveNegotiation(): NegotiationState | null {
    const gameState = this.stateService.getGameState();
    return gameState.activeNegotiation || null;
  }

  /**
   * Check if there is an active negotiation
   * 
   * @returns True if there is an active negotiation
   */
  public hasActiveNegotiation(): boolean {
    return this.getActiveNegotiation() !== null;
  }

  /**
   * Check if a player has a specific card
   * 
   * @private
   * @param player - The player to check
   * @param cardId - The card ID to look for
   * @returns True if player has the card
   */
  private playerHasCard(player: Player, cardId: string): boolean {
    return player.hand?.includes(cardId) || false;
  }

  /**
   * Remove cards from a player's hand
   * 
   * @private
   * @param player - The player to remove cards from
   * @param cardIds - The card IDs to remove
   * @returns Updated player data
   */
  private removeCardsFromPlayer(player: Player, cardIds: string[]): Partial<Player> {
    const updatedHand = player.hand.filter((id: string) => !cardIds.includes(id));

    return {
      id: player.id,
      hand: updatedHand
    };
  }

  /**
   * Add cards back to a player's hand
   * 
   * @private
   * @param player - The player to add cards to
   * @param cardIds - The card IDs to add back
   * @returns Updated player data
   */
  private addCardsToPlayer(player: Player, cardIds: string[]): Partial<Player> {
    const updatedHand = [...player.hand];
    
    // Add cards back to hand if they're not already there
    for (const cardId of cardIds) {
      if (!updatedHand.includes(cardId)) {
        updatedHand.push(cardId);
      }
    }
    
    return {
      id: player.id,
      hand: updatedHand
    };
  }

  /**
   * No-op: Negotiation accept/decline is handled by the Try Again (Renegotiate) button.
   * These methods exist only to satisfy the INegotiationService interface contract.
   */
  public async acceptOffer(_playerId: string): Promise<NegotiationResult> {
    return {
      success: true,
      message: 'Negotiation is handled via Renegotiate (Try Again)',
      newState: this.stateService.getGameState(),
      negotiationId: '',
      effects: [],
      data: { accepted: true }
    };
  }

  public async declineOffer(_playerId: string): Promise<NegotiationResult> {
    return {
      success: true,
      message: 'Negotiation is handled via Renegotiate (Try Again)',
      newState: this.stateService.getGameState(),
      negotiationId: '',
      effects: [],
      data: { declined: true }
    };
  }
}
