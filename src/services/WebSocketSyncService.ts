// src/services/WebSocketSyncService.ts
// WebSocket client service for real-time game state synchronization
// Provides sub-100ms updates for TV displays and instant turn notifications

import { GameState } from '../types/StateTypes';

/**
 * Message types from server
 */
interface ServerMessage {
  type: 'state_update' | 'version_update' | 'error' | 'pong';
  gameId?: string;
  payload?: {
    state?: GameState;
    stateVersion?: number;
    message?: string;
    code?: string;
    clientVersion?: number;
    serverVersion?: number;
  };
  timestamp?: number;
}

/**
 * Message types to server
 */
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'state_push' | 'ping';
  gameId: string;
  payload?: {
    state?: GameState;
    clientVersion?: number;
  };
}

/**
 * Connection state for external monitoring
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Callback for state updates
 */
export type StateUpdateCallback = (state: GameState, version: number) => void;

/**
 * Callback for connection state changes
 */
export type ConnectionCallback = (state: ConnectionState) => void;

/**
 * WebSocketSyncService handles real-time game state synchronization via WebSocket.
 *
 * Features:
 * - Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s max)
 * - Heartbeat ping every 30 seconds
 * - Clean disconnect on page unload
 * - Automatic resubscription after reconnect
 */
export class WebSocketSyncService {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;
  private playerId: string | null = null;
  private serverUrl: string = '';

  // Connection state
  private _connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Heartbeat
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  private lastPongTime = 0;

  // Callbacks
  private stateUpdateCallbacks: StateUpdateCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];

  // Track last known version for conflict detection
  private lastKnownVersion = 0;

  constructor() {
    // Clean disconnect on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.disconnect());
    }
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to WebSocket server for a specific game
   */
  connect(serverUrl: string, gameId: string, playerId?: string): void {
    // Store connection params for reconnection
    this.serverUrl = serverUrl;
    this.gameId = gameId;
    this.playerId = playerId || null;

    // Don't reconnect if already connected to same game
    if (this.isConnected() && this.ws) {
      console.log('WebSocket already connected');
      return;
    }

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState('connecting');

    try {
      // Build WebSocket URL
      const wsProtocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = serverUrl.replace(/^https?:\/\//, '');
      let wsUrl = `${wsProtocol}://${wsHost}/ws?gameId=${gameId}`;
      if (playerId) {
        wsUrl += `&playerId=${playerId}`;
      }

      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.setConnectionState('connected');
        this.reconnectAttempts = 0;

        // Start heartbeat
        this.startHeartbeat();

        // Subscribe to game (server auto-subscribes on connect, but this ensures it)
        this.send({
          type: 'subscribe',
          gameId: this.gameId!
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
        this.stopHeartbeat();

        // Don't reconnect if intentionally closed (code 1000)
        if (event.code !== 1000 && this._connectionState !== 'disconnected') {
          this.scheduleReconnect();
        } else {
          this.setConnectionState('disconnected');
        }
      };

      this.ws.onerror = (event) => {
        console.error('🔌 WebSocket error:', event);
        // onclose will be called after onerror, so don't need to handle reconnect here
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.setConnectionState('disconnected');
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Unsubscribe before closing
      if (this.ws.readyState === WebSocket.OPEN && this.gameId) {
        this.send({
          type: 'unsubscribe',
          gameId: this.gameId
        });
      }
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.gameId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Push state to server via WebSocket
   * Note: HTTP POST is preferred for reliability; this is for real-time scenarios
   */
  pushState(state: GameState, version: number): void {
    if (!this.isConnected() || !this.gameId) {
      console.warn('Cannot push state: WebSocket not connected');
      return;
    }

    this.send({
      type: 'state_push',
      gameId: this.gameId,
      payload: {
        state,
        clientVersion: version
      }
    });
  }

  /**
   * Register callback for state updates
   */
  onStateUpdate(callback: StateUpdateCallback): () => void {
    this.stateUpdateCallbacks.push(callback);
    return () => {
      const index = this.stateUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for connection state changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    // Immediately call with current state
    callback(this._connectionState);
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get last known server version
   */
  getLastKnownVersion(): number {
    return this.lastKnownVersion;
  }

  /**
   * Update last known version (called by ServerSyncService when HTTP POST succeeds)
   */
  setLastKnownVersion(version: number): void {
    this.lastKnownVersion = version;
  }

  // ============================================================
  // Private methods
  // ============================================================

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'state_update':
        if (message.payload?.state && message.payload.stateVersion !== undefined) {
          const newVersion = message.payload.stateVersion;
          // Only process if newer than our known version
          if (newVersion > this.lastKnownVersion) {
            this.lastKnownVersion = newVersion;
            this.stateUpdateCallbacks.forEach(cb => {
              cb(message.payload!.state!, newVersion);
            });
            console.log(`📥 WebSocket state update (v${newVersion})`);
          }
        }
        break;

      case 'version_update':
        if (message.payload?.stateVersion !== undefined) {
          this.lastKnownVersion = message.payload.stateVersion;
          console.log(`📥 WebSocket version update (v${this.lastKnownVersion})`);
        }
        break;

      case 'pong':
        this.lastPongTime = message.timestamp || Date.now();
        break;

      case 'error':
        console.error('WebSocket server error:', message.payload?.message);
        if (message.payload?.code === 'VERSION_CONFLICT') {
          console.warn('Version conflict detected - server will send updated state');
        }
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.connectionCallbacks.forEach(cb => cb(state));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, giving up');
      this.setConnectionState('disconnected');
      return;
    }

    this.setConnectionState('reconnecting');

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    this.reconnectAttempts++;

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.serverUrl && this.gameId) {
        this.connect(this.serverUrl, this.gameId, this.playerId || undefined);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected() && this.gameId) {
        // Check if we've received a pong recently (within 2 heartbeat intervals)
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > this.heartbeatInterval * 2) {
          console.warn('No pong received, connection may be stale');
          // Force reconnect
          this.ws?.close(4000, 'Heartbeat timeout');
          return;
        }

        this.send({
          type: 'ping',
          gameId: this.gameId
        });
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// Singleton instance
let webSocketServiceInstance: WebSocketSyncService | null = null;

/**
 * Get the singleton WebSocketSyncService instance
 */
export function getWebSocketService(): WebSocketSyncService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketSyncService();
  }
  return webSocketServiceInstance;
}
