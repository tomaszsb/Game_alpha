import { IStateService, IDataService, IGameRulesService } from '../types/ServiceContracts';
import {
  GameState,
  Player,
  GamePhase,
  PlayerUpdateData,
  PlayerCards,
  ActiveModal,
  ActionLogEntry
} from '../types/StateTypes';
import { colors } from '../styles/theme';
import { Choice } from '../types/CommonTypes';
import { getBackendURL } from '../utils/networkDetection';

export class StateService implements IStateService {
  private currentState: GameState;
  private readonly dataService: IDataService;
  private gameRulesService?: IGameRulesService; // Setter injection to avoid circular dependency
  private listeners: Array<(state: GameState) => void> = [];

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
    console.log(`🎯 Recording completed manual action: ${effectType}`);
    const newCompletedActions = {
      ...this.currentState.completedActions,
      manualActions: {
        ...this.currentState.completedActions.manualActions,
        [effectType]: message,
      },
    };

    const newState: GameState = {
      ...this.currentState,
      completedActions: newCompletedActions,
    };

    this.currentState = newState;
    this.updateActionCounts(); // This remains the same
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
      // Check if dice roll is required for this space
      const spaceConfig = this.dataService.getGameConfigBySpace(player.currentSpace);
      const requiresDiceRoll = spaceConfig?.requires_dice_roll ?? true; // Default to true if not specified

      if (requiresDiceRoll) {
        availableTypes.push('dice');
        required++;
        // Check if dice has been rolled
        if (this.currentState.hasPlayerRolledDice) {
          completed++;
        }
      }

