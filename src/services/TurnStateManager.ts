// src/services/TurnStateManager.ts
// Extracted from StateService - manages REAL/TEMP state model for Try Again functionality

import {
  Player,
  MutablePlayerState,
  PlayerTurnState,
  TurnStateModel,
  StateTransitionResult,
  CreateTempOptions
} from '../types/StateTypes';

/**
 * TurnStateManager handles the REAL/TEMP state model that enables Try Again functionality.
 *
 * The state model separates "committed" state (REAL) from "working" state (TEMP).
 * All turn effects apply to TEMP state; REAL state only updates on turn boundaries.
 *
 * Flow:
 * 1. Turn starts → createTempStateFromReal()
 * 2. All effects → updateTempState()
 * 3. UI renders → getEffectivePlayerState() [reads from TEMP during turn]
 * 4. On Try Again: applyToRealState(penalty) → discardTempState() → createTempStateFromReal()
 * 5. On End Turn: commitTempToReal()
 */
export class TurnStateManager {
  private turnStateModel: TurnStateModel;

  constructor() {
    this.turnStateModel = {
      realStates: {},
      tempStates: {},
      activeTurnPlayers: [],
      tryAgainCounts: {}
    };
  }

  /**
   * Initialize or reset the turn state model.
   */
  public initialize(): void {
    this.turnStateModel = {
      realStates: {},
      tempStates: {},
      activeTurnPlayers: [],
      tryAgainCounts: {}
    };
  }

  /**
   * Get the current turn state model (for state persistence).
   */
  public getTurnStateModel(): TurnStateModel {
    return { ...this.turnStateModel };
  }

  /**
   * Set the turn state model (for state restoration).
   */
  public setTurnStateModel(model: TurnStateModel | undefined): void {
    if (model) {
      this.turnStateModel = { ...model };
    } else {
      this.initialize();
    }
  }

