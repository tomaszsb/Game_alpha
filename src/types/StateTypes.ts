import { Player, ActiveCard, ActiveEffect, Loan, MoneySources, Expenditures, CostEntry, CostBreakdown, SpaceVisitRecord } from './DataTypes';
import { Effect } from './EffectTypes';
import { Choice } from './CommonTypes';

export type GamePhase = 'SETUP' | 'PLAY' | 'END';

// ============================================================
// REAL/TEMP State Model Types (December 26, 2025)
// ============================================================
//
// This state model separates "committed" state from "working" state
// to simplify Try Again logic and make state transitions explicit.
//
// Flow:
// 1. Turn starts → CREATE TEMP from REAL
// 2. All effects → APPLY TO TEMP only
// 3. UI renders → FROM TEMP
// 4. On Try Again: Add penalty to REAL → discard TEMP → create fresh TEMP
// 5. On End Turn: COMMIT TEMP to REAL
//
// See docs/technical/TECHNICAL_DEBT.md for full design rationale.
// ============================================================

/**
 * Mutable player state that can change during a turn.
 * This is the subset of Player that gets captured in REAL/TEMP states.
 */
export interface MutablePlayerState {
  // Core resources
  money: number;
  timeSpent: number;
  projectScope: number;
  score: number;

  // Cards
  hand: string[];
  activeCards: ActiveCard[];

  // Financial tracking
  loans: Loan[];
  moneySources: MoneySources;
  expenditures: Expenditures;
  costHistory: CostEntry[];
  costs: CostBreakdown;

  // Effects
  activeEffects: ActiveEffect[];

  // Space tracking (may change if Try Again applies time penalty)
  spaceVisitLog: SpaceVisitRecord[];

  // Dice state
  lastDiceRoll?: {
    roll1: number;
    roll2: number;
    total: number;
  };
}

/**
 * Captures the complete REAL or TEMP state for a player.
 * Used for state transitions (commit, discard, create from REAL).
 */
export interface PlayerTurnState {
  playerId: string;
  playerName: string;

  // The mutable state snapshot
  state: MutablePlayerState;

  // Context about when this state was captured
  capturedAt: {
    turnNumber: number;
    spaceName: string;
    visitType: 'First' | 'Subsequent';
    timestamp: Date;
  };
}

/**
 * Manages REAL and TEMP states for all players.
 * This replaces the snapshot-based approach.
 */
export interface TurnStateModel {
  // REAL state: Committed state that survives Try Again
  // Updated only at turn boundaries (end turn, start of next turn)
  realStates: {
    [playerId: string]: PlayerTurnState | null;
  };

  // TEMP state: Working state for current turn
  // Discarded and recreated on Try Again
  // Committed to REAL on End Turn
  tempStates: {
    [playerId: string]: PlayerTurnState | null;
  };

  // Tracks which players have active TEMP states
  // (i.e., are in the middle of their turn)
  activeTurnPlayers: string[];

  // Try Again tracking: how many times each player has used Try Again this turn
  tryAgainCounts: {
    [playerId: string]: number;
  };
}

/**
 * Result of a state transition operation.
 */
export interface StateTransitionResult {
  success: boolean;
  error?: string;

  // The affected state (after the operation)
  newTempState?: PlayerTurnState;
  newRealState?: PlayerTurnState;

  // For Try Again: the time penalty that was applied
  timePenaltyApplied?: number;
}

/**
 * Options for creating a TEMP state from REAL.
 */
export interface CreateTempOptions {
  playerId: string;
  spaceName: string;
  visitType: 'First' | 'Subsequent';

  // If true, this is a Try Again scenario - apply time penalty first
  isTryAgain?: boolean;
  tryAgainPenalty?: number;
}

export interface ActionLogEntry {
  id: string;
  type: 'space_entry' | 'space_effect' | 'time_effect' | 'dice_roll' | 'card_draw' | 'resource_change' | 'manual_action' | 'turn_start' | 'turn_end' | 'card_play' | 'card_transfer' | 'card_discard' | 'player_movement' | 'card_activate' | 'card_expire' | 'deck_reshuffle' | 'game_start' | 'game_end' | 'error_event' | 'choice_made' | 'negotiation_resolved' | 'system_log';
  timestamp: Date;
  playerId: string;
  playerName: string;
  description: string;
  details?: Record<string, any>;
  // Transactional logging fields for "Try Again" support
  isCommitted: boolean; // true if action is part of canonical game history
  explorationSessionId: string; // unique ID grouping all actions from a single exploratory attempt
  // Enhanced turn context
  gameRound: number; // Which game round this occurred in
  turnWithinRound: number; // Which turn within that round
  globalTurnNumber: number; // Absolute turn number across all players
  playerTurnNumber: number; // This player's individual turn number (1st, 2nd, 3rd, etc.)
  // Visibility control
  visibility: 'player' | 'debug' | 'system'; // Who should see this log
}


export interface NegotiationState {
  negotiationId: string;
  initiatorId: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  context: any;
  offers: Array<{
    playerId: string;
    offerData: any;
    timestamp: Date;
  }>;
  createdAt: Date;
  lastUpdatedAt: Date;
  participantIds?: string[];
  expiresAt?: Date;
  playerSnapshots?: Array<{
    id: string;
    availableCards: {
      W?: string[];
      B?: string[];
      E?: string[];
      L?: string[];
      I?: string[];
    };
    negotiationOffer: string[];
  }>;
}

