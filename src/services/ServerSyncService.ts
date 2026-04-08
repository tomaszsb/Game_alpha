// src/services/ServerSyncService.ts
// Handles server synchronization with WebSocket (primary) and HTTP (fallback)
// WebSocket provides sub-100ms updates; HTTP provides reliability for state pushes

import { GameState } from '../types/StateTypes';
import { getBackendURL, getGameStateAPIPath, getCurrentGameId, getCurrentGameToken } from '../utils/networkDetection';
import { debugLog, debugWarn } from '../utils/debugLog';
import { getWebSocketService, ConnectionState, StateUpdateCallback } from './WebSocketSyncService';

/**
 * Callback interface for state operations
 * Allows ServerSyncService to interact with StateService without tight coupling
 */
export interface StateProvider {
  getCurrentState(): GameState;
  setCurrentState(state: GameState, serverVersion?: number): void;
}

/**
 * ServerSyncService handles synchronization between client and server state.
 *
 * Extracted from StateService to separate network concerns from state management.
 *
 * Features:
 * - WebSocket for real-time inbound state updates (sub-100ms latency)
 * - HTTP POST for reliable outbound state pushes
 * - Debounced state syncing to prevent spam during rapid changes
 * - Lazy initialization of server URL
 * - Version tracking for conflict resolution
 * - Graceful degradation when server is unavailable
 */
export class ServerSyncService {
  private serverUrl: string = '';
  private syncEnabled: boolean = true;
  private isSyncing: boolean = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private lastKnownServerVersion: number = 0;
  private webSocketConnected: boolean = false;
  private webSocketUnsubscribers: (() => void)[] = [];

  constructor(private stateProvider: StateProvider) {}

  /**
   * Initialize the server URL lazily
   * @returns true if URL was initialized, false if failed
   */
  private initializeServerUrl(): boolean {
    if (this.serverUrl) return true;

    try {
      this.serverUrl = getBackendURL();
      return true;
    } catch (error) {
      debugWarn('Cannot determine backend URL, disabling server sync:', error);
      this.syncEnabled = false;
      return false;
    }
  }

  /**
   * Connect to WebSocket for real-time state updates
   * Call this after initial state load to enable real-time sync
   */
  public connectWebSocket(): void {
    if (!this.initializeServerUrl()) {
      return;
    }

    const gameId = getCurrentGameId();
    if (!gameId) {
      debugLog('No game ID, skipping WebSocket connection');
      return;
    }

    const wsService = getWebSocketService();

    // Subscribe to state updates
    const stateUnsubscribe = wsService.onStateUpdate((state, version) => {
      // Only update if newer than our local version
      if (version > this.lastKnownServerVersion) {
        this.lastKnownServerVersion = version;
        // Update state through the provider (skips sync to avoid loop)
        this.stateProvider.setCurrentState(state, version);
        debugLog(`📥 WebSocket state update applied (v${version})`);
      }
    });
    this.webSocketUnsubscribers.push(stateUnsubscribe);

    // Subscribe to connection state changes
    const connUnsubscribe = wsService.onConnectionChange((state) => {
      this.webSocketConnected = state === 'connected';
      debugLog(`🔌 WebSocket connection: ${state}`);
    });
    this.webSocketUnsubscribers.push(connUnsubscribe);

    // Connect
    wsService.connect(this.serverUrl, gameId);
  }

  /**
   * Disconnect WebSocket
   */
  public disconnectWebSocket(): void {
    // Unsubscribe from all callbacks
    this.webSocketUnsubscribers.forEach(unsub => unsub());
    this.webSocketUnsubscribers = [];

    getWebSocketService().disconnect();
    this.webSocketConnected = false;
  }

  /**
   * Check if WebSocket is connected
   */
  public isWebSocketConnected(): boolean {
    return this.webSocketConnected;
  }

  /**
   * Register a callback for WebSocket connection state changes
   */
  public onConnectionChange(callback: (state: ConnectionState) => void): () => void {
    return getWebSocketService().onConnectionChange(callback);
  }

  /**
   * Debounced sync to server
   * Batches multiple rapid state changes into a single sync operation
   */
  public debouncedSync(): void {
    if (!this.syncEnabled) return;

    // Clear existing timer
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Debounce 500ms - batches rapid state changes
    this.syncTimer = setTimeout(() => {
      const state = this.stateProvider.getCurrentState();
      this.syncToServer(state);
      this.syncTimer = null;
    }, 500);
  }

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
    if (!this.initializeServerUrl()) {
      return;
    }

    this.isSyncing = true;

