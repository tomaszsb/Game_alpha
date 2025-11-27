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
  Card
} from './DataTypes';

// Logging Service Types and Interface
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export interface LogPayload {
  [key: string]: any;
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

import { CardType } from './DataTypes';

// Resource Management Interfaces
export interface ResourceChange {
  money?: number;
  timeSpent?: number;
  source: string;
  reason?: string;
  moneySourceType?: 'bank' | 'investment' | 'owner' | 'other';
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
  spendMoney(playerId: string, amount: number, source: string, reason?: string): boolean;
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
  applyInterest(playerId: string): void;
}

// Phase 1 Services
export interface IDataService {
  // Configuration methods
  getGameConfig(): GameConfig[];
  getGameConfigBySpace(spaceName: string): GameConfig | undefined;
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
  
  // Card methods
  getCards(): Card[];
  getCardById(cardId: string): Card | undefined;
  getCardsByType(cardType: CardType): Card[];
  getAllCardTypes(): CardType[];
  
  // Data loading
  isLoaded(): boolean;
  loadData(): Promise<void>;
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
  startGame(): GameState;
  endGame(winnerId?: string): GameState;
  resetGame(): GameState;
  
  // Negotiation management methods
  updateNegotiationState(negotiationState: any): GameState;

  // Utility methods
  fixPlayerStartingSpaces(): GameState;
  forceResetAllPlayersToCorrectStartingSpace(): GameState;
  
  // Choice management methods
  setAwaitingChoice(choice: Choice): GameState;
  clearAwaitingChoice(): GameState;
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
  
  // Pre-space effect snapshot methods (Try Again feature)
  savePreSpaceEffectSnapshot(playerId: string, spaceName: string): GameState;
  clearPreSpaceEffectSnapshot(): GameState;
  clearPlayerSnapshot(playerId: string): GameState;
  hasPreSpaceEffectSnapshot(playerId: string, spaceName: string): boolean;
  getPreSpaceEffectSnapshot(): GameState | null;
  getPlayerSnapshot(playerId: string): GameState | null;
  revertPlayerToSnapshot(playerId: string, timePenalty?: number): GameState;
  
  // State management methods
  setGameState(newState: GameState): GameState;
  updateGameState(stateChanges: Partial<GameState>): GameState;

  // Server synchronization methods
  loadStateFromServer(): Promise<boolean>;
  replaceState(newState: GameState): void;
}

export interface TurnResult {
  newState: GameState;
  diceRoll: number;
}

export interface ITurnService {
  // Turn management methods
  takeTurn(playerId: string): Promise<TurnResult>;
  endTurn(): Promise<{ nextPlayerId: string }>;
  rollDice(): number;
  
  // Separate dice and movement methods
  rollDiceAndProcessEffects(playerId: string): Promise<{ diceRoll: number }>;
  endTurnWithMovement(force?: boolean, skipAutoMove?: boolean): Promise<{ nextPlayerId: string }>;
  
  // Turn validation methods  
  canPlayerTakeTurn(playerId: string): boolean;
  getCurrentPlayerTurn(): string | null;
  
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

  // Condition filtering for UI components
  filterSpaceEffectsByCondition(spaceEffects: any[], player: any): any[];
}

export interface ICardService {
  // Card validation methods
  canPlayCard(playerId: string, cardId: string): boolean;
  isValidCardType(cardType: string): boolean;
  playerOwnsCard(playerId: string, cardId: string): boolean;
  
  // Card management methods with source tracking
  playCard(playerId: string, cardId: string): GameState;
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
  applyCardEffects(playerId: string, cardId: string): GameState;
  effectEngineService: IEffectEngineService;
  
  // Circular dependency resolution methods
  setEffectEngineService(effectEngineService: IEffectEngineService): void;
}

export interface IPlayerActionService {
  // Methods for handling player commands and orchestrating actions
  playCard(playerId: string, cardId: string): Promise<void>;
  rollDice(playerId: string): Promise<{ roll1: number; roll2: number; total: number }>;
  endTurn(): Promise<void>;
}


export interface IMovementService {
  // Movement validation methods
  getValidMoves(playerId: string): string[];
  
  // Movement execution methods
  movePlayer(playerId: string, destinationSpace: string): Promise<GameState>;
  endMove(playerId: string): Promise<GameState>;
  
  // Dice-based movement methods
  getDiceDestination(spaceName: string, visitType: VisitType, diceRoll: number): string | null;
  
  // Choice-based movement methods
  handleMovementChoice(playerId: string): Promise<GameState>;
  handleMovementChoiceV2(playerId: string): Promise<GameState>;
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

  // Condition evaluation methods
  evaluateCondition(playerId: string, condition: string | undefined, diceRoll?: number): boolean;

  // Scoring and winner determination methods
  calculatePlayerScore(playerId: string): number;
  determineWinner(): string | null;
  
  // Enhanced win condition methods
  checkTurnLimit(turnLimit?: number): boolean;
  checkGameEndConditions(playerId: string, turnLimit?: number): Promise<{
    shouldEnd: boolean;
    reason: 'win' | 'turn_limit' | null;
    winnerId?: string;
  }>;
}

export interface IChoiceService {
  // Choice creation and resolution methods
  createChoice(playerId: string, type: Choice['type'], prompt: string, options: Choice['options'], metadata?: Choice['metadata']): Promise<string>;
  resolveChoice(choiceId: string, selection: string): boolean;

  // Choice query methods
  getActiveChoice(): Choice | null;
  hasActiveChoice(): boolean;
}

export interface IEffectEngineService {
  // Core processing methods
  processEffects(effects: Effect[], context: EffectContext): Promise<BatchEffectResult>;
  processEffect(effect: Effect, context: EffectContext): Promise<EffectResult>;
  processActiveEffectsForAllPlayers(): Promise<void>;

  // Card-specific processing with targeting support
  processCardEffects(effects: Effect[], context: EffectContext, cardData?: any): Promise<BatchEffectResult>;

  // Validation methods
  validateEffect(effect: Effect, context: EffectContext): boolean;
  validateEffects(effects: Effect[], context: EffectContext): boolean;
}

export interface ITargetingService {
  resolveTargets(sourcePlayerId: string, targetRule: string): Promise<string[]>;
  isInteractiveTargeting(targetRule: string): boolean;
  getTargetDescription(targetIds: string[]): string;
}

export interface INegotiationService {
  // Core negotiation methods
  initiateNegotiation(playerId: string, context: any): Promise<NegotiationResult>;
  makeOffer(playerId: string, offer: any): Promise<NegotiationResult>;
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
}
