// server/server.js
// Multi-Device, Multi-Game Server for Code2027
// Features:
// - Multiple independent game sessions (G1, G2, G3, etc.)
// - Auto-save games to file (survives restarts)
// - Game expiration (24 hours of inactivity)
// - Visitor logging (IP, device, actions)
// - Push notifications via ntfy.sh

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

const app = express();
const DEFAULT_PORT = 3001;

// ===== CONFIGURATION =====
const CONFIG = {
  // ntfy.sh topic for push notifications (change this to your own topic!)
  // To receive notifications: Install ntfy app and subscribe to this topic
  NTFY_TOPIC: process.env.NTFY_TOPIC || 'unravel-game-alerts',

  // Game expiration time (24 hours in milliseconds)
  GAME_EXPIRATION_MS: 24 * 60 * 60 * 1000,

  // How often to check for expired games (1 hour)
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,

  // Auto-save interval (every 30 seconds)
  AUTOSAVE_INTERVAL_MS: 30 * 1000,

  // Data directory for persistence
  DATA_DIR: process.env.DATA_DIR || '/app/data',

  // Log file path
  LOG_FILE: process.env.LOG_FILE || '/app/data/visitors.log',

  // Games file path
  GAMES_FILE: process.env.GAMES_FILE || '/app/data/games.json',
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===== MULTI-GAME STATE STORAGE =====
const games = new Map();
let nextGameNumber = 1;
let isDirty = false; // Track if games need saving

// ===== LOGGING UTILITIES =====

/**
 * Get client IP address from request
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || 'unknown';
}

/**
 * Get device info from user agent
 */
function getDeviceInfo(req) {
  const ua = req.headers['user-agent'] || 'unknown';

  // Simple device detection
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

/**
 * Format timestamp for logging
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Log visitor action to file
 */
function logVisitor(req, action, details = {}) {
  const entry = {
    timestamp: formatTimestamp(),
    ip: getClientIP(req),
    device: getDeviceInfo(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    action,
    ...details
  };

  const logLine = JSON.stringify(entry) + '\n';

  // Console log for docker logs
  console.log(`📊 ${action}: ${entry.ip} (${entry.device})${details.gameId ? ` [${details.gameId}]` : ''}`);

  // Append to log file
  try {
    ensureDataDir();
    fs.appendFileSync(CONFIG.LOG_FILE, logLine);
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }

  return entry;
}

/**
 * Send push notification via ntfy.sh
 */
async function sendNotification(title, message, priority = 'default') {
  try {
    const response = await fetch(`https://ntfy.sh/${CONFIG.NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': 'game_die'
      },
      body: message
    });

    if (response.ok) {
      console.log(`🔔 Notification sent: ${title}`);
    } else {
      console.warn(`⚠️ Notification failed: ${response.status}`);
    }
  } catch (err) {
    console.warn('⚠️ Could not send notification:', err.message);
  }
}

// ===== PERSISTENCE UTILITIES =====

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(CONFIG.DATA_DIR)) {
    fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${CONFIG.DATA_DIR}`);
  }
}

/**
 * Save games to file
 */
function saveGames() {
  if (!isDirty) return;

  try {
    ensureDataDir();

    const data = {
      nextGameNumber,
      games: Array.from(games.entries()).map(([id, game]) => ({
        id,
        ...game
      })),
      savedAt: formatTimestamp()
    };

    fs.writeFileSync(CONFIG.GAMES_FILE, JSON.stringify(data, null, 2));
    isDirty = false;
    console.log(`💾 Games saved (${games.size} games)`);
  } catch (err) {
    console.error('❌ Failed to save games:', err.message);
  }
}

/**
 * Load games from file
 */
function loadGames() {
  try {
    if (!fs.existsSync(CONFIG.GAMES_FILE)) {
      console.log('📂 No saved games found, starting fresh');
      return;
    }

    const data = JSON.parse(fs.readFileSync(CONFIG.GAMES_FILE, 'utf8'));

    nextGameNumber = data.nextGameNumber || 1;

    for (const game of data.games || []) {
      const { id, ...gameData } = game;
      games.set(id, gameData);
    }

    console.log(`📂 Loaded ${games.size} games from file`);
    console.log(`   Last saved: ${data.savedAt}`);
  } catch (err) {
    console.error('❌ Failed to load games:', err.message);
  }
}

/**
 * Clean up expired games
 */
function cleanupExpiredGames() {
  const now = Date.now();
  const expiredGames = [];

  games.forEach((game, id) => {
    // Skip legacy game
    if (id === 'G0') return;

    const lastActivity = new Date(game.lastActivity || game.createdAt).getTime();
    const age = now - lastActivity;

    if (age > CONFIG.GAME_EXPIRATION_MS) {
      expiredGames.push({
        id,
        playerCount: game.state?.players?.length || 0,
        age: Math.round(age / (60 * 60 * 1000)) // hours
      });
    }
  });

  if (expiredGames.length > 0) {
    for (const { id, playerCount, age } of expiredGames) {
      games.delete(id);
      console.log(`🗑️ Expired game ${id} (${playerCount} players, ${age}h inactive)`);
    }
    isDirty = true;
    saveGames();

    // Notify about cleanup
    sendNotification(
      'Games Cleaned Up',
      `Removed ${expiredGames.length} expired game(s): ${expiredGames.map(g => g.id).join(', ')}`,
      'low'
    );
  }
}

/**
 * Update game's last activity timestamp
 */
function touchGame(gameId) {
  const game = games.get(gameId);
  if (game) {
    game.lastActivity = formatTimestamp();
    isDirty = true;
  }
}

// ===== GAME UTILITIES =====

function generateGameId() {
  const id = `G${nextGameNumber}`;
  nextGameNumber++;
  isDirty = true;
  return id;
}

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  const gameList = Array.from(games.entries()).map(([id, data]) => ({
    gameId: id,
    version: data.version,
    playerCount: data.state?.players?.length || 0,
    gamePhase: data.state?.gamePhase || 'unknown',
    lastActivity: data.lastActivity
  }));

  res.json({
    status: 'ok',
    timestamp: formatTimestamp(),
    activeGames: games.size,
    games: gameList,
    ntfyTopic: CONFIG.NTFY_TOPIC
  });
});

// ===== GAME MANAGEMENT ENDPOINTS =====

app.get('/api/games', (req, res) => {
  logVisitor(req, 'LIST_GAMES');

  const gameList = Array.from(games.entries()).map(([id, data]) => ({
    gameId: id,
    version: data.version,
    playerCount: data.state?.players?.length || 0,
    playerNames: data.state?.players?.map(p => p.name) || [],
    gamePhase: data.state?.gamePhase || 'unknown',
    createdAt: data.createdAt,
    lastActivity: data.lastActivity
  }));

  res.json({
    games: gameList,
    count: games.size
  });
});

app.post('/api/games', async (req, res) => {
  const gameId = generateGameId();
  const now = formatTimestamp();

  games.set(gameId, {
    state: null,
    version: 0,
    createdAt: now,
    lastActivity: now
  });

  const logEntry = logVisitor(req, 'CREATE_GAME', { gameId });

  // Send notification
  await sendNotification(
    '🎮 New Game Created!',
    `Game ${gameId} created\nIP: ${logEntry.ip}\nDevice: ${logEntry.device}`,
    'default'
  );

  isDirty = true;
  saveGames();

  res.json({
    success: true,
    gameId,
    message: `Game ${gameId} created. Share this code with players!`
  });
});

app.delete('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;

  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found', gameId });
  }

  logVisitor(req, 'DELETE_GAME', { gameId });
  games.delete(gameId);
  isDirty = true;
  saveGames();

  res.json({ success: true, message: `Game ${gameId} deleted` });
});

