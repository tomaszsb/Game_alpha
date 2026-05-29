import { IStateService, IDataService, IGameRulesService } from '../types/ServiceContracts';
import { debugWarn } from '../utils/debugLog';
import {
  GameState,
  Player,
  GamePhase,
  GameMode,
  GameModeSettings,
  Decks,
  DiscardPiles,
  PlayerUpdateData,
  PlayerCards,
  ActiveModal,
  ActionLogEntry,
  // REAL/TEMP State Model Types
  MutablePlayerState,
  PlayerTurnState,
  TurnStateModel,
  TurnCostLedger,
  StateTransitionResult,
  CreateTempOptions,
  NegotiationState
} from '../types/StateTypes';
import { colors } from '../styles/theme';
import { ALL_IMAGE_ROLES, ALL_ETHNICITIES, ALL_GENDERS, NpcAppearance, NpcAppearances, NpcImageRole } from '../constants/characters';
import { Choice } from '../types/CommonTypes';
import { TurnStateManager } from './TurnStateManager';
import { ServerSyncService, StateProvider } from './ServerSyncService';

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
  amount?: number; // Alternative to moneyAmount for seed money events
  success?: boolean; // Whether the action triggered (e.g., dice matched)
  spaceName: string;
  message: string;
  // Movement-specific fields
  fromSpace?: string;
  toSpace?: string;
}

// Selective subscription for optimized re-renders
interface SelectiveListener<T> {
  selector: (state: GameState) => T;
  callback: (selected: T, state: GameState) => void;
  lastValue: T | undefined;
  equalityFn: (a: T, b: T) => boolean;
}

export class StateService implements IStateService {
  private currentState: GameState;
  private readonly dataService: IDataService;
  private gameRulesService?: IGameRulesService; // Setter injection to avoid circular dependency
  private listeners: Array<(state: GameState) => void> = [];

  // Selective listeners - only notified when their selected value changes
  private selectiveListeners: Array<SelectiveListener<unknown>> = [];

  // Auto-action event listeners for modal notifications
  private autoActionListeners: Array<(event: AutoActionEvent) => void> = [];

  // Server synchronization service (extracted Jan 2026)
  private serverSyncService: ServerSyncService;

  // Turn state manager for REAL/TEMP state model (extracted Dec 2025)
  private turnStateManager: TurnStateManager;

  constructor(dataService: IDataService) {
    this.dataService = dataService;
    this.turnStateManager = new TurnStateManager();
    this.currentState = this.createInitialState();

    // Create state provider for server sync
    const stateProvider: StateProvider = {
      getCurrentState: () => this.currentState,
      setCurrentState: (state: GameState, serverVersion?: number) => {
        this.currentState = state;
        if (serverVersion !== undefined) {
          this.serverSyncService.setServerVersion(serverVersion);
        }
        // Skip sync when loading from server to avoid syncing back what we just loaded
        this.notifyListeners({ skipSync: true });
      }
    };
    this.serverSyncService = new ServerSyncService(stateProvider);
  }

  /**
   * Set the GameRulesService after construction to handle circular dependencies
   */
  public setGameRulesService(gameRulesService: IGameRulesService): void {
    this.gameRulesService = gameRulesService;
  }

