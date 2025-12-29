// server/server.js
// Multi-Device, Multi-Game Server for Code2027
// Provides REST API for:
// - Multiple independent game sessions (G1, G2, G3, etc.)
// - Game state synchronization across devices
// - Version tracking for conflict detection (last-write-wins)

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const DEFAULT_PORT = 3001;

// Middleware
app.use(cors()); // Allow all origins for development
app.use(express.json({ limit: '10mb' })); // Support large game states

// ===== MULTI-GAME STATE STORAGE =====
// Map of gameId -> { state: GameState, version: number }
const games = new Map();
let nextGameNumber = 1;

/**
 * Generate a new game ID (G1, G2, G3, etc.)
 */
function generateGameId() {
  const id = `G${nextGameNumber}`;
  nextGameNumber++;
  return id;
}

// ===== HEALTH CHECK =====
/**
 * GET /health
 * Health check endpoint
 * Returns server status and basic info
 */
app.get('/health', (req, res) => {
  const gameList = Array.from(games.entries()).map(([id, data]) => ({
    gameId: id,
    version: data.version,
    playerCount: data.state?.players?.length || 0,
    gamePhase: data.state?.gamePhase || 'unknown'
  }));

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeGames: games.size,
    games: gameList
  });
});

// ===== GAME MANAGEMENT ENDPOINTS =====

/**
 * GET /api/games
 * List all active games
 */
app.get('/api/games', (req, res) => {
  const gameList = Array.from(games.entries()).map(([id, data]) => ({
    gameId: id,
    version: data.version,
    playerCount: data.state?.players?.length || 0,
    playerNames: data.state?.players?.map(p => p.name) || [],
    gamePhase: data.state?.gamePhase || 'unknown',
    createdAt: data.createdAt
  }));

  res.json({
    games: gameList,
    count: games.size
  });
});

/**
 * POST /api/games
 * Create a new game session
 * Returns the new game ID
 */
app.post('/api/games', (req, res) => {
  const gameId = generateGameId();

  games.set(gameId, {
    state: null,
    version: 0,
    createdAt: new Date().toISOString()
  });

  console.log(`🎮 New game created: ${gameId}`);

  res.json({
    success: true,
    gameId,
    message: `Game ${gameId} created. Share this code with players!`
  });
});

/**
 * DELETE /api/games/:gameId
 * Delete a specific game
 */
app.delete('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;

  if (!games.has(gameId)) {
    return res.status(404).json({
      error: 'Game not found',
      gameId
    });
  }

  games.delete(gameId);
  console.log(`🗑️ Game deleted: ${gameId}`);

  res.json({
    success: true,
    message: `Game ${gameId} deleted`
  });
});

// ===== GAME STATE ENDPOINTS =====

/**
 * GET /api/games/:gameId/state
 * Retrieve game state for a specific game
 * Returns 404 if game doesn't exist
 */
app.get('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;

  if (!games.has(gameId)) {
    return res.status(404).json({
      error: 'Game not found',
      gameId
    });
  }

  const game = games.get(gameId);

  if (!game.state) {
    return res.status(404).json({
      error: 'No game state available',
      gameId,
      stateVersion: 0
    });
  }

  res.json({
    state: game.state,
    stateVersion: game.version,
    gameId
  });
});

/**
 * POST /api/games/:gameId/state
 * Update game state for a specific game
 * Body: { state: GameState, clientVersion?: number }
 * Returns new stateVersion
 */
app.post('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;
  const { state, clientVersion } = req.body;

  // Auto-create game if it doesn't exist
  if (!games.has(gameId)) {
    games.set(gameId, {
      state: null,
      version: 0,
      createdAt: new Date().toISOString()
    });
    console.log(`🎮 Game auto-created: ${gameId}`);
  }

  // Validation
  if (!state) {
    return res.status(400).json({
      error: 'State is required',
      received: req.body
    });
  }

  const game = games.get(gameId);

  // Version conflict warning (informational only, we use last-write-wins)
  if (clientVersion !== undefined && clientVersion < game.version) {
    console.warn(`⚠️  [${gameId}] Client version ${clientVersion} behind server ${game.version} (will overwrite)`);
  }

  // Update state
  game.state = state;
  game.version++;

  res.json({
    success: true,
    stateVersion: game.version,
    gameId
  });
});

/**
 * DELETE /api/games/:gameId/state
 * Reset/clear game state for a specific game
 */