// ===== GAME STATE ENDPOINTS =====

app.get('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;

  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found', gameId });
  }

  const game = games.get(gameId);
  touchGame(gameId);

  if (!game.state) {
    return res.status(404).json({
      error: 'No game state available',
      gameId,
      stateVersion: 0
    });
  }

  // Log only first access (when loading game)
  // Don't log polling requests to avoid spam

  res.json({
    state: game.state,
    stateVersion: game.version,
    gameId
  });
});

app.post('/api/games/:gameId/state', async (req, res) => {
  const { gameId } = req.params;
  const { state, clientVersion } = req.body;

  // Auto-create game if it doesn't exist
  if (!games.has(gameId)) {
    games.set(gameId, {
      state: null,
      version: 0,
      createdAt: formatTimestamp(),
      lastActivity: formatTimestamp()
    });
    console.log(`🎮 Game auto-created: ${gameId}`);
  }

  if (!state) {
    return res.status(400).json({ error: 'State is required', received: req.body });
  }

  const game = games.get(gameId);
  const previousPlayerCount = game.state?.players?.length || 0;
  const newPlayerCount = state.players?.length || 0;

  // Detect significant changes for logging
  if (newPlayerCount > previousPlayerCount) {
    const newPlayer = state.players[newPlayerCount - 1];
    logVisitor(req, 'PLAYER_JOINED', {
      gameId,
      playerName: newPlayer?.name || 'Unknown',
      playerCount: newPlayerCount
    });

    // Notify about new player
    await sendNotification(
      '👤 Player Joined!',
      `${newPlayer?.name || 'Someone'} joined game ${gameId}\nNow ${newPlayerCount} player(s)`,
      'default'
    );
  }

  // Detect game start
  if (game.state?.gamePhase === 'SETUP' && state.gamePhase === 'PLAYING') {
    logVisitor(req, 'GAME_STARTED', {
      gameId,
      playerCount: newPlayerCount,
      playerNames: state.players?.map(p => p.name).join(', ')
    });

    await sendNotification(
      '🎲 Game Started!',
      `Game ${gameId} started with ${newPlayerCount} players: ${state.players?.map(p => p.name).join(', ')}`,
      'high'
    );
  }

  // Version conflict warning
  if (clientVersion !== undefined && clientVersion < game.version) {
    console.warn(`⚠️  [${gameId}] Client version ${clientVersion} behind server ${game.version}`);
  }

  game.state = state;
  game.version++;
  touchGame(gameId);
  isDirty = true;

  res.json({
    success: true,
    stateVersion: game.version,
    gameId
  });
});

