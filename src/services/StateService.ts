import { IStateService, IDataService, IGameRulesService } from '../types/ServiceContracts';
import {
  GameState,
  Player,
  GamePhase,
  PlayerUpdateData,
  PlayerCards,
  ActiveModal,
  ActionLogEntry,
  // REAL/TEMP State Model Types
  MutablePlayerState,
  PlayerTurnState,
  TurnStateModel,
  StateTransitionResult,
  CreateTempOptions
} from '../types/StateTypes';
import { colors } from '../styles/theme';
import { Choice } from '../types/CommonTypes';
import { getBackendURL } from '../utils/networkDetection';

// Auto-action event type for modal notifications
export interface AutoActionEvent {
  type: 'dice_conditional_card' | 'seed_money' | 'automatic_funding' | 'life_event' | 'movement';
  playerId: string;
  playerName: string;
  playerColor?: string; // Player's color for UI display
  diceValue?: number;
  requiredRoll?: number;
  cardType?: string;
  cardName?: string;
  cardId?: string;
  moneyAmount?: number;
  success: boolean; // Whether the action triggered (e.g., dice matched)
  spaceName: string;
  message: string;
  // Movement-specific fields
  fromSpace?: string;
  toSpace?: string;
}

export class StateService implements IStateService {
  private currentState: GameState;
  private readonly dataService: IDataService;
  private gameRulesService?: IGameRulesService; // Setter injection to avoid circular dependency
  private listeners: Array<(state: GameState) => void> = [];

  // Auto-action event listeners for modal notifications
  private autoActionListeners: Array<(event: AutoActionEvent) => void> = [];

