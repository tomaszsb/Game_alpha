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
  // v3.0.33 (fb:068a66f2) — cross-runtime resolution relay. A LOGIC_QUESTION
  // chain is created during the OUTGOING player's endTurn→startTurn handoff, so
  // the pending promise lives on that device — not on the answering player's.
  // When a device answers a choice it doesn't own the promise for, it writes
  // the selection here; the promise-owning device observes the synced state and
  // resolves locally, then clears the choice (wiping this field for everyone).
  resolvedWith?: string;
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