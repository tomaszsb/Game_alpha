import { ICardService, IDataService, IStateService, IResourceService, IEffectEngineService, ILoggingService, IGameRulesService, IChoiceService, IApprovalService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import { GameState, Player } from '../types/StateTypes';
import { Card, CardType } from '../types/DataTypes';
import { Effect } from '../types/EffectTypes';
import { ErrorNotifications } from '../utils/ErrorNotifications';
import { parseCardDrawFormat } from '../utils/parseUtils';
import { getCardTypeName } from '../utils/cardTypeNames';
import { friendlyCardList } from '../utils/logFormatting';
import { getViolationTier, computeFilingFee, computeDailyAccrual, VIOLATION_DEADLINE_DAYS, ViolationVariant } from '../utils/violationRules';

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
   * @param _reason - Human-readable reason for the draw. Accepted for the
   *   ICardService contract but unused here: card draws are logged by
   *   EffectEngine, which has richer context than this method does.
   * @returns Array of drawn card IDs
   */
  drawCards(playerId: string, cardType: CardType, count: number, source?: string, _reason?: string): string[] {
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

        // Domain-event stage 4: LogWriter reacts to this (voice rule — no
        // game language: use the real-world type label and card names, never
        // the raw type letter or the word "card(s)" — matches
        // CardEffectHandler.logCardDraw).
        this.stateService.emitGameEvent({
          type: 'card_drawn',
          playerId: player.id,
          cardType,
          count: preSelectedOfType.length,
          cards: preSelectedOfType,
          source: source || 'educational_mode',
          message: `Drew ${preSelectedOfType.length} ${getCardTypeName(cardType, preSelectedOfType.length)}: ${friendlyCardList(this.dataService, preSelectedOfType)}`,
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

        // Domain-event stage 4: LogWriter reacts to this. Voice rule (no
        // game language): no "Deck"/"Discard pile" — frame it as recycling
        // the real-world item type, not board-game mechanics.
        this.stateService.emitGameEvent({
          type: 'deck_reshuffled',
          playerId: player.id,
          cardType: cardType,
          message: `Ran low on new ${getCardTypeName(cardType, 2)} — recycled earlier ones back into the pool.`,
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
    // Routes through TEMP so Try Again restores the prior approval (the W draw
    // itself already rolls back via TEMP, so leaving the approval revoked while
    // un-drawing the scope change would be inconsistent).
    if (this.approvalService && cardType === 'W' && drawnCards.length > 0) {
      // Domain-event stage 4: revoke() now owns the "was there something to
      // lose" gating check + message text (was duplicated here and at the
      // CSV revokes_approval site below) — this caller just forwards.
      const revokeResult = this.approvalService.revoke(player, 'dob', {
        spaceName: player.currentSpace,
        reason: 'scope_change',
      });
      if (revokeResult.event) this.stateService.emitGameEvent(revokeResult.event);
      this.stateService.updateTempState(playerId, revokeResult.update);
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

    // Discard the old card (lands in the discard pile so it waits there for
    // reshuffling, per maintainer ruling 2026-07-11) and draw a replacement.
    // Note: removeCard() would strip the card from hand/activeCards without
    // ever placing it in a discard pile — a permanent leak from the card pool.
    const discarded = this.discardCards(
      playerId,
      [oldCardId],
      'manual_effect',
      `Manual action: Replace ${newCardType} card - removing old card`
    );
    if (!discarded) {
      const error = ErrorNotifications.cardDiscardFailed(oldCardId, `Failed to discard card during replacement`);
      throw new Error(error.detailed);
    }
    const drawnCards = this.drawCards(playerId, newCardType, 1);
    
    // Domain-event stage 4: LogWriter reacts to this. Note: replaceCard()'s
    // internal discardCards() call above also logs its own generic
    // "Discarded 1 card" entry — a pre-existing "2 log lines for 1 action"
    // quirk, left as-is this stage (not silently merged).
    const newCardId = drawnCards.length > 0 ? drawnCards[0] : null;
    const newCard = newCardId ? this.dataService.getCardById(newCardId) : null;

    this.stateService.emitGameEvent({
      type: 'card_replaced',
      playerId: playerId,
      oldCardId: oldCardId,
      newCardId: newCardId,
      newCardType: newCardType,
      message: `Replaced "${oldCard?.card_name}" with "${newCard?.card_name}".`,
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
      // (delegates to finalizePlayedCard so hand-play and PLAY_CARD-effect
      // paths share one duration lifecycle keyed off duration_count — see
      // finalizePlayedCard for the parsing logic). suppressActivationEvent
      // so this flow emits ONE merged card_played event below instead of
      // a separate standalone card_activated for the same player action.
      const finalizeResult = this.finalizePlayedCard(playerId, cardId, { suppressActivationEvent: true });

      // Domain-event stage 4: LogWriter reacts to this.
      const player = this.stateService.getPlayer(playerId);
      if (player) {
        this.stateService.emitGameEvent({
          type: 'card_played',
          playerId: playerId,
          cardId: cardId,
          cardName: card.card_name || cardId,
          activated: finalizeResult.activated,
          durationTurns: finalizeResult.durationTurns,
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
      // Defense-in-depth: UI should gate unaffordable cards via canPlayCard,
      // but the service layer checks independently so the engine never fires
      // a 32-error RESOURCE_CHANGE cascade on insufficient funds.
      const card = this.dataService.getCardById(cardId);
      if (card?.money_effect) {
        const moneyCost = parseInt(card.money_effect, 10);
        if (!isNaN(moneyCost) && moneyCost < 0) {
          const player = this.stateService.getPlayer(playerId);
          const required = Math.abs(moneyCost);
          if (player && player.money < required) {
            return {
              isValid: false,
              errorMessage: `Not enough funds to activate ${card.card_name}. Costs $${required.toLocaleString()} — you have $${player.money.toLocaleString()}.`
            };
          }
        }
      }
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
        return 'REGULATORY';
      default:
        return null;
    }
  }


  // Public method to activate a card with duration-based effects.
  // suppressEvent: domain-event stage 4 — set by finalizePlayedCard when
  // called from playCard()'s single-action flow, so that flow emits ONE
  // merged card_played (activated:true) event instead of two events for
  // one player action. Every OTHER caller (CardEffectHandler's standalone
  // CARD_ACTIVATION effect handler, etc.) leaves this unset and gets the
  // standalone card_activated event exactly as before.
  public activateCard(playerId: string, cardId: string, duration: number, suppressEvent?: boolean): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    const gameState = this.stateService.getGameState();
    const expirationTurn = gameState.globalTurnCount + duration;

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

    if (!suppressEvent) {
      const card = this.dataService.getCardById(cardId);
      this.stateService.emitGameEvent({
        type: 'card_activated',
        playerId: playerId,
        cardId: cardId,
        cardName: card?.card_name,
        durationTurns: duration,
      });
    }
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
      
      // Domain-event stage 4: LogWriter reacts to this.
      const card = this.dataService.getCardById(cardId);
      this.stateService.emitGameEvent({
        type: 'card_transferred',
        sourcePlayerId: sourcePlayerId,
        targetPlayerId: targetPlayerId,
        cardId: cardId,
        cardName: card?.card_name,
        message: `Transferred ${card?.card_name || cardId} to ${targetPlayer.name}`,
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
    const currentTurn = gameState.globalTurnCount;

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
          // Domain-event stage 4: LogWriter reacts to this.
          const card = this.dataService.getCardById(expiredCardId);
          this.stateService.emitGameEvent({
            type: 'card_expired',
            playerId: player.id,
            cardId: expiredCardId,
            cardName: card?.card_name,
            message: `"${card?.card_name}" expired.`,
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
   *
   * options.suppressActivationEvent: domain-event stage 4 — playCard()'s
   * single-action flow passes this so it can emit ONE merged card_played
   * event (with activated/durationTurns folded in) instead of a separate
   * standalone card_activated. Every other caller leaves it unset.
   */
  public finalizePlayedCard(
    playerId: string,
    cardId: string,
    options?: { suppressActivationEvent?: boolean }
  ): { activated: boolean; durationTurns?: number } {

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
      this.activateCard(playerId, cardId, duration, options?.suppressActivationEvent);
      return { activated: true, durationTurns: duration };
    } else {
      this.discardPlayedCard(playerId, cardId);
      return { activated: false };
    }
  }

  // Card effect methods - Enhanced with UnifiedEffectEngine integration
  //
  // options.onlyResourceEffects: apply ONLY the money/time (RESOURCE_CHANGE)
  // effects and nothing else. Used by the auto life-event path. Rationale:
  // routing a full life-event card through the engine inline (draws, discards,
  // choices, duration, global card fan-out) introduced blocking/looping hazards
  // that hung the headless ghost gate. RESOURCE_CHANGE effects are pure
  // arithmetic — they can't draw, prompt, or recurse — so this subset is
  // safe-by-construction. It still benefits from parseCardIntoEffects' global
  // time fan-out and work_type_conditional gating. The richer effects (free
  // E-card draws, forced discards, multi-turn duration) are deferred. Manual
  // card play passes no options → full behavior unchanged.
  async applyCardEffects(playerId: string, cardId: string, options?: { onlyResourceEffects?: boolean; diceRoll?: number }): Promise<GameState> {
    // Ensure EffectEngineService is ready before processing card effects
    this.assertEffectEngineReady();

    const card = this.dataService.getCardById(cardId);
    if (!card) {
      debugWarn(`Card ${cardId} not found in database`);
      return this.stateService.getGameState();
    }

    // Dice-conditional cards (e.g. L009 "roll 1-3 → +5 days, else 0") need an
    // originating dice roll to evaluate. Without a dice roll (CardEffectHandler
    // unconditional draws), we still skip — there's nothing to condition on.
    if (options?.onlyResourceEffects && card.card_mechanic === 'dice_conditional' && options.diceRoll === undefined) {
      return this.stateService.getGameState();
    }

    // Kid D (2026-05-29) — when a dice_conditional card has a dice roll, swap
    // its raw tick_modifier for the range-matched value so the downstream
    // parseCardIntoEffects emits the correct tick (parseCardIntoEffects is
    // dice-range-unaware; this prepass lets us reuse it without changes).
    let effectiveCard: Card = card;
    if (options?.onlyResourceEffects && card.card_mechanic === 'dice_conditional' && options.diceRoll !== undefined) {
      const roll = options.diceRoll;
      let matchedTime: number | undefined;
      if (card.dice_range_1_min != null && card.dice_range_1_max != null
          && roll >= card.dice_range_1_min && roll <= card.dice_range_1_max) {
        matchedTime = card.dice_range_1_time ?? 0;
      } else if (card.dice_range_2_min != null && card.dice_range_2_max != null
          && roll >= card.dice_range_2_min && roll <= card.dice_range_2_max) {
        matchedTime = card.dice_range_2_time ?? 0;
      } else {
        matchedTime = 0; // No matching range — fall to "no effect".
      }
      // Card.tick_modifier is string in DataTypes (parseCardIntoEffects parseInts it).
      effectiveCard = { ...card, tick_modifier: String(matchedTime) };
    }

    // Kid E (2026-05-29) — fan-out collision guard. When the parser already
    // produced one effect per player (scope=Global, no duration), the engine's
    // processEffectsWithTargeting would re-fan via the cardData.target rule,
    // turning N effects × N players into N² applications per player. Override
    // the target to 'Self' for this case so the engine takes its fast-path
    // (apply effects as-is, no re-targeting). Duration cards still need
    // 'All Players' so the duration loop fans the single emitted effect
    // across players (Kid C).
    // v3.1.10 — guard extended to ALL paths (previously gated on
    // options.onlyResourceEffects, i.e. only the auto life-event draw).
    // parseCardIntoEffects fans out global no-duration cards identically on
    // every path, so the manual playCard path carried the same N×N re-fan
    // (unreachable from the V2 UI, which hand-plays E cards only, but real
    // at the service-API level — a 3-player L003 discarded up to 3 E cards
    // per player instead of 1).
    if (card.scope && card.scope.toLowerCase() === 'global') {
      const hasDurationKidE = card.duration === 'Turns'
        && !!card.duration_count
        && parseInt(card.duration_count, 10) > 0;
      if (!hasDurationKidE) {
        effectiveCard = { ...effectiveCard, target: 'Self' };
      }
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

    // Special handling for E075 "Backchannel Favor" - Choose a partner and
    // open a negotiation with them (NegotiationModal), instead of resolving
    // a fixed numeric effect.
    if (card.card_id === 'E075') {
      await this.handleBackchannelFavor(playerId, card);
      return this.stateService.getGameState();
    }

    // Special handling for L050/L051 "Notice of Violation" / "Immediately
    // Hazardous Violation" — draws a corrective Work Package and sets
    // violation status fields, instead of a fixed numeric effect. See
    // TODO.md's 2026-07-31 spec for the full tier/fee-rate design.
    if (card.card_id === 'L050' || card.card_id === 'L051') {
      await this.handleNoticeOfViolation(playerId, card, card.card_id === 'L050' ? 'flat' : 'daily');
      return this.stateService.getGameState();
    }

    // Step 1: Parse card data into standardized Effect objects
    let effects = this.parseCardIntoEffects(effectiveCard, playerId);

    // Safe-by-construction subset for the auto life-event path.
    //   - RESOURCE_CHANGE: pure arithmetic, can't draw/prompt/recurse.
    //   - CARD_DRAW for E cards, self-targeted (Kid B, 2026-05-29): free
    //     Expeditor draws on L005 / L007 / L010. Lands in hand only; the auto-
    //     draw handler does NOT call applyCardEffects on E cards, so no
    //     recursion. Excludes non-E card types so we never trigger downstream
    //     auto-apply machinery this fix isn't validated for. The fanned-out
    //     global draws (e.g. L049 — playerId !== self) also pass for the
    //     not-self players (each gets a self-targeted E draw from their POV).
    //   - CARD_DISCARD (Kid E, 2026-05-29): forced-discard fan-outs from
    //     L003 / L048. Handler shows a choice modal in production (human
    //     picks which card) and auto-picks oldest in headless (ghost bot
    //     sets autoPickForcedDiscards=true).
    if (options?.onlyResourceEffects) {
      effects = effects.filter(e =>
        e.effectType === 'RESOURCE_CHANGE' ||
        (e.effectType === 'CARD_DRAW' && e.payload.cardType === 'E') ||
        e.effectType === 'CARD_DISCARD'
      );
    }

    if (effects.length > 0) {

      // Step 2: Process effects through UnifiedEffectEngine synchronously
      const context = {
        source: `card:${cardId}`,
        playerId: playerId,
        triggerEvent: 'CARD_PLAY' as const,
      };

      try {
        const batchResult = await this.effectEngineService.processCardEffects(effects, context, effectiveCard);
        if (!batchResult.success) {
          console.error(`❌ Card effect processing failed: ${batchResult.errors.join(', ')}`);
          throw new Error(`Card effect processing failed: ${batchResult.errors.join(', ')}`);
        }
      } catch (error) {
        console.error(`❌ Error processing card effects:`, error);
        throw error;
      }
    }

    // L021 "High-Profile Client" (2026-07-26) — second, independent effect.
    // `other_players_tick_modifier` (see DataTypes.ts) carries a delta that
    // applies to every OTHER player, separate from the card's own
    // tick_modifier (which just applied -4 to `playerId` above, unaffected
    // by this block). Deliberately data-driven rather than an `if (card_id
    // === 'L021')` special case, so any future card authored with the same
    // "self gets X, everyone else gets Y" shape can reuse this column
    // without new code — but today L021 is the only card with a non-empty
    // value here (see investigation notes, 2026-07-26: no other card in
    // CARDS_EXPANDED.csv needed this).
    if (card.other_players_tick_modifier && card.other_players_tick_modifier !== '0') {
      await this.applyOtherPlayersTickModifier(playerId, card);
    }

    // Workstream 7 Phase 7.3 — data-driven approval revocation.
    // L cards (and any others) with `revokes_approval` set in CARDS_EXPANDED.csv
    // invalidate the specified approval(s). Examples: L003 "New Safety Regulations"
    // and L020 "Building Code Update" force DOB approval to be re-obtained because
    // the code changed underneath the prior approval. Idempotent if no prior
    // approval was active.
    if (this.approvalService && card.revokes_approval) {
      // Re-fetch rather than reuse `player` — effects processed above
      // (Step 2) may have already touched approval state on this same
      // card play. Domain-event stage 4: revoke() now owns the gating
      // check + message text (see the W-card revoke site above).
      const freshPlayer = this.stateService.getPlayer(playerId) || player;
      const revokeResult = this.approvalService.revoke(freshPlayer, card.revokes_approval, {
        spaceName: freshPlayer.currentSpace,
        cardName: card.card_name,
        reason: 'card_effect',
      });
      if (revokeResult.event) this.stateService.emitGameEvent(revokeResult.event);
      // Routes through TEMP so Try Again restores the prior approval — safe to
      // apply on the auto life-event path too (Kid A, 2026-05-29). The revoke
      // is pure state writes, no choices or recursion.
      this.stateService.updateTempState(playerId, revokeResult.update);
    }

    // Legacy card type logging for debugging

    return this.stateService.getGameState();
  }

  /**
   * True when the player's project "involves groundwork" — i.e. they hold at
   * least one W (work-package) card whose work type is ground-disturbing.
   * Gates work_type_conditional cards (e.g. L012 "Soil Contamination").
   */
  private playerInvolvesGroundwork(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;
    return (player.hand ?? []).some(cardId => {
      const c = this.dataService.getCardById(cardId);
      return c?.card_type === 'W' && c.is_groundwork === true;
    });
  }

  /**
   * True when the player's project requires utility hookups — i.e. they hold
   * at least one W card whose work type touches outside-utility coordination.
   * Gates utility_conditional cards (e.g. L029 "Utility Delay").
   */
  private playerInvolvesUtilities(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;
    return (player.hand ?? []).some(cardId => {
      const c = this.dataService.getCardById(cardId);
      return c?.card_type === 'W' && c.requires_utility_hookup === true;
    });
  }

  /**
   * Returns the set of work_type_restriction values across all W cards a
   * player currently holds. Used by competing_worktype_conditional cards
   * (e.g. L041) to detect overlap between players.
   */
  private getPlayerWorktypes(playerId: string): Set<string> {
    const player = this.stateService.getPlayer(playerId);
    const out = new Set<string>();
    if (!player) return out;
    for (const cardId of (player.hand ?? [])) {
      const c = this.dataService.getCardById(cardId);
      if (c?.card_type === 'W' && c.work_type_restriction) {
        out.add(c.work_type_restriction);
      }
    }
    return out;
  }

  /**
   * True when any other player shares at least one current worktype with the
   * given player. Gates competing_worktype_conditional cards (L041).
   */
  private playerHasCompetingWorktype(playerId: string): boolean {
    const mine = this.getPlayerWorktypes(playerId);
    if (mine.size === 0) return false;
    const gameState = this.stateService.getGameState();
    return gameState.players.some(other => {
      if (other.id === playerId) return false;
      const theirs = this.getPlayerWorktypes(other.id);
      for (const wt of theirs) if (mine.has(wt)) return true;
      return false;
    });
  }

  /**
   * Build LifeEventModal receipt entries that reveal each other player's
   * worktypes and the overlap with the drawing player. One 'competing_reveal'
   * entry per other player so the modal can show why the conditional fired
   * (or didn't). Called from CardEffectHandler when an L card with mechanic
   * 'competing_worktype_conditional' lands. Public so the handler can invoke
   * it without reaching into private state.
   */
  buildCompetingWorktypeReveal(playerId: string): Array<{ kind: 'competing_reveal'; label: string }> {
    const mine = this.getPlayerWorktypes(playerId);
    const gameState = this.stateService.getGameState();
    const out: Array<{ kind: 'competing_reveal'; label: string }> = [];
    for (const other of gameState.players) {
      if (other.id === playerId) continue;
      const theirs = [...this.getPlayerWorktypes(other.id)];
      const overlap = theirs.filter(wt => mine.has(wt));
      const theirsLabel = theirs.length > 0 ? theirs.join(', ') : 'no current worktypes';
      const overlapLabel = overlap.length > 0 ? ` — overlap: ${overlap.join(', ')}` : ' — no overlap';
      out.push({ kind: 'competing_reveal', label: `${other.name}: ${theirsLabel}${overlapLabel}` });
    }
    return out;
  }

  /**
   * True when the player's project is "high-profile" — i.e. they hold at
   * least one W card whose work type is large, public-facing build. Gates
   * high_profile_conditional cards (L044 "State Funding").
   */
  private playerInvolvesHighProfile(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;
    return (player.hand ?? []).some(cardId => {
      const c = this.dataService.getCardById(cardId);
      return c?.card_type === 'W' && c.is_high_profile === true;
    });
  }

  /**
   * True when the player has gained 3+ Work Package cards since the start of
   * this turn. Gates bulk_permit_conditional cards (E040 "Bulk Discount").
   *
   * "Permits filed" maps to W (Work Package) cards — they're the only card
   * type representing scope a player files for approval (see
   * GameRulesService.calculateProjectScope, which already defines a player's
   * "work packages" as `hand.filter(id => id.startsWith('W'))`).
   *
   * This does NOT read stateService.getTurnOutflow(playerId).cardsConsumed —
   * that ledger only ever contains E cards. W cards are never routed through
   * CardService.playCard() (the only path that calls recordTurnOutflow with
   * cardConsumed); they're added straight to hand via drawCards() when a
   * player rolls dice or resolves a manual action, and the only "Play"
   * button in the UI is gated `card.card_type === 'E'`
   * (PlayerCardDetailV2.tsx, PlayerPanelV2.handlePlayExpeditor). Filtering
   * cardsConsumed for a 'W' prefix would always be an empty array, so the
   * gate would silently never fire.
   *
   * Instead this compares the live hand's W-card count against the
   * turn-start REAL snapshot (stateService.getRealPlayerState) — REAL only
   * updates at End Turn (TurnStateManager.commitTempToReal), so the diff is
   * exactly "W cards gained since this turn started." This also naturally
   * matches existing Try Again semantics: Try Again discards TEMP and
   * rebuilds it from REAL, so a re-rolled draw correctly resets the count
   * instead of double-counting a discarded outcome.
   */
  private playerFiledBulkPermitsThisTurn(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return false;
    const realState = this.stateService.getRealPlayerState(playerId);
    if (!realState) return false; // no turn-start snapshot yet — nothing could have been filed
    const currentWCount = (player.hand ?? []).filter(id => id.startsWith('W')).length;
    const realWCount = (realState.hand ?? []).filter(id => id.startsWith('W')).length;
    return (currentWCount - realWCount) >= 3;
  }

  /**
   * Returns the maximum phase index any space in the player's visit history
   * (including currentSpace) has reached, using the data-driven phase order.
   * −1 if no space matches. Used by L046 leader-resolution to find the player
   * "furthest along the board."
   */
  private maxPhaseReached(playerId: string): number {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return -1;
    const phases = this.dataService.getPhaseOrder();
    const spaces = [...(player.visitedSpaces ?? []), player.currentSpace].filter(Boolean);
    let max = -1;
    for (const spaceName of spaces) {
      const cfg = this.dataService.getGameConfigBySpace(spaceName);
      if (!cfg) continue;
      const idx = phases.findIndex(p => cfg.phase?.toUpperCase().includes(p));
      if (idx > max) max = idx;
    }
    return max;
  }

  /**
   * Returns the playerId of the player whose project is furthest along the
   * board (highest phase index). Ties broken by gameState.players order.
   * Used by leader_phase_conditional cards (L046 "Expeditor Awards") to
   * redirect the time-reduction effect to the leader regardless of who drew
   * the card. Returns the drawing player's id if no other player has reached
   * a phase, since the drawing player counts as a candidate.
   */
  private getFurthestPlayer(): string | null {
    const gameState = this.stateService.getGameState();
    if (gameState.players.length === 0) return null;
    let bestId: string | null = null;
    let bestPhase = -1;
    for (const p of gameState.players) {
      const phase = this.maxPhaseReached(p.id);
      if (phase > bestPhase) {
        bestPhase = phase;
        bestId = p.id;
      }
    }
    return bestId;
  }

  /**
   * Build a single 'leader_reveal' receipt for the LifeEventModal naming the
   * player whose project is furthest along and what they got. drawingId is
   * the player who drew the card so the label can frame "You're the leader"
   * vs "[Name] is the leader." Called from CardEffectHandler when an L card
   * with mechanic 'leader_phase_conditional' lands.
   */
  buildLeaderReveal(drawingPlayerId: string, days: number): Array<{ kind: 'leader_reveal'; label: string }> {
    const leaderId = this.getFurthestPlayer();
    if (!leaderId) return [];
    const gameState = this.stateService.getGameState();
    const leader = gameState.players.find(p => p.id === leaderId);
    if (!leader) return [];
    const leaderPhaseIdx = this.maxPhaseReached(leaderId);
    const phases = this.dataService.getPhaseOrder();
    const phaseName = leaderPhaseIdx >= 0 ? phases[leaderPhaseIdx] : 'no phase reached';
    const subject = leaderId === drawingPlayerId ? "You're the leader" : `${leader.name} is the leader`;
    const dayWord = Math.abs(days) === 1 ? 'day' : 'days';
    const sign = days < 0 ? 'saves' : 'loses';
    return [{
      kind: 'leader_reveal',
      label: `${subject} (${phaseName}) — ${sign} ${Math.abs(days)} ${dayWord}`,
    }];
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
      // work_type_conditional gate (e.g. L012 "Soil Contamination"): the time
      // modifier only applies when the player's project involves the relevant
      // work type. If the condition isn't met, the card still fires but adds 0.
      const conditionMet =
        card.card_mechanic === 'work_type_conditional' ? this.playerInvolvesGroundwork(playerId)
        : card.card_mechanic === 'utility_conditional' ? this.playerInvolvesUtilities(playerId)
        : card.card_mechanic === 'competing_worktype_conditional' ? this.playerHasCompetingWorktype(playerId)
        : card.card_mechanic === 'high_profile_conditional' ? this.playerInvolvesHighProfile(playerId)
        : card.card_mechanic === 'leader_phase_conditional' ? true // leader always exists if any player exists
        : card.card_mechanic === 'bulk_permit_conditional' ? this.playerFiledBulkPermitsThisTurn(playerId)
        : true;
      if (conditionMet && !isNaN(timeAmount) && timeAmount !== 0) {
        // Check if this is a Global scope card - affects all players
        const isGlobalScope = card.scope && card.scope.toLowerCase() === 'global';
        // Kid C (2026-05-29) — when a card has BOTH scope=Global and
        // duration=Turns, parser-side fan-out + EffectEngineService's
        // duration targeting loop would produce N×N active effects per player
        // (each player ends up with N copies of the tick, firing every turn
        // for N turns → N× over-application). Emit a single effect when
        // duration is set; the engine's targetRule expansion handles per-
        // player fan-out correctly. Phase-filtered duration cards (L004
        // affected_phase=CONSTRUCTION) carry their requiredPhase through
        // to the active-effect payload — applyActiveEffects re-checks it
        // each turn (v3.0.41 follow-up to the v3.0.39 N×N fix).
        const hasDuration = card.duration === 'Turns'
          && !!card.duration_count
          && parseInt(card.duration_count, 10) > 0;

        if (isGlobalScope && !hasDuration) {
          // Immediate-fire global cards (e.g. L008, L026) — fan out per player
          // at parser time so phase filtering can use each player's current
          // location.
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
        } else if (isGlobalScope && hasDuration) {
          // Duration cards: emit a single effect with the source player; the
          // engine's targetRule loop expands it to all players (one active
          // effect per player, ticked down each turn).
          // v3.0.41 (Kid C follow-up): carry the card's affected_phase
          // through to the active-effect payload so applyActiveEffects can
          // re-check each player's current phase per turn. L004
          // (affected_phase=CONSTRUCTION, duration=Turns) used to lose its
          // phase filter under the v3.0.39 N×N fix because the parser-side
          // filter was bypassed when emitting a single effect for engine
          // fan-out — now the gate moves to apply-time.
          const requiredPhase = card.affected_phase?.trim() || undefined;
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId: playerId,
              resource: 'TIME',
              amount: timeAmount,
              source: cardSource,
              reason: `${card.card_name}: ${timeAmount > 0 ? '+' : ''}${timeAmount} days${requiredPhase ? ` (all ${requiredPhase.toLowerCase()}-phase players)` : ' (affects all players)'}`,
              requiredPhase,
            }
          });
        } else {
          // Apply to a single player. L046 leader_phase_conditional redirects
          // the effect to the player furthest along the board, not the drawer.
          // All other single-target cards land on the drawing player.
          const targetPlayerId = card.card_mechanic === 'leader_phase_conditional'
            ? (this.getFurthestPlayer() ?? playerId)
            : playerId;
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId: targetPlayerId,
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


  // Discard cards.
  //
  // ⚠️ `_source` and `_reason` are accepted and then DROPPED — the underscore
  // records the current reality, not an intention. Four call sites pass real
  // values ('manual_effect', 'Manual action: Replace W card…'), but the
  // card_discarded event below emits only a generic "Discarded N cards", so
  // that audit trail never reaches the log. The `cardSummary` built further
  // down is computed and discarded for the same reason. Wiring them in changes
  // player- and teacher-visible log text, so it is tracked in TODO.md rather
  // than done as a drive-by. (Found 2026-07-28 during the lint burn-down.)
  discardCards(playerId: string, cardIds: string[], _source?: string, _reason?: string): boolean {
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

    // Process each card type (the type key itself isn't needed — removal is
    // by card id regardless of type)
    for (const cards of Object.values(cardsByType)) {
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

      // Domain-event stage 4: LogWriter reacts to this.
      this.stateService.emitGameEvent({
        type: 'card_discarded',
        playerId: playerId,
        cardIds: cardIds,
        message: `Discarded ${cardIds.length} card${cardIds.length > 1 ? 's' : ''}`,
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
      this.stateService.emitGameEvent({
        type: 'card_effect_target_resolved',
        playerId: playerId,
        mechanic: 'return_to_sender',
        resolved: false,
        cardName: card.card_name,
        message: `${card.card_name} played but no active E cards to target`,
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


    // Domain-event stage 4: LogWriter reacts to this.
    const currentPlayer = allPlayers.find(p => p.id === playerId);
    this.stateService.emitGameEvent({
      type: 'card_effect_target_resolved',
      playerId: playerId,
      mechanic: 'return_to_sender',
      resolved: true,
      targetPlayerName: owner.name,
      cardName: selectedCard.cardName,
      message: `${currentPlayer?.name || 'Player'} returned ${selectedCard.cardName} to ${owner.name}'s hand`,
    });
  }

  /**
   * Applies `other_players_tick_modifier` (see DataTypes.ts) to every player
   * OTHER than the one who just played the card. Added for L021 "High-Profile
   * Client" (2026-07-26): the card's authored description promises TWO
   * effects — the playing player's filing time drops by 4 days (already
   * handled by the ordinary tick_modifier column/pipeline, applied just
   * before this method is called) AND every other player's filing time rises
   * by 1 day (this method).
   *
   * Deliberately NOT folded into the ordinary target-rule pipeline
   * (TargetingService / processEffectsWithTargeting / EFFECT_GROUP_TARGETED):
   * those all clone ONE effect payload across every resolved target, so they
   * have no way to give the source player a different magnitude (-4) than
   * everyone else (+1) from a single card row. Instead this builds one
   * RESOURCE_CHANGE effect per other player — mirroring the existing
   * "Immediate-fire global cards" fan-out in parseCardIntoEffects above (same
   * shape: one effect per target player.id) — and runs them through the
   * ordinary processEffects batch path (shared context whose playerId stays
   * the ACTING player, exactly as that fan-out does), so the time change gets
   * identical logging/notification behavior to any other card's time effect.
   *
   * Solo-safe: filters out the acting player first. With zero other players
   * the effects array is empty and processEffects no-ops successfully — no
   * special-casing needed for solo play.
   */
  private async applyOtherPlayersTickModifier(playerId: string, card: Card): Promise<void> {
    const timeAmount = parseInt(card.other_players_tick_modifier ?? '0', 10);
    if (isNaN(timeAmount) || timeAmount === 0) {
      return;
    }

    const gameState = this.stateService.getGameState();
    const otherPlayers = gameState.players.filter(p => p.id !== playerId);
    if (otherPlayers.length === 0) {
      return;
    }

    const cardSource = `card:${card.card_id}`;
    const reason = `${card.card_name}: ${timeAmount > 0 ? '+' : ''}${timeAmount} day${Math.abs(timeAmount) === 1 ? '' : 's'} (another player filed ahead of you)`;

    const otherPlayerEffects: Effect[] = otherPlayers.map(other => ({
      effectType: 'RESOURCE_CHANGE',
      payload: {
        playerId: other.id,
        resource: 'TIME',
        amount: timeAmount,
        source: cardSource,
        reason,
      },
    }));

    const context = {
      source: cardSource,
      playerId: playerId,
      triggerEvent: 'CARD_PLAY' as const,
    };

    const result = await this.effectEngineService.processEffects(otherPlayerEffects, context);
    if (!result.success) {
      console.error(`❌ Failed to apply other_players_tick_modifier for ${card.card_id}: ${result.errors.join(', ')}`);
    }
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
      this.stateService.emitGameEvent({
        type: 'card_effect_target_resolved',
        playerId: playerId,
        mechanic: 'favor_called_in',
        resolved: false,
        cardName: card.card_name,
        message: `${card.card_name} played - no opponents, self benefit only`,
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


    // Domain-event stage 4: LogWriter reacts to this.
    this.stateService.emitGameEvent({
      type: 'card_effect_target_resolved',
      playerId: playerId,
      mechanic: 'favor_called_in',
      resolved: true,
      targetPlayerName: selectedOpponent.name,
      cardName: card.card_name,
      message: `${currentPlayer?.name} called in a favor: ${selectedOpponent.name} slowed down`,
    });
  }

  /**
   * Handle E075 "Backchannel Favor" - Choose a team to propose a trade with,
   * then open a negotiation with them.
   *
   * Unlike E009 (a fixed, auto-resolved effect), this card's whole point is
   * to hand off to NegotiationModal/NegotiationService for an interactive
   * money+card offer the partner can accept or decline — this handler only
   * picks who that partner is and emits the event GameLayout listens for to
   * open the modal on the initiator's own device.
   */
  private async handleBackchannelFavor(playerId: string, card: Card): Promise<void> {

    const gameState = this.stateService.getGameState();
    const allPlayers = gameState.players;

    // Get opponents (all players except current)
    const opponents = allPlayers.filter(p => p.id !== playerId);

    if (opponents.length === 0) {
      // No one to trade with - nothing to open, just record that the card
      // was played.
      this.stateService.emitGameEvent({
        type: 'card_effect_target_resolved',
        playerId: playerId,
        mechanic: 'backchannel_favor',
        resolved: false,
        cardName: card.card_name,
        message: `${card.card_name} played - no other teams to trade with`,
      });
      return;
    }

    let selectedPartner: Player | null = null;

    if (opponents.length === 1) {
      // Only one possible partner - auto-select
      selectedPartner = opponents[0];
    } else {
      // Multiple possible partners - present choice
      if (!this.choiceService) {
        console.error('❌ ChoiceService not available - auto-selecting first team');
        selectedPartner = opponents[0];
      } else {
        const options = opponents.map(p => ({
          id: p.id,
          label: p.name
        }));

        const selection = await this.choiceService.createChoice(
          playerId,
          'TARGET_SELECTION',
          'Choose a team to propose a trade with:',
          options
        );

        if (selection && selection !== '') {
          selectedPartner = opponents.find(p => p.id === selection) || null;
        }
      }
    }

    if (!selectedPartner) {
      return;
    }

    // Hand off to GameLayout (via the event bus) to open NegotiationModal
    // pre-seeded with this partner. The actual trade — building an offer,
    // the partner's accept/decline — happens in NegotiationModal /
    // NegotiationService from here, not in this handler.
    this.stateService.emitGameEvent({
      type: 'negotiation_requested',
      playerId: playerId,
      partnerId: selectedPartner.id,
      partnerName: selectedPartner.name,
      cardName: card.card_name,
    });
  }

  /**
   * Special handling for L050 "Notice of Violation" (flat) and L051
   * "Immediately Hazardous Violation" (daily-accrual variant). Draws one
   * corrective Work Package card, sizes the eventual civil penalty off its
   * cost, and starts the Affidavit-of-Correction deadline countdown. The fee
   * itself is NOT charged here — see fileAffidavitOfCorrection(), which
   * computes on-time vs. late once the player actually files.
   */
  private async handleNoticeOfViolation(playerId: string, card: Card, variant: ViolationVariant): Promise<void> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return;

    const drawnCards = this.drawCards(playerId, 'W', 1, `card:${card.card_id}`, 'Violation corrective work');
    const drawnWCard = drawnCards[0] ? this.dataService.getCardById(drawnCards[0]) : undefined;
    const penaltyBase = drawnWCard?.cost ?? 0;

    const tier = getViolationTier(this.gameRulesService.calculateProjectScope(playerId));
    const deadlineDay = (player.timeSpent ?? 0) + VIOLATION_DEADLINE_DAYS;

    this.stateService.updateTempState(playerId, {
      violationStatus: 'active',
      violationVariant: variant,
      violationTier: tier,
      violationDeadlineDay: deadlineDay,
      violationPenaltyBase: penaltyBase,
      violationAccrualCheckpoint: variant === 'daily' ? deadlineDay : undefined,
    });

    this.loggingService.info(
      `Violation triggered for ${player.name}: ${card.card_name} (${tier} tier, ${variant} variant, deadline day ${deadlineDay}, base $${penaltyBase.toLocaleString()})`,
      { playerId, cardId: card.card_id }
    );
  }

  /**
   * Player-initiated: file the Affidavit of Correction for an active
   * violation. On-time vs. late is judged against violationDeadlineDay at
   * the moment of filing — filing after the deadline charges the full
   * (late) rate even if the player waits well past day 180.
   */
  fileAffidavitOfCorrection(playerId: string): { success: boolean; feeCharged: number; onTime: boolean } | null {
    const player = this.stateService.getPlayer(playerId);
    if (!player || player.violationStatus !== 'active') return null;

    const tier = player.violationTier ?? 'small';
    const penaltyBase = player.violationPenaltyBase ?? 0;
    const onTime = (player.timeSpent ?? 0) <= (player.violationDeadlineDay ?? 0);
    const fee = computeFilingFee(tier, onTime, penaltyBase);

    this.resourceService.spendMoney(
      playerId, fee, 'violation_penalty',
      `Civil penalty — Affidavit of Correction filed ${onTime ? 'on time' : 'late'}`, 'fees', true
    );
    this.stateService.updateTempState(playerId, { violationStatus: 'resolved' });

    this.loggingService.info(
      `${player.name} filed the Affidavit of Correction ${onTime ? 'on time' : 'late'} — $${fee.toLocaleString()} civil penalty charged.`,
      { playerId }
    );

    return { success: true, feeCharged: fee, onTime };
  }

  /**
   * Per-turn hook (called from TurnTransitionHandler at end-of-turn) for
   * L051's daily-accrual variant only. Charges for every overdue day since
   * the last checkpoint — never re-charges days already accounted for.
   */
  processViolationDailyAccrual(playerId: string): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player || player.violationStatus !== 'active' || player.violationVariant !== 'daily') return;

    const tier = player.violationTier ?? 'small';
    const checkpoint = player.violationAccrualCheckpoint ?? player.violationDeadlineDay ?? 0;
    const { fee, newCheckpoint } = computeDailyAccrual(tier, player.timeSpent ?? 0, checkpoint);

    if (fee <= 0) return;

    this.resourceService.spendMoney(
      playerId, fee, 'violation_daily_accrual',
      `Daily civil penalty — violation still uncorrected`, 'fees', true
    );
    this.stateService.updateTempState(playerId, { violationAccrualCheckpoint: newCheckpoint });

    this.loggingService.info(
      `${player.name} accrued $${fee.toLocaleString()} in daily violation penalties.`,
      { playerId }
    );
  }
}
