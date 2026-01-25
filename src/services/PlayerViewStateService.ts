// src/services/PlayerViewStateService.ts
//
// Service for deriving what the mobile UI should show based on game state.
// Implements a state machine pattern for context-aware mobile views.
// Created: January 24, 2026

import { IStateService, IGameRulesService, IDataService } from '../types/ServiceContracts';
import { GameState, Player } from '../types/StateTypes';
import { Choice } from '../types/CommonTypes';
import { SpaceEffect } from '../types/DataTypes';

/**
 * The five possible view states for the mobile player panel.
 * Each state determines what content and actions are shown.
 */
export type PlayerViewState =
  | 'STORY_MODE'      // Just landed, showing narrative
  | 'ACTION_MODE'     // Has pending manual action (dice roll, card draw, etc.)
  | 'DECISION_MODE'   // Must choose between options (movement, card selection)
  | 'WAITING_MODE'    // Waiting for other players or processing
  | 'SUMMARY_MODE';   // Turn complete, can end turn

/**
 * Describes a pending action that the player must complete.
 */
export interface ActionPrompt {
  type: 'dice_roll' | 'card_draw' | 'manual_effect' | 'funding';
  label: string;
  description: string;
  effectType?: string;  // For manual effects: 'money', 'time', 'cards'
  cardType?: string;    // For card draws: 'W', 'B', 'E', 'L', 'I'
}

/**
 * Describes a choice the player must make.
 */
export interface DecisionChoice {
  id: string;
  label: string;
  description?: string;
  isSelected?: boolean;
}

/**
 * Summary of what happened during the turn (for SUMMARY_MODE).
 */
export interface TurnSummary {
  spaceVisited: string;
  moneyChange: number;
  timeChange: number;
  cardsDrawn: string[];
  cardsDiscarded: string[];
  effectsApplied: string[];
}

/**
 * The complete context for the current view state.
 * Contains all information needed to render the mobile UI.
 */
export interface ViewStateContext {
  state: PlayerViewState;

  // Player info (always present)
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  playerColor?: string;

  // Current location
  spaceName: string;
  spaceTitle?: string;
  visitType: 'First' | 'Subsequent';

  // Mode-specific content
  storyContent?: string;        // For STORY_MODE
  actionPrompt?: ActionPrompt;  // For ACTION_MODE
  choices?: DecisionChoice[];   // For DECISION_MODE
  choiceType?: Choice['type'];  // Type of choice being made
  selectedChoiceId?: string;    // Currently selected choice
  summaryData?: TurnSummary;    // For SUMMARY_MODE
  waitingMessage?: string;      // For WAITING_MODE

  // Stats (always available)
  stats: {
    money: number;
    timeSpent: number;
    cardCount: number;
    projectScope: number;
  };

  // Turn state flags
  isMyTurn: boolean;
  canEndTurn: boolean;
  hasMovedThisTurn: boolean;
  hasRolledDice: boolean;
}

/**
 * Tracks whether a player has "read" the story for their current space.
 * Resets when player moves to a new space.
 */
interface StoryReadState {
  spaceName: string;
  visitType: 'First' | 'Subsequent';
  hasRead: boolean;
}

export interface IPlayerViewStateService {
  /** Derive the current view state for a player */
  deriveViewState(playerId: string): ViewStateContext;

  /** Mark the story as read (transitions from STORY_MODE) */
  markStoryRead(playerId: string): void;

  /** Subscribe to view state changes */
  subscribe(playerId: string, callback: (context: ViewStateContext) => void): () => void;
}

/**
 * PlayerViewStateService
 *
 * Central state machine for determining what the mobile UI should show.
 * Derives view state from game state and provides subscriptions for updates.
 */
export class PlayerViewStateService implements IPlayerViewStateService {
  private readonly stateService: IStateService;
  private readonly gameRulesService: IGameRulesService;
  private readonly dataService: IDataService;

  // Track story read state per player
  private storyReadStates: Map<string, StoryReadState> = new Map();

  // Subscribers per player
  private subscribers: Map<string, Set<(context: ViewStateContext) => void>> = new Map();

  // Cleanup function from state service subscription
  private stateUnsubscribe?: () => void;

