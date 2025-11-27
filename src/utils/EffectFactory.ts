// src/utils/EffectFactory.ts

import { Card, CardType, SpaceEffect, DiceEffect, GameConfig } from '../types/DataTypes';
import { Effect } from '../types/EffectTypes';

/**
 * Effect Factory Utility
 * 
 * This utility is responsible for converting raw game data (from CSV files, 
 * API responses, etc.) into standardized Effect objects that can be processed
 * by the EffectEngineService.
 * 
 * By centralizing this conversion logic, we decouple the raw data format
 * from the effect processing engine. If the CSV format changes, we only
 * need to update the factory methods, not the engine itself.
 */
export class EffectFactory {

  /**
   * Create effects from a Card object
   * 
   * Analyzes a card's properties and converts them into standardized Effect objects.
   * This method handles the complex card mechanics from the expanded CSV format.
   * 
   * @param card The card object from CSV data
   * @param playerId The player who will be affected by these effects
   * @returns Array of Effect objects representing the card's effects
   */
  static createEffectsFromCard(card: Card, playerId: string): Effect[] {
    const effects: Effect[] = [];
    const cardSource = `card:${card.card_id}`;
    const cardName = card.card_name || 'Unknown Card';

    console.log(`🏭 EFFECT_FACTORY: Creating effects from card: ${cardName} (${card.card_id})`);

    // === RE-ROLL MECHANICS (E066 Specific) ===
    // Check if this is E066 - Investor Pitch Preparation
    if (card.card_id === 'E066') {
      effects.push({
        effectType: 'TURN_CONTROL',
        payload: {
          action: 'GRANT_REROLL',
          playerId,
          source: cardSource,
          reason: `${cardName}: Gain 1 extra die throw this turn if you do not like the outcome`
        }
      });
      // Don't skip normal processing in case E066 has other effects
    }

    // === CHOICE OF EFFECTS (Player Choice Between Options) ===
    // Check if card has "or" choice mechanics in description
    if (card.description && card.description.includes(' or ')) {
      const choiceEffect = this.parseChoiceOfEffects(card, playerId, cardSource, cardName);
      if (choiceEffect) {
        effects.push(choiceEffect);
        // Skip normal effect processing for choice cards
        return effects;
      }
    }

    // === CONDITIONAL EFFECTS (Dice Roll Based) ===
    // Check if card has conditional dice roll mechanics in description
    if (card.description && card.description.includes('Roll a die')) {
      const conditionalEffect = this.parseConditionalEffect(card, playerId, cardSource, cardName);
      if (conditionalEffect) {
        effects.push(conditionalEffect);
        // Skip normal effect processing for conditional cards
        return effects;
      }
    }

    // === CARD COST DEDUCTION ===
    if (card.cost && card.cost > 0) {
      effects.push({
        effectType: 'RESOURCE_CHANGE',
        payload: {
          playerId,
          resource: 'MONEY',
          amount: -card.cost,
          source: cardSource,
          reason: `${cardName}: Card cost of $${card.cost.toLocaleString()}`
        }
      });
    }

    // === MONEY EFFECTS ===
    if (card.money_effect && card.money_effect !== '0' && card.money_effect !== '') {
      const moneyAmount = this.parseMoneyEffect(card.money_effect);
      if (moneyAmount !== 0) {
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId,
            resource: 'MONEY',
            amount: moneyAmount,
            source: cardSource,
            reason: `${cardName}: ${card.money_effect}`
          }
        });
      }
    }

    // === TIME EFFECTS ===
    if (card.tick_modifier && card.tick_modifier !== '0' && card.tick_modifier !== '') {
      const timeAmount = this.parseTimeEffect(card.tick_modifier);
      if (timeAmount !== 0) {
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId,
            resource: 'TIME',
            amount: timeAmount,
            source: cardSource,
            reason: `${cardName}: ${card.tick_modifier}`
          }
        });
      }
    }

    // === CARD DRAW EFFECTS ===
    if (card.draw_cards && card.draw_cards !== '0' && card.draw_cards !== '') {
      const cardDraws = this.parseCardDrawEffect(card.draw_cards);
      cardDraws.forEach(draw => {
        effects.push({
          effectType: 'CARD_DRAW',
          payload: {
            playerId,
            cardType: draw.cardType,
            count: draw.count,
            source: cardSource,
            reason: `${cardName}: Draw ${draw.count} ${draw.cardType} card${draw.count > 1 ? 's' : ''}`
          }
        });

        // Add scope recalculation if W cards are drawn
        if (draw.cardType === 'W') {
          effects.push({
            effectType: 'RECALCULATE_SCOPE',
            payload: {
              playerId
            }
          });
        }
      });
    }

    // === CARD DISCARD EFFECTS ===
    if (card.discard_cards && card.discard_cards !== '0' && card.discard_cards !== '') {
      const discardCount = parseInt(card.discard_cards, 10);
      if (discardCount > 0) {
        // For now, assume we're discarding "E" (Expeditor) cards if type isn't specified
        // This matches the L003 card example: "All players must discard 1 Expeditor card"
        const cardTypeToDiscard: CardType = 'E';
        
        effects.push({
          effectType: 'CARD_DISCARD',
          payload: {
            playerId, // This will be replaced with actual target player IDs during targeting
            cardIds: [], // Will be determined at runtime by EffectEngineService
            cardType: cardTypeToDiscard,
            count: discardCount,
            source: cardSource,
            reason: `${cardName}: Discard ${discardCount} ${cardTypeToDiscard} card${discardCount > 1 ? 's' : ''}`
          }
        });
      }
    }

    // === LOAN AMOUNT EFFECTS (New expanded mechanic) ===
    if (card.loan_amount && card.loan_amount !== '0' && card.loan_amount !== '') {
      const loanAmount = this.parseLoanAmount(card.loan_amount);
      if (loanAmount > 0) {
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId,
            resource: 'MONEY',
            amount: loanAmount,
            source: cardSource,
            reason: `${cardName}: Loan of $${loanAmount.toLocaleString()}`
          }
        });
      }
    }

    // === TICK MODIFIER EFFECTS (New expanded mechanic) ===
    if (card.tick_modifier && card.tick_modifier !== '0' && card.tick_modifier !== '') {
      const tickModifier = this.parseTickModifier(card.tick_modifier);
      if (tickModifier !== 0) {
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId,
            resource: 'TIME',
            amount: tickModifier,
            source: cardSource,
            reason: `${cardName}: Time modifier ${tickModifier > 0 ? '+' : ''}${tickModifier}`
          }
        });
      }
    }

    // === TURN SKIP EFFECTS (New expanded mechanic) ===
    if (card.turn_skip && card.turn_skip !== '0' && card.turn_skip !== '') {
      const skipTurns = this.parseTurnSkip(card.turn_skip);
      if (skipTurns > 0) {
        for (let i = 0; i < skipTurns; i++) {
          effects.push({
            effectType: 'TURN_CONTROL',
            payload: {
              action: 'SKIP_TURN',
              playerId,
              source: cardSource,
              reason: `${cardName}: Skip turn ${i + 1}/${skipTurns}`
            }
          });
        }
      }
    }

    // === CARD ACTIVATION EFFECTS (Duration-based cards) ===
    if (card.duration && card.duration !== '0' && card.duration !== '') {
      let duration = this.parseDuration(card.duration);
      
      // If duration field doesn't contain a number, check duration_count field
      if (duration === 0 && card.duration_count && card.duration_count !== '0' && card.duration_count !== '') {
        duration = parseInt(card.duration_count);
        if (isNaN(duration)) {
          duration = 0;
        }
      }
      
      if (duration > 0) {
        effects.push({
          effectType: 'CARD_ACTIVATION',
          payload: {
            playerId,
            cardId: card.card_id,
            duration,
            source: cardSource,
            reason: `${cardName}: Activate for ${duration} turn${duration > 1 ? 's' : ''}`
          }
        });
      }
    }

    // === TARGETING LOGIC ===
    // Note: Target handling is now done by EffectEngineService.processCardEffects()
    // The EffectFactory just creates the base effects and passes target info via card data
    if (card.target && card.target !== '' && card.target.toLowerCase() !== 'self') {
      console.log(`   Card has target: ${card.target} - target resolution will be handled by EffectEngineService`);
      
      // Add log effect for targeted card
      effects.push({
        effectType: 'LOG',
        payload: {
          message: `Targeted card played: ${cardName} by player ${playerId} (target: ${card.target})`,
          level: 'INFO',
          source: cardSource,
          action: 'card_play'
        }
      });
    }

    // === LOG EFFECT (Always add for tracking) ===
    effects.push({
      effectType: 'LOG',
      payload: {
        message: `Card played: ${cardName} by player ${playerId}`,
        level: 'INFO',
        source: cardSource,
        action: 'card_play'
      }
    });

    console.log(`🏭 EFFECT_FACTORY: Generated ${effects.length} effects from card ${cardName}`);
    return effects;
  }

  /**
   * Create effects from space entry
   * 
   * @param spaceEffects Array of SpaceEffect objects for the current space and visit type
   * @param playerId The player entering the space
   * @param spaceName The space being entered for logging purposes
   * @param visitType Whether this is first or subsequent visit
   * @param spaceConfig Optional space configuration containing action data
   * @returns Array of Effect objects for space entry
   */
  static createEffectsFromSpaceEntry(
    spaceEffects: SpaceEffect[],
    playerId: string,
    spaceName: string,
    visitType: 'First' | 'Subsequent',
    spaceConfig?: GameConfig,
    playerName?: string,
    skipLogging?: boolean
  ): Effect[] {
    const effects: Effect[] = [];
    const spaceSource = `space:${spaceName}`;

    console.log(`🏭 EFFECT_FACTORY: Creating effects from space entry: ${spaceName} (${visitType} visit)`);
    console.log(`   Found ${spaceEffects.length} space effects to process`);

    // FIRST: Log effect for space entry (must be processed before any other space effects)
    // Skip logging if this is during game initialization
    if (!skipLogging) {
      effects.push({
        effectType: 'LOG',
        payload: {
          message: `Player ${playerName || playerId} entered space: ${spaceName} (${visitType} visit) - ${spaceEffects.length} effects processed${spaceConfig?.action ? `, action: ${spaceConfig.action}` : ''}`,
          level: 'INFO',
          source: spaceSource,
          action: 'space_effect'
        }
      });
    }

    // THEN: Process each space effect
    spaceEffects.forEach((spaceEffect, index) => {
      console.log(`   Processing space effect ${index + 1}: ${spaceEffect.effect_type} - ${spaceEffect.effect_action} ${spaceEffect.effect_value}`);

      const effectsFromSpaceEffect = this.parseSpaceEffect(spaceEffect, playerId, spaceSource);
      effects.push(...effectsFromSpaceEffect);
    });

    // FINALLY: Process space action if present
    if (spaceConfig && spaceConfig.action && spaceConfig.action !== '') {
      console.log(`   Processing space action: ${spaceConfig.action}`);
      const actionEffects = this.createEffectsFromSpaceAction(spaceConfig.action, playerId, spaceName, spaceSource, playerName);
      effects.push(...actionEffects);
    }

    console.log(`🏭 EFFECT_FACTORY: Generated ${effects.length} effects from space ${spaceName}`);
    return effects;
  }

  /**
   * Create effects from space action keywords
   * 
   * @param action The action keyword from space configuration
   * @param playerId The player who triggered the action
   * @param spaceName The space name for logging
   * @param spaceSource The source identifier for effects
   * @returns Array of Effect objects for the space action
   */
  private static createEffectsFromSpaceAction(action: string, playerId: string, spaceName: string, spaceSource: string, playerName?: string): Effect[] {
    const effects: Effect[] = [];
    
    console.log(`🎯 EFFECT_FACTORY: Processing space action '${action}' for player ${playerId} at ${spaceName}`);
    
    switch (action.toUpperCase()) {
      case 'GOTO_JAIL':
        // GOTO_JAIL just creates a log effect - the actual penalties come from existing space effects
        effects.push({
          effectType: 'LOG',
          payload: {
            message: `Player ${playerName || playerId} triggered regulatory violation at ${spaceName} - penalties applied via existing space effects`,
            level: 'WARN',
            source: spaceSource,
            action: 'space_effect'
          }
        });
        console.log(`   Generated GOTO_JAIL trigger: existing space effects will handle penalties`);
        break;
        
      case 'PAY_TAX':
        // Create RESOURCE_CHANGE effect to deduct fixed tax amount
        effects.push({
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: playerId,
            resource: 'MONEY',
            amount: -500,  // Fixed tax amount as specified
            source: spaceSource,
            reason: `Space action: Pay tax at ${spaceName}`
          }
        });
        console.log(`   Generated RESOURCE_CHANGE effect: ${playerId} pays $500 tax`);
        break;
        
      case 'AUCTION':
        // Reserved for future auction mechanic
        // No auction spaces currently exist in game data
        effects.push({
          effectType: 'LOG',
          payload: {
            message: `Auction mechanic not implemented (triggered at ${spaceName})`,
            level: 'WARN',
            source: spaceSource,
            action: 'space_effect'
          }
        });
        break;
        
      default:
        console.warn(`   Unknown space action '${action}' at ${spaceName} - no effects generated`);
        break;
    }
    
    console.log(`🎯 EFFECT_FACTORY: Generated ${effects.length} effects from action '${action}'`);
    return effects;
  }

  /**
   * Create effects from dice roll outcomes
   * 
   * @param diceEffects Array of DiceEffect objects for the current space and visit type
   * @param playerId The player who rolled
   * @param spaceName The space where the dice was rolled
   * @param diceResult The dice roll result (1-6)
   * @returns Array of Effect objects for dice outcomes
   */
  static createEffectsFromDiceRoll(
    diceEffects: DiceEffect[],
    playerId: string,
    spaceName: string,
    diceResult: number,
    playerName?: string
  ): Effect[] {
    const effects: Effect[] = [];
    const diceSource = `dice:${spaceName}`;

    console.log(`🏭 EFFECT_FACTORY: Creating effects from dice roll: ${diceResult} at ${spaceName}`);
    console.log(`   Found ${diceEffects.length} dice effects to process`);

    // Process each dice effect
    diceEffects.forEach((diceEffect, index) => {
      console.log(`   Processing dice effect ${index + 1}: ${diceEffect.effect_type} for roll ${diceResult}`);
      
      const effectsFromDiceEffect = this.parseDiceEffect(diceEffect, diceResult, playerId, diceSource);
      effects.push(...effectsFromDiceEffect);
    });

    // Log effect for dice roll
    effects.push({
      effectType: 'LOG',
      payload: {
        message: `Player ${playerName || playerId} rolled ${diceResult} at space: ${spaceName} - ${diceEffects.length} effects processed`,
        level: 'INFO',
        source: diceSource,
        action: 'dice_roll'
      }
    });

    console.log(`🏭 EFFECT_FACTORY: Generated ${effects.length} effects from dice roll ${diceResult}`);
    return effects;
  }

  // === PRIVATE PARSING METHODS ===

  /**
   * Parse a SpaceEffect into Effect objects
   */
  private static parseSpaceEffect(spaceEffect: SpaceEffect, playerId: string, source: string): Effect[] {
    const effects: Effect[] = [];
    
    switch (spaceEffect.effect_type) {
      case 'money':
        const moneyAmount = this.parseEffectValue(spaceEffect.effect_value, spaceEffect.effect_action);
        if (moneyAmount !== 0) {
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId,
              resource: 'MONEY',
              amount: moneyAmount,
              source,
              reason: `${spaceEffect.description || 'Space effect'}: ${spaceEffect.effect_action} ${spaceEffect.effect_value}`
            }
          });
        }
        break;

      case 'time':
        const timeAmount = this.parseEffectValue(spaceEffect.effect_value, spaceEffect.effect_action);
        if (timeAmount !== 0) {
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId,
              resource: 'TIME',
              amount: timeAmount,
              source,
              reason: `${spaceEffect.description || 'Space effect'}: ${spaceEffect.effect_action} ${spaceEffect.effect_value}`
            }
          });
        }
        break;

      case 'cards':
        const cardEffect = this.parseCardEffect(spaceEffect.effect_action, spaceEffect.effect_value);
        if (cardEffect) {
          if (cardEffect.action === 'draw') {
            effects.push({
              effectType: 'CARD_DRAW',
              payload: {
                playerId,
                cardType: cardEffect.cardType,
                count: cardEffect.count,
                source,
                reason: `${spaceEffect.description || 'Space effect'}: Draw ${cardEffect.count} ${cardEffect.cardType} card${cardEffect.count > 1 ? 's' : ''}`
              }
            });

            // Add scope recalculation if W cards are drawn
            if (cardEffect.cardType === 'W') {
              effects.push({
                effectType: 'RECALCULATE_SCOPE',
                payload: {
                  playerId
                }
              });
            }
          }
        }
        break;

      default:
        console.warn(`Unknown space effect type: ${spaceEffect.effect_type}`);
        break;
    }

    return effects;
  }

  /**
   * Parse a DiceEffect into Effect objects for a specific dice roll
   */
  private static parseDiceEffect(diceEffect: DiceEffect, diceRoll: number, playerId: string, source: string): Effect[] {
    const effects: Effect[] = [];
    
    // Get the effect value for the specific dice roll
    const rollEffect = this.getDiceRollEffectValue(diceEffect, diceRoll);
    
    if (!rollEffect || rollEffect.trim() === '') {
      // No effect for this dice roll
      return effects;
    }

    console.log(`   Dice effect for roll ${diceRoll}: ${diceEffect.effect_type} = "${rollEffect}"`);
    switch (diceEffect.effect_type) {
      case 'cards':
        if (diceEffect.card_type) {
          // For dice effects, rollEffect is like "Draw 3" and card_type is separate
          // Extract the number from rollEffect and use the card_type from the dice effect
          const countMatch = rollEffect.match(/(\d+)/);
          if (countMatch) {
            const count = parseInt(countMatch[1]);
            const cardDrawEffectPayload = {
              effectType: 'CARD_DRAW' as const,
              payload: {
                playerId,
                cardType: diceEffect.card_type as CardType,
                count: count,
                source,
                reason: `Dice effect: Draw ${count} ${diceEffect.card_type} card${count > 1 ? 's' : ''} (rolled ${diceRoll})`
              }
            };
            effects.push(cardDrawEffectPayload);

            // Add scope recalculation if W cards are drawn
            if (diceEffect.card_type === 'W') {
              effects.push({
                effectType: 'RECALCULATE_SCOPE',
                payload: {
                  playerId
                }
              });
            }
          } else {
            console.warn(`   ⚠️ Could not parse dice effect count from: "${rollEffect}"`);
          }
        } else {
          console.warn(`   ⚠️ Dice effect missing card_type:`, diceEffect);
        }
        break;

      case 'money':
        const moneyAmount = this.parseMoneyEffect(rollEffect);
        if (moneyAmount !== 0) {
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId,
              resource: 'MONEY',
              amount: moneyAmount,
              source,
              reason: `Dice effect: ${rollEffect} (rolled ${diceRoll})`
            }
          });
        }
        break;

      case 'time':
        const timeAmount = this.parseTimeEffect(rollEffect);
        if (timeAmount !== 0) {
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId,
              resource: 'TIME',
              amount: timeAmount,
              source,
              reason: `Dice effect: ${rollEffect} (rolled ${diceRoll})`
            }
          });
        }
        break;

      default:
        console.warn(`Unknown dice effect type: ${diceEffect.effect_type}`);
        break;
    }

    return effects;
  }

  /**
   * Get the dice roll effect value for a specific roll
   */
  private static getDiceRollEffectValue(diceEffect: DiceEffect, diceRoll: number): string | undefined {
    switch (diceRoll) {
      case 1: return diceEffect.roll_1;
      case 2: return diceEffect.roll_2;
      case 3: return diceEffect.roll_3;
      case 4: return diceEffect.roll_4;
      case 5: return diceEffect.roll_5;
      case 6: return diceEffect.roll_6;
      default: return undefined;
    }
  }

  /**
   * Parse effect value with action context (e.g., "add", "subtract")
   */
  private static parseEffectValue(effectValue: string | number, effectAction: string): number {
    let value = typeof effectValue === 'number' ? effectValue : parseInt(String(effectValue).replace(/[^\d-]/g, ''));
    
    if (isNaN(value)) {
      value = 0;
    }

    // Apply action context
    if (effectAction.toLowerCase().includes('subtract') || effectAction.toLowerCase().includes('lose') || effectAction.toLowerCase().includes('pay')) {
      value = -Math.abs(value);
    } else if (effectAction.toLowerCase().includes('add') || effectAction.toLowerCase().includes('gain') || effectAction.toLowerCase().includes('receive')) {
      value = Math.abs(value);
    }

    return value;
  }

  /**
   * Parse card effect from effect action and value
   */
  private static parseCardEffect(effectAction: string, effectValue: string | number): { action: string; cardType: CardType; count: number } | null {
    const action = effectAction.toLowerCase().includes('draw') ? 'draw' : 'unknown';
    
    if (action === 'unknown') {
      return null;
    }

    // Extract card type from effect action (e.g., 'draw_b' -> 'B', 'draw_i' -> 'I')
    const actionStr = effectAction.toLowerCase();
    let cardType: CardType | null = null;
    
    if (actionStr.includes('_w')) {
      cardType = 'W';
    } else if (actionStr.includes('_b')) {
      cardType = 'B';
    } else if (actionStr.includes('_e')) {
      cardType = 'E';
    } else if (actionStr.includes('_i')) {
      cardType = 'I';
    } else if (actionStr.includes('_l')) {
      cardType = 'L';
    }
    
    if (!cardType) {
      console.warn(`Could not determine card type from action: ${effectAction}`);
      return null;
    }
    
    // Use effectValue as count
    const count = typeof effectValue === 'number' ? effectValue : parseInt(String(effectValue)) || 1;
    
    return { action, cardType, count };
  }

  /**
   * Parse money effect string (e.g., "+50000", "-25000", "10% of current")
   */
  private static parseMoneyEffect(moneyEffect: string): number {
    const cleanEffect = moneyEffect.trim();
    
    // Handle percentage effects (e.g., "10% of current")
    if (cleanEffect.includes('%')) {
      // NOTE: Percentage-based money effects not supported in current card set
      // If future cards need this, will require passing player state to this method
      console.warn(`EFFECT_FACTORY: Percentage effects not implemented: ${moneyEffect}`);
      return 0;
    }

    // Handle fixed amount effects (e.g., "+50000", "-25000")
    const amount = parseInt(cleanEffect.replace(/[^-\d]/g, ''));
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Parse time effect string (e.g., "+2", "-1", "0")
   */
  private static parseTimeEffect(timeEffect: string): number {
    const cleanEffect = timeEffect.trim();
    const amount = parseInt(cleanEffect.replace(/[^-\d]/g, ''));
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Parse card draw effect string (e.g., "2 W", "1 B", "3 E")
   */
  private static parseCardDrawEffect(drawEffect: string): Array<{ cardType: CardType; count: number }> {
    const draws: Array<{ cardType: CardType; count: number }> = [];
    const cleanEffect = drawEffect.trim();

    // Simple parsing - assumes format like "2 W" or "1 B"
    const match = cleanEffect.match(/(\d+)\s*([WBEIL])/i);
    if (match) {
      const count = parseInt(match[1]);
      const cardType = match[2].toUpperCase() as CardType;
      
      if (['W', 'B', 'E', 'I', 'L'].includes(cardType)) {
        draws.push({ cardType, count });
      }
    }

    return draws;
  }

  /**
   * Parse loan amount (e.g., "50000", "100000")
   */
  private static parseLoanAmount(loanAmount: string): number {
    const cleanAmount = loanAmount.trim().replace(/[^\d]/g, '');
    const amount = parseInt(cleanAmount);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Parse tick modifier (e.g., "+1", "-2", "0")
   */
  private static parseTickModifier(tickModifier: string): number {
    const cleanModifier = tickModifier.trim();
    const modifier = parseInt(cleanModifier.replace(/[^-\d]/g, ''));
    return isNaN(modifier) ? 0 : modifier;
  }

  /**
   * Parse turn skip count (e.g., "1", "2")
   */
  private static parseTurnSkip(turnSkip: string): number {
    const cleanSkip = turnSkip.trim().replace(/[^\d]/g, '');
    const skip = parseInt(cleanSkip);
    return isNaN(skip) ? 0 : skip;
  }

  /**
   * Parse duration (e.g., "3", "5", "permanent")
   */
  private static parseDuration(duration: string): number {
    const cleanDuration = duration.trim().toLowerCase();
    
    if (cleanDuration === 'permanent' || cleanDuration === 'infinite') {
      return 999; // Use 999 as "permanent" duration
    }

    const durationNum = parseInt(cleanDuration.replace(/[^\d]/g, ''));
    return isNaN(durationNum) ? 0 : durationNum;
  }

  // === UTILITY METHODS ===

  /**
   * Validate that a card object has the minimum required properties
   */
  static validateCard(card: any): card is Card {
    return card && 
           typeof card === 'object' && 
           typeof card.card_id === 'string' &&
           typeof card.card_name === 'string';
  }

  /**
   * Get a summary of effects by type
   */
  static getEffectTypeSummary(effects: Effect[]): { [effectType: string]: number } {
    const summary: { [effectType: string]: number } = {};
    effects.forEach(effect => {
      summary[effect.effectType] = (summary[effect.effectType] || 0) + 1;
    });
    return summary;
  }

  // === TARGETING HELPER METHODS ===
  // Note: Targeting is now handled by EffectEngineService.processCardEffects()
  // These helper methods are no longer needed as the EffectFactory creates base effects
  // and the EffectEngineService handles target resolution using TargetingService

  /**
   * Parse choice-of-effects from card description
   * 
   * Handles cards with "or" mechanics like "Discard 1 card or lose $50"
   * 
   * @param card Card object with description containing choice text
   * @param playerId Player who must make the choice
   * @param cardSource Source string for the effect
   * @param cardName Display name for the card
   * @returns CHOICE_OF_EFFECTS or null if parsing fails
   */
  private static parseChoiceOfEffects(
    card: Card, 
    playerId: string, 
    cardSource: string, 
    cardName: string
  ): Effect | null {
    const description = card.description || '';
    
    // For E012: "Discard 1 Expeditor Card or the current filing takes 1 tick more time."
    if (card.card_id === 'E012') {
      return {
        effectType: 'CHOICE_OF_EFFECTS',
        payload: {
          playerId,
          prompt: `${cardName}: Choose one option`,
          options: [
            {
              label: 'Discard 1 Expeditor Card',
              effects: [{
                effectType: 'CARD_DISCARD',
                payload: {
                  playerId,
                  cardIds: [],
                  cardType: 'E',
                  count: 1,
                  source: cardSource,
                  reason: `${cardName}: Player chose to discard Expeditor card`
                }
              }]
            },
            {
              label: 'Current filing takes 1 tick more time',
              effects: [{
                effectType: 'RESOURCE_CHANGE',
                payload: {
                  playerId,
                  resource: 'TIME',
                  amount: 1,
                  source: cardSource,
                  reason: `${cardName}: Player chose filing delay`
                }
              }]
            }
          ]
        }
      };
    }
    
    return null; // No other choice cards implemented yet
  }

  /**
   * Parse conditional dice roll effects from card description
   * 
   * @param card The card object with conditional description
   * @param playerId The player ID for the effect
   * @param cardSource Source string for the effect
   * @param cardName Display name for the card
   * @returns CONDITIONAL_EFFECT or null if parsing fails
   */
  private static parseConditionalEffect(
    card: Card, 
    playerId: string, 
    cardSource: string, 
    cardName: string
  ): Effect | null {
    if (!card.description || !card.description.includes('Roll a die')) {
      return null;
    }

    const description = card.description;
    console.log(`🎲 EFFECT_FACTORY: Parsing conditional effect for ${cardName}: ${description}`);

    // Extract the conditional ranges and their effects
    // Pattern: "On X-Y [effect]. On Z-W [effect]." or "On X-Y [effect]. On Z-W no effect."
    const ranges: Array<{ min: number; max: number; effects: Effect[] }> = [];
    
    // Match patterns like "On 1-3 increase the current filing time by 5 ticks"
    const rangePattern = /On (\d+)-(\d+)\s+([^.]+)\./g;
    let match;
    
    while ((match = rangePattern.exec(description)) !== null) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      const effectText = match[3].trim();
      
      console.log(`   Found range: ${min}-${max} -> "${effectText}"`);
      
      // Parse the effect text to create actual effects
      const rangeEffects = this.parseConditionalEffectText(effectText, card, playerId, cardSource, cardName);
      
      ranges.push({
        min,
        max,
        effects: rangeEffects
      });
    }
    
    if (ranges.length === 0) {
      console.warn(`   Could not parse conditional ranges from: ${description}`);
      return null;
    }
    
    console.log(`🎲 EFFECT_FACTORY: Created conditional effect with ${ranges.length} ranges`);
    
    return {
      effectType: 'CONDITIONAL_EFFECT',
      payload: {
        playerId,
        condition: {
          type: 'DICE_ROLL',
          ranges
        },
        source: cardSource,
        reason: `${cardName}: Conditional dice roll effect`
      }
    };
  }

  /**
   * Parse conditional effect text into actual Effect objects
   * 
   * @param effectText The text describing the effect (e.g., "increase the current filing time by 5 ticks")
   * @param card The original card object for reference
   * @param playerId The player ID
   * @param cardSource Source string
   * @param cardName Display name
   * @returns Array of Effect objects
   */
  private static parseConditionalEffectText(
    effectText: string, 
    card: Card, 
    playerId: string, 
    cardSource: string, 
    cardName: string
  ): Effect[] {
    const effects: Effect[] = [];
    const text = effectText.toLowerCase();
    
    // Handle "no effect" case
    if (text.includes('no effect')) {
      return effects; // Return empty array
    }
    
    // Parse time/tick modifications
    // Patterns: "increase ... by X ticks", "reduce ... by X ticks", "decrease ... by X ticks"
    const tickPattern = /(increase|reduce|decrease)\s+.*?\s+by\s+(\d+)\s+ticks?/i;
    const tickMatch = effectText.match(tickPattern);
    
    if (tickMatch) {
      const action = tickMatch[1].toLowerCase();
      const amount = parseInt(tickMatch[2]);
      
      const timeAmount = (action === 'increase') ? amount : -amount;
      
      effects.push({
        effectType: 'RESOURCE_CHANGE',
        payload: {
          playerId,
          resource: 'TIME',
          amount: timeAmount,
          source: cardSource,
          reason: `${cardName}: ${effectText}`
        }
      });
      
      console.log(`   Parsed time effect: ${timeAmount} ticks`);
    }
    
    // Could add more parsing patterns here for other effect types (money, cards, etc.)
    
    return effects;
  }
}