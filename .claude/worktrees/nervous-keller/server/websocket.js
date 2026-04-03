// server/websocket.js
// WebSocket module for real-time game state synchronization
// Provides sub-100ms updates for TV displays and instant turn notifications

import { WebSocketServer } from 'ws';

// Room management: gameId -> Set<WebSocket>
const rooms = new Map();

// Client tracking: WebSocket -> { gameId, playerId }
const clients = new Map();

// Message types
// Server -> Client: state_update, version_update, error, pong
// Client -> Server: subscribe, unsubscribe, state_push, ping

/**
 * Initialize WebSocket server and attach to HTTP server
 * @param {import('http').Server} server - HTTP server instance
 * @param {Map} games - Reference to games Map from server.js
 * @returns {WebSocketServer} - The WebSocket server instance
 */
export function initializeWebSocket(server, games) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Parse gameId from query string: ws://server/ws?gameId=G1
    const url = new URL(req.url, `http://${req.headers.host}`);
    const gameId = url.searchParams.get('gameId');
    const playerId = url.searchParams.get('playerId') || null;

    console.log(`🔌 WebSocket connected: gameId=${gameId}, playerId=${playerId}`);

    // Track this client
    clients.set(ws, { gameId: null, playerId });

    // Auto-subscribe if gameId provided in URL
    if (gameId) {
      subscribeToGame(ws, gameId);
    }

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message, games);
      } catch (err) {
        console.error('❌ WebSocket message parse error:', err.message);
        sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      const clientInfo = clients.get(ws);
      if (clientInfo?.gameId) {
        unsubscribeFromGame(ws, clientInfo.gameId);
      }
      clients.delete(ws);
      console.log(`🔌 WebSocket disconnected: gameId=${clientInfo?.gameId}`);
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message);
    });
  });

  console.log('🔌 WebSocket server initialized at /ws');
  return wss;
}

/**
 * Handle incoming client messages
 */
function handleClientMessage(ws, message, games) {
  const { type, gameId, payload } = message;

  switch (type) {
    case 'subscribe':
      subscribeToGame(ws, gameId);
      // Send current state immediately after subscribing
      sendCurrentState(ws, gameId, games);
      break;

    case 'unsubscribe':
      unsubscribeFromGame(ws, gameId);
      break;

    case 'state_push':
      handleStatePush(ws, gameId, payload, games);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    default:
      console.warn(`⚠️ Unknown WebSocket message type: ${type}`);
      sendError(ws, `Unknown message type: ${type}`);
  }
}

/**
 * Subscribe a client to a game room
 */
function subscribeToGame(ws, gameId) {
  if (!gameId) {
    sendError(ws, 'gameId is required for subscription');
    return;
  }

  // Remove from previous room if any
  const clientInfo = clients.get(ws);
  if (clientInfo?.gameId && clientInfo.gameId !== gameId) {
    unsubscribeFromGame(ws, clientInfo.gameId);
  }

  // Add to new room
  if (!rooms.has(gameId)) {
    rooms.set(gameId, new Set());
  }
  rooms.get(gameId).add(ws);

  // Update client tracking
  clients.set(ws, { ...clientInfo, gameId });

  console.log(`📢 Client subscribed to game ${gameId} (${rooms.get(gameId).size} clients)`);
}

/**
 * Unsubscribe a client from a game room
 */
function unsubscribeFromGame(ws, gameId) {
  if (!gameId) return;

  const room = rooms.get(gameId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(gameId);
    }
    console.log(`📢 Client unsubscribed from game ${gameId} (${room?.size || 0} clients remaining)`);
  }

  // Update client tracking
  const clientInfo = clients.get(ws);
  if (clientInfo) {
    clients.set(ws, { ...clientInfo, gameId: null });
  }
}

/**
 * Send current game state to a client
 */
function sendCurrentState(ws, gameId, games) {
  const game = games.get(gameId);
  if (!game) {
    sendError(ws, `Game ${gameId} not found`);
    return;
  }

  const message = {
    type: 'state_update',
    gameId,
    payload: {
      state: game.state,
      stateVersion: game.version
    }
  };

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Handle state push from client (not typically used - HTTP POST preferred for reliability)
 */
function handleStatePush(ws, gameId, payload, games) {
  if (!gameId || !payload?.state) {
    sendError(ws, 'gameId and state are required for state_push');
    return;
  }

  const game = games.get(gameId);
  if (!game) {
    sendError(ws, `Game ${gameId} not found`);
    return;
  }

  // Version conflict check
  if (payload.clientVersion !== undefined && payload.clientVersion < game.version) {
    ws.send(JSON.stringify({
      type: 'error',
      gameId,
      payload: {
        code: 'VERSION_CONFLICT',
        message: 'Client has stale state',
        clientVersion: payload.clientVersion,
        serverVersion: game.version
      }
    }));
    // Send current state to help client recover
    sendCurrentState(ws, gameId, games);
    return;
  }

  // Update game state
  game.state = payload.state;
  game.version++;
  game.lastActivity = new Date().toISOString();

  // Acknowledge the push
  ws.send(JSON.stringify({
    type: 'version_update',
    gameId,
    payload: {
      stateVersion: game.version
    }
  }));

  // Broadcast to all other clients in the room
  broadcastToRoom(gameId, {
    type: 'state_update',
    gameId,
    payload: {
      state: game.state,
      stateVersion: game.version
    }
  }, ws);
}

/**
 * Broadcast a message to all clients in a game room
 * @param {string} gameId - The game room ID
 * @param {object} message - The message to broadcast
 * @param {WebSocket} [excludeWs] - Optional WebSocket to exclude from broadcast
 */
export function broadcastToRoom(gameId, message, excludeWs = null) {
  const room = rooms.get(gameId);
  if (!room || room.size === 0) {
    return;
  }

  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  room.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(messageStr);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(`📡 Broadcast to ${sentCount} client(s) in game ${gameId}`);
  }
}

/**
 * Broadcast state update to all clients in a game room
 * Called from server.js after successful HTTP POST
 */
export function broadcastStateUpdate(gameId, state, stateVersion) {
  broadcastToRoom(gameId, {
    type: 'state_update',
    gameId,
    payload: {
      state,
      stateVersion
    }
  });
}

/**
 * Send error message to a client
 */
function sendError(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message }
    }));
  }
}

/**
 * Get room statistics (for debugging/monitoring)
 */
export function getRoomStats() {
  const stats = {};
  rooms.forEach((clients, gameId) => {
    stats[gameId] = clients.size;
  });
  return {
    totalRooms: rooms.size,
    totalClients: clients.size,
    rooms: stats
  };
}
