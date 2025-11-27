import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
// tests/mocks/mockServices.ts

/**
 * Centralized Mock Service Utility
 * 
 * This file provides mock creator functions for all core services used in tests.
 * Each function returns a fully mocked service object where every method is an instance of vi.fn().
 * 
 * Usage:
 * import { createMockDataService, createMockStateService } from '../mocks/mockServices';
 * const mockDataService = createMockDataService();
 * const mockStateService = createMockStateService();
 */

import {
  IDataService,
  IStateService,
  IGameRulesService,
  ICardService,
  IResourceService,
  IMovementService,
  INegotiationService,
  IEffectEngineService,
  IChoiceService,
  ITurnService,
  IPlayerActionService
} from '../../src/types/ServiceContracts';

import { ILoggingService } from '../../src/services/LoggingService';
import { INotificationService } from '../../src/services/NotificationService';

export const createMockDataService = (): any => ({
  // Configuration methods
  getGameConfig: vi.fn(),
  getGameConfigBySpace: vi.fn(),
  getPhaseOrder: vi.fn(),
  
  // Space methods
  getAllSpaces: vi.fn(),
  getSpaceByName: vi.fn(),
  
  // Movement methods
  getMovement: vi.fn(),
  getAllMovements: vi.fn(),
  
  // Dice outcome methods
  getDiceOutcome: vi.fn(),
  getAllDiceOutcomes: vi.fn(),
  
  // Space effects methods
  getSpaceEffects: vi.fn(),
  getAllSpaceEffects: vi.fn(),
  
  // Dice effects methods
  getDiceEffects: vi.fn(),
  getAllDiceEffects: vi.fn(),
  
  // Content methods
  getSpaceContent: vi.fn(),
  getAllSpaceContent: vi.fn(),
  
  // Card methods
  getCards: vi.fn(),
  getCardById: vi.fn(),
  getCardsByType: vi.fn(),
  getAllCardTypes: vi.fn(),
  
  // Data loading
  isLoaded: vi.fn(),
  loadData: vi.fn()
});

export const createMockStateService = (): any => ({
  // State access methods
  getGameState: vi.fn(),
  getGameStateDeepCopy: vi.fn(),
  isStateLoaded: vi.fn(),
  
  // Subscription methods
  subscribe: vi.fn(),
  
  // Player management methods
  addPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  removePlayer: vi.fn(),
  getPlayer: vi.fn(),
  getAllPlayers: vi.fn(),
  
  // Game flow methods
  setCurrentPlayer: vi.fn(),
  setGamePhase: vi.fn(),
  advanceTurn: vi.fn(),
  nextPlayer: vi.fn(),
  
  // Game lifecycle methods
  initializeGame: vi.fn(),
  startGame: vi.fn(),
  endGame: vi.fn(),
  resetGame: vi.fn(),
  
  // Negotiation management methods
  updateNegotiationState: vi.fn(),
  
  // Utility methods
  fixPlayerStartingSpaces: vi.fn(),
  forceResetAllPlayersToCorrectStartingSpace: vi.fn(),
  
  // Choice management methods
  setAwaitingChoice: vi.fn(),
  clearAwaitingChoice: vi.fn(),
  
  // Turn state management methods
  setPlayerHasMoved: vi.fn(),
  clearPlayerHasMoved: vi.fn(),
  setPlayerCompletedManualAction: vi.fn(),
  setPlayerHasRolledDice: vi.fn(),
  clearPlayerCompletedManualActions: vi.fn(),
  clearPlayerHasRolledDice: vi.fn(),
  updateActionCounts: vi.fn(),
  clearTurnActions: vi.fn(),
  
  // Modal management methods
  showCardModal: vi.fn(),
  dismissModal: vi.fn(),
  
  // Snapshot management methods
  createPlayerSnapshot: vi.fn(),
  restorePlayerSnapshot: vi.fn(),
  
  // Validation methods
  validatePlayerAction: vi.fn(),
  canStartGame: vi.fn(),
  
  // Action logging methods
  logToActionHistory: vi.fn(),
  
  // Pre-space effect snapshot methods (Try Again feature)
  savePreSpaceEffectSnapshot: vi.fn(),
  clearPreSpaceEffectSnapshot: vi.fn(),
  clearPlayerSnapshot: vi.fn(),
  hasPreSpaceEffectSnapshot: vi.fn(),
  getPreSpaceEffectSnapshot: vi.fn(),
  getPlayerSnapshot: vi.fn(),
  
  // State management methods
  setGameState: vi.fn(),
  updateGameState: vi.fn(),

  // Dice roll feedback methods
  setDiceRollCompletion: vi.fn(),

  // Initialization methods
  isInitialized: vi.fn().mockReturnValue(true),
  markAsInitialized: vi.fn(),

  // Movement destination selection
  selectDestination: vi.fn()
});

export const createMockGameRulesService = (): any => ({
  // Movement validation methods
  isMoveValid: vi.fn(),
  
  // Card validation methods
  canPlayCard: vi.fn(),
  canDrawCard: vi.fn(),
  
  // Player resource validation methods
  canPlayerAfford: vi.fn(),
  
  // Turn validation methods
  isPlayerTurn: vi.fn(),
  
  // Game state validation methods
  isGameInProgress: vi.fn(),
  
  // Win condition methods
  checkWinCondition: vi.fn(),
  
  canPlayerTakeAction: vi.fn(),
  
  // Project scope calculation methods
  calculateProjectScope: vi.fn(),

  // Condition evaluation methods
  evaluateCondition: vi.fn().mockReturnValue(true),

  // Scoring methods
  calculatePlayerScore: vi.fn(),
  determineWinner: vi.fn(),
  checkTurnLimit: vi.fn(),
  checkGameEndConditions: vi.fn()
});

