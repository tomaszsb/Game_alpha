// src/types/EffectTypes.ts

import { CardType } from './DataTypes';
import { Choice } from './CommonTypes';

/**
 * Generic Effect System Type Definitions
 * 
 * These types define a standardized "language" for all game effects.
 * Every action in the game can be described by one or more Effect objects.
 * 
 * This discriminated union allows for type-safe effect processing while
 * maintaining flexibility for different effect types.
 * 
 * SUPPORTED EFFECT TYPES (10 core types):
 * • RESOURCE_CHANGE: Money/time modifications
 * • CARD_DRAW: Draw cards from deck
 * • CARD_DISCARD: Remove cards from hand (explicit IDs or runtime selection)
 * • CHOICE: Present player choices
 * • LOG: System logging
 * • PLAYER_MOVEMENT: Move player to new space
 * • TURN_CONTROL: Skip, end, or grant extra turns
 * • CARD_ACTIVATION: Activate cards with duration
 * • EFFECT_GROUP_TARGETED: Apply effects to multiple players
 * • RECALCULATE_SCOPE: Trigger scope recalculation
 * • CONDITIONAL_EFFECT: Dice roll-based conditional mechanics
 * 
 * LATEST ADDITIONS:
 * • CARD_DISCARD: Enhanced with cardType/count for CSV-driven runtime selection
 * • CONDITIONAL_EFFECT: Full dice roll conditional logic with range-based outcomes
 */

export type Effect =
  | { 
      effectType: 'RESOURCE_CHANGE'; 
      payload: { 
        playerId: string; 
        resource: 'MONEY' | 'TIME'; 
        amount: number; 
        source?: string;
        reason?: string;
      }; 
    }
  | { 
      effectType: 'CARD_DRAW'; 
      payload: { 
        playerId: string; 
        cardType: CardType; 
        count: number; 
        source?: string;
        reason?: string;
      }; 
    }
  | { 
      effectType: 'CARD_DISCARD'; 
      payload: { 
        playerId: string; 
        cardIds: string[]; // Explicit card IDs for immediate discard
        cardType?: CardType; // For runtime selection: type of cards to discard
        count?: number; // For runtime selection: number of cards to discard
        source?: string;
        reason?: string;
      }; 
    }
  | { 
      effectType: 'CHOICE'; 
      payload: Choice; 
    }
  | {
      effectType: 'LOG';
      payload: {
        message: string;
        level: 'INFO' | 'WARN' | 'ERROR';
        source?: string;
        action?: string;
        playerId?: string;
      };
    }
  | {
      effectType: 'PLAYER_MOVEMENT';
      payload: {
        playerId: string;
        destinationSpace: string;
        source?: string;
        reason?: string;
      };
    }
  | {
      effectType: 'TURN_CONTROL';
      payload: {
        action: 'SKIP_TURN' | 'EXTRA_TURN' | 'END_TURN' | 'GRANT_REROLL';
        playerId: string;
        source?: string;
        reason?: string;
      };
    }
  | {
      effectType: 'CARD_ACTIVATION';
      payload: {
        playerId: string;
        cardId: string;
        duration: number;
        source?: string;
        reason?: string;
      };
    }
  | {
      effectType: 'EFFECT_GROUP_TARGETED';
      payload: {
        targetType: 'OTHER_PLAYER_CHOICE' | 'ALL_OTHER_PLAYERS' | 'ALL_PLAYERS' | 'Self';
        templateEffect: Effect;
        prompt: string;
        source?: string;
      };
    }
  | {
      effectType: 'RECALCULATE_SCOPE';
      payload: {
        playerId: string;
      };
    }
  | {
      effectType: 'CONDITIONAL_EFFECT';
      payload: {
        playerId: string;
        condition: {
          type: 'DICE_ROLL'; // Future: could support other condition types
          ranges: Array<{
            min: number; // Minimum dice roll value (inclusive)
            max: number; // Maximum dice roll value (inclusive)
            effects: Effect[]; // Effects to execute if roll is in range
          }>;
        };
        source?: string;
        reason?: string;
      };
    }
  | {
      effectType: 'CHOICE_OF_EFFECTS';
      payload: {
        playerId: string;
        prompt: string;
        options: Array<{
          label: string;
          effects: Effect[];
        }>;
      };
    }
  | {
      effectType: 'PLAY_CARD';
      payload: {
        playerId: string;
        cardId: string;
        source?: string;
      };
    }
  | {
      effectType: 'DURATION_STORED';
      payload: {
        playerId: string;
        cardId: string;
        source?: string;
        message: string;
      };
    }
  | {
      effectType: 'INITIATE_NEGOTIATION';
      payload: {
        initiatorId: string;
        targetPlayerIds: string[];
        negotiationType: 'CARD_EXCHANGE' | 'RESOURCE_TRADE' | 'FAVOR_REQUEST' | 'ALLIANCE_PROPOSAL';
        context: {
          description: string;
          requiresAgreement: boolean;
          offerData?: any;
          requestData?: any;
        };
        source?: string;
      };
    }
  | {
      effectType: 'NEGOTIATION_RESPONSE';
      payload: {
        respondingPlayerId: string;
        negotiationId: string;
        response: 'ACCEPT' | 'DECLINE' | 'COUNTER_OFFER';
        responseData?: any;
        source?: string;
      };
    }
  | {
      effectType: 'PLAYER_AGREEMENT_REQUIRED';
      payload: {
        requesterPlayerId: string;
        targetPlayerIds: string[];
        agreementType: 'CARD_TRANSFER' | 'RESOURCE_SHARE' | 'JOINT_ACTION' | 'PROTECTION_DEAL';
        agreementData: any;
        prompt: string;
        source?: string;
      };
    };