app.delete('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;

  if (!games.has(gameId)) {
    return res.status(404).json({
      error: 'Game not found',
      gameId
    });
  }

  const game = games.get(gameId);
  const previousVersion = game.version;
  const hadState = game.state !== null;

  game.state = null;
  game.version = 0;

  if (hadState) console.log(`🗑️ [${gameId}] Game state reset (was v${previousVersion})`);

  res.json({
    success: true,
    message: 'Game state reset',
    gameId,
    previousVersion,
    hadState
  });
});

// ===== LEGACY ENDPOINTS (for backwards compatibility) =====
// These work with a "default" game (G0)

const LEGACY_GAME_ID = 'G0';

// Ensure legacy game exists
games.set(LEGACY_GAME_ID, {
  state: null,
  version: 0,
  createdAt: new Date().toISOString()
});

/**
 * GET /api/gamestate (legacy)
 * Retrieve current game state from default game
 */
app.get('/api/gamestate', (req, res) => {
  const game = games.get(LEGACY_GAME_ID);

  if (!game.state) {
    return res.status(404).json({
      error: 'No game state available',
      stateVersion: 0
    });
  }

  res.json({
    state: game.state,
    stateVersion: game.version
  });
});

/**
 * POST /api/gamestate (legacy)
 * Update game state for default game
 */
app.post('/api/gamestate', (req, res) => {
  const { state, clientVersion } = req.body;
  const game = games.get(LEGACY_GAME_ID);

  if (!state) {
    return res.status(400).json({
      error: 'State is required',
      received: req.body
    });
  }

  if (clientVersion !== undefined && clientVersion < game.version) {
    console.warn(`⚠️  [${LEGACY_GAME_ID}] Client version ${clientVersion} behind server ${game.version} (will overwrite)`);
  }

  game.state = state;
  game.version++;

  res.json({
    success: true,
    stateVersion: game.version
  });
});

/**
 * DELETE /api/gamestate (legacy)
 * Reset default game state
 */
app.delete('/api/gamestate', (req, res) => {
  const game = games.get(LEGACY_GAME_ID);
  const previousVersion = game.version;
  const hadState = game.state !== null;

  game.state = null;
  game.version = 0;

  if (hadState) console.log(`🗑️ [${LEGACY_GAME_ID}] Game state reset (was v${previousVersion})`);

  res.json({
    success: true,
    message: 'Game state reset',
    previousVersion,
    hadState
  });
});

/**
 * GET /api/debug/state (legacy)
 * Debug endpoint for default game
 */
app.get('/api/debug/state', (req, res) => {
  const game = games.get(LEGACY_GAME_ID);
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify({
    stateVersion: game.version,
    hasState: game.state !== null,
    state: game.state
  }, null, 2));
});

/**
 * GET /api/debug/games
 * Debug endpoint to see all games
 */
app.get('/api/debug/games', (req, res) => {
  const allGames = {};
  games.forEach((data, id) => {
    allGames[id] = {
      version: data.version,
      hasState: data.state !== null,
      playerCount: data.state?.players?.length || 0,
      createdAt: data.createdAt
    };
  });

  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(allGames, null, 2));
});

// ===== ERROR HANDLERS =====
// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    availableEndpoints: [
      'GET /health',
      'GET /api/games - List all games',
      'POST /api/games - Create new game',
      'DELETE /api/games/:gameId - Delete a game',
      'GET /api/games/:gameId/state - Get game state',
      'POST /api/games/:gameId/state - Update game state',
      'DELETE /api/games/:gameId/state - Reset game state',
      'GET /api/gamestate - (legacy) Get default game',
      'POST /api/gamestate - (legacy) Update default game',
      'DELETE /api/gamestate - (legacy) Reset default game'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ===== START SERVER =====
/**
 * Try to start server on a port, and try next port if it fails
 */
function startServer(port, maxAttempts = 10) {
  const server = createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      if (maxAttempts > 1) {
        server.close();
        startServer(port + 1, maxAttempts - 1);
      } else {
        console.error('❌ Could not find an available port after multiple attempts');
        process.exit(1);
      }
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const actualPort = server.address().port;
    console.log(`🚀 Multi-Game Server started on port ${actualPort}`);
    console.log(`   http://localhost:${actualPort}`);
    console.log(`   Supports multiple independent games (G1, G2, G3, ...)`);
  });

  return server;
}

const server = startServer(DEFAULT_PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});
