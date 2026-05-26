import { ICardService, IDataService, IStateService, IResourceService, IEffectEngineService, ILoggingService, IGameRulesService, IChoiceService, IApprovalService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { GameState, Player } from '../types/StateTypes';
import { Card, CardType } from '../types/DataTypes';
import { Effect } from '../types/EffectTypes';
import { ErrorNotifications } from '../utils/ErrorNotifications';
import { parseCardDrawFormat } from '../utils/parseUtils';

export class CardService implements ICardService {
  private readonly dataService: IDataService;
  private readonly stateService: IStateService;
  private readonly resourceService: IResourceService;
  private readonly loggingService: ILoggingService;
  private readonly gameRulesService: IGameRulesService;
  public effectEngineService!: IEffectEngineService;
  private choiceService?: IChoiceService;
  private approvalService?: IApprovalService;

  constructor(
    dataService: IDataService,
    stateService: IStateService,
    resourceService: IResourceService,
    loggingService: ILoggingService,
    gameRulesService: IGameRulesService,
    choiceService?: IChoiceService,
    approvalService?: IApprovalService
  ) {
    this.dataService = dataService;
    this.stateService = stateService;
    this.resourceService = resourceService;
    this.loggingService = loggingService;
    this.gameRulesService = gameRulesService;
    this.choiceService = choiceService;
    this.approvalService = approvalService;
  }

  // Circular dependency resolution — EffectEngineService is a genuine 3-way cycle
  // (Turn↔EffectEngine↔Card). See docs/technical/ARCHITECTURE.md for details.
  setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
  }

  /**
   * Assert that EffectEngineService is initialized.
   * Call this at the start of methods that depend on it.
   * @throws Error if EffectEngineService is not set
   */
  private assertEffectEngineReady(): void {
    if (!this.effectEngineService) {
      throw new Error(
        'CardService not fully initialized: EffectEngineService not set. ' +
        'Call setEffectEngineService() before using card effect methods.'
      );
    }
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

    // Educational mode: On starting space, give pre-selected cards instead of drawing from deck
    // Workstream 6 #1: starting-space check lifted from literal to data flag (is_starting_space).
    const isEducationalMode = gameState.startingMode === 'EDUCATIONAL';
    const isStartingSpace = this.dataService.isStartingSpace(player.currentSpace);
    const hasPreSelectedCards = gameState.startingHand && gameState.startingHand.length > 0;

    if (isEducationalMode && isStartingSpace && hasPreSelectedCards && gameState.startingHand) {
      // Get pre-selected cards of this type
      const preSelectedOfType = gameState.startingHand.filter(cardId => cardId.startsWith(cardType));

      if (preSelectedOfType.length > 0) {

        // Add pre-selected cards to player's hand
        const currentHand = player.hand || [];
        const newHand = [...currentHand, ...preSelectedOfType];

        // Update player state with the pre-selected cards
        this.stateService.updatePlayer({ id: playerId, hand: newHand });

        // For Quick Start mode compatibility, track captured cards
        if (gameState.isCapturingStartingHand) {
          const currentStartingHand = gameState.startingHand || [];
          this.stateService.updateGameState({
            startingHand: [...currentStartingHand, ...preSelectedOfType]
          });
        }

        // Log card draw to action history
        this.loggingService.info(`Drew ${preSelectedOfType.length} ${cardType} card(s) (pre-selected): ${preSelectedOfType.join(', ')}`, {
          playerId: player.id,
          action: 'card_draw',
          cardType,
          count: preSelectedOfType.length,
          cards: preSelectedOfType,
          source: source || 'educational_mode',
          reason: reason || 'Pre-selected starting cards'
        });

        return preSelectedOfType;
      }
    }

    // Determine which deck and discard pile to use based on game mode
    const isSameStartMode = gameState.gameMode === 'SAME_START';

    let availableDeck: string[];
    let discardPile: string[];

    if (isSameStartMode && gameState.playerDecks && gameState.playerDiscardPiles) {
      // Same Starting Point mode: use per-player decks
      availableDeck = [...(gameState.playerDecks[playerId]?.[cardType] || [])];
      discardPile = [...(gameState.playerDiscardPiles[playerId]?.[cardType] || [])];
    } else {
      // Battle Royale mode (default): use shared decks
      availableDeck = [...gameState.decks[cardType]];
      discardPile = [...gameState.discardPiles[cardType]];
    }

    const drawnCards: string[] = [];

    // Draw cards from the deck
    for (let i = 0; i < count; i++) {
      // If deck is empty, reshuffle discard pile back into deck
      if (availableDeck.length === 0) {
        if (discardPile.length === 0) {
          const error = ErrorNotifications.cardDrawFailed(cardType, 'Deck and discard pile both empty');
          debugWarn(error.medium);
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

    // Update deck/discard state based on game mode
    if (isSameStartMode && gameState.playerDecks && gameState.playerDiscardPiles) {
      // Same Starting Point mode: update per-player decks
      const updatedPlayerDecks = {
        ...gameState.playerDecks,
        [playerId]: {
          ...gameState.playerDecks[playerId],
          [cardType]: availableDeck
        }
      };

      const updatedPlayerDiscardPiles = {
        ...gameState.playerDiscardPiles,
        [playerId]: {
          ...gameState.playerDiscardPiles[playerId],
          [cardType]: discardPile
        }
      };

      this.stateService.updateGameState({
        playerDecks: updatedPlayerDecks,
        playerDiscardPiles: updatedPlayerDiscardPiles
      });
    } else {
      // Battle Royale mode: update shared decks
      const updatedDecks = {
        ...gameState.decks,
        [cardType]: availableDeck
      };

      const updatedDiscardPiles = {
        ...gameState.discardPiles,
        [cardType]: discardPile
      };

      this.stateService.updateGameState({
        decks: updatedDecks,
        discardPiles: updatedDiscardPiles
      });
    }

    // Update player's hand with drawn cards
    const updatedHand = [...player.hand, ...drawnCards];

    // Update player's hand via TEMP state (or main state if no TEMP exists)
    // This ensures cards are preserved when commitTempToReal is called
    this.stateService.updateTempState(playerId, { hand: updatedHand });

    // Workstream 2: L cards are permanent — a law change doesn't unchange
    // just because the player keeps negotiating. Record each drawn L card
    // on the turn ledger so it survives Try Again. (Other card types draw
    // on the revertible inflow path, handled by the TEMP rollback.)
    if (cardType === 'L') {
      for (const drawnId of drawnCards) {
        this.stateService.recordTurnOutflow(playerId, { lifeEventDrawn: drawnId });
      }
    }

    // Quick Start mode: capture drawn cards to starting hand if capturing
    if (gameState.isCapturingStartingHand && drawnCards.length > 0) {
      const currentStartingHand = gameState.startingHand || [];
      this.stateService.updateGameState({
        startingHand: [...currentStartingHand, ...drawnCards]
      });
    }

    // Log the card draw with source tracking
    const sourceInfo = source || 'unknown';
    const reasonInfo = reason || `Drew ${count} ${cardType} cards`;
    // Card draw already logged to action history by core system
    // Card details logged in action history
    // Deck status logged internally

    // EffectEngine handles card draw logging with better context

    // Workstream 7 Phase 7.3 — scope-change revokes DOB approval.
    // Adding W cards (work packages) changes project scope. DOB approved the
    // OLD scope, so any prior approval is now stale. FDNY is unaffected (it
    // approves life-safety, not scope). Idempotent: if there's no prior approval
    // the revoke is a no-op (sets 'none' → 'none', [] → []).
    // Skipped when ApprovalService isn't injected (legacy tests, ghost bootstrap).
    // Note: this is a REAL-state write — Try Again won't restore the approval.
    // Rationale: in real life, filing a scope change with DOB invalidates the
    // approval even if you later withdraw the filing. Future Phase 7.x can
    // route through TEMP if Try Again rollback of approval becomes desired.
    if (this.approvalService && cardType === 'W' && drawnCards.length > 0) {
      this.stateService.updatePlayer({ id: playerId, ...this.approvalService.revoke('dob') });
    }

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
    
    try {
      // Step 1: Draw the card
      const drawnCards = this.drawCards(playerId, cardType, 1, source, reason);

      if (drawnCards.length === 0) {
        const error = ErrorNotifications.cardDrawFailed(cardType, 'No cards available in deck');
        debugWarn(error.medium);
        return { drawnCardId: null, success: false };
      }
      
      const drawnCardId = drawnCards[0];
      
      // Step 2: Apply card effects directly (bypassing cost validation/charging)
      // For automatic funding, we apply effects without charging costs
      this.applyCardEffects(playerId, drawnCardId);
      
      // Step 3: Handle card lifecycle (move to active or discard based on duration)
      this.finalizePlayedCard(playerId, drawnCardId);
      
      
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
      }
    }

    // Note: We don't remove from discard piles as those are managed centrally
    // and cards shouldn't be removed once discarded (except for reshuffling)

    if (!cardRemoved) {
      debugWarn(`Could not find card ${cardId} in player ${playerId}'s collections`);
    }

    // Update via TEMP state (or main state if no TEMP exists)
    // This ensures card removal is preserved when commitTempToReal is called
    this.stateService.updateTempState(playerId, {
      hand: updatedHand,
      activeCards: updatedActiveCards
    });

    return this.stateService.getGameState();
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
      debugWarn(`getCardType fallback: Using ID parsing for card ${cardId}. Consider updating card data.`);
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
  async playCard(playerId: string, cardId: string): Promise<GameState> {

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

      // Workstream 2: this is the user-initiated play path. Record the
      // card as consumed in the turn ledger so Try Again doesn't return it
      // to hand. (Auto-played cards go through CardEffectHandler and do
      // NOT call playCard, so they are correctly excluded from the ledger.)
      this.stateService.recordTurnOutflow(playerId, { cardConsumed: cardId });

      // Step 3: Apply card effects FIRST (validate they work before charging cost)
      await this.applyCardEffects(playerId, cardId);

      // Step 4: Pay card cost AFTER effects succeed
      if (card.cost && card.cost > 0) {
        // Skip cost charging for funding cards (B = Bank loans, I = Investor funding)
        if (card.card_type !== 'B' && card.card_type !== 'I') {
          if (!this.resourceService.canAfford(playerId, card.cost)) {
            const player = this.stateService.getPlayer(playerId);
            throw new Error(`Cannot afford card '${card.card_name}'. Cost: $${card.cost}, Available: $${player?.money ?? 0}`);
          }
          this.resourceService.spendMoney(playerId, card.cost, 'card_play', `Played card: ${card.card_name}`);
        }
      }
      
      // Step 5: Handle card activation based on duration
      if (card.duration) {
        const numericDuration = typeof card.duration === 'string' ? parseInt(card.duration, 10) : card.duration;
        if (numericDuration > 0) {
          // Card has duration - move to activeCards
          this.activateCard(playerId, cardId, numericDuration);
        } else {
          // Card has immediate effect - move to discarded
          this.moveCardToDiscarded(playerId, cardId);
        }
      } else {
        // Card has immediate effect - move to discarded
        this.moveCardToDiscarded(playerId, cardId);
      }
      
      
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

    // Get fresh player state after removal (removeCard updates TEMP state)
    const freshPlayer = this.stateService.getPlayer(playerId);
    if (!freshPlayer) {
      throw new Error(`Player ${playerId} not found after removeCard`);
    }

    // Add to activeCards
    const updatedActiveCards = [...freshPlayer.activeCards, { cardId, expirationTurn }];

    // Update via TEMP state (or main state if no TEMP exists)
    this.stateService.updateTempState(playerId, {
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

      // Get fresh target player state and add card to their hand
      const freshTargetPlayer = this.stateService.getPlayer(targetPlayerId);
      if (!freshTargetPlayer) {
        throw new Error(`Target player ${targetPlayerId} not found after removeCard`);
      }
      const updatedTargetHand = [...freshTargetPlayer.hand, cardId];

      // Update via TEMP state (or main state if no TEMP exists)
      this.stateService.updateTempState(targetPlayerId, {
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

        // Update active cards list via TEMP state (or main state if no TEMP exists)
        this.stateService.updateTempState(player.id, {
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

    // Add expired card to discard pile based on game mode
    const gameState = this.stateService.getGameState();
    const isSameStartMode = gameState.gameMode === 'SAME_START';

    if (isSameStartMode && gameState.playerDiscardPiles) {
      // Same Starting Point mode: use per-player discard piles
      const playerDiscards = gameState.playerDiscardPiles[playerId] || { W: [], B: [], E: [], L: [], I: [] };
      const updatedPlayerDiscardPiles = {
        ...gameState.playerDiscardPiles,
        [playerId]: {
          ...playerDiscards,
          [cardType]: [...(playerDiscards[cardType] || []), cardId]
        }
      };

      this.stateService.updateGameState({
        playerDiscardPiles: updatedPlayerDiscardPiles
      });
    } else {
      // Battle Royale mode: use shared discard pile
      const updatedDiscardPiles = {
        ...gameState.discardPiles,
        [cardType]: [...gameState.discardPiles[cardType], cardId]
      };

      this.stateService.updateGameState({
        discardPiles: updatedDiscardPiles
      });
    }

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

    // Add to discard pile based on game mode
    const gameState = this.stateService.getGameState();
    const isSameStartMode = gameState.gameMode === 'SAME_START';

    if (isSameStartMode && gameState.playerDiscardPiles) {
      // Same Starting Point mode: use per-player discard piles
      const playerDiscards = gameState.playerDiscardPiles[playerId] || { W: [], B: [], E: [], L: [], I: [] };
      const updatedPlayerDiscardPiles = {
        ...gameState.playerDiscardPiles,
        [playerId]: {
          ...playerDiscards,
          [cardType]: [...(playerDiscards[cardType] || []), cardId]
        }
      };

      this.stateService.updateGameState({
        playerDiscardPiles: updatedPlayerDiscardPiles
      });
    } else {
      // Battle Royale mode: use shared discard pile
      const updatedDiscardPiles = {
        ...gameState.discardPiles,
        [cardType]: [...gameState.discardPiles[cardType], cardId]
      };

      this.stateService.updateGameState({
        discardPiles: updatedDiscardPiles
      });
    }

    // Update player's hand via TEMP state (or main state if no TEMP exists)
    this.stateService.updateTempState(playerId, {
      hand: updatedHand
    });

  }

  /**
   * Public method to discard a played card (move from available to discarded)
   * Used by EffectEngine for PLAY_CARD effects when card has no duration
   */
  public discardPlayedCard(playerId: string, cardId: string): void {
    this.moveCardToDiscarded(playerId, cardId);
  }

  /**
   * Public method to finalize a played card's lifecycle
   * Determines if card should be activated (has duration) or discarded (immediate effect)
   * Used by EffectEngine for PLAY_CARD effects
   */
  public finalizePlayedCard(playerId: string, cardId: string): void {

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
      this.activateCard(playerId, cardId, duration);
    } else {
      this.discardPlayedCard(playerId, cardId);
    }
  }

  // Card effect methods - Enhanced with UnifiedEffectEngine integration
  async applyCardEffects(playerId: string, cardId: string): Promise<GameState> {
    // Ensure EffectEngineService is ready before processing card effects
    this.assertEffectEngineReady();

    const card = this.dataService.getCardById(cardId);
    if (!card) {
      debugWarn(`Card ${cardId} not found in database`);
      return this.stateService.getGameState();
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }


    // Special handling for E024 "Return to Sender"
    if (card.card_id === 'E024') {
      await this.handleReturnToSender(playerId, card);
      return this.stateService.getGameState();
    }

    // Special handling for E009 "Favor Called In" - Choose opponent, they +2 days, you -2 days
    if (card.card_id === 'E009') {
      await this.handleFavorCalledIn(playerId, card);
      return this.stateService.getGameState();
    }

    // Step 1: Parse card data into standardized Effect objects
    const effects = this.parseCardIntoEffects(card, playerId);

    if (effects.length > 0) {

      // Step 2: Process effects through UnifiedEffectEngine synchronously
      const context = {
        source: `card:${cardId}`,
        playerId: playerId,
        triggerEvent: 'CARD_PLAY' as const
      };

      try {
        const batchResult = await this.effectEngineService.processCardEffects(effects, context, card);
        if (batchResult.success) {
        } else {
          console.error(`❌ Card effect processing failed: ${batchResult.errors.join(', ')}`);
          throw new Error(`Card effect processing failed: ${batchResult.errors.join(', ')}`);
        }
      } catch (error) {
        console.error(`❌ Error processing card effects:`, error);
        throw error;
      }
    }

    // Workstream 7 Phase 7.3 — data-driven approval revocation.
    // L cards (and any others) with `revokes_approval` set in CARDS_EXPANDED.csv
    // invalidate the specified approval(s). Examples: L003 "New Safety Regulations"
    // and L020 "Building Code Update" force DOB approval to be re-obtained because
    // the code changed underneath the prior approval. Idempotent if no prior
    // approval was active.
    if (this.approvalService && card.revokes_approval) {
      this.stateService.updatePlayer({
        id: playerId,
        ...this.approvalService.revoke(card.revokes_approval),
      });
    }

    // Legacy card type logging for debugging

    return this.stateService.getGameState();
  }

  /**
   * Parse card CSV data into standardized Effect objects for the UnifiedEffectEngine
   * This bridges the gap between CSV field structure and the Effect system
   */
  private parseCardIntoEffects(card: Card, playerId: string): Effect[] {
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
            sourceType: 'other',  // Card effects categorized as 'other'
            reason: `${card.card_name}: ${moneyAmount > 0 ? '+' : ''}$${Math.abs(moneyAmount).toLocaleString()}`
          }
        });
      }
    }

    // MODIFY_RESOURCE effects from tick_modifier field (time effects)
    if (card.tick_modifier && card.tick_modifier !== '0') {
      const timeAmount = parseInt(card.tick_modifier, 10);
      if (!isNaN(timeAmount) && timeAmount !== 0) {
        // Check if this is a Global scope card - affects all players
        const isGlobalScope = card.scope && card.scope.toLowerCase() === 'global';

        if (isGlobalScope) {
          // Apply to ALL players, optionally filtered by phase. v3.0.17:
          // cards like L026 ("All permit filing times decrease by 1 day")
          // should only tick down players who are currently *filing* (i.e.
          // standing on a REGULATORY-phase space). The affected_phase column
          // narrows the fan-out; empty/undefined preserves the original
          // unrestricted behavior (every player gets the delta).
          const requiredPhase = card.affected_phase?.trim();
          const gameState = this.stateService.getGameState();
          for (const player of gameState.players) {
            if (requiredPhase) {
              const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
              if (spaceConfig?.phase !== requiredPhase) {
                continue; // Player not in the required phase — skip them.
              }
            }
            effects.push({
              effectType: 'RESOURCE_CHANGE',
              payload: {
                playerId: player.id,
                resource: 'TIME',
                amount: timeAmount,
                source: cardSource,
                reason: `${card.card_name}: ${timeAmount > 0 ? '+' : ''}${timeAmount} days${requiredPhase ? ` (all ${requiredPhase.toLowerCase()}-phase players)` : ' (affects all players)'}`
              }
            });
          }
        } else {
          // Apply to current player only
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId: playerId,
              resource: 'TIME',
              amount: timeAmount, // Positive = add time, negative = spend time
              source: cardSource,
              reason: `${card.card_name}: ${timeAmount > 0 ? '+' : ''}${timeAmount} days`
            }
          });
        }
      }
    }

    // DRAW_CARDS effects from draw_cards field
    if (card.draw_cards && card.draw_cards.trim() !== '') {
      const drawParsed = parseCardDrawFormat(card.draw_cards);
      if (drawParsed) {
        const { count, cardType } = drawParsed;

        if (count > 0) {
          const isGlobalScope = card.scope && card.scope.toLowerCase() === 'global';

          if (isGlobalScope) {
            // Apply to ALL players (e.g. L049 "Each player draws 1 Expeditor Card")
            const gameState = this.stateService.getGameState();
            for (const targetPlayer of gameState.players) {
              effects.push({
                effectType: 'CARD_DRAW',
                payload: {
                  playerId: targetPlayer.id,
                  cardType: cardType,
                  count: count,
                  source: cardSource,
                  reason: `${card.card_name}: Draw ${count} ${cardType} card${count > 1 ? 's' : ''} (affects all players)`
                }
              });
            }
          } else {
            effects.push({
              effectType: 'CARD_DRAW',
              payload: {
                playerId: playerId,
                cardType: cardType,
                count: count,
                source: cardSource,
                reason: `${card.card_name}: Draw ${count} ${cardType} card${count > 1 ? 's' : ''}`
              }
            });
          }
        }
      }
    }

    // CARD_DISCARD effects from discard_cards field
    if (card.discard_cards && card.discard_cards.trim() !== '') {
      const discardParsed = parseCardDrawFormat(card.discard_cards);
      if (discardParsed) {
        const { count, cardType } = discardParsed;

        if (count > 0) {
          const isGlobalScope = card.scope && card.scope.toLowerCase() === 'global';

          if (isGlobalScope) {
            // v3.0.17 — Global DISCARD fan-out (L003 "All players must
            // discard 1 Expeditor card", L048 "Graft Investigation"). Mirrors
            // the L049 DRAW fan-out pattern at line 1166. Each player gets
            // their OWN CARD_DISCARD effect with their own playerId, and the
            // `requiresUserChoice` flag triggers the per-player modal in the
            // handler so each player picks WHICH of their E cards to drop
            // (instead of the engine auto-picking oldest). Effects process
            // serially via EffectEngineService — the single-slot
            // `awaitingChoice` naturally queues each player's pick in turn.
            // <!-- fb:feedback-1779570521283-2fe0db6c follow-up — L003/L048 -->
            const gameState = this.stateService.getGameState();
            for (const targetPlayer of gameState.players) {
              effects.push({
                effectType: 'CARD_DISCARD',
                payload: {
                  playerId: targetPlayer.id,
                  cardIds: [], // Will be resolved at runtime
                  cardType: cardType,
                  count: count,
                  source: cardSource,
                  requiresUserChoice: true,
                  reason: `${card.card_name}: ${targetPlayer.name} discards ${count} ${cardType || 'any'} card${count > 1 ? 's' : ''} (affects all players)`
                }
              });
            }
          } else {
            effects.push({
              effectType: 'CARD_DISCARD',
              payload: {
                playerId: playerId,
                cardIds: [], // Will be resolved at runtime
                cardType: cardType,
                count: count,
                source: cardSource,
                reason: `${card.card_name}: Discard ${count} ${cardType || 'any'} card${count > 1 ? 's' : ''}`
              }
            });
          }
        }
      }
    }

    // RESOURCE_CHANGE effects from loan_amount field (B cards)
    // Skip money effects when this space auto-applies funding for B cards
    // (handleAutomaticFunding handles the money instead, avoiding double-count).
    // Workstream 6 #3: lifted from `=== 'OWNER-FUND-INITIATION'` to data flag.
    if (card.card_type === 'B' && card.loan_amount) {
      const loanAmount = parseInt(card.loan_amount, 10);
      if (!isNaN(loanAmount) && loanAmount > 0) {
        const player = this.stateService.getPlayer(playerId);
        const autoTypes = player ? this.dataService.getAutoTriggerCardTypes(player.currentSpace) : [];
        const skipDirectMoney = autoTypes.includes('B');

        if (!skipDirectMoney) {
          // Calculate interest (loan_rate is stored as percentage, e.g., 5 for 5%)
          const interestRate = card.loan_rate ? parseFloat(card.loan_rate) / 100 : 0;
          const interestFee = Math.round(loanAmount * interestRate);

          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId: playerId,
              resource: 'MONEY',
              amount: loanAmount,
              source: cardSource,
              sourceType: 'bank',
              reason: `${card.card_name}: Loan of $${loanAmount.toLocaleString()}${interestFee > 0 ? ` at ${card.loan_rate}% interest` : ''}`
            }
          });

          // Deduct interest upfront for bank loans
          if (interestFee > 0) {
            effects.push({
              effectType: 'RESOURCE_CHANGE',
              payload: {
                playerId: playerId,
                resource: 'MONEY',
                amount: -interestFee,
                source: cardSource,
                sourceType: 'other',
                reason: `${card.card_name}: Interest fee (${card.loan_rate}%): -$${interestFee.toLocaleString()}`
              }
            });
          }
        }
      }
    }

    // RESOURCE_CHANGE effects from investment_amount field (I cards)
    // Skip money effects when this space auto-applies funding for I cards.
    // Workstream 6 #3: lifted from `=== 'OWNER-FUND-INITIATION'` to data flag.
    if (card.card_type === 'I' && card.investment_amount) {
      const investmentAmount = parseInt(card.investment_amount, 10);
      if (!isNaN(investmentAmount) && investmentAmount > 0) {
        const player = this.stateService.getPlayer(playerId);
        const autoTypes = player ? this.dataService.getAutoTriggerCardTypes(player.currentSpace) : [];
        const skipDirectMoney = autoTypes.includes('I');

        if (!skipDirectMoney) {
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId: playerId,
              resource: 'MONEY',
              amount: investmentAmount,
              source: cardSource,
              sourceType: 'investment',
              reason: `${card.card_name}: Investment of $${investmentAmount.toLocaleString()}`
            }
          });
        }
      }
    }

    // TURN_CONTROL effects from turn_effect field (skip turn)
    if (card.turn_effect && card.turn_effect.toLowerCase().includes('skip')) {
      effects.push({
        effectType: 'TURN_CONTROL',
        payload: {
          action: 'SKIP_TURN',
          playerId: playerId,
          source: cardSource,
          reason: `Card effect: ${card.card_name}`
        }
      });
    }

    return effects;
  }


  // Private helper methods
  private requiresPlayerTurn(cardType: CardType): boolean {
    // Some card types might require it to be the player's turn
    // For now, assume all cards can be played anytime during PLAY phase
    return false;
  }

  private applyWorkCardEffect(playerId: string, card: Card): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Work cards represent project scopes that add to the player's project value
    // Extract estimated cost from description for project value calculation
    const costMatch = card.description.match(/\$([0-9,]+)/);
    if (costMatch) {
      const projectValue = parseInt(costMatch[1].replace(/,/g, ''));
      
      // Work cards contribute to player's total project portfolio value
      // This could be used for win conditions or scoring in future phases
      const currentProjectValue = player.money; // For now, work cards don't change money directly
    } else {
    }
    
    return this.stateService.getGameState();
  }

  private applyBankLoanCardEffect(playerId: string, card: Card): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Log loan details if available
    if (card.loan_amount) {
      const loanAmount = parseInt(card.loan_amount);
      if (!isNaN(loanAmount) && loanAmount > 0) {
        if (card.loan_rate) {
        }
      }
    }
    
    return this.stateService.getGameState();
  }

  private applyExpeditorCardEffect(playerId: string, card: Card): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Prefer structured columns (money_effect, tick_modifier) over parsing effects_on_play text
    let hasStructuredData = false;

    // Apply money effect from structured column
    if (card.money_effect) {
      const moneyVal = parseInt(card.money_effect);
      if (!isNaN(moneyVal) && moneyVal !== 0) {
        hasStructuredData = true;
        if (moneyVal > 0) {
          this.resourceService.addMoney(playerId, moneyVal, 'expeditor_card', `Expeditor card: ${card.card_name}`);
        } else {
          const cost = Math.abs(moneyVal);
          if (this.resourceService.canAfford(playerId, cost)) {
            this.resourceService.spendMoney(playerId, cost, 'expeditor_card', `Expeditor card: ${card.card_name}`);
          } else {
            debugWarn(`⚠️ Expeditor card ${card.card_name}: Player cannot afford $${cost} (has $${player.money})`);
          }
        }
      }
    }

    // Apply time effect from structured column
    if (card.tick_modifier) {
      const tickVal = parseInt(card.tick_modifier);
      if (!isNaN(tickVal) && tickVal !== 0) {
        hasStructuredData = true;
        // Negative tick_modifier = reduce time spent (benefit), positive = increase
        this.stateService.updateTempState(playerId, {
          timeSpent: Math.max(0, player.timeSpent + tickVal)
        });
      }
    }

    // Apply card draw from structured column
    if (card.draw_cards) {
      const drawCount = parseInt(card.draw_cards);
      if (!isNaN(drawCount) && drawCount > 0) {
        hasStructuredData = true;
        const cardTypes: CardType[] = ['W', 'B', 'I', 'L', 'E'];
        const randomCardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
        try {
          this.drawCards(playerId, randomCardType, drawCount);
        } catch (error) {
          debugWarn(`Could not draw ${randomCardType} card:`, error);
          for (const fallbackType of cardTypes) {
            if (fallbackType !== randomCardType) {
              try {
                this.drawCards(playerId, fallbackType, drawCount);
                break;
              } catch (fallbackError) {
                // Continue to next type
              }
            }
          }
        }
      }
    }

    // Legacy fallback: parse effects_on_play text if no structured data was found
    if (!hasStructuredData) {
      const effects = card.effects_on_play || '';

      if (effects.includes('gain $')) {
        const moneyMatch = effects.match(/gain \$(\d+)/);
        if (moneyMatch) {
          const moneyGain = parseInt(moneyMatch[1]);
          this.resourceService.addMoney(playerId, moneyGain, 'expeditor_card', `Expeditor card: ${card.card_name}`);
        }
      }

      if (effects.includes('time units')) {
        const timeMatch = effects.match(/(\d+)\s+time\s+units/);
        if (timeMatch) {
          const timeGain = parseInt(timeMatch[1]);
          this.stateService.updateTempState(playerId, {
            timeSpent: Math.max(0, player.timeSpent - timeGain)
          });
        }
      }

      if (effects.includes('Draw 1 card')) {
        const cardTypes: CardType[] = ['W', 'B', 'I', 'L', 'E'];
        const randomCardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
        try {
          this.drawCards(playerId, randomCardType, 1);
        } catch (error) {
          debugWarn(`Could not draw ${randomCardType} card:`, error);
          for (const fallbackType of cardTypes) {
            if (fallbackType !== randomCardType) {
              try {
                this.drawCards(playerId, fallbackType, 1);
                break;
              } catch (fallbackError) {
                // Continue to next type
              }
            }
          }
        }
      }
    }
    
    return this.stateService.getGameState();
  }

  private applyLifeEventsCardEffect(playerId: string, card: Card): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Life Events cards create random events and unforeseen circumstances
    // Parse the effects_on_play field for specific benefits
    const effects = card.effects_on_play || '';
    
    if (effects.includes('Enables')) {
    }
    
    if (effects.includes('reduces') && effects.includes('risk')) {
    }
    
    if (effects.includes('Prevents')) {
    }
    
    if (effects.includes('Expands')) {
    }
    
    // Life Events cards provide random circumstances that affect gameplay
    
    return this.stateService.getGameState();
  }

  private applyInvestorLoanCardEffect(playerId: string, card: Card): GameState {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Determine investor payout: prefer structured investor_payout column, fall back to card_name parsing
    let moneyGain = 0;

    if (card.investor_payout != null) {
      // Structured column: negative value = percentage formula (e.g., -20 = 20% of money + 10000)
      if (card.investor_payout < 0) {
        moneyGain = Math.floor(player.money * Math.abs(card.investor_payout) / 100) + 10000;
      } else {
        moneyGain = card.investor_payout;
      }
    } else {
      // Legacy fallback: parse card name
      const cardName = card.card_name.toLowerCase();
      if (cardName.includes('angel investor')) {
        moneyGain = 50000;
      } else if (cardName.includes('venture capital')) {
        moneyGain = 200000;
      } else if (cardName.includes('crowdfunding')) {
        moneyGain = Math.floor(player.money * 0.2) + 10000;
      } else {
        moneyGain = 25000;
      }
    }
    
    if (moneyGain > 0) {
      this.resourceService.addMoney(
        playerId,
        moneyGain,
        `card:${card.card_id}`,
        `${card.card_name}: Investment secured $${moneyGain.toLocaleString()}`,
        'investment'  // Investment cards categorized as investment income
      );
    }
    
    return this.stateService.getGameState();
  }

  // Discard cards with source tracking
  discardCards(playerId: string, cardIds: string[], source?: string, reason?: string): boolean {
    if (!cardIds || cardIds.length === 0) {
      const error = ErrorNotifications.cardDiscardFailed('unknown', 'No cards provided');
      debugWarn(error.medium);
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
    const isSameStartMode = gameState.gameMode === 'SAME_START';

    // Process each card type
    for (const [cardType, cards] of Object.entries(cardsByType)) {
      // Remove from hand
      updatedHand = updatedHand.filter(cardId => !cards.includes(cardId));

      // Remove from active cards
      for (const cardId of cards) {
        const activeIndex = updatedActiveCards.findIndex(active => active.cardId === cardId);
        if (activeIndex !== -1) {
          updatedActiveCards.splice(activeIndex, 1);
        }
      }
    }

    // Update discard piles and player state
    try {
      if (isSameStartMode && gameState.playerDiscardPiles) {
        // Same Starting Point mode: use per-player discard piles
        const playerDiscards = gameState.playerDiscardPiles[playerId] || { W: [], B: [], E: [], L: [], I: [] };
        const updatedPlayerDiscards = { ...playerDiscards };

        for (const [cardType, cards] of Object.entries(cardsByType)) {
          const typedCardType = cardType as CardType;
          updatedPlayerDiscards[typedCardType] = [
            ...(updatedPlayerDiscards[typedCardType] || []),
            ...cards
          ];
        }

        this.stateService.updateGameState({
          playerDiscardPiles: {
            ...gameState.playerDiscardPiles,
            [playerId]: updatedPlayerDiscards
          }
        });
      } else {
        // Battle Royale mode: use shared discard piles
        const updatedDiscardPiles = { ...gameState.discardPiles };

        for (const [cardType, cards] of Object.entries(cardsByType)) {
          const typedCardType = cardType as CardType;
          if (!updatedDiscardPiles[typedCardType]) {
            updatedDiscardPiles[typedCardType] = [];
          }
          updatedDiscardPiles[typedCardType] = [
            ...updatedDiscardPiles[typedCardType],
            ...cards
          ];
        }

        this.stateService.updateGameState({
          discardPiles: updatedDiscardPiles
        });
      }

      // Update player's cards via TEMP state (or main state if no TEMP exists)
      this.stateService.updateTempState(playerId, {
        hand: updatedHand,
        activeCards: updatedActiveCards
      });

      // Log the transaction
      const cardSummary = Object.entries(cardsByType)
        .map(([type, cards]) => `${cards.length}x${type}`)
        .join(', ');

      const sourceInfo = source || 'manual';
      const reasonInfo = reason || `Discarded ${cardIds.length} card${cardIds.length > 1 ? 's' : ''}`;


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

  /**
   * Handle E024 "Return to Sender" - Returns a target active E card to its owner's hand
   *
   * This card allows the player to select any active E card (from any player) and
   * return it to that player's hand, canceling its ongoing effect.
   */
  private async handleReturnToSender(playerId: string, card: Card): Promise<void> {

    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;

    // Collect all active E cards from all players
    const activeECards: { cardId: string; ownerId: string; ownerName: string; cardName: string }[] = [];

    for (const player of allPlayers) {
      if (player.activeCards && player.activeCards.length > 0) {
        for (const activeCard of player.activeCards) {
          // Check if this is an E card
          const cardData = this.dataService.getCardById(activeCard.cardId);
          if (cardData && cardData.card_type === 'E') {
            activeECards.push({
              cardId: activeCard.cardId,
              ownerId: player.id,
              ownerName: player.name,
              cardName: cardData.card_name
            });
          }
        }
      }
    }

    if (activeECards.length === 0) {
      this.loggingService.info(`${card.card_name} played but no active E cards to target`, {
        playerId: playerId,
        action: 'card_no_target'
      });
      return;
    }

    let selectedCard: typeof activeECards[0] | null = null;

    if (activeECards.length === 1) {
      // Only one target - auto-select
      selectedCard = activeECards[0];
    } else {
      // Multiple targets - present choice
      if (!this.choiceService) {
        console.error('❌ ChoiceService not available - cannot present card selection');
        // Fall back to first card
        selectedCard = activeECards[0];
      } else {
        const options = activeECards.map(ec => ({
          id: ec.cardId,
          label: `${ec.cardName} (${ec.ownerName}'s)`
        }));

        const selection = await this.choiceService.createChoice(
          playerId,
          'CARD_SELECTION',
          'Choose an active Expeditor card to return to its owner\'s hand:',
          options
        );

        if (selection && selection !== '') {
          selectedCard = activeECards.find(ec => ec.cardId === selection) || null;
        }
      }
    }

    if (!selectedCard) {
      return;
    }

    // Return the card to its owner's hand
    const owner = allPlayers.find(p => p.id === selectedCard!.ownerId);
    if (!owner) {
      console.error(`❌ Owner ${selectedCard.ownerId} not found`);
      return;
    }

    // Remove from owner's activeCards
    const updatedActiveCards = owner.activeCards.filter(
      ac => ac.cardId !== selectedCard!.cardId
    );

    // Add back to owner's hand
    const updatedHand = [...owner.hand, selectedCard.cardId];

    // Update owner's state
    this.stateService.updatePlayer({
      id: owner.id,
      hand: updatedHand,
      activeCards: updatedActiveCards
    });


    // Log the action
    const currentPlayer = allPlayers.find(p => p.id === playerId);
    this.loggingService.info(`${currentPlayer?.name || 'Player'} returned ${selectedCard.cardName} to ${owner.name}'s hand`, {
      playerId: playerId,
      targetPlayerId: owner.id,
      cardId: selectedCard.cardId,
      cardName: selectedCard.cardName,
      action: 'card_return_to_hand'
    });
  }

  /**
   * Handle E009 "Favor Called In" - Choose opponent, they get +2 days, you get -2 days
   *
   * This card requires selecting an opponent and applying opposite time effects.
   */
  private async handleFavorCalledIn(playerId: string, card: Card): Promise<void> {

    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;
    const currentPlayer = allPlayers.find(p => p.id === playerId);

    // Get opponents (all players except current)
    const opponents = allPlayers.filter(p => p.id !== playerId);

    if (opponents.length === 0) {
      // Still apply benefit to self in single player (spendTime reduces time spent)
      this.resourceService.spendTime(playerId, 2, `card:${card.card_id}`, `${card.card_name}: -2 days`);
      this.loggingService.info(`${card.card_name} played - no opponents, self benefit only`, {
        playerId: playerId,
        action: 'card_no_target'
      });
      return;
    }

    let selectedOpponent: Player | null = null;

    if (opponents.length === 1) {
      // Only one opponent - auto-select
      selectedOpponent = opponents[0];
    } else {
      // Multiple opponents - present choice
      if (!this.choiceService) {
        console.error('❌ ChoiceService not available - auto-selecting first opponent');
        selectedOpponent = opponents[0];
      } else {
        const options = opponents.map(p => ({
          id: p.id,
          label: p.name
        }));

        const selection = await this.choiceService.createChoice(
          playerId,
          'TARGET_SELECTION',
          'Choose an opponent to slow down:',
          options
        );

        if (selection && selection !== '') {
          selectedOpponent = opponents.find(p => p.id === selection) || null;
        }
      }
    }

    if (!selectedOpponent) {
      return;
    }

    // Apply effects: opponent gets +2 days (slower), player gets -2 days (faster)
    const cardSource = `card:${card.card_id}`;

    // Opponent gets +2 days (penalty) - addTime increases time spent
    this.resourceService.addTime(
      selectedOpponent.id,
      2,
      cardSource,
      `${card.card_name}: +2 days (targeted by ${currentPlayer?.name})`
    );

    // Player gets -2 days (benefit) - spendTime reduces time spent
    this.resourceService.spendTime(
      playerId,
      2,
      cardSource,
      `${card.card_name}: -2 days`
    );


    // Log the action
    this.loggingService.info(`${currentPlayer?.name} called in a favor: ${selectedOpponent.name} slowed down`, {
      playerId: playerId,
      targetPlayerId: selectedOpponent.id,
      action: 'favor_called_in'
    });
  }
}