  /**
   * Extract mutable state from a Player object.
   * Creates a snapshot of the fields that can change during a turn.
   */
  public extractMutableState(player: Player): MutablePlayerState {
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
      fundingHistory: player.fundingHistory ? [...player.fundingHistory] : [],
      activeEffects: player.activeEffects ? [...player.activeEffects] : [],
      spaceVisitLog: player.spaceVisitLog ? [...player.spaceVisitLog] : [],
      lastDiceRoll: player.lastDiceRoll ? { ...player.lastDiceRoll } : undefined
    };
  }

  /**
   * Create a TEMP state from REAL state for a player.
   * Called at the start of a player's turn.
   *
   * @param options - Configuration for creating temp state
   * @param player - The player object
   * @param globalTurnCount - Current global turn count
   * @returns StateTransitionResult with success status and new temp state
   */
  public createTempStateFromReal(
    options: CreateTempOptions,
    player: Player,
    globalTurnCount: number
  ): StateTransitionResult {
    const { playerId, spaceName, visitType, isTryAgain = false, tryAgainPenalty = 0 } = options;

    console.log(`🔄 Creating TEMP state from REAL for player ${playerId} at ${spaceName} (Try Again: ${isTryAgain})`);

    // If Try Again, first apply penalty to REAL state
    if (isTryAgain && tryAgainPenalty > 0) {
      const penaltyResult = this.applyToRealState(playerId, player, { timeSpent: tryAgainPenalty }, globalTurnCount);
      if (!penaltyResult.success) {
        return penaltyResult;
      }
    }

    // Get the source state - either existing REAL or current player state
    const realState = this.turnStateModel.realStates[playerId];
    const sourceState: MutablePlayerState = realState?.state
      ? { ...realState.state }
      : this.extractMutableState(player);

    // Create new TEMP state from REAL
    const newTempState: PlayerTurnState = {
      playerId,
      playerName: player.name,
      state: { ...sourceState },
      capturedAt: {
        turnNumber: globalTurnCount,
        spaceName,
        visitType,
        timestamp: new Date()
      }
    };

    // Update turn state model
    this.turnStateModel = {
      ...this.turnStateModel,
      tempStates: {
        ...this.turnStateModel.tempStates,
        [playerId]: newTempState
      },
      activeTurnPlayers: this.turnStateModel.activeTurnPlayers.includes(playerId)
        ? this.turnStateModel.activeTurnPlayers
        : [...this.turnStateModel.activeTurnPlayers, playerId],
      tryAgainCounts: isTryAgain
        ? { ...this.turnStateModel.tryAgainCounts, [playerId]: (this.turnStateModel.tryAgainCounts[playerId] || 0) + 1 }
        : this.turnStateModel.tryAgainCounts
    };

    console.log(`✅ TEMP state created for player ${playerId} (Try Again count: ${this.turnStateModel.tryAgainCounts[playerId] || 0})`);

    return {
      success: true,
      newTempState,
      timePenaltyApplied: isTryAgain ? tryAgainPenalty : undefined
    };
  }

  /**
   * Commit TEMP state to REAL state for a player.
   * Called at the end of a player's turn.
   *
   * @returns The committed state for updating the main player state
   */
  public commitTempToReal(playerId: string): StateTransitionResult & { committedState?: MutablePlayerState } {
    console.log(`💾 Committing TEMP state to REAL for player ${playerId}`);

    const tempState = this.turnStateModel.tempStates[playerId];
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
    this.turnStateModel = {
      ...this.turnStateModel,
      realStates: {
        ...this.turnStateModel.realStates,
        [playerId]: newRealState
      },
      tempStates: {
        ...this.turnStateModel.tempStates,
        [playerId]: null as any // Clear TEMP state
      },
      activeTurnPlayers: this.turnStateModel.activeTurnPlayers.filter(id => id !== playerId),
      tryAgainCounts: {
        ...this.turnStateModel.tryAgainCounts,
        [playerId]: 0 // Reset Try Again count
      }
    };

    console.log(`✅ TEMP state committed to REAL for player ${playerId}`);

    return {
      success: true,
      newRealState,
      committedState: { ...tempState.state }
    };
  }

  /**
   * Discard TEMP state for a player (used in Try Again flow).
   * After calling this, createTempStateFromReal should be called to create a fresh TEMP.
   */
  public discardTempState(playerId: string): StateTransitionResult {
    console.log(`🗑️ Discarding TEMP state for player ${playerId}`);

    const tempState = this.turnStateModel.tempStates[playerId];
    if (!tempState) {
      console.log(`ℹ️ No TEMP state to discard for player ${playerId}`);
      return { success: true }; // Not an error - just nothing to discard
    }

    // Clear TEMP state
    this.turnStateModel = {
      ...this.turnStateModel,
      tempStates: {
        ...this.turnStateModel.tempStates,
        [playerId]: null as any
      }
    };

    console.log(`✅ TEMP state discarded for player ${playerId}`);
    return { success: true };
  }

  /**
   * Apply changes directly to REAL state (bypasses TEMP).
   * Used for Try Again time penalties that should persist across retries.
   */
  public applyToRealState(
    playerId: string,
    player: Player,
    changes: Partial<MutablePlayerState>,
    globalTurnCount: number
  ): StateTransitionResult {
    console.log(`📝 Applying changes to REAL state for player ${playerId}:`, changes);

    // Get existing REAL state or create from current player
    const existingReal = this.turnStateModel.realStates[playerId];
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
        turnNumber: globalTurnCount,
        spaceName: player.currentSpace,
        visitType: player.visitType,
        timestamp: new Date()
      }
    };

    // Update turn state model
    this.turnStateModel = {
      ...this.turnStateModel,
      realStates: {
        ...this.turnStateModel.realStates,
        [playerId]: newRealState
      }
    };

    console.log(`✅ Changes applied to REAL state for player ${playerId}`);
    return { success: true, newRealState };
  }

  /**
   * Get the effective player state (reads from TEMP during turn, REAL otherwise).
   * This is the state that should be used for UI rendering and effect calculations.
   */
  public getEffectivePlayerState(playerId: string, player: Player): MutablePlayerState | null {
    if (!player) return null;

    // If player has active TEMP, use TEMP
    const tempState = this.turnStateModel.tempStates[playerId];
    if (tempState) {
      return { ...tempState.state };
    }

    // Fall back to REAL if no TEMP
    const realState = this.turnStateModel.realStates[playerId];
    if (realState) {
      return { ...realState.state };
    }

    // Fall back to extracting from player object
    return this.extractMutableState(player);
  }

  /**
   * Check if a player has an active TEMP state (i.e., is in the middle of their turn).
   */
  public hasActiveTempState(playerId: string): boolean {
    return !!(this.turnStateModel.tempStates[playerId]);
  }

  /**
   * Get the Try Again count for a player in the current turn.
   */
  public getTryAgainCount(playerId: string): number {
    return this.turnStateModel.tryAgainCounts[playerId] || 0;
  }

  /**
   * Update the TEMP state for a player.
   * Returns the updated state for syncing with main player state.
   */
  public updateTempState(playerId: string, changes: Partial<MutablePlayerState>): StateTransitionResult & { updatedState?: MutablePlayerState } {
    const tempState = this.turnStateModel.tempStates[playerId];

    if (!tempState) {
      // No TEMP state - caller should update main player state directly
      console.log(`ℹ️ No TEMP state for player ${playerId}, update main state instead`);
      return { success: true, updatedState: undefined };
    }

    const updatedState: MutablePlayerState = {
      ...tempState.state,
      ...changes
    };

    const newTempState: PlayerTurnState = {
      ...tempState,
      state: updatedState
    };

    this.turnStateModel = {
      ...this.turnStateModel,
      tempStates: {
        ...this.turnStateModel.tempStates,
        [playerId]: newTempState
      }
    };

    return { success: true, newTempState, updatedState };
  }

  /**
   * Get the TEMP state for a player (if exists).
   */
  public getTempState(playerId: string): PlayerTurnState | null {
    return this.turnStateModel.tempStates[playerId] || null;
  }

  /**
   * Get the REAL state for a player (if exists).
   */
  public getRealState(playerId: string): PlayerTurnState | null {
    return this.turnStateModel.realStates[playerId] || null;
  }
}
