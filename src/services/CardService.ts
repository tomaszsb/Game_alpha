import { ICardService, IDataService, IStateService, IResourceService, IEffectEngineService, ILoggingService, IGameRulesService } from '../types/ServiceContracts';
import { GameState, Player } from '../types/StateTypes';
import { CardType } from '../types/DataTypes';
import { Effect } from '../types/EffectTypes';
import { ErrorNotifications } from '../utils/ErrorNotifications';

export class CardService implements ICardService {
  private readonly dataService: IDataService;
  private readonly stateService: IStateService;
  private readonly resourceService: IResourceService;
  private readonly loggingService: ILoggingService;
  private readonly gameRulesService: IGameRulesService;
  public effectEngineService!: IEffectEngineService;

  constructor(dataService: IDataService, stateService: IStateService, resourceService: IResourceService, loggingService: ILoggingService, gameRulesService: IGameRulesService) {
    this.dataService = dataService;
    this.stateService = stateService;
    this.resourceService = resourceService;
    this.loggingService = loggingService;
    this.gameRulesService = gameRulesService;
  }

  // Circular dependency resolution methods
  setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
  }

  // Card validation methods
  canPlayCard(playerId: string, cardId: string): boolean {
    return this.gameRulesService.canPlayCard(playerId, cardId);
  }

  isValidCardType(cardType: string): boolean {
    const validTypes: CardType[] = ['W', 'B', 'E', 'L', 'I'];
    return validTypes.includes(cardType as CardType);
  }

  playerOwnsCard(playerId: string, cardId: string): boolean {
    return this.playerOwnsCardInCollection(playerId, cardId, 'all');
  }


  /**
   * Draw cards for a player from stateful decks
   * @param playerId - Player to draw cards for
   * @param cardType - Type of cards to draw (W, B, E, L, I)
   * @param count - Number of cards to draw
   * @param source - Source of the draw (e.g., "card:E029", "space:PM-DECISION-CHECK") 
   * @param reason - Human-readable reason for the draw
   * @returns Array of drawn card IDs
   */
  drawCards(playerId: string, cardType: CardType, count: number, source?: string, reason?: string): string[] {
    if (!this.isValidCardType(cardType)) {
      const error = ErrorNotifications.cardDrawFailed(cardType, `Invalid card type: ${cardType}`);
      throw new Error(error.detailed);
    }

    if (count <= 0) {
      return [];
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    const gameState = this.stateService.getGameState();
    let availableDeck = [...gameState.decks[cardType]];
    let discardPile = [...gameState.discardPiles[cardType]];
    const drawnCards: string[] = [];

    // Draw cards from the deck
    for (let i = 0; i < count; i++) {
      // If deck is empty, reshuffle discard pile back into deck
      if (availableDeck.length === 0) {
        if (discardPile.length === 0) {
          const error = ErrorNotifications.cardDrawFailed(cardType, 'Deck and discard pile both empty');
          console.warn(error.medium);
          break; // Cannot draw any more cards
        }
        
        // Reshuffle discard pile into deck
        availableDeck = this.shuffleArray([...discardPile]);
        discardPile = [];
        
        // Log deck reshuffle to action history
        this.loggingService.info(`Deck for ${cardType} cards was empty. Discard pile reshuffled.`, {
          playerId: player.id,
          cardType: cardType,
          reshuffledCount: availableDeck.length,
          action: 'deck_reshuffle'
        });
      }

      // Draw the top card from the deck
      const drawnCard = availableDeck.pop()!;
      drawnCards.push(drawnCard);
    }

    // Update global game state with new deck and discard pile state
    const updatedDecks = {
      ...gameState.decks,
      [cardType]: availableDeck
    };
    
    const updatedDiscardPiles = {
      ...gameState.discardPiles,
      [cardType]: discardPile
    };

    // Update player's hand with drawn cards
    const updatedHand = [...player.hand, ...drawnCards];

    // Apply updates atomically - single state update to prevent race conditions
    this.stateService.updateGameState({
      decks: updatedDecks,
      discardPiles: updatedDiscardPiles,
      players: gameState.players.map(p => 
        p.id === playerId 
          ? { ...p, hand: updatedHand }
          : p
      )
    });

    // Log the card draw with source tracking
    const sourceInfo = source || 'unknown';
    const reasonInfo = reason || `Drew ${count} ${cardType} cards`;
    // Card draw already logged to action history by core system
    // Card details logged in action history
    // Deck status logged internally

    // EffectEngine handles card draw logging with better context

    return drawnCards;
  }

  /**
   * Fisher-Yates shuffle algorithm for array randomization
   * @param array - Array to shuffle (creates a copy, does not mutate original)
   * @returns Shuffled copy of the array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Draw and automatically apply a card in a single atomic operation.
   * This method is designed for scenarios like automatic funding where we need to
   * draw a card and immediately apply its effects without user interaction.
   * 
   * @param playerId - The player who will receive and apply the card
   * @param cardType - The type of card to draw (B, I, E, L, W)
   * @param source - The source of this action for tracking
   * @param reason - Human-readable reason for this action
   * @returns Object with drawnCardId and success status
   */
  drawAndApplyCard(playerId: string, cardType: CardType, source: string, reason: string): { drawnCardId: string | null; success: boolean } {
    console.log(`🎴 CARD_SERVICE: drawAndApplyCard - Drawing and applying ${cardType} card for player ${playerId}`);
    
    try {
      // Step 1: Draw the card
      const drawnCards = this.drawCards(playerId, cardType, 1, source, reason);

      if (drawnCards.length === 0) {
        const error = ErrorNotifications.cardDrawFailed(cardType, 'No cards available in deck');
        console.warn(error.medium);
        return { drawnCardId: null, success: false };
      }
      
      const drawnCardId = drawnCards[0];
      console.log(`🎴 Successfully drew card: ${drawnCardId}`);
      
      // Step 2: Apply card effects directly (bypassing cost validation/charging)
      // For automatic funding, we apply effects without charging costs
      this.applyCardEffects(playerId, drawnCardId);
      
      // Step 3: Handle card lifecycle (move to active or discard based on duration)
      this.finalizePlayedCard(playerId, drawnCardId);
      
      console.log(`🎴 Successfully applied and processed card: ${drawnCardId}`);
      
      return { drawnCardId, success: true };
      
    } catch (error) {
      const errorNotification = ErrorNotifications.cardDrawFailed(
        cardType,
        (error as Error).message
      );
      console.error(errorNotification.detailed);
      return { drawnCardId: null, success: false };
    }
  }

  removeCard(playerId: string, cardId: string): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    if (!this.playerOwnsCard(playerId, cardId)) {
      const error = ErrorNotifications.cardDiscardFailed(cardId, `Player ${playerId} does not own this card`);
      throw new Error(error.detailed);
    }

    let cardRemoved = false;
    let updatedHand = [...player.hand];
    let updatedActiveCards = [...player.activeCards];

    // Check hand first
    const handIndex = updatedHand.indexOf(cardId);
    if (handIndex !== -1) {
      updatedHand = [
        ...updatedHand.slice(0, handIndex),
        ...updatedHand.slice(handIndex + 1)
      ];
      cardRemoved = true;
      console.log(`Removed card ${cardId} from ${playerId} hand`);
    }

    // Check active cards if not found in hand
    if (!cardRemoved) {
      const activeCardIndex = updatedActiveCards.findIndex(activeCard => activeCard.cardId === cardId);
      if (activeCardIndex !== -1) {
        updatedActiveCards = [
          ...updatedActiveCards.slice(0, activeCardIndex),
          ...updatedActiveCards.slice(activeCardIndex + 1)
        ];
        cardRemoved = true;
        console.log(`Removed card ${cardId} from ${playerId} active cards`);
      }
    }

    // Note: We don't remove from discard piles as those are managed centrally
    // and cards shouldn't be removed once discarded (except for reshuffling)

    if (!cardRemoved) {
      console.warn(`Could not find card ${cardId} in player ${playerId}'s collections`);
    }

    return this.stateService.updatePlayer({
      id: playerId,
      hand: updatedHand,
      activeCards: updatedActiveCards
    });
  }

  replaceCard(playerId: string, oldCardId: string, newCardType: CardType): GameState {
    if (!this.isValidCardType(newCardType)) {
      const error = ErrorNotifications.cardDrawFailed(newCardType, 'Invalid card type');
      throw new Error(error.detailed);
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    if (!this.playerOwnsCard(playerId, oldCardId)) {
      const error = ErrorNotifications.cardDiscardFailed(oldCardId, `Player does not own this card`);
      throw new Error(error.detailed);
    }

    // Get old card details before removal
    const oldCard = this.dataService.getCardById(oldCardId);
    
    // Remove the old card and add a new one
    this.removeCard(playerId, oldCardId);
    const drawnCards = this.drawCards(playerId, newCardType, 1);
    
    // Log card replacement to action history
    const newCardId = drawnCards.length > 0 ? drawnCards[0] : null;
    const newCard = newCardId ? this.dataService.getCardById(newCardId) : null;
    
    this.loggingService.info(`Replaced "${oldCard?.card_name}" with "${newCard?.card_name}".`, {
      playerId: playerId,
      oldCardId: oldCardId,
      newCardId: newCardId,
      newCardType: newCardType,
      action: 'card_discard'
    });

    return this.stateService.getGameState();
  }

  // Card information methods
  getCardType(cardId: string): CardType | null {
    // Robust approach: First try to get card type from the Card object via DataService
    const card = this.dataService.getCardById(cardId);
    if (card && card.card_type && this.isValidCardType(card.card_type)) {
      return card.card_type as CardType;
    }
    
    // Fallback: Extract card type from card ID format for backwards compatibility
    const cardTypePart = cardId.split('_')[0];
    if (this.isValidCardType(cardTypePart)) {
      console.warn(`getCardType fallback: Using ID parsing for card ${cardId}. Consider updating card data.`);
      return cardTypePart as CardType;
    }
    
    console.error(`Cannot determine card type for ${cardId}. Card not found in database and ID format unrecognized.`);
    return null;
  }

  getPlayerCards(playerId: string, cardType?: CardType): string[] {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return [];
    }

    // Combine all card collections
    const allPlayerCards: string[] = [];
    
    // Add cards from hand
    if (player.hand) {
      if (cardType) {
        // Filter hand by card type if specified
        const filteredCards = player.hand.filter(cardId => {
          const type = this.getCardType(cardId);
          return type === cardType;
        });
        allPlayerCards.push(...filteredCards);
      } else {
        allPlayerCards.push(...player.hand);
      }
    }
    
    // Add active cards
    if (player.activeCards) {
      for (const activeCard of player.activeCards) {
        if (cardType) {
          const activeCardType = this.getCardType(activeCard.cardId);
          if (activeCardType === cardType) {
            allPlayerCards.push(activeCard.cardId);
          }
        } else {
          allPlayerCards.push(activeCard.cardId);
        }
      }
    }
    
    // Note: Discarded cards are now in global discard piles and not tracked per player
    // If needed to include discarded cards, they would need to be filtered by player history
    // For now, we only return cards currently in player's hand and active cards

    return allPlayerCards;
  }

  getPlayerCardCount(playerId: string, cardType?: CardType): number {
    return this.getPlayerCards(playerId, cardType).length;
  }

  /**
   * Gets the first available card of a specific type from a player's hand for discarding.
   * This method prioritizes cards from the available cards collection over active/discarded cards.
   * 
   * @param playerId The ID of the player
   * @param cardType The type of card to find (W, B, E, L, I)
   * @returns The card ID if found, null if no cards of that type are available
   */
  getCardToDiscard(playerId: string, cardType: CardType): string | null {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return null;
    }

    // First, try to get from hand (preferred for discarding)
    if (player.hand) {
      const cardInHand = player.hand.find(cardId => {
        const type = this.getCardType(cardId);
        return type === cardType;
      });
      if (cardInHand) {
        return cardInHand; // Return the first card of this type in hand
      }
    }

    // If no available cards of this type, check active cards
    if (player.activeCards) {
      for (const activeCard of player.activeCards) {
        const activeCardType = this.getCardType(activeCard.cardId);
        if (activeCardType === cardType) {
          return activeCard.cardId;
        }
      }
    }

    // No cards of the requested type found
    return null;
  }

  // Main card playing method
  playCard(playerId: string, cardId: string): GameState {
    console.log(`Attempting to play card [${cardId}] for player [${playerId}]`);
    
    try {
      // Step 1: Validate that the card can be played (includes phase restrictions)
      const validationResult = this.validateCardPlay(playerId, cardId);
      if (!validationResult.isValid) {
        const error = ErrorNotifications.cardPlayFailed(cardId, validationResult.errorMessage || 'Validation failed');
        throw new Error(error.detailed);
      }

      // Step 2: Get card data
      const card = this.dataService.getCardById(cardId);
      if (!card) {
        const error = ErrorNotifications.invalidState(`Card ${cardId} not found in database`);
        throw new Error(error.detailed);
      }

      // Step 3: Pay card cost if any
      if (card.cost && card.cost > 0) {
        // Skip cost charging for funding cards (B = Bank loans, I = Investor funding)
        if (card.card_type !== 'B' && card.card_type !== 'I') {
          const player = this.stateService.getPlayer(playerId);
          if (!player) {
            const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
            throw new Error(error.detailed);
          }
          
          this.stateService.updatePlayer({
            id: playerId,
            money: player.money - card.cost
          });
          console.log(`Player ${playerId} paid $${card.cost} to play card ${cardId}`);
        }
      }
      
      // Step 4: Apply card effects
      this.applyCardEffects(playerId, cardId);
      
      // Step 5: Handle card activation based on duration
      if (card.duration) {
        const numericDuration = typeof card.duration === 'string' ? parseInt(card.duration, 10) : card.duration;
        if (numericDuration > 0) {
          // Card has duration - move to activeCards
          this.activateCard(playerId, cardId, numericDuration);
          console.log(`Card [${cardId}] activated for ${numericDuration} turns`);
        } else {
          // Card has immediate effect - move to discarded
          this.moveCardToDiscarded(playerId, cardId);
          console.log(`Card [${cardId}] used immediately and discarded`);
        }
      } else {
        // Card has immediate effect - move to discarded
        this.moveCardToDiscarded(playerId, cardId);
        console.log(`Card [${cardId}] used immediately and discarded`);
      }
      
      console.log(`Successfully played card [${cardId}] for player [${playerId}]`);
      
      // Log card play to action history
      const player = this.stateService.getPlayer(playerId);
      if (player) {
        this.loggingService.info(`Played ${card.card_name || cardId}`, {
          playerId: playerId,
          cardId: cardId,
          cardName: card.card_name,
          cardType: card.card_type,
          cost: card.cost || 0,
          action: 'card_play'
        });
      }
      
      return this.stateService.getGameState();
      
    } catch (error) {
      // Re-throw if already formatted
      if ((error as Error).message.startsWith('❌')) {
        throw error;
      }
      const errorNotification = ErrorNotifications.cardPlayFailed(cardId, (error as Error).message);
      console.error(errorNotification.detailed);
      throw new Error(errorNotification.detailed);
    }
  }

  // Validation helper method
  private validateCardPlay(playerId: string, cardId: string): { isValid: boolean; errorMessage?: string } {
    if (this.gameRulesService.canPlayCard(playerId, cardId)) {
      return { isValid: true };
    }

    // If validation failed, provide more specific error message
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return { isValid: false, errorMessage: `Player ${playerId} not found` };
    }

    const card = this.dataService.getCardById(cardId);
    if (!card) {
      return { isValid: false, errorMessage: 'Card not found' };
    }

    // Check if it's a phase restriction issue
    if (card.phase_restriction && card.phase_restriction !== 'Any') {
      const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
      if (spaceConfig && spaceConfig.phase) {
        const currentPhase = this.mapSpacePhaseToCardPhase(spaceConfig.phase);
        if (currentPhase && card.phase_restriction !== currentPhase) {
          return {
            isValid: false,
            errorMessage: `Card can only be played during ${card.phase_restriction} phase. Current activity: ${currentPhase}`
          };
        }
      }
    }

    return { isValid: false, errorMessage: 'Card cannot be played at this time' };
  }

  // Helper method to map space phases to card phases
  private mapSpacePhaseToCardPhase(spacePhase: string): string | null {
    switch (spacePhase.toUpperCase()) {
      case 'CONSTRUCTION':
        return 'CONSTRUCTION';
      case 'DESIGN':
        return 'DESIGN';
      case 'FUNDING':
        return 'FUNDING';
      case 'REGULATORY':
        return 'REGULATORY_REVIEW';
      default:
        return null;
    }
  }


  // Public method to activate a card with duration-based effects
  public activateCard(playerId: string, cardId: string, duration: number): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    const gameState = this.stateService.getGameState();
    const expirationTurn = gameState.turn + duration;

    // Remove card from available cards
    this.removeCard(playerId, cardId);

    // Add to activeCards
    const updatedActiveCards = [...player.activeCards, { cardId, expirationTurn }];
    
    this.stateService.updatePlayer({
      id: playerId,
      activeCards: updatedActiveCards
    });

    // Log card activation to action history
    const card = this.dataService.getCardById(cardId);
    this.loggingService.info(`Activated "${card?.card_name}" for ${duration} turns.`, {
      playerId: playerId,
      cardId: cardId,
      duration: duration,
      expirationTurn: expirationTurn,
      action: 'card_activate'
    });
  }

  // Card transfer method
  transferCard(sourcePlayerId: string, targetPlayerId: string, cardId: string): GameState {
    // Transfer logged to action history below
    
    try {
      // Validate source player
      const sourcePlayer = this.stateService.getPlayer(sourcePlayerId);
      if (!sourcePlayer) {
        const error = ErrorNotifications.invalidState(`Source player ${sourcePlayerId} not found`);
        throw new Error(error.detailed);
      }

      // Validate target player
      const targetPlayer = this.stateService.getPlayer(targetPlayerId);
      if (!targetPlayer) {
        const error = ErrorNotifications.invalidState(`Target player ${targetPlayerId} not found`);
        throw new Error(error.detailed);
      }

      // Cannot transfer to yourself
      if (sourcePlayerId === targetPlayerId) {
        const error = ErrorNotifications.genericError('transferring card', new Error('Cannot transfer to yourself'));
        throw new Error(error.detailed);
      }

      // Check if source player owns the card (only in hand for transfer)
      if (!this.playerOwnsCardInCollection(sourcePlayerId, cardId, 'hand')) {
        const error = ErrorNotifications.genericError('transferring card', new Error('Card not owned or not available for transfer'));
        throw new Error(error.detailed);
      }

      // Get card type and validate it's transferable
      const cardType = this.getCardType(cardId);
      if (!cardType || !this.isCardTransferable(cardType)) {
        const error = ErrorNotifications.genericError('transferring card', new Error(`${cardType || 'Unknown'} cards cannot be transferred`));
        throw new Error(error.detailed);
      }
      
      // Remove card from source player's available cards
      this.removeCard(sourcePlayerId, cardId);
      
      // Add card to target player's hand
      const updatedTargetHand = [...targetPlayer.hand, cardId];
      
      this.stateService.updatePlayer({
        id: targetPlayerId,
        hand: updatedTargetHand
      });
      
      // Transfer success logged to action history below
      
      // Log card transfer to action history
      const card = this.dataService.getCardById(cardId);
      this.loggingService.info(`Transferred ${card?.card_name || cardId} to ${targetPlayer.name}`, {
        playerId: sourcePlayerId,
        cardId: cardId,
        cardName: card?.card_name,
        cardType: cardType,
        sourcePlayer: sourcePlayer.name,
        action: 'card_transfer',
        targetPlayer: targetPlayer.name,
        sourcePlayerId: sourcePlayerId,
        targetPlayerId: targetPlayerId
      });
      
      return this.stateService.getGameState();
      
    } catch (error) {
      // Re-throw if already formatted
      if ((error as Error).message.startsWith('❌')) {
        throw error;
      }
      const errorNotification = ErrorNotifications.genericError(`transferring card ${cardId}`, error as Error);
      console.error(errorNotification.detailed);
      throw new Error(errorNotification.detailed);
    }
  }

  // Helper method to check if a card type is transferable
  private isCardTransferable(cardType: CardType): boolean {
    // E (Expeditor) and L (Life Events) cards can be transferred
    // These represent filing representatives and events that can affect other players
    return cardType === 'E' || cardType === 'L';
  }

  // Enhanced method to check if player owns card in specific collection(s)
  private playerOwnsCardInCollection(
    playerId: string, 
    cardId: string, 
    collection: 'hand' | 'active' | 'discarded' | 'all' = 'all'
  ): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      return false;
    }

    // Check hand (previously available cards)
    if (collection === 'hand' || collection === 'all') {
      if (player.hand && player.hand.includes(cardId)) {
        return true;
      }
    }

    // Check active cards
    if (collection === 'active' || collection === 'all') {
      if (player.activeCards && player.activeCards.some(activeCard => activeCard.cardId === cardId)) {
        return true;
      }
    }

    // Check discarded cards (now in global discard piles)
    if (collection === 'discarded' || collection === 'all') {
      const gameState = this.stateService.getGameState();
      for (const cardType of ['W', 'B', 'E', 'L', 'I'] as CardType[]) {
        const discardPile = gameState.discardPiles[cardType];
        if (discardPile && discardPile.includes(cardId)) {
          return true;
        }
      }
    }

    return false;
  }


  // Public method called at end of each turn to handle card expirations
  endOfTurn(): void {
    const gameState = this.stateService.getGameState();
    const currentTurn = gameState.turn;

    // Processing card expirations

    // Check each player's active cards for expiration
    for (const player of gameState.players) {
      const expiredCards: string[] = [];
      const remainingActiveCards = player.activeCards.filter(activeCard => {
        if (activeCard.expirationTurn <= currentTurn) {
          expiredCards.push(activeCard.cardId);
          return false; // Remove from active cards
        }
        return true; // Keep in active cards
      });

      // If there are expired cards, update the player
      if (expiredCards.length > 0) {
        // Move expired cards to discarded collection and log each expiration
        for (const expiredCardId of expiredCards) {
          // Log card expiration to action history
          const card = this.dataService.getCardById(expiredCardId);
          this.loggingService.info(`"${card?.card_name}" expired.`, {
            playerId: player.id,
            cardId: expiredCardId,
            action: 'card_expire'
          });
          
          this.moveExpiredCardToDiscarded(player.id, expiredCardId);
        }

        // Update active cards list
        this.stateService.updatePlayer({
          id: player.id,
          activeCards: remainingActiveCards
        });
      }
    }
  }

  // Helper method to move expired card to discarded collection
  private moveExpiredCardToDiscarded(playerId: string, cardId: string): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      console.error(`Player ${playerId} not found during card expiration`);
      return;
    }

    const cardType = this.getCardType(cardId);
    if (!cardType) {
      console.error(`Cannot determine card type for expired card ${cardId}`);
      return;
    }

    // Add expired card to global discard pile
    const gameState = this.stateService.getGameState();
    const updatedDiscardPiles = {
      ...gameState.discardPiles,
      [cardType]: [...gameState.discardPiles[cardType], cardId]
    };

    this.stateService.updateGameState({
      discardPiles: updatedDiscardPiles
    });

    console.log(`Expired card ${cardId} moved to ${cardType} discard pile for player ${playerId}`);
  }

  // Card discard helper method
  private moveCardToDiscarded(playerId: string, cardId: string): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    const cardType = this.getCardType(cardId);
    if (!cardType) {
      const error = ErrorNotifications.cardDiscardFailed(cardId, 'Cannot determine card type');
      throw new Error(error.detailed);
    }

    // Verify card exists in player's hand
    const handIndex = player.hand.indexOf(cardId);
    if (handIndex === -1) {
      const error = ErrorNotifications.cardDiscardFailed(cardId, 'Card not found in player hand');
      throw new Error(error.detailed);
    }
    
    // Remove from player's hand
    const updatedHand = [
      ...player.hand.slice(0, handIndex),
      ...player.hand.slice(handIndex + 1)
    ];
    
    // Add to global discard pile
    const gameState = this.stateService.getGameState();
    const updatedDiscardPiles = {
      ...gameState.discardPiles,
      [cardType]: [...gameState.discardPiles[cardType], cardId]
    };
    
    // Update game state and player state atomically
    this.stateService.updateGameState({
      discardPiles: updatedDiscardPiles
    });
    
    this.stateService.updatePlayer({
      id: playerId,
      hand: updatedHand
    });
    
    console.log(`Moved card ${cardId} from hand to ${cardType} discard pile for player ${playerId}`);
  }

  /**
   * Public method to discard a played card (move from available to discarded)
   * Used by EffectEngine for PLAY_CARD effects when card has no duration
   */
  public discardPlayedCard(playerId: string, cardId: string): void {
    console.log(`🗑️ Discarding played card ${cardId} for player ${playerId}`);
    this.moveCardToDiscarded(playerId, cardId);
  }

  /**
   * Public method to finalize a played card's lifecycle
   * Determines if card should be activated (has duration) or discarded (immediate effect)
   * Used by EffectEngine for PLAY_CARD effects
   */
  public finalizePlayedCard(playerId: string, cardId: string): void {
    console.log(`🎴 Finalizing played card ${cardId} for player ${playerId}`);

    const card = this.dataService.getCardById(cardId);
    if (!card) {
      const error = ErrorNotifications.invalidState(`Card ${cardId} not found in database`);
      throw new Error(error.detailed);
    }
    
    // Check if card has duration
    const duration = card.duration_count && parseInt(card.duration_count, 10) > 0 
      ? parseInt(card.duration_count, 10) 
      : 0;

    if (duration > 0) {
      console.log(`🎴 Card ${cardId} has duration ${duration}, activating...`);
      this.activateCard(playerId, cardId, duration);
    } else {
      console.log(`🎴 Card ${cardId} has no duration, discarding...`);
      this.discardPlayedCard(playerId, cardId);
    }
  }

  // Card effect methods - Enhanced with UnifiedEffectEngine integration
  applyCardEffects(playerId: string, cardId: string): GameState {
    const card = this.dataService.getCardById(cardId);
    if (!card) {
      console.warn(`Card ${cardId} not found in database`);
      return this.stateService.getGameState();
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    console.log(`🎴 CARD_SERVICE: Applying effects for card ${cardId}: "${card.card_name}"`);
    console.log(`🔍 DEBUG FUNDING: Card type=${card.card_type}, loan_amount=${card.loan_amount}, investment_amount=${card.investment_amount}, cost=${card.cost}`);

    // Step 1: Parse card data into standardized Effect objects
    const effects = this.parseCardIntoEffects(card, playerId);
    
    if (effects.length > 0) {
      console.log(`🎴 CARD_SERVICE: Parsed ${effects.length} effects from card ${cardId}`);
      
      // Step 2: Process effects through UnifiedEffectEngine
      const context = {
        source: `card:${cardId}`,
        playerId: playerId,
        triggerEvent: 'CARD_PLAY' as const
      };
      
      // Use async processing for complex effects
      this.effectEngineService.processCardEffects(effects, context, card).then(batchResult => {
        if (batchResult.success) {
          console.log(`✅ Successfully processed ${batchResult.successfulEffects}/${batchResult.totalEffects} card effects`);
        } else {
          console.error(`❌ Card effect processing failed: ${batchResult.errors.join(', ')}`);
        }
      }).catch(error => {
        console.error(`❌ Error processing card effects:`, error);
      });
    }

    // Step 3: Apply legacy expanded mechanics for compatibility
    this.applyExpandedMechanics(playerId, card);

    // Step 4: Apply legacy card type effects for compatibility
    switch (card.card_type) {
      case 'W': // Work cards - Apply Work effects
        return this.applyWorkCardEffect(playerId, card);
      
      case 'B': // Bank Loan cards - Apply loan funding effects
        return this.applyBankLoanCardEffect(playerId, card);
      
      case 'E': // Expeditor cards - Filing representative effects
        return this.applyExpeditorCardEffect(playerId, card);
      
      case 'L': // Life Events cards - Random events and unforeseen circumstances
        return this.applyLifeEventsCardEffect(playerId, card);
      
      case 'I': // Investor Loan cards - High-rate funding effects
        return this.applyInvestorLoanCardEffect(playerId, card);
      
      default:
        console.warn(`Unknown card type: ${card.card_type}`);
        return this.stateService.getGameState();
    }
  }

  /**
   * Parse card CSV data into standardized Effect objects for the UnifiedEffectEngine
   * This bridges the gap between CSV field structure and the Effect system
   */
  private parseCardIntoEffects(card: any, playerId: string): Effect[] {
    const effects: Effect[] = [];
    const cardSource = `card:${card.card_id}`;

    // MODIFY_RESOURCE effects from money_effect field
    if (card.money_effect && card.money_effect !== '0') {
      const moneyAmount = parseInt(card.money_effect, 10);
      if (!isNaN(moneyAmount) && moneyAmount !== 0) {
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: playerId,
            resource: 'MONEY',
            amount: moneyAmount,
            source: cardSource,
            reason: `${card.card_name}: ${moneyAmount > 0 ? '+' : ''}$${Math.abs(moneyAmount).toLocaleString()}`
          }
        });
        console.log(`   💰 Added MODIFY_RESOURCE effect: ${moneyAmount > 0 ? '+' : ''}$${Math.abs(moneyAmount).toLocaleString()}`);
      }
    }

    // MODIFY_RESOURCE effects from tick_modifier field (time effects)
    if (card.tick_modifier && card.tick_modifier !== '0') {
      const timeAmount = parseInt(card.tick_modifier, 10);
      if (!isNaN(timeAmount) && timeAmount !== 0) {
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: playerId,
            resource: 'TIME',
            amount: timeAmount, // Positive = add time, negative = spend time
            source: cardSource,
            reason: `${card.card_name}: ${timeAmount > 0 ? '+' : ''}${timeAmount} time ticks`
          }
        });
        console.log(`   ⏰ Added TIME effect: ${timeAmount > 0 ? '+' : ''}${timeAmount} time ticks`);
      }
    }

    // DRAW_CARDS effects from draw_cards field
    if (card.draw_cards && card.draw_cards.trim() !== '') {
      const drawMatch = card.draw_cards.match(/(\d+)\s*([WBELIS]?)/);
      if (drawMatch) {
        const count = parseInt(drawMatch[1], 10);
        const cardType = drawMatch[2] || 'W'; // Default to Work cards if no type specified
        
        if (count > 0) {
          effects.push({
            effectType: 'CARD_DRAW',
            payload: {
              playerId: playerId,
              cardType: cardType as any,
              count: count,
              source: cardSource,
              reason: `${card.card_name}: Draw ${count} ${cardType} card${count > 1 ? 's' : ''}`
            }
          });
          console.log(`   🎴 Added DRAW_CARDS effect: ${count} ${cardType} card${count > 1 ? 's' : ''}`);
        }
      }
    }

    // PLAYER_CHOICE_MOVE effects for movement-related cards
    if (card.movement_effect && card.movement_effect.trim() !== '') {
      const movementSpaces = parseInt(card.movement_effect, 10);
      if (!isNaN(movementSpaces) && movementSpaces > 0) {
        effects.push({
          effectType: 'CHOICE',
          payload: {
            id: `${card.card_id}_movement_choice`,
            playerId: playerId,
            type: 'MOVEMENT',
            prompt: `Choose where to move (${movementSpaces} spaces)`,
            options: [
              { id: 'forward', label: `Move forward ${movementSpaces} spaces` },
              { id: 'backward', label: `Move backward ${movementSpaces} spaces` }
            ]
          }
        });
        console.log(`   🚶 Added PLAYER_CHOICE_MOVE effect: ${movementSpaces} spaces`);
      }
    }

    // CARD_DISCARD effects from discard_cards field
    if (card.discard_cards && card.discard_cards.trim() !== '') {
      const discardMatch = card.discard_cards.match(/(\d+)\s*([WBELIS]?)/);
      if (discardMatch) {
        const count = parseInt(discardMatch[1], 10);
        const cardType = discardMatch[2];
        
        if (count > 0) {
          effects.push({
            effectType: 'CARD_DISCARD',
            payload: {
              playerId: playerId,
              cardIds: [], // Will be resolved at runtime
              cardType: cardType as any,
              count: count,
              source: cardSource,
              reason: `${card.card_name}: Discard ${count} ${cardType || 'any'} card${count > 1 ? 's' : ''}`
            }
          });
          console.log(`   🗑️ Added CARD_DISCARD effect: ${count} ${cardType || 'any'} card${count > 1 ? 's' : ''}`);
        }
      }
    }

    return effects;
  }

  // Apply expanded mechanics from code2026
  private applyExpandedMechanics(playerId: string, card: any): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const cardSource = `card:${card.card_id}`;

    // Apply time tick modifier effects using ResourceService
    if (card.tick_modifier && card.tick_modifier !== '0') {
      const tickModifier = parseInt(card.tick_modifier);
      if (!isNaN(tickModifier) && tickModifier !== 0) {
        if (tickModifier > 0) {
          this.resourceService.addTime(playerId, tickModifier, cardSource, `${card.card_name}: +${tickModifier} time ticks`);
        } else {
          this.resourceService.spendTime(playerId, Math.abs(tickModifier), cardSource, `${card.card_name}: ${tickModifier} time ticks`);
        }
      }
    }

    // Apply direct money effects using ResourceService
    if (card.money_effect) {
      const moneyEffect = parseInt(card.money_effect);
      if (!isNaN(moneyEffect) && moneyEffect !== 0) {
        if (moneyEffect > 0) {
          this.resourceService.addMoney(playerId, moneyEffect, cardSource, `${card.card_name}: +$${moneyEffect.toLocaleString()}`);
        } else {
          this.resourceService.spendMoney(playerId, Math.abs(moneyEffect), cardSource, `${card.card_name}: -$${Math.abs(moneyEffect).toLocaleString()}`);
        }
      }
    }

    // Apply loan amounts for B cards using ResourceService
    console.log(`🔍 DEBUG: Checking B card - card_type=${card.card_type}, loan_amount=${card.loan_amount}`);
    if (card.card_type === 'B' && card.loan_amount) {
      const loanAmount = parseInt(card.loan_amount);
      console.log(`🔍 DEBUG: Parsed loan_amount=${loanAmount}, isNaN=${isNaN(loanAmount)}`);
      if (!isNaN(loanAmount) && loanAmount > 0) {
        console.log(`💰 DEBUG: Adding loan money: $${loanAmount.toLocaleString()}`);

        // Determine source type based on context
        const player = this.stateService.getPlayer(playerId);
        const sourceType = player?.currentSpace === 'OWNER-FUND-INITIATION' ? 'owner' : 'bank';
        const sourceLabel = sourceType === 'owner' ? 'Owner funding' : 'Loan';

        this.resourceService.addMoney(
          playerId,
          loanAmount,
          cardSource,
          `${card.card_name}: ${sourceLabel} of $${loanAmount.toLocaleString()}${sourceType === 'bank' ? ` at ${card.loan_rate}% interest` : ''}`,
          sourceType
        );
      } else {
        console.warn(`⚠️ DEBUG: Loan amount failed validation - loanAmount=${loanAmount}`);
      }
    } else {
      console.log(`⚠️ DEBUG: B card condition not met - card_type=${card.card_type}, loan_amount=${card.loan_amount}`);
    }

    // Apply investment amounts for I cards using ResourceService
    console.log(`🔍 DEBUG: Checking I card - card_type=${card.card_type}, investment_amount=${card.investment_amount}`);
    if (card.card_type === 'I' && card.investment_amount) {
      const investmentAmount = parseInt(card.investment_amount);
      console.log(`🔍 DEBUG: Parsed investment_amount=${investmentAmount}, isNaN=${isNaN(investmentAmount)}`);
      if (!isNaN(investmentAmount) && investmentAmount > 0) {
        console.log(`💰 DEBUG: Adding investment money: $${investmentAmount.toLocaleString()}`);
        this.resourceService.addMoney(
          playerId,
          investmentAmount,
          cardSource,
          `${card.card_name}: Investment of $${investmentAmount.toLocaleString()}`,
          'investment' // Track as investment deal
        );
      } else {
        console.warn(`⚠️ DEBUG: Investment amount failed validation - investmentAmount=${investmentAmount}`);
      }
    } else {
      console.log(`⚠️ DEBUG: I card condition not met - card_type=${card.card_type}, investment_amount=${card.investment_amount}`);
    }

    // Handle turn effects (skip next turn)
    if (card.turn_effect && card.turn_effect.toLowerCase().includes('skip')) {
      console.log(`Card ${card.card_id}: Turn effect "${card.turn_effect}" - player will skip next turn`);
      this.effectEngineService.processEffect({
        effectType: 'TURN_CONTROL',
        payload: {
          action: 'SKIP_TURN',
          playerId,
          source: `card:${card.card_id}`,
          reason: `Card effect: ${card.card_name}`
        }
      }, {
        source: `card:${card.card_id}`,
        playerId,
        triggerEvent: 'CARD_PLAY'
      });
    }

    // Handle card interaction effects (draw/discard)
    if (card.draw_cards) {
      const [count, cardType] = card.draw_cards.split(' ');
      this.effectEngineService.processEffect({
        effectType: 'CARD_DRAW',
        payload: {
          playerId,
          cardType,
          count: parseInt(count, 10),
          source: `card:${card.card_id}`,
          reason: `Card effect: ${card.card_name}`
        }
      }, {
        source: `card:${card.card_id}`,
        playerId,
        triggerEvent: 'CARD_PLAY'
      });
    }

    if (card.discard_cards) {
      const [count, cardType] = card.discard_cards.split(' ');
      const playerCards = this.getPlayerCards(playerId, cardType as CardType);
      if (playerCards.length > 0) {
        const cardsToDiscard = playerCards.slice(0, parseInt(count, 10));
        this.effectEngineService.processEffect({
          effectType: 'CARD_DISCARD',
          payload: {
            playerId,
            cardIds: cardsToDiscard,
            source: `card:${card.card_id}`,
            reason: `Card effect: ${card.card_name}`
          }
        }, {
          source: `card:${card.card_id}`,
          playerId,
          triggerEvent: 'CARD_PLAY'
        });
      }
    }

    // Handle targeted effects
    if (card.target) {
      this.effectEngineService.processEffect({
        effectType: 'EFFECT_GROUP_TARGETED',
        payload: {
          targetType: card.target,
          templateEffect: {
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId: '', // This will be replaced by the EffectEngineService
              resource: 'MONEY',
              amount: -100, // Example: all other players lose 100
              source: `card:${card.card_id}`,
              reason: `Card effect: ${card.card_name}`
            }
          },
          prompt: `Choose a player to lose $100`,
          source: `card:${card.card_id}`
        }
      }, {
        source: `card:${card.card_id}`,
        playerId,
        triggerEvent: 'CARD_PLAY'
      });
    }
  }

  // Private helper methods
  private requiresPlayerTurn(cardType: CardType): boolean {
    // Some card types might require it to be the player's turn
    // For now, assume all cards can be played anytime during PLAY phase
    return false;
  }

  private applyWorkCardEffect(playerId: string, card: any): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Work cards represent project scopes that add to the player's project value
    // Extract estimated cost from description for project value calculation
    const costMatch = card.description.match(/\$([0-9,]+)/);
    if (costMatch) {
      const projectValue = parseInt(costMatch[1].replace(/,/g, ''));
      console.log(`Work card played: ${card.card_name}`);
      console.log(`Added project scope worth $${projectValue.toLocaleString()}`);
      
      // Work cards contribute to player's total project portfolio value
      // This could be used for win conditions or scoring in future phases
      const currentProjectValue = player.money; // For now, work cards don't change money directly
      console.log(`Work scope acquired: ${card.card_name} (Est. $${projectValue.toLocaleString()})`);
    } else {
      console.log(`Work card played: ${card.card_name}`);
      console.log('Work card represents project scope for completion requirements');
    }
    
    return this.stateService.getGameState();
  }

  private applyBankLoanCardEffect(playerId: string, card: any): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Bank Loan card effects are now handled in applyExpandedMechanics via loan_amount field
    // Log loan details if available
    if (card.loan_amount) {
      const loanAmount = parseInt(card.loan_amount);
      if (!isNaN(loanAmount) && loanAmount > 0) {
        console.log(`Bank Loan approved: ${card.card_name} - $${loanAmount.toLocaleString()}`);
        if (card.loan_rate) {
          console.log(`Interest rate: ${card.loan_rate}%`);
        }
      }
    }
    
    return this.stateService.getGameState();
  }

  private applyExpeditorCardEffect(playerId: string, card: any): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse E card effects from effects_on_play field
    const effects = card.effects_on_play || '';
    
    if (effects.includes('gain $')) {
      // Extract money amount
      const moneyMatch = effects.match(/gain \$(\d+)/);
      if (moneyMatch) {
        const moneyGain = parseInt(moneyMatch[1]);
        this.stateService.updatePlayer({
          id: playerId,
          money: player.money + moneyGain
        });
        console.log(`Expeditor card provided $${moneyGain}`);
      }
    }
    
    if (effects.includes('time units')) {
      // Extract time amount
      const timeMatch = effects.match(/(\d+)\s+time\s+units/);
      if (timeMatch) {
        const timeGain = parseInt(timeMatch[1]);
        this.stateService.updatePlayer({
          id: playerId,
          timeSpent: Math.max(0, player.timeSpent - timeGain) // Reduce time spent
        });
        console.log(`Expeditor card saved ${timeGain} time units`);
      }
    }
    
    if (effects.includes('Draw 1 card')) {
      // Draw 1 additional card of any type
      // For now, we'll draw a random card type (W, B, I, L, E)
      const cardTypes: CardType[] = ['W', 'B', 'I', 'L', 'E'];
      const randomCardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
      
      try {
        this.drawCards(playerId, randomCardType, 1);
        console.log(`Expeditor card effect: Drew 1 ${randomCardType} card`);
      } catch (error) {
        console.warn(`Could not draw ${randomCardType} card:`, error);
        // Try a different card type if the first fails
        for (const fallbackType of cardTypes) {
          if (fallbackType !== randomCardType) {
            try {
              this.drawCards(playerId, fallbackType, 1);
              console.log(`Expeditor card effect: Drew 1 ${fallbackType} card (fallback)`);
              break;
            } catch (fallbackError) {
              // Continue to next type
            }
          }
        }
      }
    }
    
    console.log(`Expeditor effect applied: ${effects}`);
    return this.stateService.getGameState();
  }

  private applyLifeEventsCardEffect(playerId: string, card: any): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Life Events cards create random events and unforeseen circumstances
    // Parse the effects_on_play field for specific benefits
    const effects = card.effects_on_play || '';
    console.log(`Life Events card played: ${card.card_name}`);
    
    if (effects.includes('Enables')) {
      console.log(`✅ Life event enabled: ${effects}`);
    }
    
    if (effects.includes('reduces') && effects.includes('risk')) {
      console.log(`🛡️ Risk reduction applied: ${effects}`);
    }
    
    if (effects.includes('Prevents')) {
      console.log(`🚫 Prevention effect activated: ${effects}`);
    }
    
    if (effects.includes('Expands')) {
      console.log(`📈 Expansion benefit acquired: ${effects}`);
    }
    
    // Life Events cards provide random circumstances that affect gameplay
    console.log(`Life event processed: ${card.card_name}`);
    
    return this.stateService.getGameState();
  }

  private applyInvestorLoanCardEffect(playerId: string, card: any): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Parse investor loan effects from card name and description
    let moneyGain = 0;
    const cardName = card.card_name.toLowerCase();
    
    if (cardName.includes('angel investor')) {
      moneyGain = 50000;
    } else if (cardName.includes('venture capital')) {
      moneyGain = 200000;
    } else if (cardName.includes('government grant')) {
      moneyGain = 100000;
    } else if (cardName.includes('crowdfunding')) {
      // Variable based on player's current project value
      moneyGain = Math.floor(player.money * 0.2) + 10000;
    } else {
      moneyGain = 25000; // Default investor loan amount
    }
    
    if (moneyGain > 0) {
      this.resourceService.addMoney(
        playerId, 
        moneyGain, 
        `card:${card.card_id}`, 
        `${card.card_name}: Investment secured $${moneyGain.toLocaleString()}`
      );
    }
    
    return this.stateService.getGameState();
  }

  // Discard cards with source tracking
  discardCards(playerId: string, cardIds: string[], source?: string, reason?: string): boolean {
    if (!cardIds || cardIds.length === 0) {
      const error = ErrorNotifications.cardDiscardFailed('unknown', 'No cards provided');
      console.warn(error.medium);
      return false;
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    // Validate all cards exist and are owned by player
    const invalidCards = cardIds.filter(cardId => !this.playerOwnsCard(playerId, cardId));
    if (invalidCards.length > 0) {
      const error = ErrorNotifications.cardDiscardFailed(
        invalidCards.join(', '),
        'Player does not own these cards'
      );
      console.error(error.detailed);
      return false;
    }

    // Group cards by type for efficient discarding
    const cardsByType: { [cardType: string]: string[] } = {};
    
    for (const cardId of cardIds) {
      const cardType = this.getCardType(cardId);
      if (cardType) {
        if (!cardsByType[cardType]) {
          cardsByType[cardType] = [];
        }
        cardsByType[cardType].push(cardId);
      }
    }

    // Copy current player card collections  
    let updatedHand = [...player.hand];
    let updatedActiveCards = [...player.activeCards];
    const gameState = this.stateService.getGameState();
    const updatedDiscardPiles = { ...gameState.discardPiles };

    // Process each card type
    for (const [cardType, cards] of Object.entries(cardsByType)) {
      const typedCardType = cardType as CardType;
      
      // Remove from hand
      updatedHand = updatedHand.filter(cardId => !cards.includes(cardId));

      // Remove from active cards
      for (const cardId of cards) {
        const activeIndex = updatedActiveCards.findIndex(active => active.cardId === cardId);
        if (activeIndex !== -1) {
          updatedActiveCards.splice(activeIndex, 1);
        }
      }

      // Add to global discard pile
      if (!updatedDiscardPiles[typedCardType]) {
        updatedDiscardPiles[typedCardType] = [];
      }
      updatedDiscardPiles[typedCardType] = [
        ...updatedDiscardPiles[typedCardType],
        ...cards
      ];
    }

    // Update game state and player state
    try {
      this.stateService.updateGameState({
        discardPiles: updatedDiscardPiles
      });
      
      this.stateService.updatePlayer({
        id: playerId,
        hand: updatedHand,
        activeCards: updatedActiveCards
      });

      // Log the transaction
      const cardSummary = Object.entries(cardsByType)
        .map(([type, cards]) => `${cards.length}x${type}`)
        .join(', ');
      
      const sourceInfo = source || 'manual';
      const reasonInfo = reason || `Discarded ${cardIds.length} card${cardIds.length > 1 ? 's' : ''}`;
      
      console.log(`🗑️ Cards Discarded [${playerId}]: ${cardSummary} (Source: ${sourceInfo})`);
      console.log(`   Reason: ${reasonInfo}`);
      console.log(`   Card IDs: ${cardIds.join(', ')}`);

      // Log card discard to action history
      this.loggingService.info(`Discarded ${cardIds.length} card${cardIds.length > 1 ? 's' : ''}`, {
        playerId: playerId,
        cardIds: cardIds,
        cardsByType: cardsByType,
        source: sourceInfo,
        reason: reasonInfo,
        action: 'card_discard'
      });

      return true;

    } catch (error) {
      const errorNotification = ErrorNotifications.cardDiscardFailed(
        cardIds.join(', '),
        (error as Error).message
      );
      console.error(errorNotification.detailed);
      throw new Error(errorNotification.detailed);
    }
  }
}