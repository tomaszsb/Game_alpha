import { IStateService, LogLevel, LogPayload, ILoggingService } from '../types/ServiceContracts';
import { ActionLogEntry } from '../types/StateTypes';

export class LoggingService implements ILoggingService {
  private stateService: IStateService;
  private performanceTimers: Map<string, number> = new Map();

  constructor(stateService: IStateService) {
    this.stateService = stateService;
  }

  info(message: string, payload?: LogPayload): void {
    this.log(LogLevel.INFO, message, payload);
  }

  warn(message: string, payload?: LogPayload): void {
    this.log(LogLevel.WARN, message, payload);
  }

  error(message: string, error: Error, payload?: LogPayload): void {
    const errorPayload = {
      ...payload,
      errorMessage: error.message,
      errorStack: error.stack
    };
    this.log(LogLevel.ERROR, message, errorPayload);
  }

  debug(message: string, payload?: LogPayload): void {
    this.log(LogLevel.DEBUG, message, payload);
  }

  log(level: LogLevel, message: string, payload: LogPayload = {}): void {
    // Auto-resolve player name if playerId provided but playerName is not
    let playerName = payload.playerName;
    if (!playerName && payload.playerId && payload.playerId !== 'system') {
      const player = this.stateService.getPlayer(payload.playerId);
      playerName = player?.name || payload.playerId;
    }

    // Get current session ID or generate a default one for system logs
    const currentSessionId = this.getCurrentSessionId();
    const sessionId = currentSessionId || `system_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Determine if this should be immediately committed
    // Check if payload explicitly specifies isCommitted, otherwise use default logic
    const isCommitted = payload.isCommitted !== undefined
      ? payload.isCommitted
      : (!currentSessionId || payload.playerId === 'system' || level === LogLevel.ERROR);

    // Get current turn context from game state (simplified)
    const gameState = this.stateService.getGameState();
    const playerId = payload.playerId || 'system';

    // Special handling for setup entries - they should use turn 0 to distinguish from actual gameplay
    let playerTurnNumber: number;
    let globalTurnNumber: number;

    if (payload.action === 'game_start' && playerId !== 'system') {
      // Setup entries: use turn 0 to indicate this is initial setup, not gameplay
      playerTurnNumber = 0;
      globalTurnNumber = 0;
    } else if (playerId === 'system') {
      // System entries: use turn 1 as default
      playerTurnNumber = 1;
      globalTurnNumber = gameState.globalTurnCount || 1;
    } else {
      // Regular gameplay entries: use actual turn counts
      // Use turn from payload if provided (e.g., turn_start logs), otherwise use current state
      playerTurnNumber = payload.playerTurnNumber || gameState.playerTurnCounts[playerId] || 1;
      globalTurnNumber = payload.turn || gameState.globalTurnCount || 1;
    }

    const turnContext = {
      globalTurnNumber,
      playerTurnNumber
    };

    // Determine visibility level
    const visibility = this.determineVisibility(level, payload);

    // Create log entry for action history
    const logEntry: Omit<ActionLogEntry, 'id' | 'timestamp'> = {
      type: this.determineActionType(level, payload, message),
      playerId: payload.playerId || 'system',
      playerName: playerName || 'System',
      description: message,
      details: {
        level: level,
        ...payload
      },
      isCommitted,
      explorationSessionId: sessionId,
      // Enhanced turn context
      gameRound: gameState.gameRound,
      turnWithinRound: gameState.turnWithinRound,
      globalTurnNumber: turnContext.globalTurnNumber,
      playerTurnNumber: turnContext.playerTurnNumber,
      // Visibility control
      visibility
    };

    // Persist to action history
    this.stateService.logToActionHistory(logEntry);

    // Log to browser console based on level
    switch (level) {
      case LogLevel.ERROR:
        console.error(`[ERROR] ${message}`, payload);
        break;
      case LogLevel.WARN:
        console.warn(`[WARN] ${message}`, payload);
        break;
      case LogLevel.DEBUG:
        console.debug(`[DEBUG] ${message}`, payload);
        break;
      case LogLevel.INFO:
      default:
        console.log(`[INFO] ${message}`, payload);
        break;
    }
  }

  startPerformanceTimer(key: string): void {
    this.performanceTimers.set(key, performance.now());
  }

  endPerformanceTimer(key: string, message?: string): void {
    const startTime = this.performanceTimers.get(key);
    if (startTime === undefined) {
      this.warn(`Performance timer '${key}' was not started`);
      return;
    }

    const duration = performance.now() - startTime;
    this.performanceTimers.delete(key);

    const logMessage = message || `Performance timer '${key}' completed`;
    this.info(logMessage, {
      performanceKey: key,
      duration: `${duration.toFixed(2)}ms`,
      durationMs: duration
    });
  }

  private determineActionType(level: LogLevel, payload: LogPayload, message: string): ActionLogEntry['type'] {
    // Priority 1: Explicit 'action' from the payload is always trusted first.
    if (payload.action) {
      const validTypes: string[] = ['space_entry', 'space_effect', 'time_effect', 'dice_roll', 'card_draw', 'resource_change', 'manual_action', 'turn_start', 'turn_end', 'card_play', 'card_transfer', 'card_discard', 'player_movement', 'card_activate', 'card_expire', 'deck_reshuffle', 'game_start', 'game_end', 'error_event', 'choice_made', 'negotiation_resolved', 'system_log'];
      if (validTypes.includes(payload.action)) {
        return payload.action as ActionLogEntry['type'];
      }
    }

    // Priority 2: If no explicit action, infer the type from the log message string.
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.startsWith('landed on')) return 'space_entry';
    if (lowerMessage.startsWith('turn') && lowerMessage.endsWith('started')) return 'turn_start';
    if (lowerMessage.startsWith('turn') && lowerMessage.endsWith('ended')) return 'turn_end';
    if (lowerMessage.startsWith('rolled a')) return 'dice_roll';
    if (lowerMessage.startsWith('drew') && lowerMessage.includes('card')) return 'card_draw';
    if (lowerMessage.startsWith('played')) return 'card_play';
    if (lowerMessage.startsWith('discarded')) return 'card_discard';
    if (lowerMessage.startsWith('moved from')) return 'player_movement';

    // Priority 3: Fallback for errors.
    if (level === LogLevel.ERROR) {
      return 'error_event';
    }

    // Default to system_log if no other type can be inferred.
    return 'system_log';
  }

  private determineVisibility(level: LogLevel, payload: LogPayload): 'player' | 'debug' | 'system' {
    // Check if payload explicitly specifies visibility
    if (payload.visibility) {
      return payload.visibility as 'player' | 'debug' | 'system';
    }

    // Player-facing actions should be 'player'
    if (payload.action && [
      'dice_roll', 'card_draw', 'card_play', 'card_discard', 'card_transfer',
      'resource_change', 'player_movement', 'space_entry', 'choice_made'
    ].includes(payload.action)) {
      return 'player';
    }

    // System/internal processes should be 'system' or 'debug'
    if (payload.playerId === 'system' || payload.action === 'system_log') {
      return 'system';
    }

    // Debug level logs should be 'debug'
    if (level === LogLevel.DEBUG) {
      return 'debug';
    }

    // Error events should be visible to players (they need to know about errors)
    if (level === LogLevel.ERROR) {
      return 'player';
    }

    // Session management and internal processes should be 'system'
    if (payload.action && [
      'turn_start', 'turn_end', 'game_start', 'game_end'
    ].includes(payload.action)) {
      return 'player'; // Turn starts/ends are important for players to see
    }

    // Default to 'player' for most game actions
    return 'player';
  }

  // Transactional logging session management methods

  /**
   * Starts a new exploration session and returns the session ID.
   * This should be called when a player starts a turn or begins exploring actions.
   */
  startNewExplorationSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update the current exploration session ID in game state
    const gameState = this.stateService.getGameState();
    this.stateService.updateGameState({
      ...gameState,
      currentExplorationSessionId: sessionId
    });

    this.debug(`Started new exploration session: ${sessionId}`, {
      sessionId,
      action: 'system_log'
    });

    return sessionId;
  }

  /**
   * Commits the current exploration session by marking all entries
   * with the current session ID as committed (isCommitted = true).
   */
  commitCurrentSession(): void {
    const currentSessionId = this.getCurrentSessionId();
    if (!currentSessionId) {
      this.warn('Attempted to commit session but no current session exists');
      return;
    }

    // Get all uncommitted entries for this session and mark them as committed
    const gameState = this.stateService.getGameState();
    const updatedActionLog = gameState.globalActionLog.map(entry => {
      if (entry.explorationSessionId === currentSessionId && !entry.isCommitted) {
        return { ...entry, isCommitted: true };
      }
      return entry;
    });

    // Update the game state with committed entries and clear current session
    this.stateService.updateGameState({
      ...gameState,
      globalActionLog: updatedActionLog,
      currentExplorationSessionId: null
    });

    this.debug(`Committed exploration session: ${currentSessionId}`, {
      sessionId: currentSessionId,
      action: 'system_log'
    });
  }

  /**
   * Returns the current exploration session ID, or null if no session is active.
   */
  getCurrentSessionId(): string | null {
    const gameState = this.stateService.getGameState();
    return gameState.currentExplorationSessionId;
  }

  /**
   * Cleans up abandoned sessions by removing uncommitted log entries
   * older than a specified time threshold.
   */
  cleanupAbandonedSessions(): void {
    const gameState = this.stateService.getGameState();
    const currentTime = new Date();
    const threshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Remove uncommitted entries older than threshold
    const cleanedActionLog = gameState.globalActionLog.filter(entry => {
      if (!entry.isCommitted) {
        const entryAge = currentTime.getTime() - entry.timestamp.getTime();
        return entryAge < threshold;
      }
      return true; // Keep all committed entries
    });

    const removedCount = gameState.globalActionLog.length - cleanedActionLog.length;

    if (removedCount > 0) {
      this.stateService.updateGameState({
        ...gameState,
        globalActionLog: cleanedActionLog
      });

      this.info(`Cleaned up ${removedCount} abandoned log entries`, {
        removedCount,
        action: 'system_log'
      });
    }
  }
}