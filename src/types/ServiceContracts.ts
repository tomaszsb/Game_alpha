// src/types/ServiceContracts.ts

/**
 * @file This file defines the contracts (interfaces) for all services in the application.
 * Adhering to these contracts is crucial for ensuring a decoupled and testable architecture.
 */

import {
  GameConfig,
  Movement,
  DiceOutcome,
  SpaceEffect,
  DiceEffect,
  SpaceContent,
  Space,
  VisitType,
  Card,
  ModalConfigOverrides,
  LogicQuestion
} from './DataTypes';

// Logging Service Types and Interface
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export interface LogPayload {
  playerId?: string;
  playerName?: string;
  action?: string;
  playerTurnNumber?: number;
  turn?: number;
  isCommitted?: boolean;
  visibility?: 'player' | 'debug' | 'system';
  [key: string]: unknown;
}

export interface ILoggingService {
  info(message: string, payload?: LogPayload): void;
  warn(message: string, payload?: LogPayload): void;
  error(message: string, error: Error, payload?: LogPayload): void;
  debug(message: string, payload?: LogPayload): void;
  log(level: LogLevel, message: string, payload?: LogPayload): void;
  startPerformanceTimer(key: string): void;
  endPerformanceTimer(key: string, message?: string): void;
  // Transactional logging session management
  startNewExplorationSession(): string;
  commitCurrentSession(): void;
  discardCurrentSession(): void;
  getCurrentSessionId(): string | null;
  cleanupAbandonedSessions(): void;
}

import { 
  GameState, 
  Player, 
  GamePhase, 
  PlayerUpdateData,
  StateUpdateResult,
  NegotiationState,
  NegotiationResult
} from './StateTypes';
import { Choice } from './CommonTypes';

import { Effect, EffectContext, EffectResult, BatchEffectResult } from './EffectTypes';

// Action types that can be performed during a player's turn
export type ActionType =
  | 'ROLL_TO_MOVE'
  | 'ROLL_FOR_MONEY'
  | 'ROLL_FOR_TIME'
  | 'ROLL_FOR_CARDS_W'
  | 'ROLL_FOR_CARDS_B'
  | 'ROLL_FOR_CARDS_E'
  | 'ROLL_FOR_CARDS_L'
  | 'ROLL_FOR_CARDS_I'
  | 'END_TURN';

import { CardType } from './DataTypes';

// Resource Management Interfaces
export interface ResourceChange {
  money?: number;
  timeSpent?: number;
  source: string;
  reason?: string;
  moneySourceType?: 'bank' | 'investment' | 'owner' | 'other';
  /**
   * When true, a spend may drive money below zero (a mandatory bill the player
   * can't decline). Bankruptcy is then detected downstream. Default false keeps
   * the insufficient-funds guard for discretionary spends.
   */
  allowNegative?: boolean;
}

export interface ResourceTransaction {
  id: string;
  playerId: string;
  timestamp: number;
  changes: ResourceChange;
  balanceBefore: { money: number; timeSpent: number };
  balanceAfter: { money: number; timeSpent: number };
  successful: boolean;
}

export interface ResourceValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Resource Service Interface
export interface IResourceService {
  // Money operations
  addMoney(playerId: string, amount: number, source: string, reason?: string, sourceType?: 'bank' | 'investment' | 'owner' | 'other'): boolean;
  spendMoney(playerId: string, amount: number, source: string, reason?: string, category?: keyof import('./DataTypes').Expenditures, allowNegative?: boolean): boolean;
  canAfford(playerId: string, amount: number): boolean;
  
  // Time operations  
  addTime(playerId: string, amount: number, source: string, reason?: string): void;
  spendTime(playerId: string, amount: number, source: string, reason?: string): void;
  
  // Combined operations
  updateResources(playerId: string, changes: ResourceChange): boolean;
  getResourceHistory(playerId: string): ResourceTransaction[];
  
  // Validation
  validateResourceChange(playerId: string, changes: ResourceChange): ResourceValidation;
  
  // Loan operations
  takeOutLoan(playerId: string, amount: number, interestRate: number): boolean;

  // Cost tracking
  recordCost(playerId: string, category: import('./DataTypes').ExpenseCategory, amount: number, description: string, source: string, allowNegative?: boolean): boolean;
}

