// src/types/CommonTypes.ts

/**
 * Represents a decision point for a player.
 * This is used when a game event requires player input to proceed.
 */
export interface Choice {
  id: string;
  playerId: string;
  type: 'MOVEMENT' | 'PLAYER_TARGET' | 'GENERAL' | 'TARGET_SELECTION' | 'CARD_REPLACEMENT' | 'CARD_GIVE' | 'CARD_SELECTION' | 'CARD_DISCARD' | 'LOGIC_QUESTION';
  prompt: string;
  options: Array<{ id: string; label: string; }>;
  metadata?: {
    newCardType?: string; // For CARD_REPLACEMENT type - the type of card the player will receive
    // LOGIC_QUESTION metadata: step progress + chain context for ChoiceModal rendering
    logicSpaceName?: string;
    logicVisitType?: 'First' | 'Subsequent';
    logicQuestionId?: string;
    logicStepIndex?: number;   // 1-based step in the chain (for "Question 2 of 5" display)
    logicStepTotal?: number;
    [key: string]: any; // Allow other metadata as needed
  };
}