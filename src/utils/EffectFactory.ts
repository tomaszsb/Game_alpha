// src/utils/EffectFactory.ts

import { Card, CardType, SpaceEffect, DiceEffect, GameConfig } from '../types/DataTypes';
import { Effect } from '../types/EffectTypes';
import { ConditionEvaluator } from './ConditionEvaluator';
import { extractNumeric, extractPositiveNumeric, extractPercentage, parseCardTypeFromText, parseCardActionFromText, parseCardDrawFormat, determineFeeType } from './parseUtils';
import { debugWarn } from './debugLog';

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


    // Determine sourceType based on card type (B = owner, L = bank, I = investment)
    const sourceTypeMap: { [key: string]: 'owner' | 'bank' | 'investment' | 'other' } = {
      'B': 'owner',      // B cards = Owner funding (including seed money)
      'L': 'bank',       // L cards = Bank loans
      'I': 'investment', // I cards = Investment deals
    };
    const sourceType = sourceTypeMap[card.card_type] || 'other';

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
    // Prefer structured card_mechanic column; fall back to description parsing
    const isChoice = card.card_mechanic === 'choice' ||
      (!card.card_mechanic && card.description?.includes(' or '));
    if (isChoice) {
      const choiceEffect = this.parseChoiceOfEffects(card, playerId, cardSource, cardName);
      if (choiceEffect) {
        effects.push(choiceEffect);
        // Skip normal effect processing for choice cards
        return effects;
      }
    }

    // === CONDITIONAL EFFECTS (Dice Roll Based) ===
    // Prefer structured card_mechanic column; fall back to description parsing
    const isDiceConditional = card.card_mechanic === 'dice_conditional' ||
      (!card.card_mechanic && card.description?.includes('Roll a die'));
    if (isDiceConditional) {
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
            sourceType,  // Track money source based on card type (B=owner, L=bank, I=investment)
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
            sourceType,  // Track money source based on card type (B=owner, L=bank, I=investment)
            reason: `${cardName}: Loan of $${loanAmount.toLocaleString()}`
          }
        });
      }
    }

    // NOTE: tick_modifier is handled ONCE, in the TIME EFFECTS block above.
    // A second "TIME MODIFIER EFFECTS" block used to re-emit the same
    // RESOURCE_CHANGE here, so every timed card played through this factory
    // (the classic CardModal path) applied double time — an expeditor's
    // "-2 days" cost 4, E013's "+2 days to all players" hit for 4
    // (fb:c51f9f16 "does it really add 2 days?"). Removed 2026-07-02.

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
    skipLogging?: boolean,
    spaceFriendlyName?: string
  ): Effect[] {
    const effects: Effect[] = [];
    const spaceSource = `space:${spaceName}`;


    // FIRST: Log effect for space entry (must be processed before any other space effects)
    // Skip logging if this is during game initialization
    if (!skipLogging) {
      const friendly = spaceFriendlyName || spaceName;
      const visitLabel = visitType === 'First' ? 'first visit' : 'return visit';
      effects.push({
        effectType: 'LOG',
        payload: {
          message: `${playerName || playerId} entered ${friendly} (${visitLabel})`,
          level: 'INFO',
          source: spaceSource,
          action: 'space_effect'
        }
      });
    }

    // THEN: Process each space effect
    spaceEffects.forEach((spaceEffect, _index) => {

      const effectsFromSpaceEffect = this.parseSpaceEffect(spaceEffect, playerId, spaceSource);
      effects.push(...effectsFromSpaceEffect);
    });

    // FINALLY: Process space action if present
    if (spaceConfig && spaceConfig.action && spaceConfig.action !== '') {
      const actionEffects = this.createEffectsFromSpaceAction(spaceConfig.action, playerId, spaceName, spaceSource, playerName);
      effects.push(...actionEffects);
    }

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
    
    
    switch (action.toUpperCase()) {
      case 'GOTO_JAIL':
        // GOTO_JAIL just creates a log effect - the actual penalties come from existing space effects
        effects.push({
          effectType: 'LOG',
          payload: {
            message: `${playerName || playerId} triggered regulatory violation at ${spaceName} - penalties applied via existing space effects`,
            level: 'WARN',
            source: spaceSource,
            action: 'space_effect'
          }
        });
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
        debugWarn(`   Unknown space action '${action}' at ${spaceName} - no effects generated`);
        break;
    }
    
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
    playerName?: string,
    spaceFriendlyName?: string
  ): Effect[] {
    const effects: Effect[] = [];
    const diceSource = `dice:${spaceName}`;


    // Process each dice effect
    diceEffects.forEach((diceEffect, _index) => {

      const effectsFromDiceEffect = this.parseDiceEffect(diceEffect, diceResult, playerId, diceSource);
      effects.push(...effectsFromDiceEffect);
    });

    // Log effect for dice roll. Voice rule (no game language): no "rolled" /
    // no raw die number — frame it as the real-world outcome coming back,
    // matching TurnService's "Outcome determined" phrasing (fb:1783080880242).
    const friendly = spaceFriendlyName || spaceName;
    effects.push({
      effectType: 'LOG',
      payload: {
        message: `${playerName || playerId}'s outcome came back at ${friendly}`,
        level: 'INFO',
        source: diceSource,
        action: 'dice_roll'
      }
    });

    return effects;
  }

  // === PRIVATE PARSING METHODS ===

  /**
   * Parse a SpaceEffect into Effect objects
   */
  private static parseSpaceEffect(spaceEffect: SpaceEffect, playerId: string, source: string): Effect[] {
    const effects: Effect[] = [];
    
    switch (spaceEffect.effect_type) {
      case 'money': {
        // Special handling for owner seed money calculator
        if (spaceEffect.effect_action === 'owner_seed_money') {
          effects.push({
            effectType: 'OWNER_SEED_MONEY',
            payload: {
              playerId,
              source,
              reason: spaceEffect.description || "Owner's personal seed money investment"
            }
          });
          break;
        }

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
      }

      case 'time': {
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
      }

      case 'cards': {
        // Check if this is a dice-conditional card effect (uses condition column like 'dice_roll_3')
        // These effects should NOT be processed here - they're handled by dice roll logic in TurnService
        if (ConditionEvaluator.isDiceConditionStatic(spaceEffect.condition)) {
          // This is a dice-conditional card effect - skip it here
          // It will be processed when the dice is actually rolled
          break;
        }

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
      }

      case 'fee': {
        // Fee effects are percentage-based loan fees that require player state to calculate
        // Determine fee type from description
        // Use structured fee_type from CSV when available, fall back to runtime detection
        const feeType = spaceEffect.fee_type || determineFeeType(String(spaceEffect.effect_value));

        effects.push({
          effectType: 'FEE_DEDUCTION',
          payload: {
            playerId,
            feeType,
            feeDescription: String(spaceEffect.effect_value),
            source,
            reason: `${spaceEffect.description || 'Space effect'}: ${spaceEffect.effect_action} ${spaceEffect.effect_value}`
          }
        });
        break;
      }

      default:
        debugWarn(`Unknown space effect type: ${spaceEffect.effect_type}`);
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

    // Check for "No change" or similar values that mean nothing happens
    const noChangePatterns = ['no change', 'no effect', 'none', 'n/a', '-'];
    if (noChangePatterns.some(pattern => rollEffect.toLowerCase().trim() === pattern)) {
      return effects;
    }


    // Handle "X Cards" format in effect_type (e.g., "W Cards", "B Cards")
    // This is used in DICE_ROLL_INFO.csv where the effect_type column contains the card type
    // rollEffect can be "Draw 1", "Remove 1", "Replace 1", etc.
    const cardType = parseCardTypeFromText(diceEffect.effect_type);
    if (cardType) {
      const parsed = parseCardActionFromText(rollEffect);
      if (parsed) {
        const count = parsed.count;
        const actionWord = parsed.action;

        if (actionWord === 'draw') {
          effects.push({
            effectType: 'CARD_DRAW' as const,
            payload: {
              playerId,
              cardType: cardType,
              count: count,
              source,
              reason: `Dice effect: Draw ${count} ${cardType} card${count > 1 ? 's' : ''} (rolled ${diceRoll})`
            }
          });

          // Add scope recalculation if W cards are drawn
          if (cardType === 'W') {
            effects.push({
              effectType: 'RECALCULATE_SCOPE',
              payload: {
                playerId
              }
            });
          }
        } else if (actionWord === 'remove') {
          // Remove X cards - requires user selection via choice modal
          effects.push({
            effectType: 'CARD_DISCARD' as const,
            payload: {
              playerId,
              cardIds: [], // Empty = runtime selection needed
              cardType: cardType,
              count: count,
              source: `${source}:dice_remove`, // Special marker for dice roll removes
              reason: `Dice effect: Remove ${count} ${cardType} card${count > 1 ? 's' : ''} (rolled ${diceRoll})`
            }
          });

          // Add scope recalculation if W cards are removed
          if (cardType === 'W') {
            effects.push({
              effectType: 'RECALCULATE_SCOPE',
              payload: {
                playerId
              }
            });
          }
        } else if (actionWord === 'replace') {
          // Replace X cards - requires user selection, then draw new cards
          // First create a discard effect, then a draw effect
          effects.push({
            effectType: 'CARD_DISCARD' as const,
            payload: {
              playerId,
              cardIds: [], // Empty = runtime selection needed
              cardType: cardType,
              count: count,
              source: `${source}:dice_replace`, // Special marker for dice roll replaces
              reason: `Dice effect: Replace ${count} ${cardType} card${count > 1 ? 's' : ''} - choosing card to replace (rolled ${diceRoll})`
            }
          });
          // The draw will happen after the discard is processed
          effects.push({
            effectType: 'CARD_DRAW' as const,
            payload: {
              playerId,
              cardType: cardType,
              count: count,
              source: `${source}:dice_replace_draw`,
              reason: `Dice effect: Replace ${count} ${cardType} card${count > 1 ? 's' : ''} - drawing new card (rolled ${diceRoll})`
            }
          });

          // Add scope recalculation if W cards are replaced (affects scope either way)
          if (cardType === 'W') {
            effects.push({
              effectType: 'RECALCULATE_SCOPE',
              payload: {
                playerId
              }
            });
          }
        }
      } else {
        debugWarn(`   ⚠️ Could not parse card count from: "${rollEffect}"`);
      }
      return effects;
    }

    // DICE_EFFECTS.csv mixes case ('cards', 'money', 'time' lowercase but
    // 'Quality', 'Multiplier' capitalized). Normalize once so case data can
    // evolve without breaking the switch.
    switch (diceEffect.effect_type.toLowerCase().trim()) {
      case 'cards':
        if (diceEffect.card_type) {
          // For dice effects, rollEffect is like "Draw 3" and card_type is separate
          // Extract the number from rollEffect and use the card_type from the dice effect
          const parsedAction = parseCardActionFromText(rollEffect);
          if (parsedAction) {
            const count = parsedAction.count;
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
            debugWarn(`   ⚠️ Could not parse dice effect count from: "${rollEffect}"`);
          }
        } else {
          debugWarn(`   ⚠️ Dice effect missing card_type:`, diceEffect);
        }
        break;

      case 'money': {
        // Use structured flag from CSV when available, fall back to runtime detection
        const isPercentage = diceEffect.roll_is_percentage ?? rollEffect.includes('%');
        const percentage = isPercentage ? extractPercentage(rollEffect) : null;
        if (percentage !== null && percentage > 0) {
          // Use structured fee_category from CSV when available, fall back to
          // the old name-literal guess only if a row doesn't carry it yet.
          const feeCategory: 'architectural' | 'engineering' | 'construction' =
            (diceEffect.fee_category as 'architectural' | 'engineering' | 'construction' | undefined)
              || (source.includes('ARCH') ? 'architectural' : 'engineering');
          effects.push({
            effectType: 'RESOURCE_CHANGE',
            payload: {
              playerId,
              resource: 'MONEY',
              amount: 0,  // Will be calculated in EffectEngineService based on project scope
              percentageOfScope: percentage,
              feeCategory,
              source,
              reason: `Design fee: ${rollEffect} of project scope (rolled ${diceRoll})`
            }
          });
        } else {
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
        }
        break;
      }

      case 'time': {
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
      }

      // CON-INITIATION's Quality (HIGH/MED/LOW) and Multiplier (1-6) rows.
      // The effect_type from DICE_EFFECTS.csv comes through with mixed case
      // ("Quality", "Multiplier") — the switch above already runs through the
      // raw value, so we lowercase-compare here just like SpaceEffectService does.
      case 'quality':
        effects.push({
          effectType: 'CONTRACTOR_UPDATE',
          payload: {
            playerId,
            kind: 'quality',
            value: rollEffect,
            source,
            reason: `Hired contractor of ${rollEffect} quality (rolled ${diceRoll})`
          }
        });
        break;

      case 'multiplier':
        effects.push({
          effectType: 'CONTRACTOR_UPDATE',
          payload: {
            playerId,
            kind: 'multiplier',
            value: rollEffect,
            source,
            reason: `Contractor cost multiplier ${rollEffect}× (rolled ${diceRoll})`
          }
        });
        break;

      default:
        debugWarn(`Unknown dice effect type: ${diceEffect.effect_type}`);
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
    let value = extractNumeric(typeof effectValue === 'number' ? effectValue : String(effectValue));

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
      debugWarn(`Could not determine card type from action: ${effectAction}`);
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
    // Handle percentage effects (e.g., "10% of current")
    if (extractPercentage(moneyEffect) !== null) {
      // NOTE: Percentage-based money effects not supported in current card set
      debugWarn(`EFFECT_FACTORY: Percentage effects not implemented: ${moneyEffect}`);
      return 0;
    }

    return extractNumeric(moneyEffect);
  }

  /**
   * Parse time effect string (e.g., "+2", "-1", "0")
   */
  private static parseTimeEffect(timeEffect: string): number {
    return extractNumeric(timeEffect);
  }

  /**
   * Parse card draw effect string (e.g., "2 W", "1 B", "3 E")
   */
  private static parseCardDrawEffect(drawEffect: string): Array<{ cardType: CardType; count: number }> {
    const parsed = parseCardDrawFormat(drawEffect);
    return parsed ? [parsed] : [];
  }

  /**
   * Parse loan amount (e.g., "50000", "100000")
   */
  private static parseLoanAmount(loanAmount: string): number {
    return extractPositiveNumeric(loanAmount);
  }

  /**
   * Parse turn skip count (e.g., "1", "2")
   */
  private static parseTurnSkip(turnSkip: string): number {
    return extractPositiveNumeric(turnSkip);
  }

  /**
   * Parse duration (e.g., "3", "5", "permanent")
   */
  private static parseDuration(duration: string): number {
    const cleanDuration = duration.trim().toLowerCase();

    if (cleanDuration === 'permanent' || cleanDuration === 'infinite') {
      return 999; // Use 999 as "permanent" duration
    }

    return extractPositiveNumeric(duration);
  }

  // === UTILITY METHODS ===

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
    // For E012: "Discard 1 Expeditor Card or the current filing takes 1 day more time."
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
              label: 'Current filing takes 1 day more time',
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
    // === Structured data path: use dice_range columns if available ===
    if (card.dice_range_1_min != null) {
      const ranges: Array<{ min: number; max: number; effects: Effect[] }> = [];

      // Range 1
      const r1Effects: Effect[] = card.dice_range_1_time !== 0 ? [{
        effectType: 'RESOURCE_CHANGE' as const,
        payload: {
          playerId,
          resource: 'TIME',
          amount: card.dice_range_1_time!,
          source: cardSource,
          reason: `${cardName}: dice conditional`
        }
      }] : [];
      ranges.push({ min: card.dice_range_1_min, max: card.dice_range_1_max!, effects: r1Effects });

      // Range 2 (if defined)
      if (card.dice_range_2_min != null) {
        const r2Effects: Effect[] = card.dice_range_2_time !== 0 ? [{
          effectType: 'RESOURCE_CHANGE' as const,
          payload: {
            playerId,
            resource: 'TIME',
            amount: card.dice_range_2_time!,
            source: cardSource,
            reason: `${cardName}: dice conditional`
          }
        }] : [];
        ranges.push({ min: card.dice_range_2_min, max: card.dice_range_2_max!, effects: r2Effects });
      }

      return {
        effectType: 'CONDITIONAL_EFFECT',
        payload: {
          playerId,
          condition: { type: 'DICE_ROLL', ranges },
          source: cardSource,
          reason: `${cardName}: Conditional dice roll effect`
        }
      };
    }

    // === Legacy fallback: parse description text ===
    if (!card.description || !card.description.includes('Roll a die')) {
      return null;
    }

    const description = card.description;

    // Extract the conditional ranges and their effects
    // Pattern: "On X-Y [effect]. On Z-W [effect]." or "On X-Y [effect]. On Z-W no effect."
    const ranges: Array<{ min: number; max: number; effects: Effect[] }> = [];

    // Match patterns like "On 1-3 increase the current filing time by 5 days"
    const rangePattern = /On (\d+)-(\d+)\s+([^.]+)\./g;
    let match;

    while ((match = rangePattern.exec(description)) !== null) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      const effectText = match[3].trim();


      // Parse the effect text to create actual effects
      const rangeEffects = this.parseConditionalEffectText(effectText, card, playerId, cardSource, cardName);

      ranges.push({
        min,
        max,
        effects: rangeEffects
      });
    }

    if (ranges.length === 0) {
      debugWarn(`   Could not parse conditional ranges from: ${description}`);
      return null;
    }


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
   * @param effectText The text describing the effect (e.g., "increase the current filing time by 5 days")
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
    
    // Parse time/day modifications
    // Patterns: "increase ... by X days", "reduce ... by X days", "decrease ... by X days"
    const tickPattern = /(increase|reduce|decrease)\s+.*?\s+by\s+(\d+)\s+days?/i;
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
      
    }
    
    // Could add more parsing patterns here for other effect types (money, cards, etc.)
    
    return effects;
  }
}