// Phase 1 Services
export interface IDataService {
  // Configuration methods
  getGameConfig(): GameConfig[];
  getGameConfigBySpace(spaceName: string): GameConfig | undefined;
  isStartingSpace(spaceName: string): boolean;
  isResumeHub(spaceName: string): boolean;
  isPointOfNoReturn(spaceName: string): boolean;
  hasFinalReviewGate(spaceName: string): boolean;
  // 2026-07-16: CSV-portability lift (replaces hardcoded DOB_EXAM_SPACE/
  // FDNY_EXAM_SPACE/DOB_AUDIT_SPACE literals in ApprovalService).
  getSpaceForApprovalRole(role: 'dob_exam' | 'fdny_exam' | 'dob_audit'): string | null;
  getNpcSpeakerAssignments(): Array<{ spaceName: string; npcSpeaker: string }>;
  getCardTypeLabels(): import('./DataTypes').CardTypeLabel[];
  getMinWCardsToLeave(spaceName: string): number;
  getFeeCalculationMethod(spaceName: string): 'flat' | 'percentage_of_scope';
  getFeeLabel(spaceName: string): string;
  shouldAutoApplyFunding(spaceName: string): boolean;
  getAutoTriggerCardTypes(spaceName: string): string[];
  // 2026-05-18 audit: funding-source data flag (replaces hardcoded space arrays).
  getFundingSource(spaceName: string): 'owner' | 'bank' | 'investor' | '';
  isFundingSpace(spaceName: string): boolean;
  getPathChoiceMemoryKey(spaceName: string): string;
  isPathChoiceLockPoint(spaceName: string): boolean;
  getPathChoiceExclusions(spaceName: string, memory: Record<string, string> | undefined): string[];
  getDisplayLabelOverride(spaceName: string): string;
  getReviewLoopMessage(spaceName: string): string;
  // Workstream 3: Living Map (coordinate-driven board). Returns null if
  // the space isn't found; callers default to (0,0).
  getPosition(spaceName: string): { x: number; y: number } | null;
  getPhaseOrder(): string[];
  
  // Space methods
  getAllSpaces(): Space[];
  getSpaceByName(spaceName: string): Space | undefined;
  
  // Movement methods
  getMovement(spaceName: string, visitType: VisitType): Movement | undefined;
  getAllMovements(): Movement[];
  
  // Dice outcome methods
  getDiceOutcome(spaceName: string, visitType: VisitType): DiceOutcome | undefined;
  getAllDiceOutcomes(): DiceOutcome[];
  
  // Space effects methods
  getSpaceEffects(spaceName: string, visitType: VisitType): SpaceEffect[];
  getAllSpaceEffects(): SpaceEffect[];
  
  // Dice effects methods
  getDiceEffects(spaceName: string, visitType: VisitType): DiceEffect[];
  getAllDiceEffects(): DiceEffect[];
  
  // Content methods
  getSpaceContent(spaceName: string, visitType: VisitType): SpaceContent | undefined;
  getAllSpaceContent(): SpaceContent[];
  getEffectNarrative(spaceName: string, visitType: VisitType, effectAction: string): string | undefined;
  getModalConfig(
    spaceName: string,
    visitType: VisitType,
    effectAction: string,
    diceValue?: number
  ): ModalConfigOverrides | undefined;

  // Logic-question-chain methods (path=LOGIC spaces)
  getLogicQuestion(spaceName: string, visitType: VisitType, questionId: string): LogicQuestion | undefined;
  getLogicQuestionEntry(spaceName: string, visitType: VisitType): LogicQuestion | undefined;
  getLogicQuestionsForSpace(spaceName: string, visitType: VisitType): LogicQuestion[];
  getAllLogicQuestions(): LogicQuestion[];


  // Card methods
  getCards(): Card[];
  getCardById(cardId: string): Card | undefined;
  getCardsByType(cardType: CardType): Card[];
  getAllCardTypes(): CardType[];
  
  // Data loading
  isLoaded(): boolean;
  loadData(): Promise<void>;
  /**
   * Re-fetch GAME_CONFIG.csv only and re-parse — used by the standalone
   * Board Layout Editor after a drag-save to pick up the new pos_x/pos_y
   * without doing a full data reload. loadData() guards against re-runs
   * via the `loaded` flag, so callers that need fresh coords go through
   * this targeted refresh instead.
   */
  reloadGameConfig(): Promise<void>;

