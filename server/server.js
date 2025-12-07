// server/server.js
// Multi-Device Game Server for Code2027
// Provides REST API for:
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

  // Removed verbose logging - only log errors, not every GET request

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

  // Silent on success - only log errors

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

  if (hadState) console.log(`🗑️ Game state reset (was v${previousVersion})`);

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
    console.log(`🚀 Server started on port ${actualPort} | http://localhost:${actualPort} | Multi-device sync enabled`);
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
