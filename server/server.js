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
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initializeWebSocket, broadcastStateUpdate, getRoomStats, validateStateSchema } from './websocket.js';
import { processGameData } from './processGameData.js';

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
  // Use relative path for development, absolute for Docker (set via env var)
  DATA_DIR: process.env.DATA_DIR || './server/data',

  // Log file path
  LOG_FILE: process.env.LOG_FILE || './server/data/visitors.log',

  // Games file path
  GAMES_FILE: process.env.GAMES_FILE || './server/data/games.json',

  // Admin password hash (SHA-256). MUST be set via ADMIN_PASSWORD_HASH env var.
  // Generate: node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '',
};

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://game.unravelcodes.com', 'http://localhost:3000', 'http://localhost:3001']
}));
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ===== WRITABLE DATA DIR FOR SOURCE/CLEAN FILES =====
// Docker runs --read-only, so /app/dist is immutable.
// Copy baked-in data to writable /app/data/game-data on first run.
// Writable route is registered BEFORE dist static so edits take precedence.
const distPath = process.env.DIST_PATH || path.join(process.cwd(), 'dist');
const writableDataDir = path.join(CONFIG.DATA_DIR, 'game-data');
const writableSourceDir = path.join(writableDataDir, 'SOURCE_FILES');
const writableCleanDir = path.join(writableDataDir, 'CLEAN_FILES');
const writableBaselineDir = path.join(writableDataDir, 'BASELINE');
const backupsDir = path.join(writableDataDir, 'backups');

// Back up SOURCE_FILES before destructive operations (save, reset, init).
// Keeps the 2 most recent snapshots so editor data can be recovered.
function backupSourceFiles(reason) {
  const spacesPath = path.join(writableSourceDir, 'Spaces.csv');
  if (!fs.existsSync(spacesPath)) return; // nothing to back up

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotDir = path.join(backupsDir, `${timestamp}_${reason}`);
  fs.mkdirSync(snapshotDir, { recursive: true });

  for (const file of fs.readdirSync(writableSourceDir)) {
    const srcPath = path.join(writableSourceDir, file);
    // Skip anything that isn't a regular file. SOURCE_FILES should only
    // contain CSVs, but stray subdirectories have been observed in the
    // wild (e.g. from a restore that nested SOURCE_FILES inside itself)
    // and copyFileSync throws EISDIR on them, blocking all editor saves.
    if (!fs.statSync(srcPath).isFile()) continue;
    fs.copyFileSync(srcPath, path.join(snapshotDir, file));
  }
  console.log(`💾 Backup created: ${path.basename(snapshotDir)}`);

  // Prune: keep only the 2 most recent snapshots
  const snapshots = fs.readdirSync(backupsDir)
    .filter(d => fs.statSync(path.join(backupsDir, d)).isDirectory())
    .sort()
    .reverse();

  for (const old of snapshots.slice(2)) {
    const oldPath = path.join(backupsDir, old);
    for (const f of fs.readdirSync(oldPath)) {
      fs.unlinkSync(path.join(oldPath, f));
    }
    fs.rmdirSync(oldPath);
    console.log(`🗑️  Pruned old backup: ${old}`);
  }
}