      // Check for space effects on this space
      const spaceEffects = this.dataService.getSpaceEffects(player.currentSpace, player.visitType);

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
      const countableManualEffects = manualEffects.filter(effect => effect.effect_type !== 'turn');
      countableManualEffects.forEach(effect => {
        // Generic handling for ALL manual effect types
        const actionType = `${effect.effect_type}_manual`;
        if (!availableTypes.includes(actionType)) {
          availableTypes.push(actionType);
        }
        required++;

        // Check if this specific manual action has been completed
        // Support both simple keys ("cards") and compound keys ("cards:draw_b")
        const simpleKey = effect.effect_type;
        const compoundKey = `${effect.effect_type}:${effect.effect_action}`;
        const isCompleted = !!(
          this.currentState.completedActions.manualActions[simpleKey] ||
          this.currentState.completedActions.manualActions[compoundKey]
        );
        if (isCompleted) {
          completed++;
        }
        console.log(`  🎯 Manual effect ${effect.effect_type}: ${isCompleted ? 'completed' : 'pending'}`);
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

  // Global game state snapshot methods for "Try Again" feature
  savePreSpaceEffectSnapshot(playerId: string, spaceName: string): GameState {
    console.log(`📸 Saving snapshot for player ${playerId} at space ${spaceName}`);

    // Create a deep copy of the current game state
    const currentState = this.getGameStateDeepCopy();

    // Save the snapshot with clean player snapshots (avoid circular references)
    const snapshotState: GameState = {
      ...currentState,
      playerSnapshots: {} // Don't include nested snapshots
    };

    const newState: GameState = {
      ...this.currentState,
      playerSnapshots: {
        ...this.currentState.playerSnapshots,
        [playerId]: {
          spaceName: spaceName,
          gameState: snapshotState
        }
      }
    };

    this.currentState = newState;
    this.notifyListeners();

    console.log(`✅ Snapshot saved for player ${playerId} at space ${spaceName}`);
    return newState;
  }

  restorePreSpaceEffectSnapshot(): GameState {
    console.warn('⚠️ restorePreSpaceEffectSnapshot() is deprecated - use TurnService.tryAgainOnSpace() instead');
    // This method is no longer used since TurnService handles restoration with the new multi-player system
    return this.currentState;
  }

  clearPreSpaceEffectSnapshot(): GameState {
    console.log('🗑️ Clearing all player snapshots');

    const newState: GameState = {
      ...this.currentState,
      playerSnapshots: {}
    };

    this.currentState = newState;
    this.notifyListeners();

    return newState;
  }

  clearPlayerSnapshot(playerId: string): GameState {
    console.log(`🗑️ Clearing snapshot for player ${playerId}`);

    const newState: GameState = {
      ...this.currentState,
      playerSnapshots: {
        ...this.currentState.playerSnapshots,
        [playerId]: null
      }
    };

    this.currentState = newState;
    this.notifyListeners();

    return newState;
  }

  hasPreSpaceEffectSnapshot(playerId: string, spaceName: string): boolean {
    const playerSnapshot = this.currentState.playerSnapshots[playerId];
    return playerSnapshot !== null &&
           playerSnapshot !== undefined &&
           playerSnapshot.spaceName === spaceName;
  }

  getPreSpaceEffectSnapshot(): GameState | null {
    // This method is used by TurnService.tryAgainOnSpace to get the snapshot
    // We need to determine which player's snapshot to return based on current context
    // For now, return null - the TurnService should be updated to use a player-specific method
    console.warn('⚠️ getPreSpaceEffectSnapshot() called without player context - use getPlayerSnapshot() instead');
    return null;
  }

  getPlayerSnapshot(playerId: string): GameState | null {
    const playerSnapshot = this.currentState.playerSnapshots[playerId];
    return playerSnapshot?.gameState || null;
  }

  /**
   * Revert a specific player to their saved snapshot state
   * This is an atomic state operation that handles all the complexity of state reversion
   * @param playerId - The ID of the player to revert
   * @returns The updated game state
   * @throws Error if no snapshot exists for the player
   */
  public revertPlayerToSnapshot(playerId: string, timePenalty: number = 0): GameState {
    console.log(`🔄 Reverting player ${playerId} to snapshot state with ${timePenalty} time penalty`);

    // 1. Perform validation: Ensure a snapshot exists for the given playerId
    const playerSnapshot = this.currentState.playerSnapshots[playerId];
    if (!playerSnapshot || !playerSnapshot.gameState) {
      throw new Error(`No snapshot exists for player ${playerId}`);
    }

    // 2. Get the snapshot state
    const snapshotState = playerSnapshot.gameState;

    // 3. Find the snapshotPlayerState from the snapshot's players array
    const snapshotPlayerState = snapshotState.players.find(p => p.id === playerId);
    if (!snapshotPlayerState) {
      throw new Error(`Player ${playerId} not found in snapshot state`);
    }

    // 4. Create a newPlayers array by mapping over the current state's players array
    const newPlayers = this.currentState.players.map(player => {
      // 5. If player's ID matches playerId, replace with snapshotPlayerState + time penalty, otherwise keep current
      if (player.id === playerId) {
        return {
          ...snapshotPlayerState,
          timeSpent: snapshotPlayerState.timeSpent + timePenalty,
          // CRITICAL: Preserve visitedSpaces from current state to prevent "First visit" loops
          // Try Again should revert position/state but not "unvisit" spaces the player has been to
          visitedSpaces: player.visitedSpaces
        };
      } else {
        return { ...player };
      }
    });

    // 6. Create a newState object by spreading this.currentState
    const newState: GameState = {
      ...this.currentState,
      // 7. Update with the newPlayers array
      players: newPlayers,
      // 8. Crucially, reset all turn-specific action flags
      hasPlayerRolledDice: false,
      hasPlayerMovedThisTurn: false,
      completedActionCount: 0,
      completedActions: {
        diceRoll: undefined,
        manualActions: {}
      },
      requiredActions: 1
    };

    // 9. Set this.currentState = newState
    this.currentState = newState;

    // 10. Recalculate action counts for the reverted player
    // This ensures requiredActions is properly set based on the current space
    // (not just hardcoded to 1 from line 920)
    this.updateActionCounts();

    // 11. Call this.notifyListeners()
    this.notifyListeners();

    console.log(`✅ Player ${playerId} reverted to snapshot state`);

    // 12. Return the new state
    return newState;
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