    // Pre-increment WebSocket version to suppress self-echo during HTTP round-trip.
    // The server broadcasts state_update to ALL WS clients (including sender) after
    // an HTTP POST. This broadcast can arrive before the HTTP response, causing the
    // client to overwrite its own local state with the (stale) server echo — losing
    // any changes made between the sync capture and the echo arrival (e.g., a
    // completedAction set after a choice was resolved). By pre-setting the expected
    // version, the WS handler rejects the echo (V+1 > V+1 = false).
    const previousWsVersion = getWebSocketService().getLastKnownVersion();
    getWebSocketService().setLastKnownVersion(previousWsVersion + 1);

    try {
      const gameId = getCurrentGameId();
      const apiPath = getGameStateAPIPath(gameId);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      const token = getCurrentGameToken();
      if (token) {
        headers['X-Game-Token'] = token;
      }

      const response = await fetch(`${this.serverUrl}${apiPath}`, {
        method: 'POST',
        headers,
        // Include clientVersion to enable server-side conflict detection
        body: JSON.stringify({ state, clientVersion: this.lastKnownServerVersion })
      });

      if (!response.ok) {
        // Restore WS version — our sync failed
        getWebSocketService().setLastKnownVersion(previousWsVersion);

        // Check for version conflict (409 Conflict)
        if (response.status === 409) {
          debugWarn(`⚠️ State sync rejected: server has newer version. Fetching latest state...`);
          // Fetch the latest state from server to resolve conflict
          await this.loadFromServer();
          return;
        }
        debugWarn(`Failed to sync state to server: ${response.status} ${response.statusText}`);
      } else {
        const result = await response.json();
        // Update our known server version to prevent future conflicts
        this.lastKnownServerVersion = result.stateVersion;
        // Sync version with WebSocket service (use actual server version, not our estimate)
        getWebSocketService().setLastKnownVersion(result.stateVersion);
        // Debug: Log spaceVisitLog sync status
        const player = state.players?.[0];
        const logLength = player?.spaceVisitLog?.length || 0;
        debugLog(`✅ State synced to server (v${result.stateVersion})${gameId ? ` [${gameId}]` : ''} - spaceVisitLog: ${logLength} entries`);
      }
    } catch (error) {
      // Restore WS version — network failure
      getWebSocketService().setLastKnownVersion(previousWsVersion);
      // Fail silently - server may not be running (development mode)
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Load game state from backend server
   * Called on app initialization to restore state across devices
   * Returns true if state was loaded successfully, false otherwise
   */
  public async loadFromServer(): Promise<boolean> {
    // Lazy initialization of server URL
    if (!this.initializeServerUrl()) {
      return false;
    }

    try {
      const gameId = getCurrentGameId();
      const apiPath = getGameStateAPIPath(gameId);
      debugLog(`📥 Loading state from server...${gameId ? ` [${gameId}]` : ''}`);
      const fetchHeaders: Record<string, string> = {};
      const token = getCurrentGameToken();
      if (token) {
        fetchHeaders['X-Game-Token'] = token;
      }
      const response = await fetch(`${this.serverUrl}${apiPath}`, { headers: fetchHeaders });

      if (response.status === 404) {
        debugLog('No server state found, using local state');
        return false;
      }

      if (!response.ok) {
        debugWarn(`Failed to load state from server: ${response.status} ${response.statusText}`);
        return false;
      }

      const { state, stateVersion } = await response.json();

      if (state) {
        // Track the server version to prevent stale state overwrites
        this.lastKnownServerVersion = stateVersion;
        // Sync version with WebSocket service
        getWebSocketService().setLastKnownVersion(stateVersion);
        // Update state through the provider (skips sync to avoid loop)
        this.stateProvider.setCurrentState(state, stateVersion);
        // Debug: Log spaceVisitLog status when loading
        const player = state.players?.[0];
        const logLength = player?.spaceVisitLog?.length || 0;
        debugLog(`✅ State loaded from server (v${stateVersion})${gameId ? ` [${gameId}]` : ''}`);
        debugLog(`   Players: ${state.players?.length || 0}`);
        debugLog(`   Phase: ${state.gamePhase || 'UNKNOWN'}`);
        debugLog(`   Player 0 spaceVisitLog: ${logLength} entries`);
        return true;
      }

      return false;
    } catch (error) {
      // Server not available - continue with local state
      debugLog('Server not available, using local state');
      return false;
    }
  }

  /**
   * Update server version tracking when state is replaced externally
   * (e.g., from polling mechanism)
   */
  public setServerVersion(version: number): void {
    this.lastKnownServerVersion = version;
  }

  /**
   * Get the current known server version
   */
  public getServerVersion(): number {
    return this.lastKnownServerVersion;
  }

  /**
   * Enable or disable server synchronization
   * Useful for testing or when server is intentionally offline
   */
  public setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
    debugLog(`Server sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if sync is enabled
   */
  public isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  /**
   * Cancel any pending sync operation
   * Useful for cleanup
   */
  public cancelPendingSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }
}