app.delete('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;

  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found', gameId });
  }

  logVisitor(req, 'RESET_GAME', { gameId });

  const game = games.get(gameId);
  const previousVersion = game.version;

  game.state = null;
  game.version = 0;
  touchGame(gameId);
  isDirty = true;
  saveGames();

  res.json({
    success: true,
    message: 'Game state reset',
    gameId,
    previousVersion
  });
});

// ===== LOGS ENDPOINT =====
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(CONFIG.LOG_FILE)) {
      return res.json({ logs: [], count: 0 });
    }

    const content = fs.readFileSync(CONFIG.LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    // Return last 100 entries, newest first
    const recentLogs = logs.slice(-100).reverse();

    res.json({
      logs: recentLogs,
      count: logs.length,
      file: CONFIG.LOG_FILE
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DAILY SUMMARY ENDPOINT =====
app.get('/api/logs/summary', (req, res) => {
  try {
    if (!fs.existsSync(CONFIG.LOG_FILE)) {
      return res.json({ summary: 'No logs yet' });
    }

    const content = fs.readFileSync(CONFIG.LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    const today = new Date().toISOString().split('T')[0];
    const todayLogs = lines
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(log => log && log.timestamp?.startsWith(today));

    const uniqueIPs = new Set(todayLogs.map(l => l.ip));
    const gamesCreated = todayLogs.filter(l => l.action === 'CREATE_GAME').length;
    const playersJoined = todayLogs.filter(l => l.action === 'PLAYER_JOINED').length;
    const gamesStarted = todayLogs.filter(l => l.action === 'GAME_STARTED').length;

    res.json({
      date: today,
      uniqueVisitors: uniqueIPs.size,
      gamesCreated,
      playersJoined,
      gamesStarted,
      totalEvents: todayLogs.length,
      visitors: Array.from(uniqueIPs)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== LEGACY ENDPOINTS =====
const LEGACY_GAME_ID = 'G0';

if (!games.has(LEGACY_GAME_ID)) {
  games.set(LEGACY_GAME_ID, {
    state: null,
    version: 0,
    createdAt: formatTimestamp(),
    lastActivity: formatTimestamp()
  });
}

app.get('/api/gamestate', (req, res) => {
  const game = games.get(LEGACY_GAME_ID);
  touchGame(LEGACY_GAME_ID);

  if (!game.state) {
    return res.status(404).json({ error: 'No game state available', stateVersion: 0 });
  }

  res.json({ state: game.state, stateVersion: game.version });
});

app.post('/api/gamestate', (req, res) => {
  const { state, clientVersion } = req.body;
  const game = games.get(LEGACY_GAME_ID);

  if (!state) {
    return res.status(400).json({ error: 'State is required', received: req.body });
  }

  if (clientVersion !== undefined && clientVersion < game.version) {
    console.warn(`⚠️  [${LEGACY_GAME_ID}] Client version ${clientVersion} behind server ${game.version}`);
  }

  game.state = state;
  game.version++;
  touchGame(LEGACY_GAME_ID);
  isDirty = true;

  res.json({ success: true, stateVersion: game.version });
});

app.delete('/api/gamestate', (req, res) => {
  const game = games.get(LEGACY_GAME_ID);
  const previousVersion = game.version;

  game.state = null;
  game.version = 0;
  touchGame(LEGACY_GAME_ID);
  isDirty = true;
  saveGames();

  res.json({ success: true, message: 'Game state reset', previousVersion });
});

app.get('/api/debug/state', (req, res) => {
  const game = games.get(LEGACY_GAME_ID);
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify({
    stateVersion: game.version,
    hasState: game.state !== null,
    state: game.state
  }, null, 2));
});

app.get('/api/debug/games', (req, res) => {
  const allGames = {};
  games.forEach((data, id) => {
    allGames[id] = {
      version: data.version,
      hasState: data.state !== null,
      playerCount: data.state?.players?.length || 0,
      createdAt: data.createdAt,
      lastActivity: data.lastActivity
    };
  });

  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(allGames, null, 2));
});

// ===== ERROR HANDLERS =====
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    availableEndpoints: [
      'GET /health',
      'GET /api/games',
      'POST /api/games',
      'GET /api/games/:gameId/state',
      'POST /api/games/:gameId/state',
      'GET /api/logs',
      'GET /api/logs/summary'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ===== START SERVER =====
function startServer(port, maxAttempts = 10) {
  const server = createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      if (maxAttempts > 1) {
        server.close();
        startServer(port + 1, maxAttempts - 1);
      } else {
        console.error('❌ Could not find an available port');
        process.exit(1);
      }
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const actualPort = server.address().port;
    console.log('');
    console.log('🚀 Multi-Game Server started');
    console.log(`   Port: ${actualPort}`);
    console.log(`   ntfy topic: ${CONFIG.NTFY_TOPIC}`);
    console.log(`   Data dir: ${CONFIG.DATA_DIR}`);
    console.log('');

    // Send startup notification
    sendNotification(
      '🚀 Server Started',
      `Game server is now online!\nPort: ${actualPort}`,
      'low'
    );
  });

  return server;
}

// ===== INITIALIZATION =====
console.log('📂 Initializing server...');
ensureDataDir();
loadGames();

// Start periodic tasks
setInterval(saveGames, CONFIG.AUTOSAVE_INTERVAL_MS);
setInterval(cleanupExpiredGames, CONFIG.CLEANUP_INTERVAL_MS);

// Initial cleanup
cleanupExpiredGames();

const server = startServer(DEFAULT_PORT);

// Graceful shutdown
function shutdown() {
  console.log('🛑 Shutting down...');
  saveGames();
  server.close(() => {
    console.log('✅ Server shut down');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