/**
 * Effect Processing Context
 * 
 * Provides context information for effect processing,
 * including the source of the effect and any additional metadata.
 */
export interface EffectContext {
  source: string;
  playerId?: string;
  triggerEvent?: 'CARD_PLAY' | 'SPACE_ENTRY' | 'SPACE_EXIT' | 'DICE_ROLL' | 'TURN_START' | 'TURN_END' | 'ACTIVE_EFFECT';
  diceRoll?: number; // Required for CONDITIONAL_EFFECT processing
  metadata?: Record<string, any>;
}

/**
 * Effect Processing Result
 * 
 * Contains the result of processing an effect, including
 * success status, any errors, and resulting state changes.
 */
export interface EffectResult {
  success: boolean;
  effectType: Effect['effectType'];
  error?: string;
  resultingEffects?: Effect[];  // Some effects may trigger additional effects
  data?: {
    cardIds?: string[];  // IDs of cards that were drawn, removed, or affected
    [key: string]: any;  // Allow for other effect-specific data
  };
}

/**
 * Batch Effect Processing Result
 * 
 * Contains the results of processing multiple effects as a batch.
 */
export interface BatchEffectResult {
  success: boolean;
  totalEffects: number;
  successfulEffects: number;
  failedEffects: number;
  results: EffectResult[];
  errors: string[];
}

/**
 * Type Guards for Effect Types
 * 
 * These utility functions provide type-safe checking of effect types.
 */
export function isResourceChangeEffect(effect: Effect): effect is Extract<Effect, { effectType: 'RESOURCE_CHANGE' }> {
  return effect.effectType === 'RESOURCE_CHANGE';
}

export function isCardDrawEffect(effect: Effect): effect is Extract<Effect, { effectType: 'CARD_DRAW' }> {
  return effect.effectType === 'CARD_DRAW';
}

export function isCardDiscardEffect(effect: Effect): effect is Extract<Effect, { effectType: 'CARD_DISCARD' }> {
  return effect.effectType === 'CARD_DISCARD';
}

export function isChoiceEffect(effect: Effect): effect is Extract<Effect, { effectType: 'CHOICE' }> {
  return effect.effectType === 'CHOICE';
}

export function isLogEffect(effect: Effect): effect is Extract<Effect, { effectType: 'LOG' }> {
  return effect.effectType === 'LOG';
}

export function isPlayerMovementEffect(effect: Effect): effect is Extract<Effect, { effectType: 'PLAYER_MOVEMENT' }> {
  return effect.effectType === 'PLAYER_MOVEMENT';
}

export function isTurnControlEffect(effect: Effect): effect is Extract<Effect, { effectType: 'TURN_CONTROL' }> {
  return effect.effectType === 'TURN_CONTROL';
}

export function isCardActivationEffect(effect: Effect): effect is Extract<Effect, { effectType: 'CARD_ACTIVATION' }> {
  return effect.effectType === 'CARD_ACTIVATION';
}

export function isEffectGroupTargetedEffect(effect: Effect): effect is Extract<Effect, { effectType: 'EFFECT_GROUP_TARGETED' }> {
  return effect.effectType === 'EFFECT_GROUP_TARGETED';
}

export function isRecalculateScopeEffect(effect: Effect): effect is Extract<Effect, { effectType: 'RECALCULATE_SCOPE' }> {
  return effect.effectType === 'RECALCULATE_SCOPE';
}

export function isConditionalEffect(effect: Effect): effect is Extract<Effect, { effectType: 'CONDITIONAL_EFFECT' }> {
  return effect.effectType === 'CONDITIONAL_EFFECT';
}

export function isChoiceOfEffectsEffect(effect: Effect): effect is Extract<Effect, { effectType: 'CHOICE_OF_EFFECTS' }> {
  return effect.effectType === 'CHOICE_OF_EFFECTS';
}

export function isPlayCardEffect(effect: Effect): effect is Extract<Effect, { effectType: 'PLAY_CARD' }> {
  return effect.effectType === 'PLAY_CARD';
}

export function isDurationStoredEffect(effect: Effect): effect is Extract<Effect, { effectType: 'DURATION_STORED' }> {
  return effect.effectType === 'DURATION_STORED';
}

export function isInitiateNegotiationEffect(effect: Effect): effect is Extract<Effect, { effectType: 'INITIATE_NEGOTIATION' }> {
  return effect.effectType === 'INITIATE_NEGOTIATION';
}

export function isNegotiationResponseEffect(effect: Effect): effect is Extract<Effect, { effectType: 'NEGOTIATION_RESPONSE' }> {
  return effect.effectType === 'NEGOTIATION_RESPONSE';
}

export function isPlayerAgreementRequiredEffect(effect: Effect): effect is Extract<Effect, { effectType: 'PLAYER_AGREEMENT_REQUIRED' }> {
  return effect.effectType === 'PLAYER_AGREEMENT_REQUIRED';
}