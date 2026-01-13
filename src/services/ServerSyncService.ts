// src/services/ServerSyncService.ts
// Extracted from StateService - handles server synchronization

import { GameState } from '../types/StateTypes';
import { getBackendURL, getGameStateAPIPath, getCurrentGameId } from '../utils/networkDetection';

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
      console.warn('Cannot determine backend URL, disabling server sync:', error);
      this.syncEnabled = false;
      return false;
    }
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

    try {
      const gameId = getCurrentGameId();
      const apiPath = getGameStateAPIPath(gameId);
      const response = await fetch(`${this.serverUrl}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Include clientVersion to enable server-side conflict detection
        body: JSON.stringify({ state, clientVersion: this.lastKnownServerVersion })
      });

      if (!response.ok) {
        // Check for version conflict (409 Conflict)
        if (response.status === 409) {
          console.warn(`⚠️ State sync rejected: server has newer version. Fetching latest state...`);
          // Fetch the latest state from server to resolve conflict
          await this.loadFromServer();
          return;
        }
        console.warn(`Failed to sync state to server: ${response.status} ${response.statusText}`);
      } else {
        const result = await response.json();
        // Update our known server version to prevent future conflicts
        this.lastKnownServerVersion = result.stateVersion;
        console.log(`✅ State synced to server (v${result.stateVersion})${gameId ? ` [${gameId}]` : ''}`);
      }
    } catch (error) {
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
      console.log(`📥 Loading state from server...${gameId ? ` [${gameId}]` : ''}`);
      const response = await fetch(`${this.serverUrl}${apiPath}`);

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
        // Track the server version to prevent stale state overwrites
        this.lastKnownServerVersion = stateVersion;
        // Update state through the provider (skips sync to avoid loop)
        this.stateProvider.setCurrentState(state, stateVersion);
        console.log(`✅ State loaded from server (v${stateVersion})${gameId ? ` [${gameId}]` : ''}`);
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
    console.log(`Server sync ${enabled ? 'enabled' : 'disabled'}`);
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
