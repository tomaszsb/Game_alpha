// src/services/NegotiationService.ts

import { IStateService, IEffectEngineService } from '../types/ServiceContracts';
import { NegotiationResult, NegotiationState } from '../types/StateTypes';

/**
 * Negotiation Service
 * 
 * This service manages the state and logic of negotiation events between players.
 * It handles the creation, progression, and resolution of negotiations, including
 * offers, counter-offers, and final agreements.
 * 
 * The service is designed to be self-contained and can be triggered from space actions,
 * card effects, or other game events that require player-to-player negotiations.
 */
export class NegotiationService {
  private stateService: IStateService;
  private effectEngineService: IEffectEngineService;

  constructor(
    stateService: IStateService,
    effectEngineService: IEffectEngineService
  ) {
    this.stateService = stateService;
    this.effectEngineService = effectEngineService;
  }

  /**
   * Start a new negotiation between players
   * 
   * @param playerId - The ID of the player initiating the negotiation
   * @param context - Context data about the negotiation (what's at stake, rules, etc.)
   * @returns Promise resolving to the negotiation result
   */
  public async initiateNegotiation(playerId: string, context: any): Promise<NegotiationResult> {
    console.log(`🤝 NegotiationService.initiateNegotiation - Player ${playerId} starting negotiation`);
    console.log(`   Context:`, context);
    
    try {
      // Get current game state
      const gameState = this.stateService.getGameState();
      
      // Validate player exists
      const player = this.stateService.getPlayer(playerId);
      if (!player) {
        throw new Error(`Player ${playerId} not found`);
      }
      
      // Check if there's already an active negotiation
      if (gameState.activeNegotiation) {
        console.warn(`   Active negotiation already exists: ${gameState.activeNegotiation.negotiationId}`);
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
        status: 'pending',
        context: context,
        offers: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };
      
      // Update game state with active negotiation
      this.stateService.updateNegotiationState(negotiationState);
      
      console.log(`✅ Negotiation created: ${negotiationId}`);
      console.log(`   Status: ${negotiationState.status}`);
      console.log(`   Initiator: ${player.name || playerId}`);
      
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
   * Make an offer in an active negotiation
   * 
   * @param playerId - The ID of the player making the offer
   * @param offer - The offer details including cards to offer
   * @returns Promise resolving to the negotiation result
   */
  public async makeOffer(playerId: string, offer: { cards?: string[] }): Promise<NegotiationResult> {
    console.log(`🤝 NegotiationService.makeOffer - Player ${playerId} making offer`);
    console.log(`   Offer:`, offer);
    
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
      
      // If offering cards, validate and move them to negotiation state
      if (offer.cards && offer.cards.length > 0) {
        // Validate player owns these cards
        for (const cardId of offer.cards) {
          const hasCard = this.playerHasCard(player, cardId);
          if (!hasCard) {
            return {
              success: false,
              message: `Player does not own card ${cardId}`,
              effects: []
            };
          }
        }
        
        // Remove cards from player's hand and add to negotiation offer
        const updatedPlayer = this.removeCardsFromPlayer(player, offer.cards);
        this.stateService.updatePlayer(updatedPlayer);
        
        // Create player snapshot for potential rollback
        const playerSnapshot = {
          id: playerId,
          hand: [...player.hand],
          negotiationOffer: offer.cards
        };
        
        // Update negotiation with card offer
        const updatedNegotiation = {
          ...negotiation,
          status: 'in_progress' as const,
          offers: [...negotiation.offers, {
            playerId: playerId,
            offerData: { cards: offer.cards },
            timestamp: new Date()
          }],
          playerSnapshots: [...(negotiation.playerSnapshots || []), playerSnapshot],
          lastUpdatedAt: new Date()
        };
        
        this.stateService.updateNegotiationState(updatedNegotiation);
      }
      
      console.log(`✅ Offer accepted for negotiation: ${negotiation.negotiationId}`);
      console.log(`   Player: ${player.name || playerId}`);
      console.log(`   Cards offered: ${offer.cards?.join(', ') || 'none'}`);
      
      return {
        success: true,
        message: `Offer made successfully in negotiation ${negotiation.negotiationId}`,
        negotiationId: negotiation.negotiationId,
        effects: [
          {
            effectType: 'LOG',
            payload: {
              message: `${player.name || playerId} offered ${offer.cards?.length || 0} cards in negotiation`,
              level: 'INFO',
              source: `negotiation:${negotiation.negotiationId}`,
              action: 'negotiation_resolved'
            }
          }
        ]
      };
      
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
   * Cancel an active negotiation and restore player states
   * 
   * @param negotiationId - The ID of the negotiation to cancel
   * @returns Promise resolving to the negotiation result
   */
  public async cancelNegotiation(negotiationId: string): Promise<NegotiationResult> {
    console.log(`🤝 NegotiationService.cancelNegotiation - Cancelling negotiation ${negotiationId}`);
    
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
            console.log(`   Restored ${snapshot.negotiationOffer.length} cards to player ${snapshot.id}`);
          }
        }
      }
      
      // Clear active negotiation
      this.stateService.updateNegotiationState(null);
      
      console.log(`✅ Negotiation ${negotiationId} cancelled and player states restored`);
      
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
  public async completeNegotiation(negotiationId: string, agreement: any): Promise<NegotiationResult> {
    console.log(`🤝 NegotiationService.completeNegotiation - Completing negotiation ${negotiationId}`);
    
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
      
      console.log(`✅ Negotiation ${negotiationId} completed successfully`);
      
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
  private playerHasCard(player: any, cardId: string): boolean {
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
  private removeCardsFromPlayer(player: any, cardIds: string[]): any {
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
  private addCardsToPlayer(player: any, cardIds: string[]): any {
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
   * Accept the current offer in an active negotiation
   * 
   * @param playerId - The ID of the player accepting the offer
   * @returns Promise resolving to the negotiation result
   */
  public async acceptOffer(playerId: string): Promise<NegotiationResult> {
    console.log(`✅ NegotiationService.acceptOffer - Player ${playerId} accepting offer`);
    
    // For now, return a success result
    // In a full implementation, this would process the actual offer acceptance
    return {
      success: true,
      message: 'Offer accepted successfully',
      newState: this.stateService.getGameState(),
      negotiationId: 'temp-negotiation-id',
      effects: [],
      data: { accepted: true }
    };
  }

  /**
   * Decline the current offer in an active negotiation
   * 
   * @param playerId - The ID of the player declining the offer
   * @returns Promise resolving to the negotiation result
   */
  public async declineOffer(playerId: string): Promise<NegotiationResult> {
    console.log(`❌ NegotiationService.declineOffer - Player ${playerId} declining offer`);
    
    // For now, return a success result with declined status
    // In a full implementation, this would process the actual offer decline
    return {
      success: true,
      message: 'Offer declined',
      newState: this.stateService.getGameState(),
      negotiationId: 'temp-negotiation-id',
      effects: [],
      data: { declined: true }
    };
  }
}