  /**
   * Re-fetch every CSV slice and re-build derived data. Used by editor save
   * flows (DataEditor's bulk save touches Spaces/DiceRoll/ModalConfig which
   * the server regenerates into all CLEAN_FILES). Without this, the cached
   * in-memory copy of SPACE_EFFECTS / DICE_EFFECTS / MOVEMENT etc. survives
   * the save and the next gameplay action sees stale data — same trap as the
   * v2.69.4 reloadGameConfig fix, just generalized.
   */
  reloadAllData(): Promise<void>;
}

export interface IStateService {
  // State access methods
  getGameState(): GameState;
  getGameStateDeepCopy(): GameState;
  isStateLoaded(): boolean;

  // Dependency injection methods (setter injection for circular dependencies)
  setGameRulesService(gameRulesService: IGameRulesService): void;

  // Subscription methods
  subscribe(callback: (state: GameState) => void): () => void;

  // Selective subscription - only triggers callback when selected value changes
  subscribeWithSelector<T>(
    selector: (state: GameState) => T,
    callback: (selected: T, state: GameState) => void,
    equalityFn?: (a: T, b: T) => boolean
  ): () => void;

  // Auto-action event methods for modal notifications
  subscribeToAutoActions(callback: (event: import('../services/StateService').AutoActionEvent) => void): () => void;
  emitAutoAction(event: import('../services/StateService').AutoActionEvent): void;

  // Player management methods
  addPlayer(name: string): GameState;
  updatePlayer(playerData: PlayerUpdateData): GameState;
  removePlayer(playerId: string): GameState;
  getPlayer(playerId: string): Player | undefined;
  getAllPlayers(): Player[];
  
  // Game flow methods
  setCurrentPlayer(playerId: string): GameState;
  setGamePhase(phase: GamePhase): GameState;
  advanceTurn(): GameState;
  nextPlayer(): GameState;
  
  // Game lifecycle methods
  initializeGame(): GameState;
  startGame(settings?: import('./StateTypes').GameModeSettings): GameState;
  endGame(winnerId?: string, endReason?: import('./StateTypes').GameEndReason): GameState;
  resetGame(): GameState;
  
  // Negotiation management methods
  updateNegotiationState(negotiationState: NegotiationState | null): GameState;

  // Choice management methods
  setAwaitingChoice(choice: Choice): GameState;
  clearAwaitingChoice(): GameState;
  // Cross-runtime choice-resolution relay (fb:068a66f2). Writes the selection
  // onto the active choice so the device that owns the pending promise can
  // resolve it. No-op if the active choice id doesn't match.
  setChoiceResolution(choiceId: string, selection: string): GameState;
  setMoving(isMoving: boolean): GameState;
  selectDestination(destination: string | null): GameState;

  // Turn state management methods
  setPlayerHasMoved(): GameState;
  clearPlayerHasMoved(): GameState;
  setPlayerCompletedManualAction(effectType: string, message: string): GameState;
  setPlayerHasRolledDice(): GameState;
  clearTurnActions(): GameState;
  clearPlayerHasRolledDice(): GameState;
  updateActionCounts(): void;
  setPlayerMoveIntent(playerId: string, destination: string | null): GameState;
  clearPlayerMoveIntent(playerId: string): GameState;

  // Modal management methods
  showCardModal(cardId: string): GameState;
  dismissModal(): GameState;
  
  // Snapshot management methods
  createPlayerSnapshot(playerId: string): GameState;
  restorePlayerSnapshot(playerId: string): GameState;
  
  // Validation methods
  validatePlayerAction(playerId: string, action: string): boolean;
  canStartGame(): boolean;

  // Initialization methods
  isInitialized(): boolean;
  markAsInitialized(): GameState;
  
  // Action logging methods
  logToActionHistory(actionData: Omit<import('./StateTypes').ActionLogEntry, 'id' | 'timestamp'>): GameState;

  // Dice roll completion methods
  setDiceRollCompletion(message: string): GameState;
  
