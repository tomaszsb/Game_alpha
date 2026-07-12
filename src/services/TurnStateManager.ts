// src/services/TurnStateManager.ts
// Extracted from StateService - manages REAL/TEMP state model for Try Again functionality

import {
  Player,
  MutablePlayerState,
  PlayerTurnState,
  TurnStateModel,
  TurnCostLedger,
  StateTransitionResult,
  CreateTempOptions
} from '../types/StateTypes';
import { debugLog } from '../utils/debugLog';

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
      tryAgainCounts: {},
      costLedgers: {}
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
      tryAgainCounts: {},
      costLedgers: {}
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
      lastDiceRoll: player.lastDiceRoll ? { ...player.lastDiceRoll } : undefined,
      dobApprovalStatus: player.dobApprovalStatus,
      fdnyApprovalStatus: player.fdnyApprovalStatus,
      dobApprovedDestinations: player.dobApprovedDestinations ? [...player.dobApprovedDestinations] : undefined,
      fdnyApprovedDestinations: player.fdnyApprovedDestinations ? [...player.fdnyApprovedDestinations] : undefined
    };
  }

  /**
   * v3.0.41 — deep-clone a MutablePlayerState. Same field-by-field copy
   * `extractMutableState` does, but the input is an existing state rather
   * than a live Player. Used at every site that previously did
   * `{ ...realState.state }` (a shallow spread that shared nested array
   * references — fragile because any downstream `.push()` would leak back
   * into the source snapshot and corrupt Try Again rollback).
   *
   * No live regression today (the 1550-passing test suite confirms
   * services consistently replace arrays rather than mutate in place),
   * but this closes the foot-gun.
   */
  private cloneMutableState(state: MutablePlayerState): MutablePlayerState {
    return {
      money: state.money,
      timeSpent: state.timeSpent,
      projectScope: state.projectScope,
      score: state.score,
      hand: [...state.hand],
      activeCards: [...state.activeCards],
      loans: state.loans ? [...state.loans] : [],
      moneySources: { ...state.moneySources },
      expenditures: { ...state.expenditures },
      costHistory: state.costHistory ? [...state.costHistory] : [],
      costs: { ...state.costs },
      fundingHistory: state.fundingHistory ? [...state.fundingHistory] : [],
      activeEffects: state.activeEffects ? [...state.activeEffects] : [],
      spaceVisitLog: state.spaceVisitLog ? [...state.spaceVisitLog] : [],
      lastDiceRoll: state.lastDiceRoll ? { ...state.lastDiceRoll } : undefined,
      dobApprovalStatus: state.dobApprovalStatus,
      fdnyApprovalStatus: state.fdnyApprovalStatus,
      dobApprovedDestinations: state.dobApprovedDestinations ? [...state.dobApprovedDestinations] : undefined,
      fdnyApprovedDestinations: state.fdnyApprovedDestinations ? [...state.fdnyApprovedDestinations] : undefined
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

    debugLog(`🔄 Creating TEMP state from REAL for player ${playerId} at ${spaceName} (Try Again: ${isTryAgain})`);

    // If Try Again, first apply penalty to REAL state
    if (isTryAgain && tryAgainPenalty > 0) {
      const penaltyResult = this.applyToRealState(playerId, player, { timeSpent: tryAgainPenalty }, globalTurnCount);
      if (!penaltyResult.success) {
        return penaltyResult;
      }
    }

    // Get the source state - either existing REAL or current player state.
    // v3.0.41: deep-clone via cloneMutableState so nested arrays don't share
    // refs with realState (used to corrupt Try Again under heavy hand mutation).
    const realState = this.turnStateModel.realStates[playerId];
    const sourceState: MutablePlayerState = realState?.state
      ? this.cloneMutableState(realState.state)
      : this.extractMutableState(player);

    // Always create REAL state if it doesn't exist yet — this captures the pre-effect
    // snapshot so Try Again can restore to it later
    if (!realState) {
      debugLog(`📸 Capturing initial REAL state for player ${playerId} (${Object.keys(sourceState).length} fields)`);
      this.turnStateModel = {
        ...this.turnStateModel,
        realStates: {
          ...this.turnStateModel.realStates,
          [playerId]: {
            playerId,
            playerName: player.name,
            state: this.cloneMutableState(sourceState),
            capturedAt: {
              turnNumber: globalTurnCount,
              spaceName,
              visitType,
              timestamp: new Date()
            }
          }
        }
      };
    }

    // Create new TEMP state from REAL
    const newTempState: PlayerTurnState = {
      playerId,
      playerName: player.name,
      state: this.cloneMutableState(sourceState),
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

    debugLog(`✅ TEMP state created for player ${playerId} (Try Again count: ${this.turnStateModel.tryAgainCounts[playerId] || 0})`);

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
    debugLog(`💾 Committing TEMP state to REAL for player ${playerId}`);

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

    debugLog(`✅ TEMP state committed to REAL for player ${playerId}`);

    return {
      success: true,
      newRealState,
      // v3.0.41: deep-clone — callers may mutate the returned snapshot for
      // logging/UI without affecting the just-committed REAL state.
      committedState: this.cloneMutableState(tempState.state)
    };
  }

  /**
   * Discard TEMP state for a player (used in Try Again flow).
   * After calling this, createTempStateFromReal should be called to create a fresh TEMP.
   */
  public discardTempState(playerId: string): StateTransitionResult {
    debugLog(`🗑️ Discarding TEMP state for player ${playerId}`);

    const tempState = this.turnStateModel.tempStates[playerId];
    if (!tempState) {
      debugLog(`ℹ️ No TEMP state to discard for player ${playerId}`);
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

    debugLog(`✅ TEMP state discarded for player ${playerId}`);
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
    debugLog(`📝 Applying changes to REAL state for player ${playerId}:`, changes);

    // Get existing REAL state or create from current player.
    // v3.0.41: deep-clone the source REAL state so the assigned-from spread
    // below doesn't share nested array references with the stored REAL.
    const existingReal = this.turnStateModel.realStates[playerId];
    const currentRealState: MutablePlayerState = existingReal?.state
      ? this.cloneMutableState(existingReal.state)
      : this.extractMutableState(player);

    // Apply changes (handle additive fields like timeSpent).
    // currentRealState is already a deep clone — a shallow spread here is
    // safe because nothing further mutates the nested arrays in place.
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
    // Approval fields (Workstream 7 Try-Again rollback). Plain assignment —
    // these can legitimately be set to 'none' / [] to express revocation.
    if (changes.dobApprovalStatus !== undefined) updatedState.dobApprovalStatus = changes.dobApprovalStatus;
    if (changes.fdnyApprovalStatus !== undefined) updatedState.fdnyApprovalStatus = changes.fdnyApprovalStatus;
    if (changes.dobApprovedDestinations !== undefined) updatedState.dobApprovedDestinations = [...changes.dobApprovedDestinations];
    if (changes.fdnyApprovedDestinations !== undefined) updatedState.fdnyApprovedDestinations = [...changes.fdnyApprovedDestinations];

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

    debugLog(`✅ Changes applied to REAL state for player ${playerId}`);
    // v3.0.41: return a clone so a caller mutating result.newRealState.state
    // cannot leak back into the stored REAL state (they were the same object
    // pre-fix). Callers that just inspect the state are unaffected.
    return {
      success: true,
      newRealState: { ...newRealState, state: this.cloneMutableState(newRealState.state) }
    };
  }

  /**
   * Keep realStates[playerId] in sync with a fallback write that just landed
   * directly on the live player object (StateService.updateTempState's
   * "no active TEMP" branch — used e.g. by
   * EffectEngineService.applyActiveEffects when ticking a duration effect
   * outside the effect holder's own turn). No-ops if no REAL snapshot exists
   * yet for this player (nothing to desync — their next turn's
   * createTempStateFromReal will capture fresh live data anyway).
   *
   * Deliberately NOT applyToRealState: that method special-cases timeSpent
   * as an ADDITIVE delta (correct for its one caller, the Try Again penalty
   * flow), but callers of updateTempState pass timeSpent as an absolute
   * value — reusing applyToRealState here would double-count it into
   * realStates on every fallback write. This is a plain field-for-field
   * merge instead, same semantics as StateService.updatePlayer.
   */
  public syncRealStateIfPresent(playerId: string, changes: Partial<MutablePlayerState>): void {
    const existingReal = this.turnStateModel.realStates[playerId];
    if (!existingReal) return;

    const updatedState: MutablePlayerState = { ...this.cloneMutableState(existingReal.state), ...changes };

    this.turnStateModel = {
      ...this.turnStateModel,
      realStates: {
        ...this.turnStateModel.realStates,
        [playerId]: { ...existingReal, state: updatedState }
      }
    };
  }

  /**
   * Get the effective player state (reads from TEMP during turn, REAL otherwise).
   * This is the state that should be used for UI rendering and effect calculations.
   */
  public getEffectivePlayerState(playerId: string, player: Player): MutablePlayerState | null {
    if (!player) return null;

    // If player has active TEMP, use TEMP.
    // v3.0.41: deep-clone so consumers can safely mutate the returned object
    // (e.g. for transient UI calculations) without leaking back into TEMP.
    const tempState = this.turnStateModel.tempStates[playerId];
    if (tempState) {
      return this.cloneMutableState(tempState.state);
    }

    // Fall back to REAL if no TEMP
    const realState = this.turnStateModel.realStates[playerId];
    if (realState) {
      return this.cloneMutableState(realState.state);
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
      debugLog(`ℹ️ No TEMP state for player ${playerId}, update main state instead`);
      return { success: true, updatedState: undefined };
    }

    // v3.0.41: deep-clone the base, then layer `changes` on top. Without
    // the deep clone, mutating nested arrays on updatedState would leak into
    // the existing tempState.state via shared references.
    const updatedState: MutablePlayerState = {
      ...this.cloneMutableState(tempState.state),
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

  // ============================================================================
  // Cost ledger (Workstream 2) — tracks outflows that stick across Try Again
  // ============================================================================

  /**
   * Record an outflow for a player's current turn. Idempotent-safe: multiple
   * calls accumulate. Called from ResourceService (money spends) and
   * CardService.playCard (user-initiated card consumption).
   */
  public recordTurnOutflow(
    playerId: string,
    entry: { moneySpent?: number; cardConsumed?: string; lifeEventDrawn?: string }
  ): void {
    const existing: TurnCostLedger = this.turnStateModel.costLedgers?.[playerId] ?? {
      moneySpent: 0,
      cardsConsumed: [],
      lifeEventsDrawn: []
    };
    const updated: TurnCostLedger = {
      moneySpent: existing.moneySpent + (entry.moneySpent ?? 0),
      cardsConsumed: entry.cardConsumed
        ? [...existing.cardsConsumed, entry.cardConsumed]
        : existing.cardsConsumed,
      lifeEventsDrawn: entry.lifeEventDrawn
        ? [...(existing.lifeEventsDrawn ?? []), entry.lifeEventDrawn]
        : (existing.lifeEventsDrawn ?? [])
    };
    this.turnStateModel = {
      ...this.turnStateModel,
      costLedgers: {
        ...(this.turnStateModel.costLedgers ?? {}),
        [playerId]: updated
      }
    };
  }

  /**
   * Get the current turn's outflow ledger for a player.
   * Returns a zero-initialized ledger if none exists.
   */
  public getTurnOutflow(playerId: string): TurnCostLedger {
    return (
      this.turnStateModel.costLedgers?.[playerId] ?? {
        moneySpent: 0,
        cardsConsumed: [],
        lifeEventsDrawn: []
      }
    );
  }

  /**
   * Clear the ledger for a player (called on commit and fresh turn start).
   */
  public resetTurnOutflow(playerId: string): void {
    this.turnStateModel = {
      ...this.turnStateModel,
      costLedgers: {
        ...(this.turnStateModel.costLedgers ?? {}),
        [playerId]: undefined
      }
    };
  }
}