function initWritableData() {
  const distDataDir = path.join(distPath, 'data');
  const versionFile = path.join(writableDataDir, '.version');
  const currentVersion = process.env.VITE_GIT_COMMIT || 'dev';
  const existingVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf-8').trim() : '';

  // Re-init BASELINE on every deploy (so reset-to-baseline uses latest)
  // Only re-init SOURCE/CLEAN if no prior edits exist (first deploy)
  const needsFullInit = !fs.existsSync(path.join(writableSourceDir, 'Spaces.csv'));
  const needsBaselineUpdate = currentVersion !== existingVersion;

  if (needsFullInit) {
    backupSourceFiles('pre-init');
    console.log('📋 Initializing writable data from dist...');
    for (const sub of ['SOURCE_FILES', 'CLEAN_FILES', 'BASELINE']) {
      const src = path.join(distDataDir, sub);
      const dst = path.join(writableDataDir, sub);
      if (fs.existsSync(src)) {
        fs.mkdirSync(dst, { recursive: true });
        for (const file of fs.readdirSync(src)) {
          const srcFile = path.join(src, file);
          if (!fs.statSync(srcFile).isFile()) continue;
          fs.copyFileSync(srcFile, path.join(dst, file));
        }
        console.log(`   Copied ${sub}/`);
      }
    }
  } else if (needsBaselineUpdate) {
    // Update BASELINE from new build but keep user-edited SOURCE/CLEAN
    const baselineSrc = path.join(distDataDir, 'BASELINE');
    if (fs.existsSync(baselineSrc)) {
      fs.mkdirSync(writableBaselineDir, { recursive: true });
      for (const file of fs.readdirSync(baselineSrc)) {
        const srcFile = path.join(baselineSrc, file);
        if (!fs.statSync(srcFile).isFile()) continue;
        fs.copyFileSync(srcFile, path.join(writableBaselineDir, file));
      }
      console.log('📋 Updated BASELINE from new deploy');
    }
  } else {
    console.log('📋 Writable data dir already initialized');
  }

  // Write version marker
  fs.mkdirSync(writableDataDir, { recursive: true });
  fs.writeFileSync(versionFile, currentVersion);
}

if (fs.existsSync(distPath)) {
  initWritableData();
  // Serve writable data BEFORE dist so edited CSVs take precedence
  app.use('/data', express.static(writableDataDir));
}

// ===== STATIC FILE SERVING (Production) =====
// Serve the built frontend from the dist folder (after writable data route)
if (fs.existsSync(distPath)) {
  console.log(`📁 Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
}

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
 * Note: Headers must be ASCII-only, so we put emojis in the message body
 */
async function sendNotification(title, message, priority = 'default', tags = 'game_die') {
  try {
    // Remove emojis from title (headers must be ASCII)
    const asciiTitle = title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

    const response = await fetch(`https://ntfy.sh/${CONFIG.NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': asciiTitle || 'Game Alert',
        'Priority': priority,
        'Tags': tags
      },
      body: message
    });

    if (response.ok) {
      console.log(`🔔 Notification sent: ${asciiTitle}`);
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
    // Reduced logging - only log at debug level (Dec 29, 2025)
    // console.log(`💾 Games saved (${games.size} games)`);
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

/**
 * Generate a random game token for authentication
 * @returns {string} 16-character hex token
 */
function generateGameToken() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Validate game token from request.
 * Returns the game object if valid, or sends an error response and returns null.
 * Auto-generates a token for legacy games that don't have one.
 */
function validateGameToken(req, res, gameId) {
  const game = games.get(gameId);
  if (!game) {
    res.status(404).json({ error: `Game ${gameId} not found` });
    return null;
  }

  // Auto-generate token for legacy games
  if (!game.token) {
    game.token = generateGameToken();
    isDirty = true;
    console.log(`🔑 Auto-generated token for legacy game ${gameId}`);
  }

  const clientToken = req.headers['x-game-token'] || req.query.token;
  if (!clientToken) {
    res.status(401).json({ error: 'Game token required (X-Game-Token header or ?token= query)' });
    return null;
  }

  if (clientToken !== game.token) {
    res.status(403).json({ error: 'Invalid game token' });
    return null;
  }

  return game;
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
    websocket: getRoomStats()
  });
});

// ===== ADMIN RATE LIMITING =====
const adminAttempts = new Map(); // IP -> { count, resetAt }
const RATE_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }; // 5 per 15 min

function checkAdminRateLimit(req, res) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = adminAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT.maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({ success: false, error: `Too many attempts. Retry after ${retryAfter}s` });
      return false;
    }
    entry.count++;
  } else {
    adminAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
  }
  return true;
}

// ===== ADMIN AUTHENTICATION =====