  // Note: Old snapshot methods removed - replaced by REAL/TEMP state model
  // See createTempStateFromReal(), commitTempToReal(), discardTempState()

  // State management methods
  setGameState(newState: GameState): GameState;
  updateGameState(stateChanges: Partial<GameState>): GameState;

  // Server synchronization methods
  loadStateFromServer(): Promise<boolean>;
  replaceState(newState: GameState, serverVersion?: number): void;

  // WebSocket synchronization methods
  connectWebSocket(playerId?: string): void;
  disconnectWebSocket(): void;
  isWebSocketConnected(): boolean;

  // REAL/TEMP State Model Methods (December 26, 2025)
  // Manages separation of committed state (REAL) from working state (TEMP)
  createTempStateFromReal(options: import('./StateTypes').CreateTempOptions): import('./StateTypes').StateTransitionResult;
  commitTempToReal(playerId: string): import('./StateTypes').StateTransitionResult;
  discardTempState(playerId: string): import('./StateTypes').StateTransitionResult;
  applyToRealState(playerId: string, changes: Partial<import('./StateTypes').MutablePlayerState>): import('./StateTypes').StateTransitionResult;
  getEffectivePlayerState(playerId: string): import('./StateTypes').MutablePlayerState | null;
  hasActiveTempState(playerId: string): boolean;
  getTryAgainCount(playerId: string): number;
  updateTempState(playerId: string, changes: Partial<import('./StateTypes').MutablePlayerState>): import('./StateTypes').StateTransitionResult;

  // Cost ledger (Workstream 2 — Beta Try Again semantics)
  recordTurnOutflow(playerId: string, entry: { moneySpent?: number; cardConsumed?: string; lifeEventDrawn?: string }): void;
  getTurnOutflow(playerId: string): import('./StateTypes').TurnCostLedger;
  getRealPlayerState(playerId: string): import('./StateTypes').MutablePlayerState | null;
}

import { DiceResultEffect } from './StateTypes';

/**
 * IDiceService - Interface for dice-related operations
 * Handles dice rolling and dice effect resolution
 */
export interface IDiceService {
  rollDice(): number;
  getDiceRollEffect(effect: DiceEffect, diceRoll: number): string | undefined;
  getDiceRollEffectValue(diceEffect: DiceEffect, diceRoll: number): string;
  parseNumericValue(effect: string): number;
  generateEffectSummary(effects: DiceResultEffect[], diceValue: number, storyText?: string, spaceName?: string): string;
}

/**
 * ISpaceEffectService - Interface for space and dice effect application
 * Handles applying effects from dice rolls and space visits
 */
export interface ISpaceEffectService {
  applySpaceMoneyEffect(playerId: string, effect: SpaceEffect): GameState;
  applySpaceTimeEffect(playerId: string, effect: SpaceEffect): GameState;
  getTargetPlayer(currentPlayerId: string, condition: string): import('./StateTypes').Player | null;
}

export interface ITurnService {
  // Turn management methods
  rollDice(): number;
  
  // Separate dice and movement methods
  rollDiceAndProcessEffects(playerId: string): Promise<{ diceRoll: number }>;
  endTurnWithMovement(force?: boolean, skipAutoMove?: boolean): Promise<{ nextPlayerId: string }>;
  
  // Turn validation methods
  canPlayerTakeTurn(playerId: string): boolean;
  getCurrentPlayerTurn(): string | null;
  canEndTurn(playerId: string): boolean;

  // Available actions for UI
  getAvailableActions(playerId: string): ActionType[];

  // Turn effects processing
  processTurnEffects(playerId: string, diceRoll: number): Promise<GameState>;
  
  // Turn control methods
  setTurnModifier(playerId: string, action: 'SKIP_TURN'): boolean;

  // Starting space effects processing
  placePlayersOnStartingSpaces(): Promise<void>;

  // Turn initialization for game startup
  startTurn(playerId: string): Promise<void>;
  
