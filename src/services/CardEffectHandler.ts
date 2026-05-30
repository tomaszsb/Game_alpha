// src/services/CardEffectHandler.ts
// Extracted from EffectEngineService - handles card-related effects

import {
  ICardService,
  IStateService,
  IDataService,
  IChoiceService,
  INotificationService,
  ILoggingService
} from '../types/ServiceContracts';
import {
  Effect,
  EffectContext,
  EffectResult,
  isCardDrawEffect,
  isCardDiscardEffect,
  isCardActivationEffect,
  isPlayCardEffect
} from '../types/EffectTypes';
import { Card } from '../types/DataTypes';
import { getCardTypeName } from '../utils/cardTypeNames';

type CardDrawPayload = Extract<Effect, { effectType: 'CARD_DRAW' }>['payload'];
type CardDiscardPayload = Extract<Effect, { effectType: 'CARD_DISCARD' }>['payload'];

/**
 * CardEffectHandler - Handles card-related effects
 *
 * Extracted from EffectEngineService to create a focused handler for:
 * - CARD_DRAW: Drawing cards with notifications and funding auto-play
 * - CARD_DISCARD: Discarding cards with user choice support
 * - CARD_ACTIVATION: Activating cards with duration
 * - PLAY_CARD: Finalizing played cards
 */
export interface ICardEffectHandler {
  handleCardDraw(effect: Effect, context: EffectContext): Promise<EffectResult>;
  handleCardDiscard(effect: Effect, context: EffectContext): Promise<EffectResult>;
  handleCardActivation(effect: Effect, context: EffectContext): EffectResult;
  handlePlayCard(effect: Effect, context: EffectContext): Promise<EffectResult>;
}

export class CardEffectHandler implements ICardEffectHandler {
  private notificationService?: INotificationService;
  private dataService?: IDataService;

  /**
   * Kid E (2026-05-29). When `true`, forced-discard cards with
   * `requiresUserChoice: true` (L003 / L048 — global discard fan-out)
   * skip the choice modal and auto-pick the oldest cards. Used by the
   * headless ghost bot, which can't click modals. Production leaves this
   * false so human players keep the tactical choice.
   */
  public autoPickForcedDiscards = false;

  constructor(
    private readonly cardService: ICardService,
    private readonly stateService: IStateService,
    private readonly choiceService: IChoiceService,
    private readonly loggingService: ILoggingService,
    dataService?: IDataService,
    notificationService?: INotificationService
  ) {
    this.dataService = dataService;
    this.notificationService = notificationService;
  }