app.post('/api/admin/verify', (req, res) => {
  if (!checkAdminRateLimit(req, res)) return;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }

  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  const expectedHash = CONFIG.ADMIN_PASSWORD_HASH;

  // Timing-safe comparison to prevent timing attacks
  const match = inputHash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash));

  if (match) {
    logVisitor(req, 'ADMIN_AUTH_SUCCESS');
    res.json({ success: true });
  } else {
    logVisitor(req, 'ADMIN_AUTH_FAILED');
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// ===== ADMIN: SAVE SOURCE FILES & REGENERATE =====

app.post('/api/admin/save-source-files', (req, res) => {
  const { password, spacesCSV, diceRollCSV, modalConfigCSV } = req.body;

  // Verify admin password
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  const expectedHash = CONFIG.ADMIN_PASSWORD_HASH;
  const match = inputHash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash));
  if (!match) {
    logVisitor(req, 'SAVE_SOURCE_FILES_AUTH_FAILED');
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }

  if (!spacesCSV || !diceRollCSV) {
    return res.status(400).json({ success: false, error: 'spacesCSV and diceRollCSV are required' });
  }

  let step = 'init';
  try {
    step = 'backup';
    backupSourceFiles('pre-save');
    step = 'mkdir';
    fs.mkdirSync(writableSourceDir, { recursive: true });
    fs.mkdirSync(writableCleanDir, { recursive: true });
    step = 'write_spaces';
    fs.writeFileSync(path.join(writableSourceDir, 'Spaces.csv'), spacesCSV, 'utf-8');
    step = 'write_dice';
    fs.writeFileSync(path.join(writableSourceDir, 'DiceRoll Info.csv'), diceRollCSV, 'utf-8');
    if (modalConfigCSV) {
      step = 'write_modal';
      fs.writeFileSync(path.join(writableSourceDir, 'ModalConfig.csv'), modalConfigCSV, 'utf-8');
    }

    console.log('📝 SOURCE_FILES written to writable data dir');

    step = 'process';
    const results = processGameData(spacesCSV, diceRollCSV, writableCleanDir, modalConfigCSV || null);
    console.log(`✅ CLEAN_FILES regenerated (${results.length} files)`);

    logVisitor(req, 'SAVE_SOURCE_FILES', {
      filesGenerated: results.map(r => r.filename)
    });

    res.json({
      success: true,
      message: 'Source files saved and clean files regenerated',
      files: results
    });
  } catch (err) {
    // Per-step diagnostic so docker logs and the admin client can see which
    // stage failed without rebuilding the server. `detail` is surfaced to the
    // admin-only client; safe to expose since the route is password-gated.
    console.error('❌ Failed to save source files:', {
      step,
      message: err && err.message,
      stack: err && err.stack,
      spacesLen: spacesCSV ? spacesCSV.length : 0,
      diceRollLen: diceRollCSV ? diceRollCSV.length : 0,
      modalConfigLen: modalConfigCSV ? modalConfigCSV.length : 0
    });
    res.status(500).json({
      success: false,
      error: 'Failed to save source files',
      step,
      detail: (err && err.message) || String(err)
    });
  }
});

// ===== ADMIN: RESET TO BASELINE =====

