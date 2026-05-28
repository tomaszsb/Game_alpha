// tests/services/WebSocketSyncService.test.ts
// Unit tests for WebSocketSyncService

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketSyncService, getWebSocketService, ConnectionState } from '../../src/services/WebSocketSyncService';
import { GameState } from '../../src/types/StateTypes';

// Make debug functions always call through to console (bypass debug gate)
vi.mock('../../src/utils/debugLog', () => ({
  debugLog: (...args: unknown[]) => console.log(...args),
  debugWarn: (...args: unknown[]) => console.warn(...args),
  debugDebug: (...args: unknown[]) => console.debug(...args),
  resetDebugCache: () => {},
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  // When false, new sockets stay in CONNECTING forever (never fire onopen).
  // Used by the reconnect-give-up test to let reconnectAttempts accumulate
  // (a socket that opens resets the counter). Defaults true so existing tests
  // are unaffected.
  static autoOpen = true;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  private messageQueue: string[] = [];

  constructor(public url: string) {
    // Simulate async connection
    if (MockWebSocket.autoOpen) {
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) this.onopen();
      }, 10);
    }
  }

  send(data: string): void {
    this.messageQueue.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code || 1000, reason: reason || '' });
    }
  }

  // Test helpers
  simulateMessage(data: object): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(error: unknown): void {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  getLastMessage(): object | null {
    const msg = this.messageQueue.pop();
    return msg ? JSON.parse(msg) : null;
  }

  getMessageCount(): number {
    return this.messageQueue.length;
  }
}

// Store original WebSocket
let originalWebSocket: typeof WebSocket;
let mockWs: MockWebSocket | null = null;