  /**
   * Assert that GameRulesService is initialized.
   * Note: Some methods have fallbacks, but this ensures full functionality.
   * @throws Error if GameRulesService is not set
   */
  private assertGameRulesServiceReady(): void {
    if (!this.gameRulesService) {
      throw new Error(
        'StateService not fully initialized: GameRulesService not set. ' +
        'Call setGameRulesService() before using condition evaluation methods.'
      );
    }
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
   * Subscribe with a selector - only triggers callback when selected value changes.
   * This reduces unnecessary re-renders by allowing components to specify exactly
   * which parts of state they care about.
   *
   * @param selector Function to extract the relevant part of state
   * @param callback Function called when selected value changes
   * @param equalityFn Optional custom equality function (default: shallow equality)
   * @returns Unsubscribe function
   *
   * @example
   * // Only re-render when currentPlayerId changes
   * stateService.subscribeWithSelector(
   *   state => state.currentPlayerId,
   *   (currentPlayerId) => setCurrentPlayerId(currentPlayerId)
   * );
   *
   * @example
   * // Only re-render when specific player's hand changes
   * stateService.subscribeWithSelector(
   *   state => state.players.find(p => p.id === playerId)?.hand,
   *   (hand) => setHand(hand || []),
   *   (a, b) => JSON.stringify(a) === JSON.stringify(b) // Deep compare arrays
   * );
   */
  subscribeWithSelector<T>(
    selector: (state: GameState) => T,
    callback: (selected: T, state: GameState) => void,
    equalityFn: (a: T, b: T) => boolean = (a, b) => a === b
  ): () => void {
    const listener: SelectiveListener<T> = {
      selector,
      callback,
      lastValue: undefined,
      equalityFn
    };

    // Initialize with current value
    const currentState = this.getGameState();
    listener.lastValue = selector(currentState);

    this.selectiveListeners.push(listener as SelectiveListener<unknown>);

    // Return unsubscribe function
    return () => {
      const index = this.selectiveListeners.indexOf(listener as SelectiveListener<unknown>);
      if (index > -1) {
        this.selectiveListeners.splice(index, 1);
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

    // Notify all full-state subscribers (legacy pattern)
    this.listeners.forEach(callback => {
      try {
        callback(currentStateSnapshot);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });

    // Notify selective subscribers only if their selected value changed
    this.selectiveListeners.forEach(listener => {
      try {
        const newValue = listener.selector(currentStateSnapshot);
        const hasChanged = listener.lastValue === undefined ||
          !listener.equalityFn(listener.lastValue, newValue);

        if (hasChanged) {
          listener.lastValue = newValue;
          listener.callback(newValue, currentStateSnapshot);
        }
      } catch (error) {
        console.error('Error in selective state change listener:', error);
      }
    });

    // Sync to server after notifying listeners (with debouncing)
    // Skip sync if explicitly requested (e.g., when loading from server)
    if (!options.skipSync) {
      this.serverSyncService.debouncedSync();
    }
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
      debugWarn('DataService not loaded yet, using fallback starting space. Consider ensuring data is loaded before adding players.');
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

    // Debug: Log spaceVisitLog updates
    if (playerData.spaceVisitLog) {
    }

    const updatedPlayer: Player = {
      ...currentPlayer,
      ...playerData,
      timeSpent: playerData.timeSpent !== undefined ? playerData.timeSpent : currentPlayer.timeSpent,
      hand: playerData.hand ? [...playerData.hand] : currentPlayer.hand,
      visitedSpaces: playerData.visitedSpaces ? [...playerData.visitedSpaces] : currentPlayer.visitedSpaces,
      spaceVisitLog: playerData.spaceVisitLog ? [...playerData.spaceVisitLog] : currentPlayer.spaceVisitLog
    };

    // Debug: Verify spaceVisitLog was set
    if (playerData.spaceVisitLog) {
    }

    let newPlayers = [...this.currentState.players];
    newPlayers[playerIndex] = updatedPlayer;

    // Handle avatar/color conflicts intelligently
    newPlayers = this.resolveConflicts(newPlayers);

    const newState: GameState = {
      ...this.currentState,
      players: newPlayers
    };

    this.currentState = newState;
    this.notifyListeners(); // Also triggers debounced server sync
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

  /**
   * Start the game with optional game mode settings.
   * @param settings - Optional settings for game mode (Battle Royale or Same Starting Point)
   */
  startGame(settings?: GameModeSettings): GameState {
    if (!this.canStartGame()) {
      throw new Error('Cannot start game: requirements not met');
    }

    const gameMode = settings?.gameMode ?? 'BATTLE_ROYALE';
    const startingMode = settings?.startingMode;
    const preSelectedHand = settings?.startingHand;

    if (gameMode === 'BATTLE_ROYALE') {
      return this.startGameBattleRoyale();
    } else {
      return this.startGameSameStart(startingMode, preSelectedHand);
    }
  }

  /**
   * Start game in Battle Royale mode - shared decks, random draws.
   * This is the default/original game mode.
   */
  private startGameBattleRoyale(): GameState {
    // Initialize shuffled decks for each card type (shared by all players)
    const decks: Decks = {
      W: this.shuffleArray([...this.dataService.getCardsByType('W').map(card => card.card_id)]),
      B: this.shuffleArray([...this.dataService.getCardsByType('B').map(card => card.card_id)]),
      E: this.shuffleArray([...this.dataService.getCardsByType('E').map(card => card.card_id)]),
      L: this.shuffleArray([...this.dataService.getCardsByType('L').map(card => card.card_id)]),
      I: this.shuffleArray([...this.dataService.getCardsByType('I').map(card => card.card_id)])
    };

    // Initialize empty discard piles
    const discardPiles: DiscardPiles = {
      W: [],
      B: [],
      E: [],
      L: [],
      I: []
    };

    const newState: GameState = {
      ...this.currentState,
      gamePhase: 'PLAY',
      gameStartTime: new Date(),
      currentPlayerId: this.currentState.players.length > 0 ? this.currentState.players[0].id : null,
      gameMode: 'BATTLE_ROYALE',
      decks,
      discardPiles,
      npcAppearances: this.randomizeNpcAppearances(),
      isInitialized: false // Game is not fully initialized until players are placed
    };

    this.currentState = newState;

    // Initialize action counts for the first player
    this.updateActionCounts();


    return { ...this.currentState };
  }

  /**
   * Start game in Same Starting Point mode - per-player decks with identical order.
   * All players get the same shuffled deck order using a shared seed.
   */
  private startGameSameStart(startingMode?: 'QUICK_START' | 'EDUCATIONAL', preSelectedHand?: string[]): GameState {
    const seed = Date.now();
    const playerDecks: Record<string, Decks> = {};
    const playerDiscardPiles: Record<string, DiscardPiles> = {};

    // Create identical deck for each player using same seed
    // Each card type uses seed + offset to ensure different but reproducible order per type
    for (const player of this.currentState.players) {
      playerDecks[player.id] = {
        W: this.createSeededDeck('W', seed),
        B: this.createSeededDeck('B', seed + 1),
        E: this.createSeededDeck('E', seed + 2),
        L: this.createSeededDeck('L', seed + 3),
        I: this.createSeededDeck('I', seed + 4)
      };
      playerDiscardPiles[player.id] = { W: [], B: [], E: [], L: [], I: [] };
    }

    // For Educational mode, DON'T give cards at startup - store them for later
    // Cards will be given when player presses draw buttons on OWNER-SCOPE-INITIATION
    const updatedPlayers = [...this.currentState.players];
    if (startingMode === 'EDUCATIONAL' && preSelectedHand && preSelectedHand.length > 0) {
      // Remove pre-selected cards from each player's deck (so they can be given later)
      for (let i = 0; i < updatedPlayers.length; i++) {
        for (const cardId of preSelectedHand) {
          const cardType = this.getCardTypeFromId(cardId);
          if (cardType && playerDecks[updatedPlayers[i].id]) {
            const deck = playerDecks[updatedPlayers[i].id][cardType];
            const cardIndex = deck.indexOf(cardId);
            if (cardIndex !== -1) {
              deck.splice(cardIndex, 1);
            }
          }
        }
      }
    }

    const isQuickStart = startingMode === 'QUICK_START';

    // For Battle Royale compatibility, create empty shared decks
    // (Per-player decks will be used when gameMode is SAME_START)
    const decks: Decks = { W: [], B: [], E: [], L: [], I: [] };
    const discardPiles: DiscardPiles = { W: [], B: [], E: [], L: [], I: [] };

    const newState: GameState = {
      ...this.currentState,
      players: updatedPlayers,
      gamePhase: 'PLAY',
      gameStartTime: new Date(),
      currentPlayerId: this.currentState.players.length > 0 ? this.currentState.players[0].id : null,
      gameMode: 'SAME_START',
      startingMode,
      shuffleSeed: seed,
      playerDecks,
      playerDiscardPiles,
      startingHand: preSelectedHand || [],
      isCapturingStartingHand: isQuickStart,
      decks,
      discardPiles,
      npcAppearances: this.randomizeNpcAppearances(),
      isInitialized: false
    };

    this.currentState = newState;

    // Initialize action counts for the first player
    this.updateActionCounts();

    if (isQuickStart) {
    } else if (startingMode === 'EDUCATIONAL' && preSelectedHand) {
    }

    return { ...this.currentState };
  }

  /**
   * Helper to determine card type from card ID.
   */
  private getCardTypeFromId(cardId: string): 'W' | 'B' | 'E' | 'L' | 'I' | null {
    if (!cardId) return null;
    const firstChar = cardId.charAt(0).toUpperCase();
    if (['W', 'B', 'E', 'L', 'I'].includes(firstChar)) {
      return firstChar as 'W' | 'B' | 'E' | 'L' | 'I';
    }
    return null;
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
      debugWarn('Cannot fix starting spaces: DataService not loaded');
      return { ...this.currentState };
    }

    const correctStartingSpace = this.getStartingSpace();
    
    const updatedPlayers = this.currentState.players.map(player => {
      // Only fix players who are still on the old incorrect starting space
      if (player.currentSpace === 'START-QUICK-PLAY-GUIDE') {
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
    
    return { ...newState };
  }

  // Aggressive method to force reset ALL players to correct starting space
  // This ignores current space and resets everyone
  forceResetAllPlayersToCorrectStartingSpace(): GameState {
    if (!this.dataService || !this.dataService.isLoaded()) {
      debugWarn('Cannot force reset starting spaces: DataService not loaded');
      return { ...this.currentState };
    }

    const correctStartingSpace = this.getStartingSpace();
    
    const updatedPlayers = this.currentState.players.map(player => {
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
    
    return { ...newState };
  }

  setAwaitingChoice(choice: Choice): GameState {

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

  /**
   * Cross-runtime choice-resolution relay (fb:068a66f2).
   *
   * A LOGIC_QUESTION chain's pending promise is created on the device that ran
   * the player's startTurn (the OUTGOING player's device, since startTurn fires
   * inside endTurn→nextPlayer). The answering player's device renders the modal
   * from synced `awaitingChoice` but has no local promise, so resolving locally
   * is impossible. Instead it stamps the selection onto the active choice here;
   * notifyListeners() syncs it to all devices, and the promise-owning device's
   * ChoiceService observes it and resolves (then clears the choice).
   *
   * No-op if there is no active choice or the id doesn't match (stale click).
   */
  setChoiceResolution(choiceId: string, selection: string): GameState {
    const choice = this.currentState.awaitingChoice;
    if (!choice || choice.id !== choiceId) {
      return this.currentState;
    }

    this.currentState = {
      ...this.currentState,
      awaitingChoice: { ...choice, resolvedWith: selection }
    };

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
    const newState: GameState = {
      ...this.currentState,
      hasPlayerMovedThisTurn: false
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...newState };
  }

  clearTurnActions(): GameState {
    const currentPlayerId = this.currentState.currentPlayerId;
    let players = this.currentState.players;
    
    if (currentPlayerId) {
      const playerIndex = players.findIndex(p => p.id === currentPlayerId);
      if (playerIndex !== -1) {
        const updatedPlayer = {
          ...players[playerIndex],
          moveIntent: null
        };
        players = [...players];
        players[playerIndex] = updatedPlayer;
      }
    }

    const newState: GameState = {
      ...this.currentState,
      players,
      // RESET the new object
      completedActions: {
        diceRoll: undefined,
        manualActions: {},
      },
    };

    this.currentState = newState;
    this.updateActionCounts();
    this.notifyListeners();
    return { ...this.currentState };
  }

  clearPlayerMoveIntent(playerId: string): GameState {
    const playerIndex = this.currentState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { ...this.currentState };

    const updatedPlayer = {
      ...this.currentState.players[playerIndex],
      moveIntent: null
    };

    const newPlayers = [...this.currentState.players];
    newPlayers[playerIndex] = updatedPlayer;

    const newState: GameState = {
      ...this.currentState,
      players: newPlayers
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...this.currentState };
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

      // Choice-based movement: the player must explicitly pick a destination
      // before ending the turn. canEndTurn already gates on moveIntent, but the
      // requiredActions counter undercounted by 1 — players saw the End Turn
      // tooltip claim "1 action remaining" while two buttons (the manual effect
      // + the destination prompt) were still visible. Dice movement is already
      // counted via the dice block above; fixed/logic/none don't need player
      // input. fb:feedback-1778642151553-ffff07e2.
      if (movement?.movement_type === 'choice') {
        availableTypes.push('movement_choice');
        required++;
        if (player.moveIntent) {
          completed++;
        }
      }

      // Filter effects by condition (e.g., scope_le_4M, scope_gt_4M)
      const conditionFilteredEffects = spaceEffects.filter(effect =>
        this.evaluateSpaceEffectCondition(effect.condition, player)
      );

      const manualEffects = conditionFilteredEffects.filter(effect => effect.trigger_type === 'manual');

      // Count manual effects (require separate player action)
      // Exclude 'turn' effects since they duplicate the regular End Turn button
      // Exclude 'dice' effects since they're handled by the dice required check above
      const countableManualEffects = manualEffects.filter(effect =>
        effect.effect_type !== 'turn' && effect.effect_type !== 'dice'
      );

      countableManualEffects.forEach(effect => {
        // Generic handling for ALL manual effect types
        const actionType = `${effect.effect_type}_manual`;
        if (!availableTypes.includes(actionType)) {
          availableTypes.push(actionType);
        }
        required++;

        // Match by compound key (cards:draw_b) or effect action (draw_b)
        // DO NOT match by simple key (cards) as it causes all same-type effects to appear completed
        const compoundKey = `${effect.effect_type}:${effect.effect_action}`;
        const completedKeys = Object.keys(this.currentState.completedActions.manualActions);

        // 1. Direct match by compound key or effect action
        const compoundMatch = this.currentState.completedActions.manualActions[compoundKey];
        const actionMatch = this.currentState.completedActions.manualActions[effect.effect_action];

        // 2. Case-insensitive match for compound key or effect action
        const caseMatch = completedKeys.some(key =>
          key.toLowerCase() === compoundKey.toLowerCase() ||
          key.toLowerCase() === (effect.effect_action || '').toLowerCase()
        );

        // 3. Description match (fallback)
        const descMatch = Object.values(this.currentState.completedActions.manualActions).some(val =>
          val === effect.description || val === compoundKey
        );

        const isCompleted = !!(compoundMatch || actionMatch || caseMatch || descMatch);

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
    debugWarn('GameRulesService not set in StateService, using fallback condition evaluation');
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
  // Implementation extracted to TurnStateManager for better separation of concerns.
  // These methods delegate to the TurnStateManager while keeping the public API.
  // ============================================================================

  /**
   * Sync turn state model between StateService and TurnStateManager.
   * Called before operations that need the manager's state.
   */
  private syncTurnStateToManager(): void {
    this.turnStateManager.setTurnStateModel(this.currentState.turnStateModel);
  }

  /**
   * Sync turn state model from TurnStateManager back to StateService.
   * Called after operations that modify the manager's state.
   */
  private syncTurnStateFromManager(): void {
    this.currentState = {
      ...this.currentState,
      turnStateModel: this.turnStateManager.getTurnStateModel()
    };
  }

  /**
   * Create a TEMP state from REAL state for a player.
   * Called at the start of a player's turn.
   */
  public createTempStateFromReal(options: CreateTempOptions): StateTransitionResult {
    const player = this.getPlayer(options.playerId);
    if (!player) {
      return { success: false, error: `Player ${options.playerId} not found` };
    }

    this.syncTurnStateToManager();

    // For Try Again scenarios, we need to restore player state from REAL before creating new TEMP
    // This is because updateTempState also updates main player state for UI feedback,
    // so the player's main state has the turn's changes that need to be reverted
    if (options.isTryAgain) {
      const realState = this.turnStateManager.getRealState(options.playerId);
      if (realState) {

        this.updatePlayer({
          id: options.playerId,
          hand: [...realState.state.hand],
          money: realState.state.money,
          timeSpent: realState.state.timeSpent,
          projectScope: realState.state.projectScope,
          score: realState.state.score,
          activeCards: [...realState.state.activeCards],
          loans: [...realState.state.loans],
          moneySources: { ...realState.state.moneySources },
          expenditures: { ...realState.state.expenditures },
          costHistory: [...realState.state.costHistory],
          costs: { ...realState.state.costs },
          fundingHistory: [...realState.state.fundingHistory],
          activeEffects: [...realState.state.activeEffects],
        });
      }
    }

    // Fresh turn (not a Try Again retry) — start with an empty ledger.
    // Try Again retries intentionally preserve the ledger so outflows from
    // the prior attempt remain sticky.
    if (!options.isTryAgain) {
      this.turnStateManager.resetTurnOutflow(options.playerId);
    }

    const result = this.turnStateManager.createTempStateFromReal(
      options,
      player,
      this.currentState.globalTurnCount
    );
    this.syncTurnStateFromManager();

    return result;
  }

  // ============================================================================
  // Cost ledger passthroughs (Workstream 2 — Beta Try Again semantics)
  // ============================================================================

  /**
   * Record an outflow for the player's current turn. Player-initiated
   * spends/card-plays call this so the cost sticks across Try Again.
   */
  public recordTurnOutflow(
    playerId: string,
    entry: { moneySpent?: number; cardConsumed?: string; lifeEventDrawn?: string }
  ): void {
    this.syncTurnStateToManager();
    this.turnStateManager.recordTurnOutflow(playerId, entry);
    this.syncTurnStateFromManager();
  }

  /**
   * Read the accumulated outflow ledger for a player's current turn.
   */
  public getTurnOutflow(playerId: string): TurnCostLedger {
    this.syncTurnStateToManager();
    return this.turnStateManager.getTurnOutflow(playerId);
  }

  /**
   * Get the REAL (turn-start) state for a player, if one exists.
   * Returns null when the player is between turns or has never been active.
   */
  public getRealPlayerState(playerId: string): MutablePlayerState | null {
    this.syncTurnStateToManager();
    const real = this.turnStateManager.getRealState(playerId);
    return real?.state ?? null;
  }

  /**
   * Commit TEMP state to REAL state for a player.
   * Called at the end of a player's turn.
   */
  public commitTempToReal(playerId: string): StateTransitionResult {
    this.syncTurnStateToManager();
    // Ledger is per-turn — committing a turn retires the ledger.
    this.turnStateManager.resetTurnOutflow(playerId);
    const result = this.turnStateManager.commitTempToReal(playerId);
    this.syncTurnStateFromManager();

    // Also update the player in main state to reflect committed changes
    if (result.success && result.committedState) {
      const playerIndex = this.currentState.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const currentPlayer = this.currentState.players[playerIndex];
        const committedState = result.committedState;

        // IMPORTANT: Preserve movement-related properties that are updated outside TEMP state
        // These are set by MovementService and should NOT be overwritten by committedState
        const updatedPlayer = {
          ...currentPlayer,
          ...committedState,
          // Preserve movement-related state (updated by MovementService, not TEMP state)
          currentSpace: currentPlayer.currentSpace,
          visitType: currentPlayer.visitType,
          visitedSpaces: currentPlayer.visitedSpaces,
          spaceVisitLog: currentPlayer.spaceVisitLog,
          moveIntent: currentPlayer.moveIntent,
          pathChoiceMemory: currentPlayer.pathChoiceMemory
        };
        const newPlayers = [...this.currentState.players];
        newPlayers[playerIndex] = updatedPlayer;
        this.currentState = {
          ...this.currentState,
          players: newPlayers
        };
      }
    }

    this.notifyListeners();
    return result;
  }

  /**
   * Discard TEMP state for a player (used in Try Again flow).
   * Also restores the player's main state from REAL to undo any changes made during the turn.
   */
  public discardTempState(playerId: string): StateTransitionResult {
    this.syncTurnStateToManager();

    // Get REAL state BEFORE discarding TEMP - this is what we need to restore the player to
    const realState = this.turnStateManager.getRealState(playerId);

    const result = this.turnStateManager.discardTempState(playerId);
    this.syncTurnStateFromManager();

    // Restore player's main state from REAL state
    // This is critical because updateTempState also updates main player state for UI feedback
    // Without this, the player would keep cards/money/etc from the failed attempt
    if (result.success && realState) {
      const currentHand = this.getPlayer(playerId)?.hand.length ?? 0;

      this.updatePlayer({
        id: playerId,
        hand: [...realState.state.hand],
        money: realState.state.money,
        timeSpent: realState.state.timeSpent,
        projectScope: realState.state.projectScope,
        score: realState.state.score,
        activeCards: [...realState.state.activeCards],
        loans: [...realState.state.loans],
        moneySources: { ...realState.state.moneySources },
        expenditures: { ...realState.state.expenditures },
        costHistory: [...realState.state.costHistory],
        costs: { ...realState.state.costs },
        fundingHistory: [...realState.state.fundingHistory],
        activeEffects: [...realState.state.activeEffects],
      });
      this.updateActionCounts();
    }

    return result;
  }

  /**
   * Apply changes directly to REAL state (bypasses TEMP).
   * Used for Try Again time penalties that should persist across retries.
   */
  public applyToRealState(playerId: string, changes: Partial<MutablePlayerState>): StateTransitionResult {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: `Player ${playerId} not found` };
    }

    this.syncTurnStateToManager();
    const result = this.turnStateManager.applyToRealState(
      playerId,
      player,
      changes,
      this.currentState.globalTurnCount
    );
    this.syncTurnStateFromManager();

    return result;
  }

  /**
   * Get the effective player state (reads from TEMP during turn, REAL otherwise).
   */
  public getEffectivePlayerState(playerId: string): MutablePlayerState | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    this.syncTurnStateToManager();
    return this.turnStateManager.getEffectivePlayerState(playerId, player);
  }

  /**
   * Check if a player has an active TEMP state (i.e., is in the middle of their turn).
   */
  public hasActiveTempState(playerId: string): boolean {
    this.syncTurnStateToManager();
    return this.turnStateManager.hasActiveTempState(playerId);
  }

  /**
   * Get the Try Again count for a player in the current turn.
   */
  public getTryAgainCount(playerId: string): number {
    this.syncTurnStateToManager();
    return this.turnStateManager.getTryAgainCount(playerId);
  }

  /**
   * Update the TEMP state for a player (if active) or main player state.
   */
  public updateTempState(playerId: string, changes: Partial<MutablePlayerState>): StateTransitionResult {
    this.syncTurnStateToManager();
    const result = this.turnStateManager.updateTempState(playerId, changes);
    this.syncTurnStateFromManager();

    // Also update the main player state for immediate UI feedback
    if (result.updatedState) {
      this.updatePlayer({ id: playerId, ...changes });
    } else if (!this.turnStateManager.hasActiveTempState(playerId)) {
      // No TEMP state - fall back to updating main player state
      this.updatePlayer({ id: playerId, ...changes });
    }

    return result;
  }

  setGameState(newState: GameState): GameState {
    this.currentState = newState;
    this.notifyListeners();
    return this.currentState;
  }

  updateGameState(stateChanges: Partial<GameState>): GameState {
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
      },
      // Game mode - defaults to Battle Royale (shared decks)
      gameMode: 'BATTLE_ROYALE'
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
      fundingHistory: [], // Track all funding received with details
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
    if (this.dataService && this.dataService.isLoaded()) {
      const gameConfigs = this.dataService.getGameConfig();
      const startingSpaces = gameConfigs.filter(config => config.is_starting_space);

      // Workstream 6 follow-up: runtime defense against malformed data.
      // Build-time test in processGameData.test.ts already asserts exactly one
      // starting space on real source data. This warns if production CLEAN_FILES
      // ever drift out of sync (e.g. hand-edited on the server).
      if (startingSpaces.length === 0) {
        console.warn(
          '⚠️ No space flagged is_starting_space=Yes in GAME_CONFIG. ' +
          'Falling back to legacy default \'OWNER-SCOPE-INITIATION\'.'
        );
      } else if (startingSpaces.length > 1) {
        console.warn(
          `⚠️ Multiple spaces flagged is_starting_space=Yes (${startingSpaces.length}: ` +
          `${startingSpaces.map(s => s.space_name).join(', ')}). ` +
          `Using first match: ${startingSpaces[0].space_name}.`
        );
      }

      if (startingSpaces[0]) {
        return startingSpaces[0].space_name;
      }
    }

    // Legacy fallback when DataService isn't loaded (race during init).
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
  updateNegotiationState(negotiationState: NegotiationState | null): GameState {
    const newState: GameState = {
      ...this.currentState,
      activeNegotiation: negotiationState
    };

    this.currentState = newState;
    this.notifyListeners();
    return { ...this.currentState };
  }

  // Utility method to shuffle an array (Fisher-Yates shuffle)
  /**
   * Generate random NPC appearances — one per image role.
   * Builds a pool of 8 combos (4 ethnicities × 2 genders), shuffles,
   * then assigns round-robin to the 9 roles.
   */
  private randomizeNpcAppearances(): NpcAppearances {
    const pool: NpcAppearance[] = [];
    for (const ethnicity of ALL_ETHNICITIES) {
      for (const gender of ALL_GENDERS) {
        pool.push({ ethnicity, gender });
      }
    }
    const shuffled = this.shuffleArray(pool);

    const appearances = {} as NpcAppearances;
    ALL_IMAGE_ROLES.forEach((role, i) => {
      appearances[role] = shuffled[i % shuffled.length];
    });
    return appearances;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Seeded shuffle - produces deterministic order based on seed.
   * Used for Same Starting Point mode to give all players identical deck order.
   * Uses Linear Congruential Generator (LCG) for reproducible random numbers.
   */
  private seededShuffle<T>(array: T[], seed: number): T[] {
    const shuffled = [...array];
    let currentSeed = seed;

    // Simple LCG for deterministic shuffle
    const random = () => {
      currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
      return currentSeed / 4294967296;
    };

    // Fisher-Yates shuffle with seeded random
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Create a shuffled deck for a specific card type using a seed.
   */
  private createSeededDeck(cardType: 'W' | 'B' | 'E' | 'L' | 'I', seed: number): string[] {
    const cards = this.dataService.getCardsByType(cardType).map(card => card.card_id);
    return this.seededShuffle(cards, seed);
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
  // Server Synchronization Methods (delegated to ServerSyncService)
  // ============================================================================

  /**
   * Load game state from backend server
   * Called on app initialization to restore state across devices
   * Returns true if state was loaded successfully, false otherwise
   */
  async loadStateFromServer(): Promise<boolean> {
    return this.serverSyncService.loadFromServer();
  }

  /**
   * Replace entire state (used by polling mechanism)
   * Does NOT trigger sync (to avoid infinite loops)
   * @param newState - The new state to replace with
   * @param serverVersion - Optional server version to track
   */
  replaceState(newState: GameState, serverVersion?: number): void {
    // Reject stale server updates - only accept if version is actually newer
    // This prevents race conditions where polling returns old state during Try Again
    if (serverVersion !== undefined) {
      const currentKnownVersion = this.serverSyncService.getServerVersion();
      if (serverVersion <= currentKnownVersion) {
        return;
      }
      this.serverSyncService.setServerVersion(serverVersion);
    }
    this.currentState = newState;
    // Skip sync when replacing from server poll to avoid syncing back what we just received
    this.notifyListeners({ skipSync: true });
  }

  /**
   * Enable or disable server synchronization
   * Useful for testing or when server is intentionally offline
   */
  setSyncEnabled(enabled: boolean): void {
    this.serverSyncService.setSyncEnabled(enabled);
  }

  /**
   * Connect WebSocket for real-time state updates
   * Call this after initial state load to enable real-time sync
   */
  connectWebSocket(): void {
    this.serverSyncService.connectWebSocket();
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    this.serverSyncService.disconnectWebSocket();
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.serverSyncService.isWebSocketConnected();
  }
}
