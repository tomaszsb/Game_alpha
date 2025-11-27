// src/types/CommonTypes.ts

/**
 * Represents a decision point for a player.
 * This is used when a game event requires player input to proceed.
 */
export interface Choice {
  id: string;
  playerId: string;
  type: 'MOVEMENT' | 'PLAYER_TARGET' | 'GENERAL' | 'TARGET_SELECTION' | 'CARD_REPLACEMENT';
  prompt: string;
  options: Array<{ id: string; label: string; }>;
  metadata?: {
    newCardType?: string; // For CARD_REPLACEMENT type - the type of card the player will receive
    [key: string]: any; // Allow other metadata as needed
  };
}