  // Feedback methods for UI components
  rollDiceWithFeedback(playerId: string): Promise<import('./StateTypes').TurnEffectResult>;
  rerollDice(playerId: string): Promise<import('./StateTypes').TurnEffectResult>;
  triggerManualEffectWithFeedback(playerId: string, effectType: string): Promise<import('./StateTypes').TurnEffectResult>;
  performNegotiation(playerId: string): Promise<{ success: boolean; message: string }>;
  tryAgainOnSpace(playerId: string): Promise<{ success: boolean; message: string; shouldAdvanceTurn?: boolean }>;
  handleAutomaticFunding(playerId: string): Promise<import('./StateTypes').TurnEffectResult>;

  // Condition filtering for UI components (with optional dice roll for dice-dependent conditions)
  filterSpaceEffectsByCondition(spaceEffects: SpaceEffect[], player: Player, diceRoll?: number): SpaceEffect[];
}

export interface ICardService {
  // Card validation methods
  canPlayCard(playerId: string, cardId: string): boolean;
  isValidCardType(cardType: string): boolean;
  playerOwnsCard(playerId: string, cardId: string): boolean;
  
  // Card management methods with source tracking
  playCard(playerId: string, cardId: string): Promise<GameState>;
  drawCards(playerId: string, cardType: CardType, count: number, source?: string, reason?: string): string[];
  drawAndApplyCard(playerId: string, cardType: CardType, source: string, reason: string): { drawnCardId: string | null; success: boolean };
  discardCards(playerId: string, cardIds: string[], source?: string, reason?: string): boolean;
  removeCard(playerId: string, cardId: string): GameState;
  replaceCard(playerId: string, oldCardId: string, newCardType: CardType): GameState;
  
  // Turn-based card lifecycle methods
  endOfTurn(): void;
  activateCard(playerId: string, cardId: string, duration: number): void;
  finalizePlayedCard(playerId: string, cardId: string): void;
  discardPlayedCard(playerId: string, cardId: string): void;
  
  // Card transfer methods with source tracking
  transferCard(sourcePlayerId: string, targetPlayerId: string, cardId: string, source?: string, reason?: string): GameState;
  
  // Card information methods
  getCardType(cardId: string): CardType | null;
  getPlayerCards(playerId: string, cardType?: CardType): string[];
  getPlayerCardCount(playerId: string, cardType?: CardType): number;
  getCardToDiscard(playerId: string, cardType: CardType): string | null;
  
  // Card effect methods
  applyCardEffects(playerId: string, cardId: string, options?: { onlyResourceEffects?: boolean; diceRoll?: number }): Promise<GameState>;
  buildCompetingWorktypeReveal(playerId: string): Array<{ kind: 'competing_reveal'; label: string }>;
  buildLeaderReveal(drawingPlayerId: string, days: number): Array<{ kind: 'leader_reveal'; label: string }>;
  effectEngineService: IEffectEngineService;
  
  // Circular dependency resolution methods
  setEffectEngineService(effectEngineService: IEffectEngineService): void;
}

/**
 * Result of a card effect operation
 */
export interface CardEffectResult {
  success: boolean;
  cardsAffected: string[];
  message?: string;
}

/**
 * Card Effect Service - Handles card-related space effects
 * Extracted from TurnService to consolidate card operations
 */
export interface ICardEffectService {
  executeCardEffect(
    playerId: string,
    effect: SpaceEffect,
    effectType: string
  ): Promise<CardEffectResult>;

  isCardAction(action: string): boolean;
}

/**
 * Financial Effect Handler - Handles RESOURCE_CHANGE and FEE_DEDUCTION effects
 * Extracted from EffectEngineService to consolidate financial operations
 */
export interface IFinancialEffectHandler {
  handleResourceChange(effect: Effect, context: EffectContext): EffectResult;
  handleFeeDeduction(effect: Effect, context: EffectContext): EffectResult;
  /** Ends the game (no winner) if the player's cash is below zero. */
  checkBankruptcy(playerId: string): void;
}

/**
 * Card Effect Handler - Handles card-related effects
 * Extracted from EffectEngineService to consolidate card operations
 */
export interface ICardEffectHandler {
  handleCardDraw(effect: Effect, context: EffectContext): Promise<EffectResult>;
  handleCardDiscard(effect: Effect, context: EffectContext): Promise<EffectResult>;
  handleCardActivation(effect: Effect, context: EffectContext): EffectResult;
  handlePlayCard(effect: Effect, context: EffectContext): Promise<EffectResult>;
}