  // Server synchronization settings
  private serverUrl: string = '';
  private syncEnabled: boolean = true;
  private isSyncing: boolean = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dataService: IDataService) {
    this.dataService = dataService;
    this.currentState = this.createInitialState();

    // Initialize server URL (will be set dynamically based on window.location)
    // Deferred to first sync call to ensure window is available
  }

  /**
   * Set the GameRulesService after construction to handle circular dependencies
   */
  public setGameRulesService(gameRulesService: IGameRulesService): void {
    this.gameRulesService = gameRulesService;
  }

  // Subscription methods
  subscribe(callback: (state: GameState) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to auto-action events (dice rolls for L cards, seed money, etc.)
   * These events trigger modal notifications in the UI
   */
  subscribeToAutoActions(callback: (event: AutoActionEvent) => void): () => void {
    this.autoActionListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.autoActionListeners.indexOf(callback);
      if (index > -1) {
        this.autoActionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit an auto-action event to trigger modal notifications
   */
  emitAutoAction(event: AutoActionEvent): void {
    console.log(`📢 Auto-action event: ${event.type} for ${event.playerName}`, event);
    this.autoActionListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in auto-action listener:', error);
      }
    });
  }

  private notifyListeners(options: { skipSync?: boolean } = {}): void {
    const currentStateSnapshot = this.getGameState();

    // Notify all subscribers
    this.listeners.forEach(callback => {
      try {
        callback(currentStateSnapshot);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });

    // Sync to server after notifying listeners (with debouncing)
    // Skip sync if explicitly requested (e.g., when loading from server)
    if (!options.skipSync) {
      this.debouncedSyncToServer(currentStateSnapshot);
    }
  }

  /**
   * Debounced version of syncToServer to prevent spam during rapid state changes
   * Batches multiple rapid changes into a single sync operation
   */
  private debouncedSyncToServer(state: GameState): void {
    // Clear existing timer
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Debounce 500ms - batches rapid state changes
    this.syncTimer = setTimeout(() => {
      this.syncToServer(state);
      this.syncTimer = null;
    }, 500);
  }

  // State access methods
  getGameState(): GameState {
    // Return deep copies to prevent external mutations
    return {
      ...this.currentState,
      players: this.currentState.players.map(player => ({
        ...player,
        hand: [...player.hand]
      }))
    };
  }

  // Method for explicit deep cloning (same as getGameState now)
  getGameStateDeepCopy(): GameState {
    return this.getGameState();
  }

  isStateLoaded(): boolean {
    return this.currentState !== undefined;
  }

  // Player management methods
  addPlayer(name: string): GameState {
    if (this.currentState.gamePhase !== 'SETUP') {
      throw new Error('Cannot add players outside of setup phase');
    }

    if (this.currentState.players.some(p => p.name === name)) {
      throw new Error(`Player with name "${name}" already exists`);
    }

    // Ensure data is loaded before creating player with correct starting space
    if (this.dataService && !this.dataService.isLoaded()) {
      console.warn('DataService not loaded yet, using fallback starting space. Consider ensuring data is loaded before adding players.');
    }

    const newPlayer: Player = this.createNewPlayer(name);
    
    const newState: GameState = {
      ...this.currentState,
      players: [...this.currentState.players, newPlayer]
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  updatePlayer(playerData: PlayerUpdateData): GameState {
    if (!playerData.id) {
      throw new Error('Player ID is required for updates');
    }

    const playerIndex = this.currentState.players.findIndex(p => p.id === playerData.id);
    if (playerIndex === -1) {
      throw new Error(`Player with ID "${playerData.id}" not found`);
    }

    const currentPlayer = this.currentState.players[playerIndex];
    const updatedPlayer: Player = {
      ...currentPlayer,
      ...playerData,
      timeSpent: playerData.timeSpent !== undefined ? playerData.timeSpent : currentPlayer.timeSpent,
      hand: playerData.hand ? [...playerData.hand] : currentPlayer.hand
    };

    let newPlayers = [...this.currentState.players];
    newPlayers[playerIndex] = updatedPlayer;

    // Handle avatar/color conflicts intelligently
    newPlayers = this.resolveConflicts(newPlayers);

    const newState: GameState = {
      ...this.currentState,
      players: newPlayers
    };

    this.currentState = newState;
    this.notifyListeners();
    this.debouncedSyncToServer(newState); // Sync to server for multi-device support
    return { ...newState };
  }

  removePlayer(playerId: string): GameState {
    if (this.currentState.gamePhase !== 'SETUP') {
      throw new Error('Cannot remove players outside of setup phase');
    }

    const playerExists = this.currentState.players.some(p => p.id === playerId);
    if (!playerExists) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    const newPlayers = this.currentState.players.filter(p => p.id !== playerId);
    let newCurrentPlayerId = this.currentState.currentPlayerId;

    if (this.currentState.currentPlayerId === playerId) {
      newCurrentPlayerId = newPlayers.length > 0 ? newPlayers[0].id : null;
    }

    const newState: GameState = {
      ...this.currentState,
      players: newPlayers,
      currentPlayerId: newCurrentPlayerId
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  getPlayer(playerId: string): Player | undefined {
    const player = this.currentState.players.find(p => p.id === playerId);
    return player ? { ...player, hand: [...player.hand] } : undefined;
  }

  getAllPlayers(): Player[] {
    return this.currentState.players.map(player => ({ ...player, hand: [...player.hand] }));
  }

  // Game flow methods
  setCurrentPlayer(playerId: string): GameState {
    const playerExists = this.currentState.players.some(p => p.id === playerId);
    if (!playerExists) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    const player = this.currentState.players.find(p => p.id === playerId);
    console.log(`🎯 StateService.setCurrentPlayer - Setting current player to ${player?.name} (${playerId})`);

    const newState: GameState = {
      ...this.currentState,
      currentPlayerId: playerId
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  setGamePhase(phase: GamePhase): GameState {
    const newState: GameState = {
      ...this.currentState,
      gamePhase: phase
    };

    if (phase === 'PLAY' && !this.currentState.gameStartTime) {
      newState.gameStartTime = new Date();
    }

    if (phase === 'END' && !this.currentState.gameEndTime) {
      newState.gameEndTime = new Date();
    }

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  advanceTurn(): GameState {
    const currentPlayerId = this.currentState.currentPlayerId;
    const numPlayers = this.currentState.players.length;

    // Handle case where no current player is set (for backwards compatibility)
    if (!currentPlayerId || numPlayers === 0) {
      // Just increment the legacy turn counter and global count
      const newState: GameState = {
        ...this.currentState,
        turn: this.currentState.turn + 1,
        globalTurnCount: this.currentState.globalTurnCount + 1,
      };
      this.currentState = newState;
      this.notifyListeners();
      return { ...newState };
    }

    // New turn and round logic
    let newGameRound = this.currentState.gameRound;
    let newTurnWithinRound = this.currentState.turnWithinRound + 1;

    if (newTurnWithinRound > numPlayers) {
      newTurnWithinRound = 1;
      newGameRound += 1;
    }

    // Calculate new turn tracking values (simplified)
    const newGlobalTurnCount = this.currentState.globalTurnCount + 1;

    // Update this player's individual turn count
    const currentPlayerTurnCount = (this.currentState.playerTurnCounts[currentPlayerId] || 0) + 1;
    const updatedPlayerTurnCounts = {
      ...this.currentState.playerTurnCounts,
      [currentPlayerId]: currentPlayerTurnCount,
    };

    const newState: GameState = {
      ...this.currentState,
      gameRound: newGameRound,
      turnWithinRound: newTurnWithinRound,
      globalTurnCount: newGlobalTurnCount,
      playerTurnCounts: updatedPlayerTurnCounts,
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  nextPlayer(): GameState {
    if (this.currentState.players.length === 0) {
      throw new Error('No players available');
    }

    const currentIndex = this.currentState.currentPlayerId 
      ? this.currentState.players.findIndex(p => p.id === this.currentState.currentPlayerId)
      : -1;

    const nextIndex = (currentIndex + 1) % this.currentState.players.length;
    const nextPlayerId = this.currentState.players[nextIndex].id;

    const newState: GameState = {
      ...this.currentState,
      currentPlayerId: nextPlayerId,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      selectedDestination: null,
      awaitingChoice: null // Clear any pending choices from previous player
    };

    this.currentState = newState;
    
    // Update action counts for the new current player
    this.updateActionCounts();
    
    return { ...this.currentState };
  }

  // Game lifecycle methods
  initializeGame(): GameState {
    this.currentState = this.createInitialState();
    this.notifyListeners();
    return { ...this.currentState };
  }

  startGame(): GameState {
    if (!this.canStartGame()) {
      throw new Error('Cannot start game: requirements not met');
    }

    // Initialize shuffled decks for each card type
    const decks = {
      W: this.shuffleArray([...this.dataService.getCardsByType('W').map(card => card.card_id)]),
      B: this.shuffleArray([...this.dataService.getCardsByType('B').map(card => card.card_id)]),
      E: this.shuffleArray([...this.dataService.getCardsByType('E').map(card => card.card_id)]),
      L: this.shuffleArray([...this.dataService.getCardsByType('L').map(card => card.card_id)]),
      I: this.shuffleArray([...this.dataService.getCardsByType('I').map(card => card.card_id)])
    };

    // Initialize empty discard piles
    const discardPiles = {
      W: [] as string[],
      B: [] as string[],
      E: [] as string[],
      L: [] as string[],
      I: [] as string[]
    };

    const newState: GameState = {
      ...this.currentState,
      gamePhase: 'PLAY',
      gameStartTime: new Date(),
      currentPlayerId: this.currentState.players.length > 0 ? this.currentState.players[0].id : null,
      decks,
      discardPiles,
      isInitialized: false // Game is not fully initialized until players are placed
    };

    this.currentState = newState;

    // Initialize action counts for the first player
    this.updateActionCounts();

    console.log(`🎴 DECK_INIT: Created shuffled decks - W:${decks.W.length}, B:${decks.B.length}, E:${decks.E.length}, L:${decks.L.length}, I:${decks.I.length}`);
    console.log('⏳ Game started but not yet initialized - waiting for player placement');

    return { ...this.currentState };
  }

  endGame(winnerId?: string): GameState {
    const newState: GameState = {
      ...this.currentState,
      gamePhase: 'END',
      gameEndTime: new Date(),
      isGameOver: true,
      winner: winnerId
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  resetGame(): GameState {
    this.currentState = this.createInitialState();
    this.notifyListeners();
    return { ...this.currentState };
  }

  // Utility method to fix players with incorrect starting spaces
  // This can be called after data is loaded to correct any players with wrong starting spaces
  fixPlayerStartingSpaces(): GameState {
    if (!this.dataService || !this.dataService.isLoaded()) {
      console.warn('Cannot fix starting spaces: DataService not loaded');
      return { ...this.currentState };
    }

    const correctStartingSpace = this.getStartingSpace();
    console.log('🔧 Fixing starting spaces. Correct starting space should be:', correctStartingSpace);
    console.log('🔍 Current players before fix:', this.currentState.players.map(p => ({ name: p.name, currentSpace: p.currentSpace })));
    
    const updatedPlayers = this.currentState.players.map(player => {
      // Only fix players who are still on the old incorrect starting space
      if (player.currentSpace === 'START-QUICK-PLAY-GUIDE') {
        console.log(`🔄 Fixing player ${player.name} from ${player.currentSpace} to ${correctStartingSpace}`);
        return {
          ...player,
          currentSpace: correctStartingSpace
        };
      }
      return player;
    });

    const newState: GameState = {
      ...this.currentState,
      players: updatedPlayers
    };

    this.currentState = newState;
    this.notifyListeners();
    
    console.log('✅ Players after fix:', newState.players.map(p => ({ name: p.name, currentSpace: p.currentSpace })));
    return { ...newState };
  }

  // Aggressive method to force reset ALL players to correct starting space
  // This ignores current space and resets everyone
  forceResetAllPlayersToCorrectStartingSpace(): GameState {
    if (!this.dataService || !this.dataService.isLoaded()) {
      console.warn('Cannot force reset starting spaces: DataService not loaded');
      return { ...this.currentState };
    }

    const correctStartingSpace = this.getStartingSpace();
    console.log('🚨 FORCE RESET: Moving all players to:', correctStartingSpace);
    
    const updatedPlayers = this.currentState.players.map(player => {
      console.log(`🔄 FORCE RESET: ${player.name} from ${player.currentSpace} to ${correctStartingSpace}`);
      return {
        ...player,
        currentSpace: correctStartingSpace,
        visitType: 'First' as const // Reset visit type too
      };
    });

    const newState: GameState = {
      ...this.currentState,
      players: updatedPlayers
    };

    this.currentState = newState;
    this.notifyListeners();
    
    console.log('🎯 FORCE RESET COMPLETE. All players now at:', correctStartingSpace);
    return { ...newState };
  }

  setAwaitingChoice(choice: Choice): GameState {
    console.log(`🎯 Setting awaiting choice for player ${choice.playerId}: ${choice.type} - "${choice.prompt}"`);

    this.currentState = {
      ...this.currentState,
      awaitingChoice: choice
    };

    // Recalculate action counts when a choice is set
    this.updateActionCounts();

    this.notifyListeners();
    return this.currentState;
  }

  clearAwaitingChoice(): GameState {
    this.currentState = {
      ...this.currentState,
      awaitingChoice: null
    };

    // Recalculate action counts when a choice is cleared
    this.updateActionCounts();

    this.notifyListeners();
    return this.currentState;
  }

  setMoving(isMoving: boolean): GameState {
    this.currentState = {
      ...this.currentState,
      isMoving
    };
    this.notifyListeners();
    return this.currentState;
  }

  selectDestination(destination: string | null): GameState {
    this.currentState = {
      ...this.currentState,
      selectedDestination: destination,
    };
    this.notifyListeners();
    return this.currentState;
  }

  setPlayerMoveIntent(playerId: string, destination: string | null): GameState {
    console.log(`🎯 Setting move intent for player ${playerId}: ${destination}`);

    const playerIndex = this.currentState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    const updatedPlayer = {
      ...this.currentState.players[playerIndex],
      moveIntent: destination
    };

    const newPlayers = [...this.currentState.players];
    newPlayers[playerIndex] = updatedPlayer;

    const newState: GameState = {
      ...this.currentState,
      players: newPlayers
    };

    this.currentState = newState;

    // Recalculate action counts when moveIntent is set
    // This ensures End Turn button state is correct regardless of action order
    this.updateActionCounts();

    this.notifyListeners();
    return { ...this.currentState };
  }

  setPlayerHasMoved(): GameState {
    const newState: GameState = {
      ...this.currentState,
      hasPlayerMovedThisTurn: true
    };

    this.currentState = newState;
    
    // Update action counts when player completes actions
    this.updateActionCounts();
    
    return { ...this.currentState };
  }

  setPlayerCompletedManualAction(effectType: string, message: string): GameState {
    console.log(`🎯 Recording completed manual action: ${effectType}, message: "${message}"`);
    console.log(`🎯 Current manual actions before:`, this.currentState.completedActions.manualActions);
    const newCompletedActions = {
      ...this.currentState.completedActions,
      manualActions: {
        ...this.currentState.completedActions.manualActions,
        [effectType]: message,
      },
    };
    console.log(`🎯 New manual actions after:`, newCompletedActions.manualActions);

    const newState: GameState = {
      ...this.currentState,
      completedActions: newCompletedActions,
    };

    this.currentState = newState;
    console.log(`🎯 About to call updateActionCounts after recording ${effectType}`);
    this.updateActionCounts(); // This remains the same
    console.log(`🎯 updateActionCounts completed. State now has requiredActions=${this.currentState.requiredActions}, completedActionCount=${this.currentState.completedActionCount}`);
    return { ...this.currentState };
  }

  setPlayerHasRolledDice(): GameState {
    const newState: GameState = {
      ...this.currentState,
      hasPlayerRolledDice: true
    };

    this.currentState = newState;
    
    // Update action counts when player completes dice roll
    this.updateActionCounts();
    
    return { ...this.currentState };
  }

  clearPlayerHasMoved(): GameState {
    console.log(`🎯 StateService.clearPlayerHasMoved - Clearing hasPlayerMovedThisTurn flag`);
    const newState: GameState = {
      ...this.currentState,
      hasPlayerMovedThisTurn: false
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  clearTurnActions(): GameState {
    const newState: GameState = {
      ...this.currentState,
      // RESET the new object
      completedActions: {
        diceRoll: undefined,
        manualActions: {},
      },
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  clearPlayerHasRolledDice(): GameState {
    const newState: GameState = {
      ...this.currentState,
      hasPlayerRolledDice: false
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  // Validation methods
  validatePlayerAction(playerId: string, action: string): boolean {
    if (this.currentState.gamePhase !== 'PLAY') {
      return false;
    }

    if (this.currentState.currentPlayerId !== playerId) {
      return false;
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      return false;
    }

    return true;
  }

  canStartGame(): boolean {
    if (this.currentState.gamePhase !== 'SETUP') {
      return false;
    }

    if (this.currentState.players.length < 1) {
      return false;
    }

    if (this.dataService && this.dataService.isLoaded()) {
      const gameConfigs = this.dataService.getGameConfig();
      if (gameConfigs.length > 0) {
        const minPlayers = Math.min(...gameConfigs.map(c => c.min_players));
        const maxPlayers = Math.max(...gameConfigs.map(c => c.max_players));
        
        
        return this.currentState.players.length >= minPlayers && 
               this.currentState.players.length <= maxPlayers;
      }
    }

    return this.currentState.players.length >= 1 && this.currentState.players.length <= 6;
  }

  // Initialization methods
  isInitialized(): boolean {
    return this.currentState.isInitialized;
  }

  markAsInitialized(): GameState {
    const newState: GameState = {
      ...this.currentState,
      isInitialized: true
    };

    this.currentState = newState;
    this.notifyListeners();
    console.log('🎯 Game marked as fully initialized');

    return { ...this.currentState };
  }

  // Modal management methods
  showCardModal(cardId: string): GameState {
    const newState: GameState = {
      ...this.currentState,
      activeModal: {
        type: 'CARD',
        cardId
      }
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  dismissModal(): GameState {
    const newState: GameState = {
      ...this.currentState,
      activeModal: null
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  // Action tracking methods
  updateActionCounts(): void {
    if (!this.currentState.currentPlayerId) return;

    const currentPlayer = this.currentState.players.find(p => p.id === this.currentState.currentPlayerId);
    if (!currentPlayer || !this.dataService.isLoaded()) return;

    const actionCounts = this.calculateRequiredActions(currentPlayer);

    console.log(`🎯 updateActionCounts: ${currentPlayer.name} - required: ${actionCounts.required}, completed: ${actionCounts.completed}, hasRolled: ${this.currentState.hasPlayerRolledDice}, space: ${currentPlayer.currentSpace}`);

    this.currentState = {
      ...this.currentState,
      requiredActions: actionCounts.required,
      completedActionCount: actionCounts.completed,
      availableActionTypes: actionCounts.availableTypes
    };

    this.notifyListeners();
  }
  
  private calculateRequiredActions(player: Player): { required: number, completed: number, availableTypes: string[] } {
    const availableTypes: string[] = [];
    let required = 0;
    let completed = 0;

    try {
      // Check if dice roll is REQUIRED for this space
      // A dice roll is only required if:
      // 1. Movement type is 'dice' (dice_outcome spaces like CHEAT-BYPASS), OR
      // 2. There are unconditional dice effects (not "if you roll" effects)
      const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
      const requiresDiceRollConfig = spaceConfig?.requires_dice_roll ?? true; // Default to true if not specified

      // Check movement type to see if dice determines destination
      const movement = this.dataService.getMovement(player.currentSpace, player.visitType);
      const isDiceMovement = movement?.movement_type === 'dice';

      // Check if there are unconditional dice effects (dice-based effects without dice_roll_X conditions)
      // Effects with dice_roll_X conditions are handled automatically - they don't require player action
      const spaceEffects = this.dataService.getSpaceEffects(player.currentSpace, player.visitType);
      const hasUnconditionalDiceEffect = spaceEffects.some(effect => {
        // Check if this is a dice effect type (requires player to roll)
        const isDiceEffect = effect.effect_type === 'dice' || effect.effect_action === 'dice_outcome';
        // Exclude effects that are just dice-conditional (like dice_roll_3) - those are auto-evaluated
        const isDiceConditional = effect.condition?.toLowerCase().startsWith('dice_roll_') ||
                                  effect.condition?.toLowerCase() === 'high' ||
                                  effect.condition?.toLowerCase() === 'low';
        return isDiceEffect && !isDiceConditional;
      });

      // Only count dice as required if movement is dice-based OR there are unconditional dice effects
      const isDiceRequired = requiresDiceRollConfig && (isDiceMovement || hasUnconditionalDiceEffect);

      if (isDiceRequired) {
        availableTypes.push('dice');
        required++;
        // Check if dice has been rolled
        if (this.currentState.hasPlayerRolledDice) {
          completed++;
        }
      }

      // Filter effects by condition (e.g., scope_le_4M, scope_gt_4M)
      const conditionFilteredEffects = spaceEffects.filter(effect =>
        this.evaluateSpaceEffectCondition(effect.condition, player)
      );

      const manualEffects = conditionFilteredEffects.filter(effect => effect.trigger_type === 'manual');
      const automaticEffects = conditionFilteredEffects.filter(effect => effect.trigger_type !== 'manual');


      // Log automatic effects for debugging, but don't count them as separate actions
      // Automatic effects are triggered by space entry and don't require separate player actions
      automaticEffects.forEach((effect, index) => {
        console.log(`  📝 Automatic effect ${index}: ${effect.effect_type} ${effect.effect_action} ${effect.effect_value} (triggered by space entry)`);
      });

      // Count manual effects (require separate player action)
      // Exclude 'turn' effects since they duplicate the regular End Turn button
      // Exclude 'dice' effects since they're handled by the dice required check above
      const countableManualEffects = manualEffects.filter(effect =>
        effect.effect_type !== 'turn' && effect.effect_type !== 'dice'
      );
      console.log(`🎯 calculateRequiredActions: Found ${countableManualEffects.length} countable manual effects:`,
        countableManualEffects.map(e => `${e.effect_type}:${e.effect_action}`));
      console.log(`🎯 Current completed manual actions:`, this.currentState.completedActions.manualActions);

      countableManualEffects.forEach(effect => {
        // Generic handling for ALL manual effect types
        const actionType = `${effect.effect_type}_manual`;
        if (!availableTypes.includes(actionType)) {
          availableTypes.push(actionType);
        }
        required++;

        // Check if this specific manual action has been completed
        // Support both simple keys ("cards") and compound keys ("cards:draw_b")
        // Also support case-insensitive matching for robustness
        const simpleKey = effect.effect_type;
        const compoundKey = `${effect.effect_type}:${effect.effect_action}`;
        const completedKeys = Object.keys(this.currentState.completedActions.manualActions);

        // Direct match (exact key)
        const simpleMatch = this.currentState.completedActions.manualActions[simpleKey];
        const compoundMatch = this.currentState.completedActions.manualActions[compoundKey];

        // Case-insensitive fallback matching
        const caseInsensitiveMatch = completedKeys.find(key =>
          key.toLowerCase() === compoundKey.toLowerCase() ||
          key.toLowerCase() === simpleKey.toLowerCase()
        );

        const isCompleted = !!(simpleMatch || compoundMatch || caseInsensitiveMatch);

        console.log(`  🎯 Manual effect ${effect.effect_type}:${effect.effect_action}:`);
        console.log(`     - simpleKey="${simpleKey}", simpleMatch="${simpleMatch}"`);
        console.log(`     - compoundKey="${compoundKey}", compoundMatch="${compoundMatch}"`);
        console.log(`     - caseInsensitiveMatch="${caseInsensitiveMatch}"`);
        console.log(`     - completedKeys:`, completedKeys);
        console.log(`     - isCompleted=${isCompleted}`);

        if (isCompleted) {
          completed++;
        }
      });
      
    } catch (error) {
      console.error('Error calculating required actions:', error);
      // Fallback to basic turn requirements
      return { required: 1, completed: this.currentState.hasPlayerMovedThisTurn ? 1 : 0, availableTypes: ['movement'] };
    }
    
    return { required, completed, availableTypes };
  }

  /**
   * Evaluate space effect condition for a player
   * Used to filter effects based on conditions like scope_le_4M, scope_gt_4M, etc.
   * Delegates to GameRulesService for consistent condition evaluation
   */
  private evaluateSpaceEffectCondition(condition: string, player: Player): boolean {
    // Use GameRulesService as single source of truth for condition evaluation
    if (this.gameRulesService) {
      return this.gameRulesService.evaluateCondition(player.id, condition);
    }

    // Fallback for when GameRulesService hasn't been set yet (during initialization)
    console.warn('GameRulesService not set in StateService, using fallback condition evaluation');
    switch (condition) {
      case 'always':
        return true;
      default:
        // Unknown conditions default to false
        return false;
    }
  }

  // Player snapshot methods for negotiation
  createPlayerSnapshot(playerId: string): GameState {
    const player = this.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const snapshot = {
      space: player.currentSpace,
      visitType: player.visitType,
      money: player.money,
      timeSpent: player.timeSpent,
      hand: [...player.hand],
      activeCards: [...player.activeCards]
    };

    return this.updatePlayer({
      id: playerId,
      spaceEntrySnapshot: snapshot
    });
  }

  restorePlayerSnapshot(playerId: string): GameState {
    const player = this.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    if (!player.spaceEntrySnapshot) {
      throw new Error(`No snapshot exists for player ${playerId}`);
    }

    const snapshot = player.spaceEntrySnapshot;

    // Restore player state from snapshot
    const restoredState = this.updatePlayer({
      id: playerId,
      currentSpace: snapshot.space,
      visitType: snapshot.visitType,
      money: snapshot.money,
      timeSpent: snapshot.timeSpent,
      hand: [...snapshot.hand],
      activeCards: [...snapshot.activeCards],
      spaceEntrySnapshot: undefined // Clear snapshot after restoring
    });

    return restoredState;
  }

  // ============================================================================
  // REAL/TEMP State Model Methods (December 26, 2025)
  // Note: Old snapshot methods (savePreSpaceEffectSnapshot, revertPlayerToSnapshot, etc.)
  // have been removed. Try Again functionality now uses REAL/TEMP state model.
  // ============================================================================
  //
  // These methods implement the new state model that separates "committed" state
  // (REAL) from "working" state (TEMP). All turn effects apply to TEMP state;
  // REAL state only updates on turn boundaries.
  //
  // Flow:
  // 1. Turn starts → createTempStateFromReal()
  // 2. All effects → updateTempState() or updatePlayer() [which writes to TEMP]
  // 3. UI renders → getPlayerState() [reads from TEMP during turn]
  // 4. On Try Again: applyToRealState(penalty) → discardTempState() → createTempStateFromReal()
  // 5. On End Turn: commitTempToReal()
  // ============================================================================

  /**
   * Extract mutable state from a Player object.
   * This creates a snapshot of the fields that can change during a turn.
   */
  private extractMutableState(player: Player): MutablePlayerState {
    return {
      money: player.money,
      timeSpent: player.timeSpent,
      projectScope: player.projectScope,
      score: player.score,
      hand: [...player.hand],
      activeCards: [...player.activeCards],
      loans: player.loans ? [...player.loans] : [],
      moneySources: { ...player.moneySources },
      expenditures: { ...player.expenditures },
      costHistory: player.costHistory ? [...player.costHistory] : [],
      costs: { ...player.costs },
      activeEffects: player.activeEffects ? [...player.activeEffects] : [],
      spaceVisitLog: player.spaceVisitLog ? [...player.spaceVisitLog] : [],
      lastDiceRoll: player.lastDiceRoll ? { ...player.lastDiceRoll } : undefined
    };
  }

  /**
   * Initialize the turn state model if it doesn't exist.
   */
  private ensureTurnStateModel(): void {
    if (!this.currentState.turnStateModel) {
      this.currentState = {
        ...this.currentState,
        turnStateModel: {
          realStates: {},
          tempStates: {},
          activeTurnPlayers: [],
          tryAgainCounts: {}
        }
      };
    }
  }

  /**
   * Create a TEMP state from REAL state for a player.
   * Called at the start of a player's turn.
   *
   * If this is a Try Again scenario, the time penalty should have already been
   * applied to REAL state before calling this method.
   */
  public createTempStateFromReal(options: CreateTempOptions): StateTransitionResult {
    const { playerId, spaceName, visitType, isTryAgain = false, tryAgainPenalty = 0 } = options;

    console.log(`🔄 Creating TEMP state from REAL for player ${playerId} at ${spaceName} (Try Again: ${isTryAgain})`);

    this.ensureTurnStateModel();
    const player = this.getPlayer(playerId);

    if (!player) {
      return { success: false, error: `Player ${playerId} not found` };
    }

    // If Try Again, first apply penalty to REAL state
    if (isTryAgain && tryAgainPenalty > 0) {
      const penaltyResult = this.applyToRealState(playerId, { timeSpent: tryAgainPenalty });
      if (!penaltyResult.success) {
        return penaltyResult;
      }
    }

    // Get the source state - either existing REAL or current player state
    const realState = this.currentState.turnStateModel!.realStates[playerId];
    const sourceState: MutablePlayerState = realState?.state
      ? { ...realState.state }
      : this.extractMutableState(player);

    // Create new TEMP state from REAL
    const newTempState: PlayerTurnState = {
      playerId,
      playerName: player.name,
      state: { ...sourceState },
      capturedAt: {
        turnNumber: this.currentState.globalTurnCount,
        spaceName,
        visitType,
        timestamp: new Date()
      }
    };

    // Update turn state model
    const turnStateModel = this.currentState.turnStateModel!;
    this.currentState = {
      ...this.currentState,
      turnStateModel: {
        ...turnStateModel,
        tempStates: {
          ...turnStateModel.tempStates,
          [playerId]: newTempState
        },
        activeTurnPlayers: turnStateModel.activeTurnPlayers.includes(playerId)
          ? turnStateModel.activeTurnPlayers
          : [...turnStateModel.activeTurnPlayers, playerId],
        tryAgainCounts: isTryAgain
          ? { ...turnStateModel.tryAgainCounts, [playerId]: (turnStateModel.tryAgainCounts[playerId] || 0) + 1 }
          : turnStateModel.tryAgainCounts
      }
    };

    console.log(`✅ TEMP state created for player ${playerId} (Try Again count: ${this.currentState.turnStateModel!.tryAgainCounts[playerId] || 0})`);

    return {
      success: true,
      newTempState,
      timePenaltyApplied: isTryAgain ? tryAgainPenalty : undefined
    };
  }

  /**
   * Commit TEMP state to REAL state for a player.
   * Called at the end of a player's turn.
   */
  public commitTempToReal(playerId: string): StateTransitionResult {
    console.log(`💾 Committing TEMP state to REAL for player ${playerId}`);

    if (!this.currentState.turnStateModel) {
      return { success: false, error: 'Turn state model not initialized' };
    }

    const tempState = this.currentState.turnStateModel.tempStates[playerId];
    if (!tempState) {
      return { success: false, error: `No TEMP state exists for player ${playerId}` };
    }

    // Create new REAL state from TEMP
    const newRealState: PlayerTurnState = {
      ...tempState,
      capturedAt: {
        ...tempState.capturedAt,
        timestamp: new Date() // Update timestamp to commit time
      }
    };

    // Update turn state model
    const turnStateModel = this.currentState.turnStateModel;
    this.currentState = {
      ...this.currentState,
      turnStateModel: {
        ...turnStateModel,
        realStates: {
          ...turnStateModel.realStates,
          [playerId]: newRealState
        },
        tempStates: {
          ...turnStateModel.tempStates,
          [playerId]: null // Clear TEMP state
        },
        activeTurnPlayers: turnStateModel.activeTurnPlayers.filter(id => id !== playerId),
        tryAgainCounts: {
          ...turnStateModel.tryAgainCounts,
          [playerId]: 0 // Reset Try Again count
        }
      }
    };

    // Also update the player in main state to reflect committed changes
    const playerIndex = this.currentState.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const updatedPlayer = {
        ...this.currentState.players[playerIndex],
        ...tempState.state
      };
      const newPlayers = [...this.currentState.players];
      newPlayers[playerIndex] = updatedPlayer;
      this.currentState = {
        ...this.currentState,
        players: newPlayers
      };
    }

    this.notifyListeners();
    console.log(`✅ TEMP state committed to REAL for player ${playerId}`);

    return { success: true, newRealState };
  }

  /**
   * Discard TEMP state for a player (used in Try Again flow).
   * After calling this, createTempStateFromReal should be called to create a fresh TEMP.
   */
  public discardTempState(playerId: string): StateTransitionResult {
    console.log(`🗑️ Discarding TEMP state for player ${playerId}`);

    if (!this.currentState.turnStateModel) {
      return { success: false, error: 'Turn state model not initialized' };
    }

    const tempState = this.currentState.turnStateModel.tempStates[playerId];
    if (!tempState) {
      console.log(`ℹ️ No TEMP state to discard for player ${playerId}`);
      return { success: true }; // Not an error - just nothing to discard
    }

    // Clear TEMP state
    const turnStateModel = this.currentState.turnStateModel;
    this.currentState = {
      ...this.currentState,
      turnStateModel: {
        ...turnStateModel,
        tempStates: {
          ...turnStateModel.tempStates,
          [playerId]: null
        }
      }
    };

    console.log(`✅ TEMP state discarded for player ${playerId}`);
    return { success: true };
  }

  /**
   * Apply changes directly to REAL state (bypasses TEMP).
   * Used for Try Again time penalties that should persist across retries.
   */
  public applyToRealState(playerId: string, changes: Partial<MutablePlayerState>): StateTransitionResult {
    console.log(`📝 Applying changes to REAL state for player ${playerId}:`, changes);

    this.ensureTurnStateModel();
    const player = this.getPlayer(playerId);

    if (!player) {
      return { success: false, error: `Player ${playerId} not found` };
    }

    // Get existing REAL state or create from current player
    const existingReal = this.currentState.turnStateModel!.realStates[playerId];
    const currentRealState: MutablePlayerState = existingReal?.state
      ? { ...existingReal.state }
      : this.extractMutableState(player);

    // Apply changes (handle additive fields like timeSpent)
    const updatedState: MutablePlayerState = { ...currentRealState };

    // For timeSpent, we ADD the penalty to existing value
    if (changes.timeSpent !== undefined) {
      updatedState.timeSpent = currentRealState.timeSpent + changes.timeSpent;
    }

    // For other fields, apply directly if provided
    if (changes.money !== undefined) updatedState.money = changes.money;
    if (changes.projectScope !== undefined) updatedState.projectScope = changes.projectScope;
    if (changes.score !== undefined) updatedState.score = changes.score;
    if (changes.hand) updatedState.hand = [...changes.hand];
    if (changes.activeCards) updatedState.activeCards = [...changes.activeCards];
    if (changes.loans) updatedState.loans = [...changes.loans];
    if (changes.moneySources) updatedState.moneySources = { ...changes.moneySources };
    if (changes.expenditures) updatedState.expenditures = { ...changes.expenditures };
    if (changes.costHistory) updatedState.costHistory = [...changes.costHistory];
    if (changes.costs) updatedState.costs = { ...changes.costs };
    if (changes.activeEffects) updatedState.activeEffects = [...changes.activeEffects];
    if (changes.spaceVisitLog) updatedState.spaceVisitLog = [...changes.spaceVisitLog];
    if (changes.lastDiceRoll) updatedState.lastDiceRoll = { ...changes.lastDiceRoll };

    // Create updated REAL state
    const newRealState: PlayerTurnState = {
      playerId,
      playerName: player.name,
      state: updatedState,
      capturedAt: existingReal?.capturedAt || {
        turnNumber: this.currentState.globalTurnCount,
        spaceName: player.currentSpace,
        visitType: player.visitType,
        timestamp: new Date()
      }
    };

    // Update turn state model
    const turnStateModel = this.currentState.turnStateModel!;
    this.currentState = {
      ...this.currentState,
      turnStateModel: {
        ...turnStateModel,
        realStates: {
          ...turnStateModel.realStates,
          [playerId]: newRealState
        }
      }
    };

    console.log(`✅ Changes applied to REAL state for player ${playerId}`);
    return { success: true, newRealState };
  }

  /**
   * Get the effective player state (reads from TEMP during turn, REAL otherwise).
   * This is the state that should be used for UI rendering and effect calculations.
   */
  public getEffectivePlayerState(playerId: string): MutablePlayerState | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    // If turn state model exists and player has active TEMP, use TEMP
    if (this.currentState.turnStateModel) {
      const tempState = this.currentState.turnStateModel.tempStates[playerId];
      if (tempState) {
        return { ...tempState.state };
      }

      // Fall back to REAL if no TEMP
      const realState = this.currentState.turnStateModel.realStates[playerId];
      if (realState) {
        return { ...realState.state };
      }
    }

    // Fall back to extracting from player object
    return this.extractMutableState(player);
  }

  /**
   * Check if a player has an active TEMP state (i.e., is in the middle of their turn).
   */
  public hasActiveTempState(playerId: string): boolean {
    return !!(this.currentState.turnStateModel?.tempStates[playerId]);
  }

  /**
   * Get the Try Again count for a player in the current turn.
   */
  public getTryAgainCount(playerId: string): number {
    return this.currentState.turnStateModel?.tryAgainCounts[playerId] || 0;
  }

  /**
   * Update the TEMP state for a player (if active) or main player state.
   * This is the method that should be used by effect processing.
   */
  public updateTempState(playerId: string, changes: Partial<MutablePlayerState>): StateTransitionResult {
    if (!this.currentState.turnStateModel?.tempStates[playerId]) {
      // No TEMP state - fall back to updating main player state
      console.log(`ℹ️ No TEMP state for player ${playerId}, updating main state instead`);
      this.updatePlayer({ id: playerId, ...changes });
      return { success: true };
    }

    const tempState = this.currentState.turnStateModel.tempStates[playerId]!;
    const updatedState: MutablePlayerState = {
      ...tempState.state,
      ...changes
    };

    const newTempState: PlayerTurnState = {
      ...tempState,
      state: updatedState
    };

    this.currentState = {
      ...this.currentState,
      turnStateModel: {
        ...this.currentState.turnStateModel!,
        tempStates: {
          ...this.currentState.turnStateModel!.tempStates,
          [playerId]: newTempState
        }
      }
    };

    // Also update the main player state for immediate UI feedback
    this.updatePlayer({ id: playerId, ...changes });

    return { success: true, newTempState };
  }

  setGameState(newState: GameState): GameState {
    console.log('🔧 Setting entire game state atomically');
    this.currentState = newState;
    this.notifyListeners();
    return this.currentState;
  }

  updateGameState(stateChanges: Partial<GameState>): GameState {
    console.log('🔧 Updating game state with partial changes');
    this.currentState = { ...this.currentState, ...stateChanges };
    this.notifyListeners();
    return this.currentState;
  }

  // Private helper methods
  private createInitialState(): GameState {
    const startingSpace = this.getStartingSpace();
    
    return {
      players: [],
      currentPlayerId: null,
      gamePhase: 'SETUP',
      turn: 0, // Deprecated but kept for backwards compatibility
      // New turn tracking system
      gameRound: 1, // Start at round 1
      turnWithinRound: 1, // Start at turn 1 within the round
      globalTurnCount: 0,
      // Track individual player turn counts for statistics
      playerTurnCounts: {},
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      isMoving: false,
      isProcessingArrival: false,
      isInitialized: false, // Game starts uninitialized
      // Initialize action tracking
      requiredActions: 1,
      completedActionCount: 0,
      availableActionTypes: [],
      completedActions: {
        diceRoll: undefined as string | undefined,
        manualActions: {} as { [key: string]: string },
      },
      // Initialize negotiation state
      activeNegotiation: null,
      // Initialize movement selection state
      selectedDestination: null as string | null,
      // Initialize global action log
      globalActionLog: [],
      // Initialize transactional logging session tracking
      currentExplorationSessionId: null,
      // Initialize Try Again snapshots (per player)
      playerSnapshots: {},
      // Initialize empty decks and discard piles (will be populated in startGame)
      decks: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      },
      discardPiles: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      }
    };
  }

  private createNewPlayer(name: string): Player {
    const startingSpace = this.getStartingSpace();
    const defaultColor = this.getNextAvailableColor();
    const defaultAvatar = this.getNextAvailableAvatar();
    const shortId = this.generateShortPlayerId();

    return {
      id: this.generatePlayerId(),
      shortId,
      name,
      currentSpace: startingSpace,
      visitType: 'First',
      visitedSpaces: [startingSpace], // Track starting space as first visited
      spaceVisitLog: [{
        spaceName: startingSpace,
        daysSpent: 0,
        entryTurn: 1,
        entryTime: 0
      }], // Track detailed visit history with time spent per space
      money: 0, // Players start with no money, get funding from owner and loans later
      timeSpent: 0,
      projectScope: 0, // Players start with no project scope, calculated from W cards
      color: defaultColor,
      avatar: defaultAvatar,
      hand: [], // Start with empty hand - cards drawn from centralized decks
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: [], // Start with no loans
      score: 0, // Initialize score to 0
      moneySources: {
        ownerFunding: 0,
        bankLoans: 0,
        investmentDeals: 0,
        other: 0
      },
      expenditures: {
        design: 0,
        fees: 0,
        construction: 0
      },
      costHistory: [], // Track all costs incurred with details
      costs: {
        bank: 0,
        investor: 0,
        expeditor: 0,
        architectural: 0,
        engineering: 0,
        regulatory: 0,
        investmentFee: 0,
        miscellaneous: 0,
        total: 0
      }
    };
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateShortPlayerId(): string {
    // Generate short player ID based on current player count (P1, P2, P3, etc.)
    const playerNumber = this.currentState.players.length + 1;
    return `P${playerNumber}`;
  }

  private getStartingSpace(): string {
    console.log('🎯 getStartingSpace called');
    console.log('📊 DataService loaded?', this.dataService?.isLoaded());
    
    if (this.dataService && this.dataService.isLoaded()) {
      const gameConfigs = this.dataService.getGameConfig();
      console.log('📋 Game configs loaded:', gameConfigs.length);
      const startingSpace = gameConfigs.find(config => config.is_starting_space);
      console.log('🏁 Found starting space config:', startingSpace);
      if (startingSpace) {
        console.log('✅ Using CSV starting space:', startingSpace.space_name);
        return startingSpace.space_name;
      }
    }
    
    // Updated fallback to use the correct starting space
    console.log('⚠️ Using fallback starting space: OWNER-SCOPE-INITIATION');
    return 'OWNER-SCOPE-INITIATION';
  }

  private getNextAvailableColor(): string {
    const availableColors = [
      colors.game.player1, colors.game.player2, colors.game.player3, colors.game.player8, 
      colors.game.player5, colors.game.player6, colors.game.player7, colors.game.player4
    ];
    const usedColors = this.currentState.players.map(p => p.color).filter(Boolean);
    const available = availableColors.filter(color => !usedColors.includes(color));
    return available.length > 0 ? available[0] : availableColors[0];
  }

  private getNextAvailableAvatar(): string {
    const availableAvatars = [
      '👤', '👨‍💼', '👩‍💼', '👨‍🔧', '👩‍🔧', 
      '👨‍💻', '👩‍💻', '🧑‍🎨', '👨‍🏫', '👩‍🏫'
    ];
    const usedAvatars = this.currentState.players.map(p => p.avatar).filter(Boolean);
    const available = availableAvatars.filter(avatar => !usedAvatars.includes(avatar));
    return available.length > 0 ? available[0] : availableAvatars[0];
  }

  private resolveConflicts(players: Player[]): Player[] {
    const availableColors = [
      colors.game.player1, colors.game.player2, colors.game.player3, colors.game.player8, 
      colors.game.player5, colors.game.player6, colors.game.player7, colors.game.player4
    ];
    const availableAvatars = [
      '👤', '👨‍💼', '👩‍💼', '👨‍🔧', '👩‍🔧', 
      '👨‍💻', '👩‍💻', '🧑‍🎨', '👨‍🏫', '👩‍🏫'
    ];

    const result = [...players];
    const usedColors = new Set<string>();
    const usedAvatars = new Set<string>();

    // First pass: collect unique colors and avatars, resolve conflicts
    for (let i = 0; i < result.length; i++) {
      const player = result[i];
      
      // Handle color conflicts
      if (player.color && usedColors.has(player.color)) {
        // Find next available color
        const availableColor = availableColors.find(color => !usedColors.has(color));
        result[i] = { ...player, color: availableColor || availableColors[i % availableColors.length] };
      } else if (player.color) {
        usedColors.add(player.color);
      }

      // Handle avatar conflicts
      if (player.avatar && usedAvatars.has(player.avatar)) {
        // Find next available avatar
        const availableAvatar = availableAvatars.find(avatar => !usedAvatars.has(avatar));
        result[i] = { ...result[i], avatar: availableAvatar || availableAvatars[i % availableAvatars.length] };
      } else if (player.avatar) {
        usedAvatars.add(player.avatar);
      }
    }

    return result;
  }

  // Negotiation state management
  updateNegotiationState(negotiationState: any): GameState {
    const newState: GameState = {
      ...this.currentState,
      activeNegotiation: negotiationState
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...this.currentState };
  }

  // Utility method to shuffle an array (Fisher-Yates shuffle)
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Action logging methods
  logToActionHistory(actionData: Omit<ActionLogEntry, 'id' | 'timestamp'>): GameState {
    const newEntry: ActionLogEntry = {
      ...actionData,
      id: this.generateActionId(),
      timestamp: new Date()
    };

    const newState: GameState = {
      ...this.currentState,
      globalActionLog: [...this.currentState.globalActionLog, newEntry]
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...this.currentState };
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Dice roll completion methods
  setDiceRollCompletion(message: string): GameState {
    console.log(`🎲 Setting dice roll completion message: ${message}`);

    const newCompletedActions = {
      ...this.currentState.completedActions,
      diceRoll: message
    };

    const newState: GameState = {
      ...this.currentState,
      completedActions: newCompletedActions
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...this.currentState };
  }

  // ============================================================================
  // Server Synchronization Methods
  // ============================================================================

  /**
   * Sync current state to backend server
   * Called automatically after every state update
   * Fails silently if server is unavailable (graceful degradation)
   */
  private async syncToServer(state: GameState): Promise<void> {
    // Skip sync if disabled or already syncing
    if (!this.syncEnabled || this.isSyncing) {
      return;
    }

    // Lazy initialization of server URL
    if (!this.serverUrl) {
      try {
        this.serverUrl = getBackendURL();
      } catch (error) {
        console.warn('Cannot determine backend URL, disabling server sync:', error);
        this.syncEnabled = false;
        return;
      }
    }

    this.isSyncing = true;

    try {
      const response = await fetch(`${this.serverUrl}/api/gamestate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state })
      });

      if (!response.ok) {
        console.warn(`Failed to sync state to server: ${response.status} ${response.statusText}`);
      } else {
        const result = await response.json();
        console.log(`✅ State synced to server (v${result.stateVersion})`);
      }
    } catch (error) {
      // Fail silently - server may not be running (development mode)
      // console.error('Failed to sync state to server:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Load game state from backend server
   * Called on app initialization to restore state across devices
   * Returns true if state was loaded successfully, false otherwise
   */
  async loadStateFromServer(): Promise<boolean> {
    // Lazy initialization of server URL
    if (!this.serverUrl) {
      try {
        this.serverUrl = getBackendURL();
      } catch (error) {
        console.warn('Cannot determine backend URL, skipping server state load:', error);
        return false;
      }
    }

    try {
      console.log('📥 Loading state from server...');
      const response = await fetch(`${this.serverUrl}/api/gamestate`);

      if (response.status === 404) {
        console.log('No server state found, using local state');
        return false;
      }

      if (!response.ok) {
        console.warn(`Failed to load state from server: ${response.status} ${response.statusText}`);
        return false;
      }

      const { state, stateVersion } = await response.json();

      if (state) {
        this.currentState = state;
        // Skip sync when loading from server to avoid syncing back what we just loaded
        this.notifyListeners({ skipSync: true });
        console.log(`✅ State loaded from server (v${stateVersion})`);
        console.log(`   Players: ${state.players?.length || 0}`);
        console.log(`   Phase: ${state.gamePhase || 'UNKNOWN'}`);
        return true;
      }

      return false;
    } catch (error) {
      // Server not available - continue with local state
      console.log('Server not available, using local state');
      return false;
    }
  }

  /**
   * Replace entire state (used by polling mechanism)
   * Does NOT trigger sync (to avoid infinite loops)
   */
  replaceState(newState: GameState): void {
    this.currentState = newState;
    // Skip sync when replacing from server poll to avoid syncing back what we just received
    this.notifyListeners({ skipSync: true });
  }

  /**
   * Enable or disable server synchronization
   * Useful for testing or when server is intentionally offline
   */
  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
    console.log(`Server sync ${enabled ? 'enabled' : 'disabled'}`);
  }
}