  /**
   * Handle CARD_DRAW effect
   * Draws cards with notifications and handles funding card auto-play
   */
  async handleCardDraw(effect: Effect, context: EffectContext): Promise<EffectResult> {
    if (!isCardDrawEffect(effect)) {
      return {
        success: false,
        effectType: effect.effectType,
        error: 'Invalid CARD_DRAW effect'
      };
    }

    const { payload } = effect;
    const source = payload.source || context.source;
    const reason = payload.reason || 'Effect processing';


    try {
      const drawnCards = this.cardService.drawCards(payload.playerId, payload.cardType, payload.count, source, reason);

      // Apply the auto-drawn Life Event (L) card's money/time effects. drawCards
      // only adds the card to hand. onlyResourceEffects applies just the pure
      // arithmetic money/time (safe — can't draw/prompt/loop); richer effects are
      // deferred. Card stays in hand as a record.
      if (payload.cardType === 'L' && !this.stateService.getGameState().isCapturingStartingHand) {
        for (const drawnId of drawnCards) {
          await this.cardService.applyCardEffects(payload.playerId, drawnId, { onlyResourceEffects: true });
        }
      }

      // Show notification for L (Life Event) card draws
      this.notifyLifeEventDraw(payload.playerId, payload.cardType, drawnCards);

      // Check for funding space auto-play
      const fundingResult = this.checkFundingAutoPlay(payload, drawnCards, context);
      if (fundingResult) {
        return fundingResult;
      }

      // Log to action log
      this.logCardDraw(payload.playerId, payload.cardType, payload.count, drawnCards);

      // Store drawn cards in result
      return {
        success: true,
        effectType: effect.effectType,
        data: { cardIds: drawnCards },
        resultingEffects: [{
          effectType: 'LOG',
          payload: {
            // Voice rule: real-life label, no "card(s)" word. fb:7a99da1a/004dc390.
            message: `Drew ${drawnCards.length} ${getCardTypeName(payload.cardType, drawnCards.length)}: ${drawnCards.join(', ')}`,
            level: 'INFO',
            source,
            action: 'card_draw',
            playerId: payload.playerId
          }
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown card draw error';
      return {
        success: false,
        effectType: effect.effectType,
        error: `Failed to draw ${payload.count} ${payload.cardType} cards for player ${payload.playerId}: ${errorMessage}`
      };
    }
  }

  /**
   * Handle CARD_DISCARD effect
   * Discards cards with user choice support for dice roll effects
   */
  async handleCardDiscard(effect: Effect, context: EffectContext): Promise<EffectResult> {
    if (!isCardDiscardEffect(effect)) {
      return {
        success: false,
        effectType: effect.effectType,
        error: 'Invalid CARD_DISCARD effect'
      };
    }

    const { payload } = effect;
    const source = payload.source || context.source;
    const reason = payload.reason || 'Effect processing';
    let cardIdsToDiscard = payload.cardIds;

    // Check if this is a dice roll effect requiring user choice
    const isDiceRollRemove = source.includes(':dice_remove');
    const isDiceRollReplace = source.includes(':dice_replace') && !source.includes(':dice_replace_draw');
    // v3.0.17 — explicit per-effect flag for card-source globals like L003/L048.
    // Each fanned-out CARD_DISCARD effect sets `requiresUserChoice: true` so the
    // player whose hand is being touched gets a modal to pick which card. Without
    // this flag, card-source discards retain the auto-pick-first-N behavior.
    const isFlaggedForChoice = payload.requiresUserChoice === true;
    const requiresUserChoice = isDiceRollRemove || isDiceRollReplace || isFlaggedForChoice;

    // If cardIds is empty but cardType and count are provided, determine cards at runtime
    if ((!cardIdsToDiscard || cardIdsToDiscard.length === 0) && payload.cardType && payload.count) {

      const allCardsOfType = this.cardService.getPlayerCards(payload.playerId, payload.cardType);

      if (allCardsOfType.length === 0) {
        return {
          success: true,
          effectType: effect.effectType,
          data: { cardIds: [], skipped: true, reason: `No ${payload.cardType} cards to ${isDiceRollReplace ? 'replace' : 'remove'}` }
        };
      }

      // Show a choice modal when explicitly required (dice rolls, or
      // flagged globals like L003/L048) AND the player has more cards
      // than the discard count — otherwise auto-pick by slicing.
      // Kid E (2026-05-29): ghost bot sets `autoPickForcedDiscards=true`
      // to skip the modal (it can't click) and fall through to the slice.
      if (requiresUserChoice && allCardsOfType.length > payload.count && !this.autoPickForcedDiscards) {
        const choiceResult = await this.presentCardChoice(payload, allCardsOfType, isDiceRollReplace);
        if (choiceResult.skipped) {
          return {
            success: true,
            effectType: effect.effectType,
            data: { cardIds: [], skipped: true }
          };
        }
        if (choiceResult.error) {
          return {
            success: false,
            effectType: effect.effectType,
            error: choiceResult.error
          };
        }
        cardIdsToDiscard = choiceResult.cardIds;
      } else {
        // Take the first 'count' cards from that list
        cardIdsToDiscard = allCardsOfType.slice(0, payload.count);
      }
    }


    try {
      const discardResult = await this.cardService.discardCards(payload.playerId, cardIdsToDiscard, source, reason);

      if (!discardResult) {
        return {
          success: false,
          effectType: effect.effectType,
          error: `Failed to discard cards for player ${payload.playerId}: Card discard operation failed`
        };
      }

      return {
        success: true,
        effectType: effect.effectType,
        data: { cardIds: cardIdsToDiscard }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown card discard error';
      return {
        success: false,
        effectType: effect.effectType,
        error: `Failed to discard cards for player ${payload.playerId}: ${errorMessage}`
      };
    }
  }

  /**
   * Handle CARD_ACTIVATION effect
   * Activates a card for a specified duration
   */
  handleCardActivation(effect: Effect, context: EffectContext): EffectResult {
    if (!isCardActivationEffect(effect)) {
      return {
        success: false,
        effectType: effect.effectType,
        error: 'Invalid CARD_ACTIVATION effect'
      };
    }

    const { payload } = effect;

    try {
      this.cardService.activateCard(payload.playerId, payload.cardId, payload.duration);
      return { success: true, effectType: effect.effectType };
    } catch (error) {
      console.error(`❌ Error activating card ${payload.cardId}:`, error);
      return {
        success: false,
        effectType: effect.effectType,
        error: error instanceof Error ? error.message : 'Unknown error activating card'
      };
    }
  }

  /**
   * Handle PLAY_CARD effect
   * Finalizes a played card (moves to active or discard based on duration)
   */
  async handlePlayCard(effect: Effect, context: EffectContext): Promise<EffectResult> {
    if (!isPlayCardEffect(effect)) {
      return {
        success: false,
        effectType: effect.effectType,
        error: 'Invalid PLAY_CARD effect'
      };
    }

    const { payload } = effect;
    try {

      // Auto-play cards (e.g., OWNER-FUND-INITIATION) need their effects applied here.
      // Manual card plays already had effects processed by PlayerActionService before reaching this point.
      if (payload.source?.startsWith('auto_play:')) {
        await this.cardService.applyCardEffects(payload.playerId, payload.cardId);
      }

      // Finalize card (move to active or discard based on duration)
      this.cardService.finalizePlayedCard(payload.playerId, payload.cardId);

      return { success: true, effectType: effect.effectType };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error finalizing card ${payload.cardId}:`, errorMsg);
      return {
        success: false,
        effectType: effect.effectType,
        error: errorMsg
      };
    }
  }

  // --- Private helper methods ---

  private notifyLifeEventDraw(playerId: string, cardType: string, drawnCards: string[]): void {
    if (cardType !== 'L' || drawnCards.length === 0 || !this.notificationService) return;

    const player = this.stateService.getPlayer(playerId);
    if (!player) return;

    const cardDetails = drawnCards.map(cardId => {
      const card = this.dataService?.getCardById(cardId);
      return { id: cardId, name: card?.card_name || card?.name || cardId, description: card?.description || '' };
    });

    const cardNames = cardDetails.map(c => c.name);
    const notificationMessage = drawnCards.length === 1
      ? `🎲 Life Event: ${cardNames[0]}`
      : `🎲 Life Events: ${cardNames.join(', ')}`;

    // Voice rule: real-life label, no "card(s)" word. fb:7a99da1a/004dc390.
    const lifeEventLabel = drawnCards.length === 1 ? 'Life Event' : 'Life Events';
    this.notificationService.notify(
      {
        short: 'Life Event!',
        medium: notificationMessage,
        detailed: `Drew ${drawnCards.length} ${lifeEventLabel}: ${cardNames.join(', ')}`
      },
      {
        playerId,
        playerName: player.name,
        actionType: 'card_draw_L',
        notificationDuration: 5000
      }
    );

    // Emit auto-action event to trigger modal in UI
    const cardDetail = cardDetails[0];
    this.stateService.emitAutoAction({
      type: 'life_event',
      playerId,
      playerName: player.name,
      playerColor: player.color,
      cardType: 'L',
      cardName: cardDetail.name,
      cardId: cardDetail.id,
      success: true,
      spaceName: player.currentSpace,
      message: notificationMessage
    });
  }

  private checkFundingAutoPlay(payload: CardDrawPayload, drawnCards: string[], context: EffectContext): EffectResult | null {
    const currentSpaceName = (context.metadata?.spaceName as string | undefined) ?? '';
    // 2026-05-18 audit: lifted from hardcoded space-name array to data flag.
    const fundingSource = this.dataService?.getFundingSource(currentSpaceName) ?? '';
    const isFundingSpace = fundingSource !== '';
    const isFundingCard = payload.cardType === 'B' || payload.cardType === 'I';

    if (!isFundingSpace || !isFundingCard || drawnCards.length === 0) {
      return null;
    }

    // Get card details for auto-action event
    const drawnCardData = this.dataService?.getCardById(drawnCards[0]);
    const cardName = drawnCardData?.card_name || `${payload.cardType} Card`;
    const fundingPlayer = this.stateService.getPlayer(payload.playerId);
    const fundingType = payload.cardType === 'B' ? 'Bank' : 'Investment';

    // Extract funding amount
    const fundingAmount = this.extractFundingAmount(drawnCardData, payload.cardType);

    // Determine event type and message
    const isOwnerFunding = fundingSource === 'owner';
    const eventType = isOwnerFunding ? 'seed_money' : 'automatic_funding';
    const eventMessage = isOwnerFunding
      ? `🏠 Owner Seed Money: ${cardName} (${fundingType} funding approved)`
      : `💰 ${fundingType} Funding: ${cardName} (+$${fundingAmount.toLocaleString()})`;

    // Emit auto-action event for funding modal
    this.stateService.emitAutoAction({
      type: eventType,
      playerId: payload.playerId,
      playerName: fundingPlayer?.name || 'Unknown',
      cardType: payload.cardType,
      cardName: cardName,
      cardId: drawnCards[0],
      success: true,
      spaceName: currentSpaceName,
      message: eventMessage,
      moneyAmount: fundingAmount
    });

    const playCardEffects = drawnCards.map(cardId => ({
      effectType: 'PLAY_CARD' as const,
      payload: {
        playerId: payload.playerId,
        cardId: cardId,
        source: `auto_play:${currentSpaceName}`
      }
    }));

    return {
      success: true,
      effectType: 'CARD_DRAW',
      resultingEffects: playCardEffects,
      data: { cardIds: drawnCards }
    };
  }

  private extractFundingAmount(cardData: Card | undefined, cardType: string): number {
    if (!cardData) return 0;

    if (cardType === 'B' && cardData.loan_amount) {
      return parseInt(cardData.loan_amount.replace(/,/g, ''), 10) || 0;
    } else if (cardType === 'I' && cardData.investment_amount) {
      return parseInt(cardData.investment_amount.replace(/,/g, ''), 10) || 0;
    } else if (cardData.money_effect) {
      const moneyMatch = cardData.money_effect.match(/add\s+([\d,]+)/i);
      if (moneyMatch) {
        return parseInt(moneyMatch[1].replace(/,/g, ''), 10);
      }
    }
    return 0;
  }

  private async presentCardChoice(
    payload: CardDiscardPayload,
    allCardsOfType: string[],
    isDiceRollReplace: boolean
  ): Promise<{ cardIds: string[]; skipped?: boolean; error?: string }> {

    try {
      const options = allCardsOfType.map(cardId => {
        const cardData = this.dataService?.getCardById(cardId);
        return {
          id: cardId,
          label: cardData ? cardData.card_name : `${payload.cardType} Card`
        };
      });

      const actionVerb = isDiceRollReplace ? 'replace' : 'remove';
      const count = payload.count ?? 1;
      const prompt = `Choose ${count} ${payload.cardType} card${count > 1 ? 's' : ''} to ${actionVerb}:`;

      const selectedCardId = await this.choiceService.createChoice(
        payload.playerId,
        isDiceRollReplace ? 'CARD_REPLACEMENT' : 'CARD_DISCARD',
        prompt,
        options
      );

      if (selectedCardId && selectedCardId !== '') {
        this.stateService.clearAwaitingChoice();
        return { cardIds: [selectedCardId] };
      } else {
        return { cardIds: [], skipped: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown choice error';
      console.error(`    ❌ Error presenting card choice: ${errorMessage}`);
      return { cardIds: [], error: `Failed to present card choice: ${errorMessage}` };
    }
  }

  private logCardDraw(playerId: string, cardType: string, count: number, drawnCards: string[]): void {
    // Voice rule: real-life label via getCardTypeName ("Work Packages",
    // "Expeditors", etc.) — never "Work card" / "X cards". fb:7a99da1a/004dc390.
    const friendlyName = getCardTypeName(cardType, count);

    this.loggingService.info(
      `Drew ${count} ${friendlyName}: ${drawnCards.join(', ')}`,
      {
        playerId,
        action: 'card_draw',
        cardType,
        count,
        cards: drawnCards,
        visibility: 'player'
      }
    );
  }
}