export interface IPlayerActionService {
  // Methods for handling player commands and orchestrating actions.
  // Phase 2.1 audit (2026-06-04): `rollDice` and `endTurn` removed — they were
  // a legacy monolithic dice-and-move pattern superseded by the split:
  // DiceRollProcessor.rollDiceWithFeedback (roll + effects + UI feedback) and
  // MovementExecutor.executeMovement (deferred end-turn move). The live UI in
  // GameLayout/ActionCenterPanel calls turnService.rollDiceWithFeedback and
  // turnService.endTurnWithMovement directly.
  playCard(playerId: string, cardId: string): Promise<void>;
}


/**
 * Options for narrowing the canonical valid-moves resolver to a specific
 * scenario. Phase 2.1 audit (2026-06-04) — when the caller already knows the
 * dice value (END-TURN dice movement), passing it narrows the base set to that
 * single roll's destination BEFORE the override stack (lock-point, resume-hub,
 * Stage-1 gate) is applied. This collapses the two-resolver split that caused
 * the v3.0.61 → v3.0.62 crash family.
 */
export interface GetValidMovesOptions {
  /** When provided on a dice/dice_outcome space, narrows the base to this roll's destination only. Ignored on non-dice movement types. */
  diceRoll?: number;
}

export interface IMovementService {
  // Movement validation methods
  getValidMoves(playerId: string, options?: GetValidMovesOptions): string[];

  // Movement execution methods
  movePlayer(playerId: string, destinationSpace: string): Promise<GameState>;
  endMove(playerId: string): Promise<GameState>;

  // Dice-based movement methods
  getDiceDestination(spaceName: string, visitType: VisitType, diceRoll: number): string | null;
  getDiceDestinationChoices(spaceName: string, visitType: VisitType, diceRoll: number, playerId?: string): string[];

  // Logic-based movement methods
  getLogicMovementWithExplanation(playerId: string, spaceName: string, visitType: VisitType): {
    destinations: string[];
    explanation: string;
    matchedConditions: string[];
  };

  // Choice-based movement methods
  handleMovementChoice(playerId: string): Promise<GameState>;
  handleMovementChoiceV2(playerId: string): Promise<GameState>;

  // Movement choice management (merged from MovementChoiceManager)
  isDiceBasedMovement(playerId: string): boolean;
  isLogicMovement(playerId: string): boolean;
  handleLogicMovement(playerId: string): import('../services/MovementService').MovementChoiceResult;
  createMovementChoice(playerId: string, options?: import('../services/MovementService').MovementChoiceOptions): Promise<import('../services/MovementService').MovementChoiceResult>;
  handleMovementChoices(playerId: string): Promise<import('../services/MovementService').MovementChoiceResult>;
  restoreMovementChoiceIfNeeded(playerId: string): Promise<import('../services/MovementService').MovementChoiceResult>;
  setNotificationService(service: INotificationService): void;
}

export interface IGameRulesService {
  // Movement validation methods
  isMoveValid(playerId: string, destination: string): boolean;
  
  // Card validation methods
  canPlayCard(playerId: string, cardId: string): boolean;
  canDrawCard(playerId: string, cardType: CardType): boolean;
  
  // Player resource validation methods
  canPlayerAfford(playerId: string, cost: number): boolean;
  
  // Turn validation methods
  isPlayerTurn(playerId: string): boolean;
  
  // Game state validation methods
  isGameInProgress(): boolean;
  
  // Win condition methods
  checkWinCondition(playerId: string): Promise<boolean>;
  
  canPlayerTakeAction(playerId: string): boolean;
  
  // Project scope calculation methods
  calculateProjectScope(playerId: string): number;

  // Work cost calculation methods (for construction phase)
  calculateTotalWorkCost(playerId: string): number;

  // Project length estimation methods
  calculateEstimatedProjectLength(playerId: string): {
    estimatedDays: number;
    basePathDays: number;
    workTypeDays: number;
    contingencyDays: number;
    uniqueWorkTypes: string[];
  };

  // Condition evaluation methods
  evaluateCondition(playerId: string, condition: string | undefined, diceRoll?: number): boolean;

  // Scoring and winner determination methods
  calculatePlayerScore(playerId: string): number;
  determineWinner(): string | null;
  
