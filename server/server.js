// server/server.js
// Multi-Device Game Server for Code2027
// Provides REST API for:
// - Game state synchronization across devices
// - Version tracking for conflict detection (last-write-wins)

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors()); // Allow all origins for development
app.use(express.json({ limit: '10mb' })); // Support large game states

// ===== GAME STATE STORAGE =====
let gameState = null;
let stateVersion = 0;

// ===== HEALTH CHECK =====
/**
 * GET /health
 * Health check endpoint
 * Returns server status and basic info
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stateVersion,
    hasState: gameState !== null,
    playerCount: gameState?.players?.length || 0,
    gamePhase: gameState?.gamePhase || 'unknown'
  });
});

// ===== GAME STATE ENDPOINTS =====
/**
 * GET /api/gamestate
 * Retrieve current game state
 * Returns 404 if no state exists
 */
app.get('/api/gamestate', (req, res) => {
  if (!gameState) {
    return res.status(404).json({
      error: 'No game state available',
      stateVersion: 0
    });
  }

  console.log(`📤 GET /api/gamestate - Sending state (v${stateVersion})`);
  console.log(`   Players: ${gameState.players?.length || 0}`);
  console.log(`   Phase: ${gameState.gamePhase || 'UNKNOWN'}`);
  console.log(`   Current Player: ${gameState.currentPlayerId || 'none'}`);

  res.json({
    state: gameState,
    stateVersion
  });
});

/**
 * POST /api/gamestate
 * Update game state
 * Body: { state: GameState, clientVersion?: number }
 * Returns new stateVersion
 */
app.post('/api/gamestate', (req, res) => {
  const { state, clientVersion } = req.body;

  // Validation
  if (!state) {
    return res.status(400).json({
      error: 'State is required',
      received: req.body
    });
  }

  // Version conflict warning (informational only, we use last-write-wins)
  if (clientVersion !== undefined && clientVersion < stateVersion) {
    console.warn(`⚠️  Client version ${clientVersion} behind server ${stateVersion} (will overwrite)`);
  }

  // Update state
  gameState = state;
  stateVersion++;

  // Detailed logging
  console.log(`✅ POST /api/gamestate - State updated (v${stateVersion})`);
  console.log(`   Players: ${state.players?.length || 0}`);
  console.log(`   Phase: ${state.gamePhase || 'UNKNOWN'}`);
  console.log(`   Current Player: ${state.currentPlayerId || 'none'}`);

  if (state.players && state.players.length > 0) {
    console.log(`   Player Details:`);
    state.players.forEach(p => {
      console.log(`     - ${p.name} (${p.id.slice(0, 8)}...): ${p.currentSpace} [${p.visitType}]`);
    });
  }

  res.json({
    success: true,
    stateVersion
  });
});

/**
 * DELETE /api/gamestate
 * Reset/clear game state
 * Useful for testing and starting fresh
 */
app.delete('/api/gamestate', (req, res) => {
  const previousVersion = stateVersion;
  const hadState = gameState !== null;

  gameState = null;
  stateVersion = 0;

  console.log(`🗑️  DELETE /api/gamestate - State reset`);
  console.log(`   Previous version: ${previousVersion}`);
  console.log(`   Had state: ${hadState}`);

  res.json({
    success: true,
    message: 'Game state reset',
    previousVersion,
    hadState
  });
});

/**
 * GET /api/debug/state
 * Debug endpoint to inspect raw state
 * Returns prettified JSON for troubleshooting
 */
app.get('/api/debug/state', (req, res) => {
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify({
    stateVersion,
    hasState: gameState !== null,
    state: gameState
  }, null, 2));
});

// ===== ERROR HANDLERS =====
// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    availableEndpoints: [
      'GET /health',
      'GET /api/gamestate',
      'POST /api/gamestate',
      'DELETE /api/gamestate',
      'GET /api/debug/state'
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
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Code2027 Multi-Device Server Started');
  console.log('');
  console.log(`   Port: ${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log(`   GET    /health              - Health check`);
  console.log(`   GET    /api/gamestate       - Get current state`);
  console.log(`   POST   /api/gamestate       - Update state`);
  console.log(`   DELETE /api/gamestate       - Reset state`);
  console.log(`   GET    /api/debug/state     - Debug state dump`);
  console.log('');
  console.log('🔄 Features enabled:');
  console.log('   ✅ Multi-device state synchronization');
  console.log('   ✅ Version tracking (last-write-wins)');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('🛑 Shutting down server...');
  process.exit(0);
});