  constructor(
    stateService: IStateService,
    gameRulesService: IGameRulesService,
    dataService: IDataService
  ) {
    this.stateService = stateService;
    this.gameRulesService = gameRulesService;
    this.dataService = dataService;

    // Subscribe to game state changes to notify our subscribers
    this.stateUnsubscribe = this.stateService.subscribe((gameState) => {
      this.notifyAllSubscribers(gameState);
    });
  }

  /**
   * Derive the current view state for a player.
   * This is the main method that determines what the mobile UI should show.
   */
  public deriveViewState(playerId: string): ViewStateContext {
    const gameState = this.stateService.getGameState();
    const player = this.stateService.getPlayer(playerId);

    if (!player) {
      // Return a minimal waiting state for invalid player
      return this.createWaitingContext(playerId, 'Player not found');
    }

    const isMyTurn = this.gameRulesService.isPlayerTurn(playerId);
    const canEndTurn = this.gameRulesService.canEndTurn(playerId);

    // Build base context with common data
    const baseContext = this.buildBaseContext(player, gameState, isMyTurn, canEndTurn);

    // Derive the view state based on game state (priority order matters!)
    const viewState = this.deriveState(player, gameState, isMyTurn, canEndTurn);

    // Enrich context with state-specific data
    return this.enrichContext(baseContext, viewState, player, gameState);
  }

  /**
   * Mark the story as read for a player.
   * This transitions them from STORY_MODE to the next appropriate state.
   */
  public markStoryRead(playerId: string): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return;

    this.storyReadStates.set(playerId, {
      spaceName: player.currentSpace,
      visitType: player.visitType,
      hasRead: true
    });