  // Enhanced win condition methods
  checkGameEndConditions(playerId: string): Promise<{
    shouldEnd: boolean;
    reason: 'win' | null;
    winnerId?: string;
  }>;
  canEndTurn(playerId: string): boolean;
}

export interface IChoiceService {
  // Choice creation and resolution methods
  createChoice(playerId: string, type: Choice['type'], prompt: string, options: Choice['options'], metadata?: Choice['metadata']): Promise<string>;
  resolveChoice(choiceId: string, selection: string): boolean;
  skipChoice(choiceId: string): boolean;
  // v3.0.41 — cancel every pending-choice promise without waiting on the
  // 5-minute timeout. Called from end-of-turn/game-end/reset paths so
  // un-answered choices don't leak a stale callback that fires post-turn.
  cancelAllPendingChoices(reason?: string): void;

  // Choice query methods
  getActiveChoice(): Choice | null;
  hasActiveChoice(): boolean;
}

export interface IEffectEngineService {
  // Core processing methods
  processEffects(effects: Effect[], context: EffectContext): Promise<BatchEffectResult>;
  processEffect(effect: Effect, context: EffectContext): Promise<EffectResult>;
  processActiveEffectsForCurrentPlayer(currentPlayerId: string): Promise<void>;

  // Card-specific processing with targeting support
  processCardEffects(effects: Effect[], context: EffectContext, cardData?: Card): Promise<BatchEffectResult>;

  // Validation methods
  validateEffect(effect: Effect, context: EffectContext): boolean;
  validateEffects(effects: Effect[], context: EffectContext): boolean;

  /**
   * Passthrough to the shared FinancialEffectHandler.checkBankruptcy rule, so
   * callers that only hold an IEffectEngineService reference (e.g. TurnService)
   * can trigger the same mandatory-bill bankruptcy check without a direct
   * dependency on FinancialEffectHandler. No-ops if no handler is wired.
   */
  checkBankruptcy(playerId: string): void;
}

export interface ITargetingService {
  resolveTargets(sourcePlayerId: string, targetRule: string): Promise<string[]>;
  isInteractiveTargeting(targetRule: string): boolean;
  getTargetDescription(targetIds: string[]): string;
}

export interface INegotiationService {
  // Core negotiation methods
  initiateNegotiation(playerId: string, context: Record<string, unknown>): Promise<NegotiationResult>;
  makeOffer(playerId: string, offer: { cards?: string[] }): Promise<NegotiationResult>;
  acceptOffer(playerId: string): Promise<NegotiationResult>;
  declineOffer(playerId: string): Promise<NegotiationResult>;

  // Negotiation state methods
  getActiveNegotiation(): NegotiationState | null;
  hasActiveNegotiation(): boolean;
}

export interface INotificationService {
  notify(content: import('../services/NotificationService').NotificationContent, options: import('../services/NotificationService').NotificationOptions): void;
  clearPlayerNotifications(playerId?: string): void;
  clearAllNotifications(): void;
  setUpdateCallbacks(
    onButtonUpdate: (feedback: { [actionType: string]: string }) => void,
    onNotificationUpdate: (notifications: { [playerId: string]: string }) => void
  ): void;
  getButtonFeedback(): { [actionType: string]: string };
  getPlayerNotifications(): { [playerId: string]: string };
}

/**
 * Represents the complete container of all game services.
 * This will be provided via context to the rest of the application.
 */
export interface IServiceContainer {
  dataService: IDataService;
  stateService: IStateService;
  loggingService: ILoggingService;
  notificationService: INotificationService;
  turnService: ITurnService;
  cardService: ICardService;
  playerActionService: IPlayerActionService;
  movementService: IMovementService;
  gameRulesService: IGameRulesService;
  resourceService: IResourceService;
  choiceService: IChoiceService;
  effectEngineService: IEffectEngineService;
  negotiationService: INegotiationService;
  // Optional in Phase 7.1: only MovementService + DiceRollProcessor currently
  // read it. Component tests that don't exercise approval flow can omit it.
  // ServiceProvider always populates it in production.
  approvalService?: import('../services/ApprovalService').IApprovalService;
}

// Re-export approval service interface for convenience.
export type { IApprovalService } from '../services/ApprovalService';