export const createMockCardService = (): any => ({
  // Card validation methods
  canPlayCard: vi.fn(),
  isValidCardType: vi.fn(),
  playerOwnsCard: vi.fn(),
  
  // Card management methods with source tracking
  playCard: vi.fn(),
  drawCards: vi.fn(),
  drawAndApplyCard: vi.fn(),
  discardCards: vi.fn(),
  removeCard: vi.fn(),
  replaceCard: vi.fn(),
  
  // Turn-based card lifecycle methods
  endOfTurn: vi.fn(),
  activateCard: vi.fn(),
  finalizePlayedCard: vi.fn(),
  discardPlayedCard: vi.fn(),
  
  // Card transfer methods with source tracking
  transferCard: vi.fn(),
  
  // Card information methods
  getCardType: vi.fn(),
  getPlayerCards: vi.fn(),
  getPlayerCardCount: vi.fn(),
  getCardToDiscard: vi.fn(),
  
  // Card effect methods
  applyCardEffects: vi.fn(),
  effectEngineService: {} as IEffectEngineService, // Will be mocked separately if needed
  
  // Circular dependency resolution methods
  setEffectEngineService: vi.fn()
});

export const createMockResourceService = (): any => ({
  // Money operations
  addMoney: vi.fn(),
  spendMoney: vi.fn(),
  canAfford: vi.fn(),
  
  // Time operations  
  addTime: vi.fn(),
  spendTime: vi.fn(),
  
  // Combined operations
  updateResources: vi.fn(),
  getResourceHistory: vi.fn(),
  
  // Validation
  validateResourceChange: vi.fn(),
  
  // Loan operations
  takeOutLoan: vi.fn(),
  applyInterest: vi.fn()
});

export const createMockMovementService = (): any => ({
  // Movement validation methods
  getValidMoves: vi.fn(),
  
  // Movement execution methods
  movePlayer: vi.fn(),
  
  // Dice-based movement methods
  getDiceDestination: vi.fn(),
  
  // Choice-based movement methods
  handleMovementChoice: vi.fn()
});

export const createMockNegotiationService = (): any => ({
  // Core negotiation methods
  initiateNegotiation: vi.fn(),
  makeOffer: vi.fn(),
  acceptOffer: vi.fn(),
  declineOffer: vi.fn(),
  
  // Negotiation state methods
  getActiveNegotiation: vi.fn(),
  hasActiveNegotiation: vi.fn()
});

export const createMockEffectEngineService = (): any => ({
  // Core processing methods
  processEffects: vi.fn(),
  processEffect: vi.fn(),
  processCardEffects: vi.fn(),
  processActiveEffectsForAllPlayers: vi.fn(),
  
  // Validation methods
  validateEffect: vi.fn(),
  validateEffects: vi.fn()
});

export const createMockChoiceService = (): any => ({
  // Choice creation and resolution methods
  createChoice: vi.fn(),
  resolveChoice: vi.fn(),
  
  // Choice query methods
  getActiveChoice: vi.fn(),
  hasActiveChoice: vi.fn()
});

export const createMockTurnService = (): any => ({
  // Turn management methods
  takeTurn: vi.fn(),
  endTurn: vi.fn(),
  rollDice: vi.fn(),

  // Separate dice and movement methods
  rollDiceAndProcessEffects: vi.fn(),
  endTurnWithMovement: vi.fn(),

  // Turn validation methods
  canPlayerTakeTurn: vi.fn(),
  getCurrentPlayerTurn: vi.fn(),

  // Turn effects processing
  processTurnEffects: vi.fn(),
  filterSpaceEffectsByCondition: vi.fn(),

  // Turn control methods
  setTurnModifier: vi.fn(),

  // Feedback methods for UI components
  rollDiceWithFeedback: vi.fn(),
  rerollDice: vi.fn(),
  triggerManualEffectWithFeedback: vi.fn(),
  performNegotiation: vi.fn(),
  tryAgainOnSpace: vi.fn(),
  handleAutomaticFunding: vi.fn()
});

// Convenience function to create all mocks at once
export const createMockPlayerActionService = (): any => ({
  // Methods for handling player commands and orchestrating actions
  playCard: vi.fn(),
  rollDice: vi.fn(),
  endTurn: vi.fn()
});

export const createMockLoggingService = (): any => ({
  // Logging methods
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
  // Performance timing methods
  startPerformanceTimer: vi.fn(),
  endPerformanceTimer: vi.fn(),
  // Exploration session methods
  startNewExplorationSession: vi.fn().mockReturnValue('session_123'),
  getCurrentSessionId: vi.fn().mockReturnValue('session_123')
});

export const createMockNotificationService = (): any => ({
  // Notification methods
  notify: vi.fn(),
  clearPlayerNotifications: vi.fn(),
  clearAllNotifications: vi.fn(),
  setButtonFeedbackCallback: vi.fn(),
  setNotificationCallback: vi.fn()
});

export const createAllMockServices = () => ({
  dataService: createMockDataService(),
  stateService: createMockStateService(),
  loggingService: createMockLoggingService(),
  gameRulesService: createMockGameRulesService(),
  cardService: createMockCardService(),
  resourceService: createMockResourceService(),
  movementService: createMockMovementService(),
  negotiationService: createMockNegotiationService(),
  effectEngineService: createMockEffectEngineService(),
  choiceService: createMockChoiceService(),
  turnService: createMockTurnService(),
  playerActionService: createMockPlayerActionService(),
  notificationService: createMockNotificationService()
});