    // Notify subscribers that state may have changed
    const gameState = this.stateService.getGameState();
    this.notifySubscribersForPlayer(playerId, gameState);
  }

  /**
   * Subscribe to view state changes for a specific player.
   * Returns unsubscribe function.
   */
  public subscribe(
    playerId: string,
    callback: (context: ViewStateContext) => void
  ): () => void {
    if (!this.subscribers.has(playerId)) {
      this.subscribers.set(playerId, new Set());
    }

    this.subscribers.get(playerId)!.add(callback);

    // Immediately call with current state (wrapped in try/catch for robustness)
    try {
      callback(this.deriveViewState(playerId));
    } catch (error) {
      console.error(`Error in initial PlayerViewStateService callback for ${playerId}:`, error);
    }

    // Return unsubscribe function
    return () => {
      const playerSubscribers = this.subscribers.get(playerId);
      if (playerSubscribers) {
        playerSubscribers.delete(callback);
        if (playerSubscribers.size === 0) {
          this.subscribers.delete(playerId);
        }
      }
    };
  }

  /**
   * Clean up resources when service is destroyed.
   */
  public destroy(): void {
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
    }
    this.subscribers.clear();
    this.storyReadStates.clear();
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Derive the view state based on game state.
   * Priority order is critical!
   */
  private deriveState(
    player: Player,
    gameState: GameState,
    isMyTurn: boolean,
    canEndTurn: boolean
  ): PlayerViewState {
    // 1. Not my turn? → WAITING
    if (!isMyTurn) {
      return 'WAITING_MODE';
    }

    // 2. Has unread story? → STORY
    if (this.hasUnreadStory(player)) {
      return 'STORY_MODE';
    }

    // 3. Has pending choice? → DECISION
    if (this.hasPendingChoice(gameState, player.id)) {
      return 'DECISION_MODE';
    }

    // 4. Has pending manual action? → ACTION
    if (this.hasPendingManualAction(player, gameState)) {
      return 'ACTION_MODE';
    }

    // 5. Can end turn? → SUMMARY
    if (canEndTurn) {
      return 'SUMMARY_MODE';
    }

    // 6. Default → WAITING (processing or unknown state)
    return 'WAITING_MODE';
  }

  /**
   * Check if player has unread story for current space.
   */
  private hasUnreadStory(player: Player): boolean {
    const readState = this.storyReadStates.get(player.id);

    // If no read state or different space, story is unread
    if (!readState) {
      return this.hasStoryContent(player);
    }

    // If on same space with same visit type, check if read
    if (readState.spaceName === player.currentSpace &&
        readState.visitType === player.visitType) {
      return !readState.hasRead;
    }

    // Different space - story is unread
    return this.hasStoryContent(player);
  }

  /**
   * Check if the current space has story content.
   */
  private hasStoryContent(player: Player): boolean {
    const spaceContent = this.dataService.getSpaceContent(
      player.currentSpace,
      player.visitType
    );
    return !!(spaceContent?.story || spaceContent?.action_description);
  }

  /**
   * Check if there's a pending choice for this player.
   */
  private hasPendingChoice(gameState: GameState, playerId: string): boolean {
    const choice = gameState.awaitingChoice;
    return choice !== null && choice.playerId === playerId;
  }

  /**
   * Check if there are pending manual actions for this player.
   */
  private hasPendingManualAction(player: Player, gameState: GameState): boolean {
    // Check if required actions exceed completed actions
    if (gameState.requiredActions > gameState.completedActionCount) {
      return true;
    }

    // Check for manual space effects that haven't been triggered
    const manualEffects = this.getManualSpaceEffects(player);
    if (manualEffects.length > 0) {
      // Check if these effects have been completed
      const completedManual = gameState.completedActions?.manualActions || {};
      const hasUncompletedManual = manualEffects.some(effect =>
        !completedManual[effect.effect_type]
      );
      if (hasUncompletedManual) {
        return true;
      }
    }

    // Check for dice-movement spaces requiring a roll
    const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
    if (movement?.movement_type === 'dice' && !gameState.hasPlayerRolledDice) {
      return true;
    }

    return false;
  }

  /**
   * Get manual space effects for player's current space.
   */
  private getManualSpaceEffects(player: Player): SpaceEffect[] {
    const spaceEffects = this.dataService.getSpaceEffects(
      player.currentSpace,
      player.visitType
    );
    return spaceEffects.filter(effect => effect.trigger_type === 'manual');
  }

  /**
   * Build the base context with common data.
   */
  private buildBaseContext(
    player: Player,
    gameState: GameState,
    isMyTurn: boolean,
    canEndTurn: boolean
  ): ViewStateContext {
    const spaceContent = this.dataService.getSpaceContent(
      player.currentSpace,
      player.visitType
    );

    return {
      state: 'WAITING_MODE', // Will be overwritten
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar,
      playerColor: player.color,
      spaceName: player.currentSpace,
      spaceTitle: spaceContent?.title,
      visitType: player.visitType,
      stats: {
        money: player.money || 0,
        timeSpent: player.timeSpent || 0,
        cardCount: player.hand?.length || 0,
        projectScope: player.projectScope || 0
      },
      isMyTurn,
      canEndTurn,
      hasMovedThisTurn: gameState.hasPlayerMovedThisTurn,
      hasRolledDice: gameState.hasPlayerRolledDice
    };
  }

  /**
   * Enrich context with state-specific data.
   */
  private enrichContext(
    context: ViewStateContext,
    state: PlayerViewState,
    player: Player,
    gameState: GameState
  ): ViewStateContext {
    context.state = state;

    switch (state) {
      case 'STORY_MODE':
        context.storyContent = this.getStoryContent(player);
        break;

      case 'ACTION_MODE':
        context.actionPrompt = this.buildActionPrompt(player, gameState);
        break;

      case 'DECISION_MODE':
        this.enrichDecisionContext(context, player, gameState);
        break;

      case 'WAITING_MODE':
        context.waitingMessage = this.getWaitingMessage(player, gameState);
        break;

      case 'SUMMARY_MODE':
        context.summaryData = this.buildTurnSummary(player, gameState);
        break;
    }

    return context;
  }

  /**
   * Get story content for player's current space.
   */
  private getStoryContent(player: Player): string {
    const spaceContent = this.dataService.getSpaceContent(
      player.currentSpace,
      player.visitType
    );

    const storyText = spaceContent?.story || '';
    const actionText = spaceContent?.action_description || '';
    return [storyText, actionText].filter(Boolean).join(' ');
  }

  /**
   * Build action prompt for ACTION_MODE.
   */
  private buildActionPrompt(player: Player, gameState: GameState): ActionPrompt {
    // Check for dice-movement spaces first
    const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
    if (movement?.movement_type === 'dice' && !gameState.hasPlayerRolledDice) {
      return {
        type: 'dice_roll',
        label: 'Roll Dice',
        description: 'Roll to determine your next destination'
      };
    }

    // Check for manual space effects
    const manualEffects = this.getManualSpaceEffects(player);
    const completedManual = gameState.completedActions?.manualActions || {};

    for (const effect of manualEffects) {
      if (!completedManual[effect.effect_type]) {
        return {
          type: 'manual_effect',
          label: this.getEffectLabel(effect),
          description: effect.description || `Complete ${effect.effect_type} action`,
          effectType: effect.effect_type
        };
      }
    }

    // Generic action if nothing specific found
    return {
      type: 'manual_effect',
      label: 'Complete Action',
      description: 'Complete the required action to continue'
    };
  }

  /**
   * Get user-friendly label for a space effect.
   */
  private getEffectLabel(effect: SpaceEffect): string {
    switch (effect.effect_type) {
      case 'money':
        return 'Roll for Money';
      case 'time':
        return 'Roll for Time';
      case 'cards':
        return 'Roll for Cards';
      case 'dice':
        return 'Roll Dice';
      default:
        return `${effect.effect_type} Action`;
    }
  }

  /**
   * Enrich context with decision-specific data.
   */
  private enrichDecisionContext(
    context: ViewStateContext,
    player: Player,
    gameState: GameState
  ): void {
    const choice = gameState.awaitingChoice;
    if (!choice) return;

    context.choiceType = choice.type;
    context.choices = choice.options.map(opt => ({
      id: opt.id,
      label: opt.label,
      isSelected: player.moveIntent === opt.id
    }));

    if (player.moveIntent) {
      context.selectedChoiceId = player.moveIntent;
    }
  }

  /**
   * Get waiting message based on state.
   */
  private getWaitingMessage(player: Player, gameState: GameState): string {
    if (!this.gameRulesService.isPlayerTurn(player.id)) {
      const currentPlayer = gameState.players.find(
        p => p.id === gameState.currentPlayerId
      );
      return `Waiting for ${currentPlayer?.name || 'other player'}...`;
    }

    if (gameState.isProcessingArrival) {
      return 'Processing arrival effects...';
    }

    if (gameState.isMoving) {
      return 'Moving to next space...';
    }

    return 'Processing...';
  }

  /**
   * Build turn summary for SUMMARY_MODE.
   */
  private buildTurnSummary(_player: Player, _gameState: GameState): TurnSummary {
    // TODO: Implement turn summary based on action log
    // For now, return minimal summary
    return {
      spaceVisited: _player.currentSpace,
      moneyChange: 0,
      timeChange: 0,
      cardsDrawn: [],
      cardsDiscarded: [],
      effectsApplied: []
    };
  }

  /**
   * Create a waiting context for error states.
   */
  private createWaitingContext(playerId: string, message: string): ViewStateContext {
    return {
      state: 'WAITING_MODE',
      playerId,
      playerName: 'Unknown',
      spaceName: '',
      visitType: 'First',
      stats: {
        money: 0,
        timeSpent: 0,
        cardCount: 0,
        projectScope: 0
      },
      isMyTurn: false,
      canEndTurn: false,
      hasMovedThisTurn: false,
      hasRolledDice: false,
      waitingMessage: message
    };
  }

  /**
   * Notify all subscribers of state changes.
   */
  private notifyAllSubscribers(gameState: GameState): void {
    for (const playerId of this.subscribers.keys()) {
      this.notifySubscribersForPlayer(playerId, gameState);
    }
  }

  /**
   * Notify subscribers for a specific player.
   */
  private notifySubscribersForPlayer(playerId: string, _gameState: GameState): void {
    const playerSubscribers = this.subscribers.get(playerId);
    if (!playerSubscribers || playerSubscribers.size === 0) return;

    const context = this.deriveViewState(playerId);
    for (const callback of playerSubscribers) {
      try {
        callback(context);
      } catch (error) {
        console.error(`Error in PlayerViewStateService subscriber for ${playerId}:`, error);
      }
    }
  }
}