export interface NegotiationResult {
  success: boolean;
  message: string;
  negotiationId?: string;
  effects: Effect[];
  data?: any;
  newState?: GameState;
}

export interface ActiveModal {
  type: 'CARD';
  cardId: string;
}

export interface GameState {
  players: Player[];
  currentPlayerId: string | null;
  gamePhase: GamePhase;
  turn: number; // Deprecated but kept for backwards compatibility
  // New turn tracking system
  gameRound: number; // Current game round (1, 2, 3...)
  turnWithinRound: number; // Current turn within round (1-4 for 4 players)
  globalTurnCount: number; // Total turns taken across all players (1, 2, 3, 4, 5, 6...)
  // Track individual player turn counts for statistics
  playerTurnCounts: { [playerId: string]: number }; // How many turns each player has taken total
  activeModal: ActiveModal | null;
  awaitingChoice: Choice | null;
  hasPlayerMovedThisTurn: boolean;
  hasPlayerRolledDice: boolean;
  isGameOver: boolean;
  isMoving: boolean;
  isProcessingArrival: boolean;
  isInitialized: boolean; // Flag to indicate game state is fully set up
  gameStartTime?: Date;
  gameEndTime?: Date;
  winner?: string;
  // Transactional logging session tracking
  currentExplorationSessionId: string | null;
  // Action tracking for turn management
  requiredActions: number;
  completedActionCount: number;
  availableActionTypes: string[];
  completedActions: {
    diceRoll: string | undefined;
    manualActions: { [key: string]: string };
  };
  // Negotiation state
  activeNegotiation: NegotiationState | null;
  // Movement selection state
  selectedDestination: string | null;
  // Global action log
  globalActionLog: ActionLogEntry[];
  // Try Again state snapshotting (per player) - LEGACY
  // Will be replaced by turnStateModel in future refactor
  playerSnapshots: {
    [playerId: string]: {
      spaceName: string;
      gameState: GameState;
    } | null;
  };

  // NEW: REAL/TEMP State Model (December 26, 2025)
  // Separates committed state (REAL) from working state (TEMP)
  // See docs/technical/TECHNICAL_DEBT.md for design rationale
  turnStateModel?: TurnStateModel;
  // Stateful decks and discard piles
  decks: {
    W: string[];
    B: string[];
    E: string[];
    L: string[];
    I: string[];
  };
  discardPiles: {
    W: string[];
    B: string[];
    E: string[];
    L: string[];
    I: string[];
  };
}

export interface PlayerAction {
  id: string;
  playerId: string;
  action: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface GameHistory {
  actions: PlayerAction[];
  gameStates: GameState[];
}

export interface StateUpdateResult {
  success: boolean;
  newState: GameState;
  error?: string;
}

export interface PlayerUpdateData {
  id?: string;
  name?: string;
  currentSpace?: string;
  visitType?: 'First' | 'Subsequent';
  visitedSpaces?: string[];
  spaceVisitLog?: import('./DataTypes').SpaceVisitRecord[];
  money?: number;
  timeSpent?: number;
  projectScope?: number;
  hand?: string[]; // Replaces availableCards and discardedCards
  activeCards?: ActiveCard[];
  lastDiceRoll?: {
    roll1: number;
    roll2: number;
    total: number;
  };
  spaceEntrySnapshot?: {
    space: string;
    visitType: 'First' | 'Subsequent';
    money: number;
    timeSpent: number;
    hand: string[];
    activeCards: ActiveCard[];
  };
  turnModifiers?: {
    skipTurns: number;
    canReRoll?: boolean;
  };
  activeEffects?: ActiveEffect[];
  loans?: import('./DataTypes').Loan[];
  score?: number;
  moneySources?: import('./DataTypes').MoneySources;
  expenditures?: import('./DataTypes').Expenditures;
  deviceType?: 'mobile' | 'desktop';
  costHistory?: import('./DataTypes').CostEntry[];
  costs?: import('./DataTypes').CostBreakdown;
  moveIntent?: string | null;
}

export type PlayerCards = {
  W: string[];
  B: string[];
  E: string[];
  L: string[];
  I: string[];
};

export type { Player, ActiveCard, ActiveEffect } from './DataTypes';

// Dice result feedback types
export interface DiceResultEffect {
  type: 'money' | 'time' | 'cards' | 'movement' | 'choice';
  description: string;
  value?: number;
  cardType?: string;
  cardCount?: number;
  cardAction?: 'draw' | 'remove' | 'replace';  // For cards: what action was performed
  cardIds?: string[];  // IDs of the actual cards that were drawn/removed
  moveOptions?: string[];
}

export interface TurnEffectResult {
  diceValue: number;
  spaceName: string;
  effects: DiceResultEffect[];
  summary: string;
  hasChoices: boolean;
  canReRoll?: boolean; // True if player can re-roll dice this turn
  // Project time tracking (optional - included when time effects are present)
  projectTime?: {
    actionDays: number;        // Days spent on this action
    totalDays: number;         // Total project time so far
    estimatedDays: number;     // Estimated total project length
    progressPercent: number;   // Progress percentage (0-100)
    uniqueWorkTypes: number;   // Number of unique work types
  };
}