describe('WebSocketSyncService', () => {
  beforeEach(() => {
    // Replace global WebSocket with mock
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        mockWs = this;
      }
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    mockWs = null;
    (MockWebSocket as { autoOpen: boolean }).autoOpen = true;
    // Reset visibility override so it doesn't bleed into other tests.
    try {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    } catch { /* environment without document */ }
    vi.useRealTimers();
  });

  describe('Connection', () => {
    it('should connect to WebSocket server with correct URL', () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1', 'P1');

      expect(mockWs).not.toBeNull();
      expect(mockWs!.url).toBe('ws://localhost:3001/ws?gameId=G1&playerId=P1');
    });

    it('should use wss:// for https:// servers', () => {
      const service = new WebSocketSyncService();
      service.connect('https://example.com', 'G1');

      expect(mockWs!.url).toBe('wss://example.com/ws?gameId=G1');
    });

    it('should set connection state to connecting', () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');

      expect(service.connectionState).toBe('connecting');
    });

    it('should set connection state to connected after open', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');

      // Wait for connection
      await vi.advanceTimersByTimeAsync(20);

      expect(service.connectionState).toBe('connected');
      expect(service.isConnected()).toBe(true);
    });

    it('should send subscribe message after connection', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');

      await vi.advanceTimersByTimeAsync(20);

      const message = mockWs!.getLastMessage();
      expect(message).toEqual({
        type: 'subscribe',
        gameId: 'G1'
      });
    });
  });

  describe('Disconnection', () => {
    it('should disconnect cleanly', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      service.disconnect();

      expect(service.connectionState).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('should send unsubscribe message before closing', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      // Clear any queued messages
      while (mockWs!.getLastMessage()) {}

      service.disconnect();

      const message = mockWs!.getLastMessage();
      expect(message).toEqual({
        type: 'unsubscribe',
        gameId: 'G1'
      });
    });
  });

  describe('Reconnection', () => {
    it('should attempt reconnection with exponential backoff', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      // Simulate unexpected close
      mockWs!.simulateClose(4000, 'Server error');

      expect(service.connectionState).toBe('reconnecting');

      // First reconnect attempt after 1s
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockWs).not.toBeNull();
    });

    it('should not reconnect after intentional disconnect', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      service.disconnect();

      expect(service.connectionState).toBe('disconnected');

      // Wait for potential reconnect
      await vi.advanceTimersByTimeAsync(5000);

      expect(service.connectionState).toBe('disconnected');
    });
  });

  describe('Message Handling', () => {
    it('should call state update callback on state_update message', async () => {
      const service = new WebSocketSyncService();
      const callback = vi.fn();
      service.onStateUpdate(callback);

      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      const mockState: Partial<GameState> = {
        players: [],
        gamePhase: 'SETUP'
      };

      mockWs!.simulateMessage({
        type: 'state_update',
        gameId: 'G1',
        payload: {
          state: mockState,
          stateVersion: 1
        }
      });

      expect(callback).toHaveBeenCalledWith(mockState, 1);
    });

    it('should not call callback for stale state versions', async () => {
      const service = new WebSocketSyncService();
      const callback = vi.fn();
      service.onStateUpdate(callback);
      service.setLastKnownVersion(5);

      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      mockWs!.simulateMessage({
        type: 'state_update',
        gameId: 'G1',
        payload: {
          state: {},
          stateVersion: 3 // Older than known version
        }
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should update lastKnownVersion on version_update message', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      mockWs!.simulateMessage({
        type: 'version_update',
        gameId: 'G1',
        payload: {
          stateVersion: 10
        }
      });

      expect(service.getLastKnownVersion()).toBe(10);
    });

    it('should handle error messages', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      mockWs!.simulateMessage({
        type: 'error',
        payload: {
          message: 'Test error'
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server error:', 'Test error');
      consoleSpy.mockRestore();
    });
  });

  describe('Connection Callbacks', () => {
    it('should notify connection state callbacks', async () => {
      const service = new WebSocketSyncService();
      const callback = vi.fn();
      service.onConnectionChange(callback);

      // Should be called immediately with current state
      expect(callback).toHaveBeenCalledWith('disconnected');

      service.connect('http://localhost:3001', 'G1');
      expect(callback).toHaveBeenCalledWith('connecting');

      await vi.advanceTimersByTimeAsync(20);
      expect(callback).toHaveBeenCalledWith('connected');
    });

    it('should allow unsubscribing from callbacks', async () => {
      const service = new WebSocketSyncService();
      const callback = vi.fn();
      const unsubscribe = service.onConnectionChange(callback);

      // Unsubscribe immediately after first call
      unsubscribe();
      callback.mockClear();

      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      // Should not have been called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('State Push', () => {
    it('should send state_push message', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      // Clear subscribe message
      mockWs!.getLastMessage();

      const mockState = { players: [], gamePhase: 'SETUP' } as unknown as GameState;
      service.pushState(mockState, 5);

      const message = mockWs!.getLastMessage();
      expect(message).toEqual({
        type: 'state_push',
        gameId: 'G1',
        payload: {
          state: mockState,
          clientVersion: 5
        }
      });
    });

    it('should not push state when disconnected', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = new WebSocketSyncService();
      const mockState = { players: [], gamePhase: 'SETUP' } as unknown as GameState;

      service.pushState(mockState, 5);

      expect(consoleSpy).toHaveBeenCalledWith('Cannot push state: WebSocket not connected');
      consoleSpy.mockRestore();
    });
  });

  describe('Singleton', () => {
    it('should return same instance from getWebSocketService', () => {
      const instance1 = getWebSocketService();
      const instance2 = getWebSocketService();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Visibility resume (phone reliability — fb:f7312d82 / fb:c7312a0a)', () => {
    // Helper: override document.visibilityState and fire the event.
    const setVisibility = (state: 'visible' | 'hidden') => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    it('force-reconnects when the tab returns to foreground with a dead (zombie) socket', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);
      expect(service.isConnected()).toBe(true);

      const zombieWs = mockWs;
      // Simulate the OS killing the socket while backgrounded WITHOUT firing
      // onclose (the exact failure mode the fix targets).
      zombieWs!.readyState = MockWebSocket.CLOSED;

      setVisibility('visible');

      // A fresh socket should have been created (different instance).
      expect(mockWs).not.toBe(zombieWs);
      await vi.advanceTimersByTimeAsync(20);
      expect(service.connectionState).toBe('connected');

      service.disconnect();
    });

    it('does NOT reconnect when the connection is still healthy on resume', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      const healthyWs = mockWs;
      // Fresh pong → pongFresh true, socket OPEN → no action expected.
      healthyWs!.simulateMessage({ type: 'pong', timestamp: Date.now() });

      setVisibility('visible');

      expect(mockWs).toBe(healthyWs); // same socket, no reconnect
      service.disconnect();
    });

    it('ignores visibilitychange after an intentional disconnect (listener removed)', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      service.disconnect();
      const afterDisconnect = mockWs;

      setVisibility('visible');

      expect(service.connectionState).toBe('disconnected');
      expect(mockWs).toBe(afterDisconnect); // no new socket
    });

    it('keeps retrying (does not strand as disconnected) when attempts are exhausted but the tab is visible', async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20); // initial connection opens

      // From here, reconnect sockets must NOT open, so reconnectAttempts climbs.
      (MockWebSocket as { autoOpen: boolean }).autoOpen = false;

      // Drop + let the scheduled reconnect fire, repeatedly, past the 10-attempt cap.
      for (let i = 0; i < 12; i++) {
        mockWs!.simulateClose(4000, 'drop');
        await vi.advanceTimersByTimeAsync(16000);
      }

      // Past the cap, but visible → should keep trying, NOT strand as
      // 'disconnected'. Depending on exactly where the last timer landed the
      // state is either 'reconnecting' (backoff scheduled) or 'connecting'
      // (a retry in flight) — both mean "still trying".
      expect(service.connectionState).not.toBe('disconnected');
      expect(['reconnecting', 'connecting']).toContain(service.connectionState);

      (MockWebSocket as { autoOpen: boolean }).autoOpen = true;
      service.disconnect();
    });
  });

  describe('Heartbeat', () => {
    it('should send ping messages at heartbeat interval', async () => {
      const service = new WebSocketSyncService();
      service.connect('http://localhost:3001', 'G1');
      await vi.advanceTimersByTimeAsync(20);

      // Clear initial messages
      while (mockWs!.getLastMessage()) {}

      // Simulate pong response to keep connection alive
      mockWs!.simulateMessage({ type: 'pong', timestamp: Date.now() });

      // Advance to heartbeat interval (30s)
      await vi.advanceTimersByTimeAsync(30000);

      const message = mockWs!.getLastMessage();
      expect(message).toEqual({
        type: 'ping',
        gameId: 'G1'
      });
    });
  });
});