app.post('/api/admin/reset-to-baseline', (req, res) => {
  const { password } = req.body;

  // Verify admin password
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  const expectedHash = CONFIG.ADMIN_PASSWORD_HASH;
  const match = inputHash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash));
  if (!match) {
    logVisitor(req, 'RESET_BASELINE_AUTH_FAILED');
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }

  try {
    if (!fs.existsSync(writableBaselineDir)) {
      return res.status(404).json({
        success: false,
        error: 'No baseline found. This feature requires a Docker deployment with BASELINE files.'
      });
    }

    backupSourceFiles('pre-reset');
    // Copy all CSV files from BASELINE to SOURCE_FILES
    fs.mkdirSync(writableSourceDir, { recursive: true });
    fs.mkdirSync(writableCleanDir, { recursive: true });
    const baselineFiles = fs.readdirSync(writableBaselineDir).filter(f => f.endsWith('.csv'));

    for (const file of baselineFiles) {
      fs.copyFileSync(path.join(writableBaselineDir, file), path.join(writableSourceDir, file));
    }

    console.log(`📋 Copied ${baselineFiles.length} baseline files to SOURCE_FILES`);

    // Read the restored files and regenerate CLEAN_FILES
    const spacesCSV = fs.readFileSync(path.join(writableSourceDir, 'Spaces.csv'), 'utf-8');
    const diceRollCSV = fs.readFileSync(path.join(writableSourceDir, 'DiceRoll Info.csv'), 'utf-8');
    const results = processGameData(spacesCSV, diceRollCSV, writableCleanDir);

    console.log(`✅ CLEAN_FILES regenerated from baseline (${results.length} files)`);

    logVisitor(req, 'RESET_TO_BASELINE', {
      filesRestored: baselineFiles,
      filesGenerated: results.map(r => r.filename)
    });

    res.json({
      success: true,
      message: 'Data reset to baseline successfully',
      filesRestored: baselineFiles,
      filesGenerated: results
    });
  } catch (err) {
    console.error('❌ Failed to reset to baseline:', err);
    res.status(500).json({ success: false, error: 'Failed to reset to baseline' });
  }
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
  const token = generateGameToken();
  const now = formatTimestamp();

  games.set(gameId, {
    state: null,
    version: 0,
    token,
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
    token,
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

/**
 * Join-by-code endpoint — public (no auth) lookup of game info + token by gameId.
 *
 * Background: the April 2026 security audit added X-Game-Token auth on all
 * state endpoints. The flow assumed creator-shares-full-URL-with-token. But
 * the lobby's "Join by Code" UI lets players type a game ID with no token,
 * which then 401'd silently when the game UI tried to load state — players
 * saw a blank screen and reported "join button doesn't work" (G159, 2026-05-08).
 *
 * Resolution: treat the gameId itself as the shared secret for joining.
 * Anyone who knows a game's ID can fetch its token here, then proceed
 * with the normal authed state-load flow. State writes still require the
 * token in headers, so this endpoint doesn't loosen modify-state security
 * — only restores read-state-on-join usability.
 */
app.get('/api/games/:gameId/join-info', (req, res) => {
  const { gameId } = req.params;
  const game = games.get(gameId);
  if (!game) {
    return res.status(404).json({ error: `Game ${gameId} not found`, gameId });
  }
  // Auto-generate token for legacy games (matches validateGameToken behavior)
  if (!game.token) {
    game.token = generateGameToken();
    isDirty = true;
    console.log(`🔑 Auto-generated token for legacy game ${gameId} on join-info`);
  }
  logVisitor(req, 'JOIN_INFO', { gameId });
  res.json({
    gameId,
    token: game.token,
    gamePhase: game.state?.gamePhase || 'SETUP',
    playerCount: game.state?.players?.length || 0,
  });
});

// ===== GAME STATE ENDPOINTS =====

app.get('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;

  const game = validateGameToken(req, res, gameId);
  if (!game) return;

  touchGame(gameId);

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

app.post('/api/games/:gameId/state', async (req, res) => {
  const { gameId } = req.params;
  const { state, clientVersion } = req.body;

  // Auto-create game if it doesn't exist (with token from client)
  if (!games.has(gameId)) {
    const clientToken = req.headers['x-game-token'] || req.query.token;
    if (!clientToken) {
      return res.status(401).json({ error: 'Game token required to create game' });
    }
    games.set(gameId, {
      state: null,
      version: 0,
      token: clientToken,
      createdAt: formatTimestamp(),
      lastActivity: formatTimestamp()
    });
    console.log(`🎮 Game auto-created: ${gameId}`);
  }

  // Validate token
  const game = validateGameToken(req, res, gameId);
  if (!game) return;

  if (!state) {
    return res.status(400).json({ error: 'State is required', received: req.body });
  }

  // Schema validation
  const schemaError = validateStateSchema(state);
  if (schemaError) {
    console.warn(`⚠️ [${gameId}] HTTP state_push schema validation failed: ${schemaError}`);
    return res.status(400).json({ error: `Invalid state: ${schemaError}` });
  }

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

  // Version conflict detection and rejection (Dec 29, 2025 fix)
  // Reject updates from clients with stale versions to prevent race conditions
  if (clientVersion !== undefined && clientVersion < game.version) {
    console.warn(`⚠️  [${gameId}] REJECTED: Client version ${clientVersion} behind server ${game.version}`);
    return res.status(409).json({
      error: 'Version conflict - client has stale state',
      clientVersion,
      serverVersion: game.version,
      message: 'Please refresh your state from server before making changes'
    });
  }

  game.state = state;
  game.version++;
  touchGame(gameId);
  isDirty = true;

  // Broadcast state update to all WebSocket clients in this game room
  broadcastStateUpdate(gameId, game.state, game.version);

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
    console.error('Failed to read logs:', err.message);
    res.status(500).json({ error: 'Failed to read logs' });
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
    console.error('Failed to read log summary:', err.message);
    res.status(500).json({ error: 'Failed to read log summary' });
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

// Debug endpoints - admin only
app.get('/api/debug/state', (req, res) => {
  const passwordHash = req.headers['x-admin-password']
    ? crypto.createHash('sha256').update(req.headers['x-admin-password']).digest('hex')
    : '';
  if (passwordHash !== CONFIG.ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const game = games.get(LEGACY_GAME_ID);
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify({
    stateVersion: game.version,
    hasState: game.state !== null,
    state: game.state
  }, null, 2));
});

app.get('/api/debug/games', (req, res) => {
  const passwordHash = req.headers['x-admin-password']
    ? crypto.createHash('sha256').update(req.headers['x-admin-password']).digest('hex')
    : '';
  if (passwordHash !== CONFIG.ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
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

// ===== FEEDBACK / BUG REPORT ENDPOINTS =====
const FEEDBACK_DIR = path.join(CONFIG.DATA_DIR, 'feedback');

function ensureFeedbackDir() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
    console.log(`📁 Created feedback directory: ${FEEDBACK_DIR}`);
  }
}

app.post('/api/feedback', async (req, res) => {
  try {
    const { screenshot, whatDoing, whatWrong, extra, contact, metadata } = req.body;

    if (!whatDoing || !whatWrong) {
      return res.status(400).json({ error: 'whatDoing and whatWrong are required' });
    }

    ensureFeedbackDir();

    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const filename = `feedback-${timestamp}-${random}.json`;

    const report = {
      id: filename,
      screenshot: screenshot || null,
      whatDoing,
      whatWrong,
      extra: extra || '',
      // Optional contact info — present only if reporter filled in any
      // of name/email/phone for follow-up. Added per G159 feedback
      // (2026-05-08).
      ...(contact && (contact.name || contact.email || contact.phone)
        ? { contact: { name: contact.name || '', email: contact.email || '', phone: contact.phone || '' } }
        : {}),
      metadata: metadata || {},
      createdAt: new Date(timestamp).toISOString(),
    };

    fs.writeFileSync(path.join(FEEDBACK_DIR, filename), JSON.stringify(report, null, 2));

    logVisitor(req, 'BUG_REPORT', {
      gameId: metadata?.gameId || 'unknown',
      whatDoing: whatDoing.substring(0, 80),
    });

    // Send ntfy notification
    const gameLabel = metadata?.gameId && metadata.gameId !== 'none' ? metadata.gameId : 'unknown game';
    await sendNotification(
      'Bug Report Received',
      `Bug report from ${gameLabel}:\n${whatDoing.substring(0, 80)}`,
      'default',
      'bug'
    );

    res.json({ success: true, id: filename });
  } catch (err) {
    console.error('Failed to save feedback:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

app.get('/api/feedback', (req, res) => {
  try {
    ensureFeedbackDir();

    const files = fs.readdirSync(FEEDBACK_DIR).filter(f => f.endsWith('.json'));
    const reports = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR, f), 'utf8'));
        // Return without screenshot for list view
        const { screenshot, ...rest } = data;
        return rest;
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Sort newest first
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ reports, count: reports.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/feedback/:id', (req, res) => {
  try {
    const sanitizedId = path.basename(req.params.id);
    if (!/^feedback-\d+-[a-f0-9]+\.json$/.test(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid feedback ID format' });
    }
    const filePath = path.join(FEEDBACK_DIR, sanitizedId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (err) {
    console.error('Feedback read error:', err.message);
    res.status(500).json({ error: 'Failed to read feedback report' });
  }
});

app.patch('/api/feedback/:id', (req, res) => {
  try {
    const sanitizedId = path.basename(req.params.id);
    if (!/^feedback-\d+-[a-f0-9]+\.json$/.test(sanitizedId)) {
      return res.status(400).json({ error: 'Invalid feedback ID format' });
    }
    const filePath = path.join(FEEDBACK_DIR, sanitizedId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const { resolved } = req.body;
    
    if (typeof resolved !== 'boolean') {
      return res.status(400).json({ error: 'resolved field must be a boolean' });
    }

    data.resolved = resolved;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ success: true, id: sanitizedId, resolved: data.resolved });
  } catch (err) {
    console.error('Feedback update error:', err.message);
    res.status(500).json({ error: 'Failed to update feedback report' });
  }
});

// Token-protected public endpoint for /start to fetch unresolved feedback.
// Returns compact form (no screenshots, no metadata) for low token cost.
// Requires FEEDBACK_TOKEN env var; rejects with 503 if unset to avoid
// accidental public exposure when deployed without a token.
function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

app.get('/api/public/feedback/open', (req, res) => {
  try {
    const expected = process.env.FEEDBACK_TOKEN;
    if (!expected) {
      return res.status(503).json({ error: 'Endpoint disabled: FEEDBACK_TOKEN not set' });
    }

    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const provided = queryToken || bearerToken;

    if (!provided || !timingSafeEqualStr(provided, expected)) {
      return res.status(401).json({ error: 'Invalid or missing token' });
    }

    ensureFeedbackDir();

    const files = fs.readdirSync(FEEDBACK_DIR).filter(f => f.endsWith('.json'));
    const reports = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR, f), 'utf8'));
        if (data.resolved === true) return null;
        return {
          id: f.replace(/\.json$/, ''),
          createdAt: data.createdAt,
          whatDoing: data.whatDoing,
          whatWrong: data.whatWrong,
          contact: data.contact || null,
          // Promote version + gitCommit from metadata to top-level so the
          // dashboard can tell at a glance whether a report is pre-fix or
          // post-fix. Older reports lacking these will surface as null.
          version: data.metadata && data.metadata.version ? data.metadata.version : null,
          gitCommit: data.metadata && data.metadata.gitCommit ? data.metadata.gitCommit : null,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ reports, count: reports.length });
  } catch (err) {
    console.error('Public feedback fetch error:', err.message);
    res.status(500).json({ error: 'Failed to read feedback' });
  }
});

// ===== SPA FALLBACK & ERROR HANDLERS =====
// For non-API routes, serve index.html (SPA client-side routing)
app.use((req, res, next) => {
  // If it's an API route, return 404 JSON
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return res.status(404).json({
      error: 'Not Found',
      path: req.path,
      availableEndpoints: [
        'GET /health',
        'GET /api/games',
        'POST /api/games',
        'GET /api/games/:gameId/state',
        'POST /api/games/:gameId/state',
        'GET /api/logs',
        'GET /api/logs/summary',
        'POST /api/admin/save-source-files',
        'POST /api/admin/reset-to-baseline',
        'POST /api/feedback',
        'GET /api/feedback',
        'GET /api/feedback/:id',
        'PATCH /api/feedback/:id',
        'GET /api/public/feedback/open'
      ]
    });
  }

  // For all other routes, serve index.html (SPA routing)
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  // If no dist folder, return simple error
  res.status(404).send('Not Found - Frontend not built. Run npm run build first.');
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error'
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

    // Initialize WebSocket server after HTTP server is listening
    initializeWebSocket(server, games);

    console.log('');
    console.log('🚀 Multi-Game Server started');
    console.log(`   Port: ${actualPort}`);
    console.log(`   WebSocket: ws://0.0.0.0:${actualPort}/ws`);
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
