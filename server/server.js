// server/server.js
// Multi-Device, Multi-Game Server for Code2027
// Features:
// - Multiple independent game sessions (G1, G2, G3, etc.)
// - Auto-save games to file (survives restarts)
// - Game expiration (24 hours of inactivity)
// - Visitor logging (IP, device, actions)

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { initializeWebSocket, broadcastStateUpdate, broadcastToAllRooms, getRoomStats, validateStateSchema, getConnectedPlayerIds } from './websocket.js';
import { processGameData } from './processGameData.js';
import { timingSafeEqualStr, checkAdminPassword, checkFeedbackAccess } from './authGuards.js';
import { isHomeIP as isHomeIPPure, ipv6Prefix64 } from './homeIP.js';
import { parseLogLine, aggregateVisitorStats } from './visitorStats.js';
import { aggregateEngagementStats } from './engagementStats.js';
import geoip from 'geoip-lite';
import {
  DEFAULT_INSTANCE_ID,
  createInstance,
  loadInstance,
  saveInstance,
  checkInstanceWriteAccess,
  instanceOwnedBy,
  setInstanceOwner,
  deleteInstance,
  removeAccountFromAllInstances,
  listInstanceIds,
  setSlotPositions,
  setSlotUsed,
  createTeacherCopy,
  updateTeacherCopy,
  deleteTeacherCopy,
  addInsertion,
  updateInsertion,
  removeInsertion,
  setEdgeWaypoints,
  clearEdgeWaypoint,
  clearAllEdgeWaypoints,
  setEdgeAnchor,
  clearEdgeAnchor,
  clearAllEdgeAnchors,
  VALID_OWNER_TIERS,
} from './instanceStore.js';
import { validateConfig } from './instanceValidation.js';
import { buildCatalog } from './instanceCatalog.js';
import { parseCsvWithHeaders } from './processGameData.js';
import {
  computeStockVersion,
  ensureFreshBake,
  readBakeStamp,
  resolvedDir,
} from './instanceResolver.js';
import { computeMigrationPlan, applyMigrationPlan, formatMigrationPlan } from './migrateInstance.js';
import {
  createAccount,
  deleteAccount,
  resetPassword,
  verifyLogin,
  getAccount,
  loadAccounts,
  publicAccount,
  createSession,
  verifySession,
  revokeSession,
  revokeAccountSessions,
} from './accountStore.js';
import { sendReminder, isMailerConfigured, CARRIER_GATEWAYS, resolveRecipient, sendOwnerAlert } from './mailer.js';
import {
  initReminderScheduler,
  isPushConfigured,
  getVapidPublicKey,
  schedulePush,
  scheduleMail,
} from './reminderScheduler.js';

const app = express();
app.disable('x-powered-by'); // removes the Express framework-fingerprint header
// Production traffic runs Cloudflare -> Nginx Proxy Manager -> this container
// (verified 2026-07-25: DNS resolves to Cloudflare IPs; NPM's proxy_host config
// forwards to this container with proxy_add_x_forwarded_for). Without this,
// Express's own req.ip falls back to the immediate TCP peer -- NPM's address --
// so every visitor behind the same reverse proxy collapses into one identity
// for anything reading req.ip directly (e.g. the admin/login rate limiters),
// and rate-limiting stops being per-visitor. `2` trusts exactly those two
// hops and no more.
app.set('trust proxy', 2);
const DEFAULT_PORT = 3001;

// ===== CONFIGURATION =====
const CONFIG = {
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

  // Settings file path (admin-toggleable runtime settings, e.g. alert kill switch)
  SETTINGS_FILE: process.env.SETTINGS_FILE || './server/data/settings.json',

  // Manual override for the "home" IP the foreign-game alert compares
  // against. The server auto-detects its own public IP on startup (see
  // detectHomeIP below) and re-checks it daily, so this is normally left
  // blank — only set it if auto-detection is wrong for your network
  // (e.g. a proxy in front of the server that changes what IP-echo
  // services see).
  HOME_IP: process.env.HOME_IP || '',

  // Admin password hash (SHA-256). MUST be set via ADMIN_PASSWORD_HASH env var.
  // Generate: node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '',
};

initReminderScheduler(CONFIG.DATA_DIR);

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://game.unravelcodes.com', 'http://localhost:3000', 'http://localhost:3001']
}));
app.use(express.json({ limit: '10mb' }));

// Security headers
//
// CSP/HSTS/Permissions-Policy were deferred 2026-07-25 (TODO.md) pending a
// full survey of every external/inline resource the client bundle loads,
// because this app leans on inline style={{...}} everywhere (React) and
// embeds a live cross-origin iframe (the dictionary panel, dashboard.
// unravelcodes.com) — a too-strict policy would silently break the live
// site in ways the test suite can't catch (jsdom doesn't enforce CSP at
// all). Surveyed 2026-07-30 (grepped every fetch/WebSocket/iframe/image
// origin in src/, and index.html's own markup) before writing this:
//
// - script-src: 'self' only. The one inline <script> index.html used to
//   carry (module-load error handler + reload button) is now the external
//   /error-handler.js file instead of an inline block, specifically so
//   this can stay 'unsafe-inline'-free with no CSP hash to keep in sync by
//   hand. static.cloudflareinsights.com is Cloudflare's own auto-injected
//   analytics beacon (see error-handler.js's comment) — allowed so this
//   header doesn't silently change what Cloudflare collects at the edge.
// - style-src: needs 'unsafe-inline' — React's style={{...}} prop renders
//   as literal style="..." attributes throughout this app, which CSP's
//   style-src governs the same as a <style> tag. Low-risk relative to
//   script 'unsafe-inline': CSS injection enables UI redress/exfil via
//   crafted selectors, not code execution.
// - img-src: 'self' + data: (html2canvas's FeedbackButton screenshot
//   capture renders to a data: URI) + iqarius.com (glossary term images,
//   src/dictionary/data/glossary.json's imageUrl fields).
// - connect-src: 'self' (same-origin fetch/XHR/WebSocket — getBackendURL()
//   in networkDetection.ts returns '' in production, so every internal
//   API/WS call resolves same-origin) + dashboard.unravelcodes.com
//   (remoteConfig.ts's config endpoint, terms.ts's live glossary fetch) +
//   api.github.com (useGitHubSyncStatus.ts's version-check ping).
// - frame-src: dashboard.unravelcodes.com only, for DictionaryPanel's
//   embedded iframe (src/dictionary/components/DictionaryPanel.tsx).
// - worker-src 'self': the PWA service worker (public/sw.js).
// - frame-ancestors 'none': the CSP-native form of the X-Frame-Options:
//   DENY already set below — kept for browsers that prefer CSP over the
//   legacy header.
// - object-src 'none', base-uri 'self', form-action 'self': no <object>/
//   <embed> plugins and no native <form action> anywhere in this app
//   (ReminderHub.tsx's one <form> is onSubmit-handled, never submits
//   natively) — standard hardening with zero behavior change.
//
// Permissions-Policy explicitly restricts only features confirmed unused
// anywhere in src/ (camera, microphone, geolocation, payment, usb,
// motion sensors). clipboard-write and fullscreen are both left
// unlisted/default-allowed on purpose — ShareGameButton, PlaytesterLanding
// Page, and ShutdownNotice all call navigator.clipboard.writeText(), and
// GameLayout/ProjectProgress both call requestFullscreen() for TV mode.
//
// HSTS caution: includeSubDomains means ANY unravelcodes.com subdomain
// must be HTTPS-only or browsers that saw this header will refuse plain
// HTTP to it for a year — every subdomain referenced from this app
// (dashboard.unravelcodes.com) is already accessed via https:// only, so
// this should be a no-op in practice, but it's a browser-side commitment
// that's slow to undo (waits out max-age), unlike CSP which is scoped to
// one response. No `preload` — that submits to the browser-shipped HSTS
// preload list, which is close to irreversible; not doing that without an
// explicit ask.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'interest-cohort=()',
  ].join(', '));
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://iqarius.com",
    "font-src 'self'",
    "connect-src 'self' https://dashboard.unravelcodes.com https://api.github.com",
    "frame-src https://dashboard.unravelcodes.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; '));
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

// ===== TEACHER INSTANCE LAYER (Phase 1) =====
// docs/core/TEACHER_LAYER_DESIGN.md. Stock (SOURCE/CLEAN/BASELINE in the
// writable dir) now follows every deploy; per-classroom customizations live
// in instances/<id>/config.json and are overlaid back by the bake. There is
// no merge step anywhere — that is what kills the data-deploy gap.
const instancesRoot = path.join(writableDataDir, 'instances');
let instanceLayerActive = false;

// ===== TEACHER ACCOUNTS (Phase 3) =====
// Teacher logins + sessions live alongside the instances they own. The
// session token arrives in the x-teacher-session header; resolving it to an
// accountId is how a logged-in teacher authorizes writes to owned classrooms
// (instanceStore.checkInstanceWriteAccess accepts the accountId).
const accountsRoot = path.join(writableDataDir, 'accounts');

/** Resolve a request's teacher session to an accountId, or null. */
function resolveTeacherAccountId(req) {
  const session = verifySession(accountsRoot, req.headers['x-teacher-session']);
  return session ? session.accountId : null;
}

function copyStockSubdirs(distDataDir) {
  for (const sub of ['SOURCE_FILES', 'CLEAN_FILES', 'BASELINE']) {
    const src = path.join(distDataDir, sub);
    const dst = path.join(writableDataDir, sub);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      const srcFile = path.join(src, file);
      if (!fs.statSync(srcFile).isFile()) continue;
      fs.copyFileSync(srcFile, path.join(dst, file));
    }
    console.log(`   Copied ${sub}/`);
  }
}

// One-time capture of the pre-instance-layer working copy: tile positions
// become classroom-1 config; every other live-vs-stock difference is stale
// content (logged, replaced by stock — the 2026-06-09 rule, codified).
// Idempotent: a no-op once classroom-1 exists.
function migrateLegacyWorkingCopy(distDataDir) {
  try {
    if (loadInstance(instancesRoot, DEFAULT_INSTANCE_ID)) return;
  } catch (err) {
    // Existing-but-corrupt config: never re-migrate over it, that could
    // mask a recoverable classroom. Surface and leave it for the admin.
    console.error(`⚠️ ${DEFAULT_INSTANCE_ID} config exists but is unreadable: ${err.message}`);
    return;
  }
  const liveSpacesPath = path.join(writableSourceDir, 'Spaces.csv');
  const stockSpacesPath = path.join(distDataDir, 'SOURCE_FILES', 'Spaces.csv');
  if (!fs.existsSync(liveSpacesPath) || !fs.existsSync(stockSpacesPath)) return;

  // Positions also come from CLEAN GAME_CONFIG.csv (where the legacy editor
  // saved them); read it when present, fall back to SOURCE-only otherwise.
  const liveGameConfigPath = path.join(writableCleanDir, 'GAME_CONFIG.csv');
  const stockGameConfigPath = path.join(distDataDir, 'CLEAN_FILES', 'GAME_CONFIG.csv');
  const hasGameConfig = fs.existsSync(liveGameConfigPath) && fs.existsSync(stockGameConfigPath);

  const plan = computeMigrationPlan({
    liveSpacesCsv: fs.readFileSync(liveSpacesPath, 'utf-8'),
    stockSpacesCsv: fs.readFileSync(stockSpacesPath, 'utf-8'),
    liveGameConfigCsv: hasGameConfig ? fs.readFileSync(liveGameConfigPath, 'utf-8') : undefined,
    stockGameConfigCsv: hasGameConfig ? fs.readFileSync(stockGameConfigPath, 'utf-8') : undefined,
  });
  applyMigrationPlan({ instancesRoot, plan, id: DEFAULT_INSTANCE_ID, displayName: 'Classroom 1' });
  console.log(`🏫 Migrated live board into "${DEFAULT_INSTANCE_ID}": ${Object.keys(plan.positions).length} tile position(s) preserved`);
  if (plan.contentDrift.length || plan.liveOnlySpaces.length) {
    console.log('🏫 Migration detail (stale live content below is replaced by stock):');
    console.log(formatMigrationPlan(plan));
  }
}

function initWritableData() {
  const distDataDir = path.join(distPath, 'data');
  const needsFullInit = !fs.existsSync(path.join(writableSourceDir, 'Spaces.csv'));

  if (needsFullInit) {
    backupSourceFiles('pre-init');
    console.log('📋 Initializing writable data from dist...');
    copyStockSubdirs(distDataDir);
    return;
  }

  // Capture legacy customizations BEFORE the stock refresh can overwrite them.
  migrateLegacyWorkingCopy(distDataDir);

  // Stock refresh: SOURCE/CLEAN/BASELINE follow the deploy whenever the
  // shipped data differs from the working copy. (Replaces the old
  // first-boot-only rule that caused the data-deploy gap. Live edits to
  // stock — e.g. via the content editor — do not survive this; content's
  // home is the repo, per spec decision 3.)
  const distVersion = computeStockVersion(distDataDir);
  const writableVersion = computeStockVersion(writableDataDir);
  if (distVersion !== writableVersion) {
    backupSourceFiles('pre-stock-refresh');
    console.log('📋 Refreshing stock data from new deploy...');
    copyStockSubdirs(distDataDir);
  } else {
    console.log('📋 Stock data already current');
  }
}

// Boot-time bake, fault-isolated: a corrupt classroom config must never
// block the server from starting (spec). On failure we fall back to
// serving the writable stock directly, exactly like pre-instance-layer.
function initInstanceLayer() {
  try {
    let config = loadInstance(instancesRoot, DEFAULT_INSTANCE_ID);
    if (!config) {
      config = createInstance(instancesRoot, { id: DEFAULT_INSTANCE_ID, displayName: 'Classroom 1' });
      console.log(`🏫 Created instance "${DEFAULT_INSTANCE_ID}"`);
    }
    const { rebaked } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });
    console.log(rebaked ? `🏫 Baked resolved board for "${DEFAULT_INSTANCE_ID}"` : `🏫 Resolved board for "${DEFAULT_INSTANCE_ID}" is fresh`);
    instanceLayerActive = true;
  } catch (err) {
    console.error('❌ Instance layer init failed — falling back to legacy data serving:', err.message);
    instanceLayerActive = false;
  }
}

// Rebake the default classroom if its config or the stock changed. Used by
// the positions endpoint, the content editor save, and the game-create gate
// (spec: game creation requires configVersion == resolvedVersion).
// Rebake a specific classroom (Phase 3 generalizes the default-only helper).
function rebakeInstance(id) {
  const config = loadInstance(instancesRoot, id);
  if (!config) throw new Error(`Instance "${id}" not found`);
  return ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });
}
function rebakeDefaultInstance() {
  return rebakeInstance(DEFAULT_INSTANCE_ID);
}

// Generate a unique, URL-safe classroom id from a teacher-supplied name.
// Teachers name a room ("Room 4B"); the id is derived ("room-4b") and
// de-duplicated with a numeric suffix, so a teacher never has to invent an
// id and createInstance's id rules are always satisfied.
function generateInstanceId(displayName) {
  let base = String(displayName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) base = 'room';
  const existing = new Set(listInstanceIds(instancesRoot));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// Per-instance static middlewares, cached by id. The resolved dir path is
// constant per instance (the bake swaps its CONTENTS atomically under the
// same path), so a cached express.static stays correct across re-bakes.
const instanceStaticCache = new Map();
function instanceStatic(id) {
  if (!instanceStaticCache.has(id)) {
    instanceStaticCache.set(id, express.static(resolvedDir(instancesRoot, id)));
  }
  return instanceStaticCache.get(id);
}

if (fs.existsSync(distPath)) {
  initWritableData();
  initInstanceLayer();

  // Per-instance resolved board (Phase 3): /data/i/<id>/CLEAN_FILES/... — how
  // a game bound to a non-default classroom loads its board. The id regex
  // blocks path traversal (no '.' or '/'). Baking is the responsibility of
  // create/mutation/game-create (same model as the default classroom below);
  // serving stays a fast static read. Must be registered BEFORE the generic
  // '/data' static or that would swallow '/data/i/...' as classroom-1 files.
  app.use('/data/i/:instanceId', (req, res, next) => {
    if (!instanceLayerActive) return res.status(404).end();
    const id = req.params.instanceId;
    // resolvedDir validates id (SECURITY: path traversal, 2026-07-21 audit)
    // and throws on anything outside the classroom-id shape.
    let dir;
    try {
      dir = resolvedDir(instancesRoot, id);
    } catch {
      return res.status(400).end();
    }
    if (!fs.existsSync(dir)) return res.status(404).end();
    return instanceStatic(id)(req, res, next);
  });

  // Default classroom (classroom-1) served at /data — players unchanged.
  // Resolved data first (stock + teacher overlay, baked); the writable stock
  // is the fallback when the instance layer is down. The static root path is
  // constant — the bake swaps the directory under it atomically, so requests
  // always see a complete set.
  const resolvedStatic = express.static(resolvedDir(instancesRoot, DEFAULT_INSTANCE_ID));
  app.use('/data', (req, res, next) => {
    if (!instanceLayerActive) return next();
    resolvedStatic(req, res, next);
  });
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
 * Get client IP address from request. `cf-connecting-ip` is checked first:
 * Cloudflare's edge always overwrites this header with the actual connecting
 * IP it saw, so it can't be spoofed by a crafted request -- unlike
 * `x-forwarded-for`, whose leftmost (client-supplied) entry a visitor can set
 * to anything. Falls back to the older header/socket chain for traffic that
 * doesn't come through Cloudflare (local dev, direct LAN access).
 */
function getClientIP(req) {
  return req.headers['cf-connecting-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || 'unknown';
}

// Auto-detected public IP(s) of the machine running this server, refreshed
// periodically so an ISP-reassigned home IP doesn't need a manual update.
// CONFIG.HOME_IP (if set) always wins over these. Tracked separately per
// address family — see isHomeIP()'s comment for why IPv4 uses exact match
// but IPv6 uses prefix match.
let detectedHomeIP = '';
let detectedHomeIPv6 = '';

// True once each detection has resolved at least once (success or all
// providers exhausted) since this process started. Both detectHomeIP() and
// detectHomeIPv6() are fired-and-forgotten at startup rather than awaited
// (so they don't delay the server accepting traffic), which means there's a
// real window — every restart — between "server is listening" and
// "outbound geo-IP lookup resolved". Without these flags, isHomeIP() would
// fail toward alerting for that whole window, and the visit most likely to
// land in it is the maintainer's own "did the deploy work?" check right
// after a restart.
let homeIPDetectionSettled = false;
let homeIPv6DetectionSettled = false;

const IP_ECHO_SERVICES = [
  'https://api.ipify.org',
  'https://ifconfig.me/ip',
  'https://icanhazip.com',
];

// IPv6-only hostnames (no A record) so the OS can't silently fall back to
// IPv4 and hand us the wrong family — if the server truly has no IPv6
// route, these simply fail/timeout and detectedHomeIPv6 stays blank, which
// isHomeIP() treats the same safe way plain detection failure already is.
const IPV6_ECHO_SERVICES = [
  'https://ipv6.icanhazip.com',
  'https://api64.ipify.org',
];

async function detectHomeIP() {
  for (const url of IP_ECHO_SERVICES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const text = (await response.text()).trim();
      // Crude sanity check: looks like an IPv4/IPv6 address, not an HTML error page
      if (text && text.length <= 45 && /^[0-9a-fA-F:.]+$/.test(text)) {
        detectedHomeIP = text;
        console.log(`🏠 Auto-detected home IP: ${detectedHomeIP} (via ${url})`);
        homeIPDetectionSettled = true;
        return;
      }
    } catch (err) {
      console.warn(`⚠️ Could not detect home IP via ${url}: ${err.message}`);
    }
  }
  console.warn('⚠️ Could not auto-detect home IP from any provider. Foreign-game alerts will fire for every non-private IP until this succeeds (or set HOME_IP manually).');
  homeIPDetectionSettled = true;
}

async function detectHomeIPv6() {
  for (const url of IPV6_ECHO_SERVICES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const text = (await response.text()).trim();
      if (ipv6Prefix64(text)) {
        detectedHomeIPv6 = text;
        console.log(`🏠 Auto-detected home IPv6: ${detectedHomeIPv6} (via ${url})`);
        homeIPv6DetectionSettled = true;
        return;
      }
    } catch (err) {
      console.warn(`⚠️ Could not detect home IPv6 via ${url}: ${err.message}`);
    }
  }
  // Not a warning-worthy failure on its own — plenty of home networks/ISPs
  // genuinely have no IPv6 — isHomeIP() falls back to the IPv4-only
  // comparison for any IPv6 client in that case.
  console.log('ℹ️ No IPv6 home address detected (server may not have IPv6 connectivity). IPv6 players will be compared against the IPv4 home IP only.');
  homeIPv6DetectionSettled = true;
}

if (!CONFIG.HOME_IP) {
  detectHomeIP();
  detectHomeIPv6();
  setInterval(detectHomeIP, 24 * 60 * 60 * 1000); // re-check daily in case the ISP reassigns it
  setInterval(detectHomeIPv6, 24 * 60 * 60 * 1000);
}

/**
 * True if the given IP should be treated as "home" for the foreign-game
 * alert. Thin wrapper around the pure isHomeIP() in homeIP.js — this
 * function just supplies the current mutable detection state (which can't
 * live in the pure module, since server.js can't be imported directly in
 * tests but needs real async detection at runtime). See homeIP.js for the
 * actual decision logic and why IPv6 is compared by /64 prefix rather than
 * exact address.
 */
function isHomeIP(ip) {
  return isHomeIPPure(ip, {
    homeIPOverride: CONFIG.HOME_IP,
    detectedHomeIPv4: detectedHomeIP,
    detectedHomeIPv6,
    homeIPDetectionSettled,
    homeIPv6DetectionSettled,
  });
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

// ===== ADMIN SETTINGS (persisted, toggled from the Admin Tools screen) =====

let settings = {
  foreignGameAlertsEnabled: true,
};

function loadSettings() {
  try {
    if (fs.existsSync(CONFIG.SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.SETTINGS_FILE, 'utf8'));
      settings = { ...settings, ...data };
    }
  } catch (err) {
    console.error('❌ Failed to load settings:', err.message);
  }
}

function saveSettings() {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG.SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('❌ Failed to save settings:', err.message);
  }
}

loadSettings();

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

// Unambiguous alphabet for human-typed codes - no 0/O, 1/I/L (easily confused
// when read aloud or handwritten on a whiteboard).
const GAME_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GAME_ID_SEGMENT_LEN = 4;
const GAME_ID_MAX_ATTEMPTS = 50;

/**
 * Generate a cryptographically random, human-typeable game ID (e.g. G-A7F9-K3PX).
 * Old sequential IDs (G1, G7, ...) from before this change remain valid for
 * games already in storage - this only affects newly created games. Random
 * IDs are what make the join-info code-is-the-secret model (see the route's
 * doc comment) safe: sequential IDs were enumerable, these aren't.
 */
function generateGameId() {
  for (let attempt = 0; attempt < GAME_ID_MAX_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < GAME_ID_SEGMENT_LEN * 2; i++) {
      code += GAME_ID_ALPHABET[crypto.randomInt(GAME_ID_ALPHABET.length)];
    }
    const id = `G-${code.slice(0, GAME_ID_SEGMENT_LEN)}-${code.slice(GAME_ID_SEGMENT_LEN)}`;
    if (!games.has(id)) {
      isDirty = true;
      return id;
    }
  }
  throw new Error(`Failed to generate a unique game ID after ${GAME_ID_MAX_ATTEMPTS} attempts`);
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
// Counts only — no per-game detail. /health used to list every gameId
// (and websocket room keys, which ARE gameIds), but game codes are the
// join secret (join-info exchanges a code for the game token), so the
// public health check leaked what the 2026-06-12 GET /api/games lock
// protects. Both client consumers (ConnectionStatus, networkDetection)
// only check response.ok and never read the body. Per-game detail lives
// behind admin auth at /api/debug/games.
app.get('/health', (req, res) => {
  const wsStats = getRoomStats();
  res.json({
    status: 'ok',
    // Same scope fix as commit 95f46f9 (startup log): `currentVersion` is
    // declared inside initWritableData() and is not in scope here. Read
    // process.env directly so the /health handler doesn't throw.
    version: process.env.VITE_GIT_COMMIT || 'dev',
    timestamp: formatTimestamp(),
    activeGames: games.size,
    websocket: { totalRooms: wsStats.totalRooms, totalClients: wsStats.totalClients }
  });
});

// ===== RATE LIMITING =====
// Factory so unrelated auth surfaces (admin password, teacher login) get
// independent per-IP buckets — a school's shared public IP shouldn't let
// one teacher's mistyped login throttle everyone else's admin access, or
// vice versa.
function createRateLimiter(maxAttempts, windowMs) {
  const attempts = new Map(); // IP -> { count, resetAt }
  return function checkRateLimit(req, res) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = attempts.get(ip);
    if (entry && now < entry.resetAt) {
      if (entry.count >= maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.status(429).json({ success: false, error: `Too many attempts. Retry after ${retryAfter}s` });
        return false;
      }
      entry.count++;
    } else {
      attempts.set(ip, { count: 1, resetAt: now + windowMs });
    }
    return true;
  };
}

const checkAdminRateLimit = createRateLimiter(5, 15 * 60 * 1000); // 5 per 15 min
const checkLoginRateLimit = createRateLimiter(5, 15 * 60 * 1000); // 5 per 15 min

// ===== FOREIGN-GAME ALERT THROTTLE =====
// A global cap, not per-IP: the kill switch (settings.foreignGameAlertsEnabled)
// is all-or-nothing, but with it on, a burst of qualifying game starts —
// same visitor retrying, or several different ones — must not spam the
// developer's phone via the carrier-gateway SMS path. No dedup needed
// beyond a simple count; the alert body already includes gameId/IP for
// context on whichever ones do get through.
const ALERT_CAP = { maxPerHour: 5, windowMs: 60 * 60 * 1000 };
let alertWindow = { count: 0, resetAt: 0 };
function canSendForeignGameAlert() {
  const now = Date.now();
  if (now >= alertWindow.resetAt) {
    alertWindow = { count: 0, resetAt: now + ALERT_CAP.windowMs };
  }
  if (alertWindow.count >= ALERT_CAP.maxPerHour) return false;
  alertWindow.count++;
  return true;
}

// ===== ADMIN AUTHENTICATION =====

app.post('/api/admin/verify', (req, res) => {
  if (!checkAdminRateLimit(req, res)) return;
  if (!requireAdmin(req, res)) {
    logVisitor(req, 'ADMIN_AUTH_FAILED');
    return;
  }
  logVisitor(req, 'ADMIN_AUTH_SUCCESS');
  res.json({ success: true });
});

// ===== ADMIN: SAVE SOURCE FILES & REGENERATE =====

app.post('/api/admin/save-source-files', (req, res) => {
  if (!checkAdminRateLimit(req, res)) return;
  if (!requireAdmin(req, res)) {
    logVisitor(req, 'SAVE_SOURCE_FILES_AUTH_FAILED');
    return;
  }
  const { spacesCSV, diceRollCSV, modalConfigCSV } = req.body;

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

    // The edit above changed stock, so the served (resolved) data is stale
    // until rebaked. Note: live stock edits do not survive the next deploy
    // (spec decision 3 — content's home is the repo).
    step = 'rebake';
    if (instanceLayerActive) rebakeDefaultInstance();

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
  if (!checkAdminRateLimit(req, res)) return;
  if (!requireAdmin(req, res)) {
    logVisitor(req, 'RESET_BASELINE_AUTH_FAILED');
    return;
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

    if (instanceLayerActive) rebakeDefaultInstance();

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

// ===== TEACHER INSTANCE LAYER ENDPOINTS (Phase 1) =====

// A logged-in teacher's own classrooms (Phase 3c). MUST be registered before
// '/api/instances/:id' or that route would capture "mine" as an id.
app.get('/api/instances/mine', (req, res) => {
  const accountId = resolveTeacherAccountId(req);
  if (!accountId) return res.status(401).json({ success: false, error: 'Not logged in' });
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const instances = [];
  for (const id of listInstanceIds(instancesRoot)) {
    try {
      const cfg = loadInstance(instancesRoot, id);
      if (cfg && instanceOwnedBy(cfg, accountId)) {
        const { writeToken: _writeToken, ...meta } = cfg.meta;
        instances.push({ ...meta, configVersion: cfg.configVersion });
      }
    } catch {
      // Skip a corrupt classroom rather than failing the whole list.
    }
  }
  res.json({ success: true, instances });
});

// Teacher self-service: a logged-in teacher creates a classroom they own.
// (Phase 3 polish, 2026-06-14 — the maintainer decided teachers shouldn't
// need the admin to make rooms. The admin can still create rooms on a
// teacher's behalf via /api/admin/instances.) The new room is owned by the
// caller automatically and its id is generated from the name.
app.post('/api/instances', (req, res) => {
  const accountId = resolveTeacherAccountId(req);
  if (!accountId) return res.status(401).json({ success: false, error: 'Not logged in' });
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  if (!getAccount(accountsRoot, accountId)) {
    return res.status(401).json({ success: false, error: 'Session no longer valid' });
  }
  const displayName = String((req.body && req.body.displayName) || '').trim();
  try {
    const id = generateInstanceId(displayName);
    const config = createInstance(instancesRoot, { id, displayName: displayName || undefined });
    setInstanceOwner(config, accountId);
    saveInstance(instancesRoot, config);
    // Bake immediately so the new classroom is playable right away.
    rebakeInstance(config.meta.id);
    const { writeToken: _writeToken, ...meta } = config.meta;
    logVisitor(req, 'INSTANCE_CREATED', { instanceId: config.meta.id, owner: accountId, via: 'teacher' });
    res.json({ success: true, instance: { ...meta, configVersion: config.configVersion } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Delete a classroom. A teacher may delete one they own; the admin may
// delete any. The default classroom can never be deleted. Running games
// already hold their own baked board, so deleting a classroom never
// disturbs a game in progress.
app.delete('/api/instances/:id', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const id = req.params.id;
  if (id === DEFAULT_INSTANCE_ID) {
    return res.status(400).json({ success: false, error: 'The default classroom cannot be deleted' });
  }
  let config;
  try {
    config = loadInstance(instancesRoot, id);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (!config) return res.status(404).json({ success: false, error: 'No such classroom' });
  const access = checkInstanceWriteAccess(config, {
    adminPassword: req.headers['x-admin-password'],
    adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
    accountId: resolveTeacherAccountId(req),
  });
  if (!access.ok) {
    logVisitor(req, 'INSTANCE_DELETE_DENIED', { instanceId: id });
    return res.status(access.status || 401).json({ success: false, error: access.error || 'Not authorized to delete this classroom' });
  }
  try {
    deleteInstance(instancesRoot, id);
    logVisitor(req, 'INSTANCE_DELETED', { instanceId: id, via: access.via });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Open read (access model: watching is open) — board layout is visible on
// the public board anyway. The write token is never included.
app.get('/api/instances/:id', (req, res) => {
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }
    const { writeToken: _writeToken, ...meta } = config.meta;
    // Last bake's validation report (warnings incl. schema drift + the
    // stock-updated staleness hints) — the catalog UI's data source.
    let validation = null;
    try {
      const reportPath = path.join(resolvedDir(instancesRoot, req.params.id), 'validation-report.json');
      if (fs.existsSync(reportPath)) validation = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch { /* report is informational — never fail the read over it */ }
    res.json({
      success: true,
      meta,
      configVersion: config.configVersion,
      slots: config.slots,
      detours: config.detours,
      teacherCopies: config.teacherCopies,
      resolved: readBakeStamp(instancesRoot, req.params.id),
      validation,
    });
  } catch (err) {
    console.error(`❌ Instance read failed for "${req.params.id}":`, err.message);
    res.status(500).json({ success: false, error: 'Instance config unreadable' });
  }
});

// The Classroom Setup screen's data source: the FULL stock deck (the
// resolved board omits switched-off spaces, so /data can't serve this),
// each card's classroom state, protection tiers, copies, and the last
// validation report. Open read — board content is public by design and
// the write token is never included.
app.get('/api/instances/:id/catalog', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }
    const { stockSpacesCsv, pathChoiceCsv, diceCsv, stockVersion } = readStockForValidation();
    const catalog = buildCatalog({ stockSpacesCsv, pathChoiceCsv, diceCsv, config, stockVersion });
    let validation = null;
    try {
      const reportPath = path.join(resolvedDir(instancesRoot, req.params.id), 'validation-report.json');
      if (fs.existsSync(reportPath)) validation = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch { /* informational only */ }
    res.json({
      success: true,
      ...catalog,
      copies: config.teacherCopies,
      configVersion: config.configVersion,
      validation,
    });
  } catch (err) {
    console.error(`❌ Catalog read failed for "${req.params.id}":`, err.message);
    res.status(500).json({ success: false, error: 'Catalog unavailable' });
  }
});

// Stock inputs for config validation, read from the writable stock (which
// follows the deploy). stockVersion keys the copies' staleness hints.
function readStockForValidation() {
  const stockSpacesCsv = fs.readFileSync(path.join(writableSourceDir, 'Spaces.csv'), 'utf-8');
  const pcPath = path.join(writableCleanDir, 'PATH_CHOICE_RULES.csv');
  const pathChoiceCsv = fs.existsSync(pcPath) ? fs.readFileSync(pcPath, 'utf-8') : null;
  // Dice table feeds 4b dice-edge validation + the catalog's dice-edge list.
  const dicePath = path.join(writableSourceDir, 'DiceRoll Info.csv');
  const diceCsv = fs.existsSync(dicePath) ? fs.readFileSync(dicePath, 'utf-8') : null;
  // Card Library stage 1b part ii: a teacher copy also captures its slot's
  // ModalConfig and LOGIC_QUESTIONS rows (see the /copies handler below).
  const modalPath = path.join(writableSourceDir, 'ModalConfig.csv');
  const modalCsv = fs.existsSync(modalPath) ? fs.readFileSync(modalPath, 'utf-8') : null;
  const logicPath = path.join(writableCleanDir, 'LOGIC_QUESTIONS.csv');
  const logicCsv = fs.existsSync(logicPath) ? fs.readFileSync(logicPath, 'utf-8') : null;
  return {
    stockSpacesCsv, pathChoiceCsv, diceCsv, modalCsv, logicCsv,
    stockVersion: computeStockVersion(writableDataDir),
  };
}

// Shared flow for catalog mutations: auth → mutate the loaded config →
// validate → dryRun returns the report unsaved (the hybrid confirm flow's
// preview) → otherwise errors reject with 422, clean configs save + bake.
function handleInstanceMutation(req, res, mutate) {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }
    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || (req.body && req.body.password),
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_MUTATION_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    // Optimistic concurrency (audit round 4): if the client sends the
    // configVersion its edit was based on and the classroom has since moved
    // on (another tab/teacher saved), reject with 409 rather than silently
    // clobbering that save. Backward-compatible — clients that omit it are
    // unaffected. Skipped for dryRun (a preview mutates nothing).
    const base = req.body && req.body.baseConfigVersion;
    if (base != null && !(req.body && req.body.dryRun) && base !== config.configVersion) {
      return res.status(409).json({
        success: false,
        error: 'This classroom was changed in another session — reload and reapply your edit',
        configVersion: config.configVersion,
      });
    }

    step = 'apply';
    const result = mutate(config) || {};
    step = 'validate';
    const stock = readStockForValidation();
    const report = validateConfig({ config, ...stock });
    if (req.body && req.body.dryRun) {
      // Nothing saved: the loaded config object is discarded.
      return res.json({ success: true, dryRun: true, report, ...result });
    }
    if (!report.ok) {
      return res.status(422).json({ success: false, report, ...result });
    }
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });
    logVisitor(req, 'INSTANCE_MUTATED', { instanceId: req.params.id, ...result });
    res.json({
      success: true,
      report,
      configVersion: config.configVersion,
      resolvedVersion: stamp.configVersion,
      ...result,
    });
  } catch (err) {
    console.error(`❌ Instance mutation failed (step: ${step}):`, err.message);
    const payload = { success: false, error: 'Instance update failed', step, detail: err.message };
    if (err.report) payload.report = err.report;
    res.status(err.statusCode || 500).json(payload);
  }
}

// Switch spaces on/off — the hybrid confirm flow's backend. The UI first
// POSTs with dryRun:true to get the report (pass-through suggestions,
// protection errors, detour candidates), shows the teacher the before/after
// path, and the confirmed call (optionally with a custom detour) saves.
app.post('/api/instances/:id/board', (req, res) => {
  const { changes } = req.body || {};
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
    return res.status(400).json({ success: false, error: 'changes object is required (space name → { used, detour? })' });
  }
  handleInstanceMutation(req, res, (config) => {
    for (const [space, change] of Object.entries(changes)) {
      if (!change || typeof change.used !== 'boolean') {
        const err = new Error(`Change for "${space}" needs a boolean "used"`);
        err.statusCode = 400;
        throw err;
      }
      setSlotUsed(config, space, change.used, change.detour);
    }
    return { changed: Object.keys(changes) };
  });
});

// Teacher copies: full copies of the current stock card under a stable id;
// the slot plays the copy, the stock original stays in the library.
app.post('/api/instances/:id/copies', (req, res) => {
  const { slot, overrides, tier } = req.body || {};
  if (!slot || typeof slot !== 'string') {
    return res.status(400).json({ success: false, error: 'slot (space name) is required' });
  }
  if (tier !== undefined && !VALID_OWNER_TIERS.has(tier)) {
    return res.status(400).json({
      success: false,
      error: `tier must be one of ${[...VALID_OWNER_TIERS].join(', ')}`,
    });
  }
  // PRIVILEGE BOUNDARY (CARD_LIBRARY_DESIGN.md stage 1). `official` means
  // "this card belongs to the curated library everyone gets", so minting one
  // is an ADMIN act, not something classroom write access grants.
  // handleInstanceMutation authorizes via checkInstanceWriteAccess, which
  // ALSO passes on the instance write token or a logged-in teacher who owns
  // the classroom — exactly right for an `individual` copy and exactly wrong
  // for an `official` one. Narrowest fix rather than reworking that shared
  // helper: require the admin password here, and do it BEFORE
  // handleInstanceMutation runs, so a refused attempt never loads, mutates,
  // saves or re-bakes the classroom. Omitted / `individual` tiers skip this
  // entirely, so Classroom Setup's behavior is unchanged.
  if (tier === 'official') {
    const admin = checkAdminPassword(
      req.headers['x-admin-password'] || (req.body && req.body.password),
      CONFIG.ADMIN_PASSWORD_HASH
    );
    if (!admin.ok) {
      logVisitor(req, 'OFFICIAL_CARD_DENIED', { instanceId: req.params.id, slot });
      return res.status(403).json({
        success: false,
        error: 'Creating an official card requires admin authentication',
      });
    }
  }
  handleInstanceMutation(req, res, (config) => {
    const { stockSpacesCsv, diceCsv, modalCsv, logicCsv, stockVersion } = readStockForValidation();
    const stockRows = parseCsvWithHeaders(stockSpacesCsv).filter(r => r.space_name === slot);
    if (stockRows.length === 0) {
      const err = new Error(`No such space in stock: "${slot}"`);
      err.statusCode = 404;
      throw err;
    }
    // A card owns its slot's dice outcomes too (CARD_LIBRARY_DESIGN.md stage
    // 1b). Parsed and filtered here, mirroring stockRows above; a space with
    // no dice rows yields [] and createTeacherCopy then writes no diceRows key
    // at all — absent, which the bake reads as "use stock".
    const stockDiceRows = diceCsv
      ? parseCsvWithHeaders(diceCsv).filter(r => r.space_name === slot)
      : [];
    // Same treatment for modal copy and logic-question wording (stage 1b
    // part ii). Empty filters yield [] → createTeacherCopy writes no key at
    // all for either, same absent-means-stock rule.
    const stockModalRows = modalCsv
      ? parseCsvWithHeaders(modalCsv).filter(r => r.space_name === slot)
      : [];
    const stockLogicRows = logicCsv
      ? parseCsvWithHeaders(logicCsv).filter(r => r.space_name === slot)
      : [];
    const copyId = createTeacherCopy(config, {
      slotName: slot, stockRows, stockDiceRows, stockModalRows, stockLogicRows,
      overrides, stockVersion, tier,
    });
    return { copyId, slot, tier: config.teacherCopies[copyId].owner.tier };
  });
});

app.patch('/api/instances/:id/copies/:copyId', (req, res) => {
  const { overrides } = req.body || {};
  if (!overrides || typeof overrides !== 'object' || Object.keys(overrides).length === 0) {
    return res.status(400).json({ success: false, error: 'overrides object is required (visit_type → fields)' });
  }
  handleInstanceMutation(req, res, (config) => {
    if (!config.teacherCopies[req.params.copyId]) {
      const err = new Error(`No such copy: "${req.params.copyId}"`);
      err.statusCode = 404;
      throw err;
    }
    updateTeacherCopy(config, req.params.copyId, overrides);
    return { copyId: req.params.copyId };
  });
});

app.delete('/api/instances/:id/copies/:copyId', (req, res) => {
  handleInstanceMutation(req, res, (config) => {
    if (!config.teacherCopies[req.params.copyId]) {
      const err = new Error(`No such copy: "${req.params.copyId}"`);
      err.statusCode = 404;
      throw err;
    }
    deleteTeacherCopy(config, req.params.copyId);
    return { copyId: req.params.copyId, deleted: true };
  });
});

// Teacher-authored insertions (Phase 4a/4b): a new narrative space spliced onto
// an A→B edge (fixed, choice, or dice). Same hybrid-confirm/validate/bake flow
// as copies — a topology error (missing edge, lock-point edge, switched-off
// endpoint, id collision, bad card draw) comes back as a 422 with the
// validation report; dryRun previews unsaved.
app.post('/api/instances/:id/insertions', (req, res) => {
  const { from, to, displayName, story, time, fee, feePercent, feeBasis, pos_x, pos_y, cardDraw, diceOutcomes } = req.body || {};
  if (!from || !to || !displayName) {
    return res.status(400).json({ success: false, error: 'from, to, and displayName are required' });
  }
  handleInstanceMutation(req, res, (config) => {
    const id = addInsertion(config, { from, to, displayName, story, time, fee, feePercent, feeBasis, pos_x, pos_y, cardDraw, diceOutcomes });
    return { insertionId: id, from, to };
  });
});

app.patch('/api/instances/:id/insertions/:insertionId', (req, res) => {
  const patch = req.body && req.body.patch;
  if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, error: 'patch object is required (field → value)' });
  }
  handleInstanceMutation(req, res, (config) => {
    if (!config.insertions || !config.insertions[req.params.insertionId]) {
      const err = new Error(`No such insertion: "${req.params.insertionId}"`);
      err.statusCode = 404;
      throw err;
    }
    updateInsertion(config, req.params.insertionId, patch);
    return { insertionId: req.params.insertionId };
  });
});

app.delete('/api/instances/:id/insertions/:insertionId', (req, res) => {
  handleInstanceMutation(req, res, (config) => {
    if (!config.insertions || !config.insertions[req.params.insertionId]) {
      const err = new Error(`No such insertion: "${req.params.insertionId}"`);
      err.statusCode = 404;
      throw err;
    }
    removeInsertion(config, req.params.insertionId);
    return { insertionId: req.params.insertionId, deleted: true };
  });
});

// Tile positions (board drag-save). Replaces the old whole-Spaces.csv
// round-trip through /api/admin/save-source-files — positions are classroom
// config now, so they survive every deploy by construction. Auth: the
// instance write token or the admin password (watching open, touching keyed).
app.post('/api/instances/:id/positions', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const { positions } = req.body || {};
  if (!positions || typeof positions !== 'object' || Object.keys(positions).length === 0) {
    return res.status(400).json({ success: false, error: 'positions object is required' });
  }

  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || req.body.password,
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_POSITIONS_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    const applied = setSlotPositions(config, positions);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_POSITIONS_SAVED', { instanceId: req.params.id, spaces: applied });
    res.json({
      success: true,
      applied,
      configVersion: config.configVersion,
      resolvedVersion: stamp.configVersion,
    });
  } catch (err) {
    console.error(`❌ Position save failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to save positions', step, detail: err.message });
  }
});

// Edge waypoint redirects (G160). Same shape as positions above — pure
// display data (which point a badly auto-routed connector should bend
// through), not gameplay logic, so no validateConfig/bake-affecting content
// changes are involved; ensureFreshBake here only keeps the bake stamp's
// configVersion in sync with the version bump from saveInstance.
app.get('/api/instances/:id/edge-waypoints', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }
    res.json({ success: true, edgeWaypoints: config.edgeWaypoints || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read edge waypoints', detail: err.message });
  }
});

app.post('/api/instances/:id/edge-waypoints', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const { edgeId, points } = req.body || {};
  if (!edgeId || typeof edgeId !== 'string') {
    return res.status(400).json({ success: false, error: 'edgeId is required' });
  }
  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ success: false, error: 'points must be a non-empty array' });
  }

  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || req.body.password,
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_EDGE_WAYPOINT_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    setEdgeWaypoints(config, edgeId, points);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_EDGE_WAYPOINT_SAVED', { instanceId: req.params.id, edgeId });
    res.json({
      success: true,
      edgeId,
      configVersion: config.configVersion,
      resolvedVersion: stamp.configVersion,
    });
  } catch (err) {
    console.error(`❌ Edge waypoint save failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to save edge waypoint', step, detail: err.message });
  }
});

app.delete('/api/instances/:id/edge-waypoints/:edgeId', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || (req.body && req.body.password),
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_EDGE_WAYPOINT_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    clearEdgeWaypoint(config, req.params.edgeId);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_EDGE_WAYPOINT_CLEARED', { instanceId: req.params.id, edgeId: req.params.edgeId });
    res.json({ success: true, configVersion: config.configVersion, resolvedVersion: stamp.configVersion });
  } catch (err) {
    console.error(`❌ Edge waypoint clear failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to clear edge waypoint', step, detail: err.message });
  }
});

app.delete('/api/instances/:id/edge-waypoints', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || (req.body && req.body.password),
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_EDGE_WAYPOINT_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    clearAllEdgeWaypoints(config);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_EDGE_WAYPOINTS_CLEARED_ALL', { instanceId: req.params.id });
    res.json({ success: true, configVersion: config.configVersion, resolvedVersion: stamp.configVersion });
  } catch (err) {
    console.error(`❌ Edge waypoints clear-all failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to clear edge waypoints', step, detail: err.message });
  }
});

// Box-side anchor snapping (2026-08-04) — pins one or both ends of a
// connector to a fixed side-middle point on its node instead of the
// automatic floating attach point. Same shape/pattern as edge-waypoints
// above, a separate field so the already-deployed edgeWaypoints shape
// never needs reshaping again.
app.get('/api/instances/:id/edge-anchors', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }
    res.json({ success: true, edgeAnchors: config.edgeAnchors || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read edge anchors', detail: err.message });
  }
});

app.post('/api/instances/:id/edge-anchors', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const { edgeId, end, anchor } = req.body || {};
  if (!edgeId || typeof edgeId !== 'string') {
    return res.status(400).json({ success: false, error: 'edgeId is required' });
  }
  if (end !== 'source' && end !== 'target') {
    return res.status(400).json({ success: false, error: 'end must be "source" or "target"' });
  }

  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || req.body.password,
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_EDGE_ANCHOR_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    setEdgeAnchor(config, edgeId, end, anchor);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_EDGE_ANCHOR_SAVED', { instanceId: req.params.id, edgeId, end, anchor });
    res.json({
      success: true,
      edgeId,
      configVersion: config.configVersion,
      resolvedVersion: stamp.configVersion,
    });
  } catch (err) {
    console.error(`❌ Edge anchor save failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to save edge anchor', step, detail: err.message });
  }
});

app.delete('/api/instances/:id/edge-anchors/:edgeId/:end', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const { end } = req.params;
  if (end !== 'source' && end !== 'target') {
    return res.status(400).json({ success: false, error: 'end must be "source" or "target"' });
  }
  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || (req.body && req.body.password),
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_EDGE_ANCHOR_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    clearEdgeAnchor(config, req.params.edgeId, end);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_EDGE_ANCHOR_CLEARED', { instanceId: req.params.id, edgeId: req.params.edgeId, end });
    res.json({ success: true, configVersion: config.configVersion, resolvedVersion: stamp.configVersion });
  } catch (err) {
    console.error(`❌ Edge anchor clear failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to clear edge anchor', step, detail: err.message });
  }
});

app.delete('/api/instances/:id/edge-anchors', (req, res) => {
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  let step = 'load';
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'No such instance' });
    }

    const access = checkInstanceWriteAccess(config, {
      token: req.headers['x-instance-token'],
      adminPassword: req.headers['x-admin-password'] || (req.body && req.body.password),
      adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
      accountId: resolveTeacherAccountId(req),
    });
    if (!access.ok) {
      logVisitor(req, 'INSTANCE_EDGE_ANCHOR_AUTH_FAILED', { instanceId: req.params.id });
      return res.status(access.status || 401).json({ success: false, error: access.error || 'Unauthorized' });
    }

    step = 'apply';
    clearAllEdgeAnchors(config);
    step = 'save';
    saveInstance(instancesRoot, config);
    step = 'bake';
    const { stamp } = ensureFreshBake({ stockDataDir: writableDataDir, instancesRoot, config });

    logVisitor(req, 'INSTANCE_EDGE_ANCHORS_CLEARED_ALL', { instanceId: req.params.id });
    res.json({ success: true, configVersion: config.configVersion, resolvedVersion: stamp.configVersion });
  } catch (err) {
    console.error(`❌ Edge anchors clear-all failed (step: ${step}):`, err.message);
    res.status(500).json({ success: false, error: 'Failed to clear edge anchors', step, detail: err.message });
  }
});

// ===== TEACHER ACCOUNTS + SESSIONS (Phase 3) =====
// Admin-mediated, per the settled spec: only the admin creates accounts and
// resets passwords (no self-signup, no email, no "forgot password"). Login
// yields a session token the client sends as x-teacher-session; that token
// authorizes writes to classrooms the account owns (see resolveTeacherAccountId
// + checkInstanceWriteAccess). Reads stay open — this only gates writes.

// Teacher login: username + password → opaque session token + public account.
app.post('/api/accounts/login', (req, res) => {
  if (!checkLoginRateLimit(req, res)) return;
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'username and password are required' });
  }
  const account = verifyLogin(accountsRoot, username, password);
  if (!account) {
    logVisitor(req, 'TEACHER_LOGIN_FAILED', { username: String(username).slice(0, 64) });
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }
  const sessionToken = createSession(accountsRoot, account.id);
  logVisitor(req, 'TEACHER_LOGIN', { accountId: account.id });
  res.json({ success: true, sessionToken, account });
});

// Teacher logout: revoke the presented session. Idempotent.
app.post('/api/accounts/logout', (req, res) => {
  revokeSession(accountsRoot, req.headers['x-teacher-session']);
  res.json({ success: true });
});

// Who am I — the client uses this on boot to restore a session into UI state.
app.get('/api/accounts/me', (req, res) => {
  const accountId = resolveTeacherAccountId(req);
  if (!accountId) return res.status(401).json({ success: false, error: 'Not logged in' });
  const account = getAccount(accountsRoot, accountId);
  if (!account) return res.status(401).json({ success: false, error: 'Session no longer valid' });
  res.json({ success: true, account: publicAccount(account) });
});

// Admin: list teacher accounts (for the management UI's owner picker).
app.get('/api/admin/accounts', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const accounts = loadAccounts(accountsRoot);
  res.json({ success: true, accounts: Object.values(accounts).map(publicAccount) });
});

// Admin: create a teacher account (the only way accounts come into being).
app.post('/api/admin/accounts', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { username, password, displayName } = req.body || {};
  try {
    const account = createAccount(accountsRoot, { username, password, displayName });
    logVisitor(req, 'TEACHER_ACCOUNT_CREATED', { accountId: account.id, username: account.username });
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin: reset a teacher's password. Revokes their existing sessions so a
// reset also locks out anyone holding an old token.
app.post('/api/admin/accounts/:id/reset-password', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { newPassword } = req.body || {};
  try {
    const account = resetPassword(accountsRoot, req.params.id, newPassword);
    revokeAccountSessions(accountsRoot, req.params.id);
    logVisitor(req, 'TEACHER_PASSWORD_RESET', { accountId: req.params.id });
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin: delete a teacher account. Revokes their sessions and clears them
// from any classroom they owned — the rooms survive, reverting to admin-only,
// so nothing points at a ghost owner.
app.delete('/api/admin/accounts/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    deleteAccount(accountsRoot, req.params.id);
    const releasedClassrooms = instanceLayerActive
      ? removeAccountFromAllInstances(instancesRoot, req.params.id)
      : [];
    logVisitor(req, 'TEACHER_ACCOUNT_DELETED', { accountId: req.params.id, releasedClassrooms });
    res.json({ success: true, releasedClassrooms });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ===== ADMIN: CLASSROOM (INSTANCE) MANAGEMENT (Phase 3) =====
// Only the admin creates classrooms and binds owners (admin-mediated model).
// A teacher then manages their owned classroom via their session.

// List all classrooms (admin tool) — never includes write tokens.
app.get('/api/admin/instances', (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const instances = [];
  for (const id of listInstanceIds(instancesRoot)) {
    try {
      const cfg = loadInstance(instancesRoot, id);
      if (!cfg) continue;
      const { writeToken: _writeToken, ...meta } = cfg.meta;
      instances.push({ ...meta, configVersion: cfg.configVersion });
    } catch (err) {
      instances.push({ id, error: err.message });
    }
  }
  res.json({ success: true, instances });
});

// Create a classroom, optionally binding an owner account in one step.
app.post('/api/admin/instances', (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const { id, displayName, owner } = req.body || {};
  try {
    if (owner && !getAccount(accountsRoot, owner)) {
      return res.status(400).json({ success: false, error: `No such account: "${owner}"` });
    }
    const config = createInstance(instancesRoot, { id, displayName });
    if (owner) {
      setInstanceOwner(config, owner);
      saveInstance(instancesRoot, config);
    }
    // Bake immediately so the new classroom is playable right away.
    rebakeInstance(config.meta.id);
    const { writeToken: _writeToken, ...meta } = config.meta;
    logVisitor(req, 'INSTANCE_CREATED', { instanceId: config.meta.id, owner: owner || null });
    res.json({ success: true, instance: { ...meta, configVersion: config.configVersion } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Bind / rebind / clear a classroom's owner (admin). owner=null → admin-only.
app.post('/api/admin/instances/:id/owner', (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!instanceLayerActive) {
    return res.status(503).json({ success: false, error: 'Instance layer is not active on this server' });
  }
  const { owner } = req.body || {};
  try {
    const config = loadInstance(instancesRoot, req.params.id);
    if (!config) return res.status(404).json({ success: false, error: 'No such instance' });
    if (owner && !getAccount(accountsRoot, owner)) {
      return res.status(400).json({ success: false, error: `No such account: "${owner}"` });
    }
    setInstanceOwner(config, owner || null);
    saveInstance(instancesRoot, config);
    logVisitor(req, 'INSTANCE_OWNER_SET', { instanceId: req.params.id, owner: owner || null });
    res.json({ success: true, owner: config.meta.owner });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin-toggleable runtime settings (currently just the foreign-game alert
// kill switch). GET reads current state; POST merges in any recognized keys.
app.get('/api/admin/settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ success: true, settings });
});

app.post('/api/admin/settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (typeof req.body?.foreignGameAlertsEnabled === 'boolean') {
    settings.foreignGameAlertsEnabled = req.body.foreignGameAlertsEnabled;
  }
  saveSettings();
  res.json({ success: true, settings });
});

// ===== GAME MANAGEMENT ENDPOINTS =====

// Admin-only since 2026-06-12: listing every gameId publicly defeated the
// join-by-code model — game codes act as the join secret, and join-info
// hands out a game's token to anyone who knows its code. A public list of
// all codes therefore meant write access to every game. The only client
// consumer is the admin Game Manager (PlayerSetup), which sends the header.
app.get('/api/games', (req, res) => {
  if (!requireAdmin(req, res)) return;
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
  // Phase 3: a game belongs to a classroom. Default (or omitted) = classroom-1,
  // open to anyone (today's behavior, unchanged). A non-default classroom is a
  // teacher's room — creating a game from it requires that teacher's session
  // (owner) or admin, so a stranger can't spawn games from a private classroom.
  const requestedInstanceId = (req.body && req.body.instanceId) || DEFAULT_INSTANCE_ID;

  // Spec gate: a game may only be seeded from a resolved board whose version
  // matches the current classroom config (configVersion == resolvedVersion).
  // ensureFreshBake makes that true or throws — a half-failed bake can never
  // seed a game, and the atomic dir swap means a torn board cannot exist.
  if (instanceLayerActive) {
    if (requestedInstanceId !== DEFAULT_INSTANCE_ID) {
      const cfg = loadInstance(instancesRoot, requestedInstanceId);
      if (!cfg) {
        return res.status(404).json({ success: false, error: `No such classroom: "${requestedInstanceId}"` });
      }
      const access = checkInstanceWriteAccess(cfg, {
        adminPassword: req.headers['x-admin-password'],
        adminPasswordHash: CONFIG.ADMIN_PASSWORD_HASH,
        accountId: resolveTeacherAccountId(req),
      });
      if (!access.ok) {
        logVisitor(req, 'CREATE_GAME_INSTANCE_DENIED', { instanceId: requestedInstanceId });
        return res.status(access.status || 403).json({ success: false, error: 'Not authorized to start a game from this classroom' });
      }
    }
    try {
      rebakeInstance(requestedInstanceId);
    } catch (err) {
      console.error('❌ Bake failed at game create:', err.message);
      return res.status(503).json({
        success: false,
        error: 'The game board could not be prepared. Please try again or contact the administrator.'
      });
    }
  }

  const gameId = generateGameId();
  const token = generateGameToken();
  const now = formatTimestamp();

  games.set(gameId, {
    state: null,
    version: 0,
    token,
    instanceId: requestedInstanceId,
    createdAt: now,
    lastActivity: now
  });

  logVisitor(req, 'CREATE_GAME', { gameId, instanceId: requestedInstanceId });

  isDirty = true;
  saveGames();

  res.json({
    success: true,
    gameId,
    token,
    instanceId: requestedInstanceId,
    message: `Game ${gameId} created. Share this code with players!`
  });
});

app.delete('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;

  if (!requireGameTokenOrAdmin(req, res, gameId)) return;

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
 *
 * `players` (added for fb:feedback-1783819148816-bb72760f /
 * fb:feedback-1783819238489-aaae63c0) is the same open-by-design trust
 * model: anyone with the code can already read full player state via
 * GET /api/gamestate, so a display-only roster here (name/color/avatar,
 * no money/hand/history) leaks nothing new. It exists so "Join by Code"
 * can offer a "which player are you?" picker instead of dropping a
 * rejoining player into the spectator view with no way to act.
 *
 * `connected` (added for the takeover-warning follow-up, 2026-07-12/13):
 * whether that player currently holds a live WebSocket connection to this
 * game. Lets the picker warn before silently taking over a seat someone
 * else is actively playing on another device — a presence hint, not a
 * lock, so picking a connected player still works after a confirmation.
 */
// Defense-in-depth alongside random game IDs (see generateGameId): even a
// large ID space should be throttled against brute-force guessing. Keyed on
// IP alone (not IP+gameId) so an attacker can't dodge the limit by cycling
// through many candidate codes from one address.
const joinInfoAttempts = new Map(); // IP -> { count, resetAt }
const JOIN_INFO_RATE_LIMIT = { maxAttempts: 30, windowMs: 60 * 1000 }; // 30 per minute

function checkJoinInfoRateLimit(req, res) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = joinInfoAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= JOIN_INFO_RATE_LIMIT.maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({ error: `Too many attempts. Retry after ${retryAfter}s` });
      return false;
    }
    entry.count++;
  } else {
    joinInfoAttempts.set(ip, { count: 1, resetAt: now + JOIN_INFO_RATE_LIMIT.windowMs });
  }
  return true;
}

app.get('/api/games/:gameId/join-info', (req, res) => {
  if (!checkJoinInfoRateLimit(req, res)) return;
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
  const connectedPlayerIds = getConnectedPlayerIds(gameId);
  res.json({
    gameId,
    token: game.token,
    // Which classroom's board to load (Phase 3). Legacy/instance-less games
    // fall back to the default classroom — players' join flow is unchanged.
    instanceId: game.instanceId || DEFAULT_INSTANCE_ID,
    gamePhase: game.state?.gamePhase || 'SETUP',
    playerCount: game.state?.players?.length || 0,
    // Lightweight roster for the client's "which player are you?" picker.
    // Deliberately minimal — id/shortId to build the ?p= URL, name/color/
    // avatar to render the picker, connected for the takeover warning.
    // Never the full Player object.
    players: (game.state?.players || []).map(p => ({
      id: p.id,
      shortId: p.shortId,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      connected: connectedPlayerIds.has(p.id),
    })),
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
  }

  // Detect game start
  if (game.state?.gamePhase === 'SETUP' && state.gamePhase === 'PLAY') {
    const playerNames = state.players?.map(p => p.name).join(', ');
    const logEntry = logVisitor(req, 'GAME_STARTED', {
      gameId,
      playerCount: newPlayerCount,
      playerNames
    });

    if (settings.foreignGameAlertsEnabled && !isHomeIP(logEntry.ip)) {
      if (canSendForeignGameAlert()) {
        try {
          // Carrier email-to-SMS gateways can deliver minutes to hours late
          // (confirmed 2026-08-16: a real alert arrived ~16h after the game
          // actually started) -- stamp the real event time so a late text
          // doesn't get mistaken for something happening right now.
          const alertTime = new Date(logEntry.timestamp).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          await sendOwnerAlert(`Game ${gameId} started ${alertTime} ET with players: ${playerNames} (IP ${logEntry.ip}, ${logEntry.device})`);
        } catch (err) {
          console.warn('⚠️ Could not send foreign-game alert:', err.message);
        }
      } else {
        console.warn('⚠️ Foreign-game alert suppressed: hourly cap reached');
      }
    }
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

  const game = requireGameTokenOrAdmin(req, res, gameId);
  if (!game) return;

  logVisitor(req, 'RESET_GAME', { gameId });

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
// Gated 2026-06-12: visitor logs carry IP addresses + device strings (PII).
// Same access rule as feedback: admin password or FEEDBACK_TOKEN.
app.get('/api/logs', (req, res) => {
  if (!requireFeedbackAccess(req, res)) return;
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
  if (!requireFeedbackAccess(req, res)) return; // exposes visitor IP list
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
  // Gated 2026-06-12: this legacy single-game write had NO auth. Modern
  // clients never use it intentionally (the accidental fallback to it caused
  // the stale-PLAY-phase bug — see App.tsx) — requiring G0's token both
  // closes the open write and turns any accidental legacy write into a
  // clean 401 instead of silent state corruption.
  const game = validateGameToken(req, res, LEGACY_GAME_ID);
  if (!game) return;

  const { state, clientVersion } = req.body;

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
  // Gated 2026-06-12 (was unauthenticated): legacy reset is admin-or-token.
  const game = requireGameTokenOrAdmin(req, res, LEGACY_GAME_ID);
  if (!game) return;

  const previousVersion = game.version;

  game.state = null;
  game.version = 0;
  touchGame(LEGACY_GAME_ID);
  isDirty = true;
  saveGames();

  res.json({ success: true, message: 'Game state reset', previousVersion });
});

// ===== ENDPOINT AUTH GUARDS =====
// requireAdmin: x-admin-password header, fail-closed when hash unset (DEF-5).
// requireFeedbackAccess: admin password OR FEEDBACK_TOKEN (DEF-6) — keeps
// both the admin BugReportsPanel and token-holding maintainer scripts working.
// Returns true if authorized; otherwise writes the error response and returns false.
function requireAdmin(req, res) {
  const result = checkAdminPassword(req.headers['x-admin-password'], CONFIG.ADMIN_PASSWORD_HASH);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return false;
  }
  return true;
}

// Destructive per-game operations (delete game, reset state) accept EITHER
// that game's own token (a player in the game) OR the admin password (the
// teacher/maintainer). Added 2026-06-12: these endpoints previously had NO
// auth — anyone who guessed a gameId could delete or wipe a game.
function requireGameTokenOrAdmin(req, res, gameId) {
  const game = games.get(gameId);
  if (!game) {
    res.status(404).json({ error: `Game ${gameId} not found` });
    return null;
  }
  if (checkAdminPassword(req.headers['x-admin-password'], CONFIG.ADMIN_PASSWORD_HASH).ok) {
    return game;
  }
  // Falls through to token validation (writes its own 401/403 on failure)
  return validateGameToken(req, res, gameId);
}

function requireFeedbackAccess(req, res) {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const result = checkFeedbackAccess(
    { adminHeader: req.headers['x-admin-password'], token: queryToken || bearerToken },
    { adminHash: CONFIG.ADMIN_PASSWORD_HASH, feedbackToken: process.env.FEEDBACK_TOKEN }
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return false;
  }
  return true;
}

// Debug endpoints - admin only
app.get('/api/debug/state', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const game = games.get(LEGACY_GAME_ID);
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify({
    stateVersion: game.version,
    hasState: game.state !== null,
    state: game.state
  }, null, 2));
});

app.get('/api/debug/games', (req, res) => {
  if (!requireAdmin(req, res)) return;
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
    const { screenshot, whatDoing, whatWrong, extra, contact, metadata, consoleLogs, gameState } = req.body;

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
      // Diagnostic capture (v3.0.21). Client always-sends; before this fix
      // both fields were silently dropped. consoleLogs is a ring buffer of
      // up to 50 console.error/warn/unhandled entries from consoleCapture.ts.
      // gameState is a pruned snapshot (no hands, no large arrays) from
      // FeedbackButton.fetchGameStateSummary.
      ...(Array.isArray(consoleLogs) && consoleLogs.length > 0 ? { consoleLogs } : {}),
      ...(gameState ? { gameState } : {}),
      createdAt: new Date(timestamp).toISOString(),
    };

    fs.writeFileSync(path.join(FEEDBACK_DIR, filename), JSON.stringify(report, null, 2));

    logVisitor(req, 'BUG_REPORT', {
      gameId: metadata?.gameId || 'unknown',
      whatDoing: whatDoing.substring(0, 80),
    });

    res.json({ success: true, id: filename });
  } catch (err) {
    console.error('Failed to save feedback:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Reads/updates require admin password or FEEDBACK_TOKEN (DEF-6):
// reports can carry reporter contact info (name/email/phone), console
// logs, and screenshots — PII that must not be publicly enumerable.
// POST (the in-game bug-report button) stays open by design.
app.get('/api/feedback', (req, res) => {
  if (!requireFeedbackAccess(req, res)) return;
  try {
    ensureFeedbackDir();

    const files = fs.readdirSync(FEEDBACK_DIR).filter(f => f.endsWith('.json'));
    const reports = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR, f), 'utf8'));
        // Return without screenshot for list view
        const { screenshot: _screenshot, ...rest } = data;
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
  if (!requireFeedbackAccess(req, res)) return;
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
  if (!requireFeedbackAccess(req, res)) return;
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
// (timingSafeEqualStr now lives in authGuards.js)

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
        // Summarise console capture for the /start view: counts + last
        // error message (truncated). Full logs available via /api/feedback/:id.
        // Older reports without consoleLogs surface as null.
        let consoleSummary = null;
        if (Array.isArray(data.consoleLogs) && data.consoleLogs.length > 0) {
          const errors = data.consoleLogs.filter(e => e && e.level === 'error');
          const warns = data.consoleLogs.filter(e => e && e.level === 'warn');
          const lastError = errors.length > 0 ? errors[errors.length - 1].message : null;
          consoleSummary = {
            errorCount: errors.length,
            warnCount: warns.length,
            lastError: lastError ? lastError.slice(0, 200) : null,
          };
        }
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
          consoleSummary,
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

// ===== PLAYTESTER ACQUISITION TRACKING =====
// Minimal funnel tracking for the QR-code -> landing page -> reminder ->
// return-visit -> play funnel (TODO.md "Playtester Acquisition System").
// Reuses the existing logVisitor() file-log pattern — no new storage.
const PLAYTEST_EVENTS = new Set([
  'landing_view',
  'preview_click',
  'reminder_selected',
  'bookmark_click',
  'play_click',
  'return_visit',
  'share_click',
  // In-game engagement tracking (TODO.md, decided 2026-08-02) — "how far
  // players get, what draws their attention." Reuses this same endpoint
  // rather than a parallel one. Pseudonymous gameId/playerId only, never
  // the player's display name. See engagementStats.js for the aggregation
  // and its own note on why "game_abandoned" isn't a tracked event here.
  'space_reached',
  'game_finished',
  'panel_opened',
]);

function sanitizeTrackField(value) {
  return typeof value === 'string' ? value.slice(0, 60) : null;
}

app.post('/api/playtest/track', (req, res) => {
  const { event, campaignSource, gameId, playerId, spaceId, panel } = req.body || {};
  if (typeof event !== 'string' || !PLAYTEST_EVENTS.has(event)) {
    return res.status(400).json({ error: 'Unknown or missing event' });
  }
  logVisitor(req, `PLAYTEST_${event.toUpperCase()}`, {
    campaignSource: sanitizeTrackField(campaignSource),
    gameId: sanitizeTrackField(gameId),
    playerId: sanitizeTrackField(playerId),
    spaceId: sanitizeTrackField(spaceId),
    panel: sanitizeTrackField(panel),
  });
  res.json({ success: true });
});

// Rate limit "remind me" separately from admin auth (stricter — this
// endpoint sends real email/SMS on the caller's behalf, an abuse vector if
// left open, e.g. spamming an arbitrary phone number via a carrier gateway).
const remindMeAttempts = new Map(); // IP -> { count, resetAt }
const REMIND_ME_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 60 * 1000 }; // 5 per hour

function checkRemindMeRateLimit(req, res) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = remindMeAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= REMIND_ME_RATE_LIMIT.maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({ error: `Too many attempts. Retry after ${retryAfter}s` });
      return false;
    }
    entry.count++;
  } else {
    remindMeAttempts.set(ip, { count: 1, resetAt: now + REMIND_ME_RATE_LIMIT.windowMs });
  }
  return true;
}

app.get('/api/playtest/carriers', (req, res) => {
  res.json({ carriers: Object.keys(CARRIER_GATEWAYS) });
});

app.get('/api/playtest/push-public-key', (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: 'Browser notifications are not set up yet' });
  }
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/api/playtest/schedule-push', (req, res) => {
  if (!checkRemindMeRateLimit(req, res)) return;
  if (!isPushConfigured()) {
    return res.status(503).json({ error: 'Browser notifications are not set up yet' });
  }

  const { subscription, sendAt, campaignSource } = req.body || {};
  if (!subscription || typeof subscription !== 'object' || !subscription.endpoint) {
    return res.status(400).json({ error: 'A valid push subscription is required' });
  }
  const sendAtMs = Date.parse(sendAt);
  if (!sendAt || Number.isNaN(sendAtMs)) {
    return res.status(400).json({ error: 'sendAt must be a valid date' });
  }

  schedulePush(subscription, sendAt, campaignSource);
  logVisitor(req, 'PLAYTEST_PUSH_SCHEDULED', { campaignSource: campaignSource || null });
  res.json({ success: true });
});

app.post('/api/playtest/remind-me', async (req, res) => {
  if (!checkRemindMeRateLimit(req, res)) return;
  if (!isMailerConfigured()) {
    return res.status(503).json({ error: 'Email/text reminders are not set up yet' });
  }

  const { method, email, phone, carrier, whenLabel, campaignSource, sendAt } = req.body || {};
  try {
    // Validate the recipient now so a bad address/carrier is rejected while
    // the visitor is still on the form, not silently dropped when the
    // scheduler fires later.
    resolveRecipient({ method, email, phone, carrier });

    const sendAtMs = Date.parse(sendAt);
    if (sendAt && !Number.isNaN(sendAtMs) && sendAtMs > Date.now()) {
      // Scheduled for a chosen time — hand off to the reminder scheduler.
      scheduleMail({ method, email, phone, carrier, whenLabel }, sendAt, campaignSource);
      logVisitor(req, 'PLAYTEST_REMINDER_SCHEDULED', { method, carrier: carrier || null, campaignSource: campaignSource || null });
    } else {
      // No (or already-past) time — send right away.
      await sendReminder({ method, email, phone, carrier, whenLabel, campaignSource });
      logVisitor(req, 'PLAYTEST_REMINDER_SENT', { method, carrier: carrier || null, campaignSource: campaignSource || null });
    }
    res.json({ success: true });
  } catch (err) {
    if (err && err.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Failed to send playtest reminder:', err && err.message);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Aggregated view of the funnel — answers "where did they come from" without
// a dashboard. Admin-gated like /api/debug/state (visitor log carries IPs).
app.get('/api/admin/playtest-stats', (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!fs.existsSync(CONFIG.LOG_FILE)) {
      return res.json({ total: 0, byEvent: {}, bySource: {} });
    }
    const content = fs.readFileSync(CONFIG.LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const playtestLogs = lines
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(log => log && typeof log.action === 'string' && log.action.startsWith('PLAYTEST_'));

    const byEvent = {};
    const bySource = {};
    for (const log of playtestLogs) {
      byEvent[log.action] = (byEvent[log.action] || 0) + 1;
      const source = log.campaignSource || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    res.json({ total: playtestLogs.length, byEvent, bySource });
  } catch (err) {
    console.error('Failed to read playtest stats:', err.message);
    res.status(500).json({ error: 'Failed to read playtest stats' });
  }
});

// In-game engagement — "how far players get, what draws their attention"
// (TODO.md, decided 2026-08-02). Separate from playtest-stats above (that
// one answers acquisition-funnel questions; this one answers
// in-game-progression questions) but reads the same log file via the same
// cached reader used by /api/admin/stats/summary below — no new storage.
// Aggregation (dedup logic, abandonment inference) lives in the pure,
// unit-tested engagementStats.js. Admin-gated like its siblings.
app.get('/api/admin/engagement-stats', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const entries = await getVisitorLogEntries();
    res.json(aggregateEngagementStats(entries));
  } catch (err) {
    console.error('Failed to compute engagement stats:', err.message);
    res.status(500).json({ error: 'Failed to compute engagement stats' });
  }
});

// ===== ADMIN STATS DASHBOARD =====
// GET /api/admin/stats/summary backs the /admin/stats page (client route in
// App.tsx). Aggregation logic lives in visitorStats.js (pure, unit-tested);
// this just streams the log file line-by-line (never loads the whole ~6MB
// file into one string) and caches the parsed entries for a short window so
// repeated dashboard reloads/auto-refreshes don't re-parse the growing log
// on every request. Cache is invalidated the moment the file's mtime/size
// changes, so it never serves stale data for longer than the TTL.
let visitorLogCache = { mtimeMs: 0, size: 0, entries: null, loadedAt: 0 };
const VISITOR_LOG_CACHE_TTL_MS = 45 * 1000;

async function getVisitorLogEntries() {
  if (!fs.existsSync(CONFIG.LOG_FILE)) return [];
  const stat = fs.statSync(CONFIG.LOG_FILE);
  const isFresh = visitorLogCache.entries
    && visitorLogCache.mtimeMs === stat.mtimeMs
    && visitorLogCache.size === stat.size
    && (Date.now() - visitorLogCache.loadedAt) < VISITOR_LOG_CACHE_TTL_MS;
  if (isFresh) return visitorLogCache.entries;

  const entries = [];
  await new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(CONFIG.LOG_FILE, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => {
      const parsed = parseLogLine(line);
      if (parsed) entries.push(parsed);
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });

  visitorLogCache = { mtimeMs: stat.mtimeMs, size: stat.size, entries, loadedAt: Date.now() };
  return entries;
}

const STATS_WINDOWS = new Set(['24h', '7d', '30d', 'all']);

// Country lookup for the stats dashboard's Geography section. geoip-lite
// bundles its own local IP-range database (no MaxMind account, no
// per-request outbound calls) and loads it synchronously at import time, so
// there's no async "is it ready yet" state to track -- if the import above
// succeeded, geoLookup is live from the first request on.
function geoLookup(ip) {
  try {
    return geoip.lookup(ip)?.country || null;
  } catch {
    return null;
  }
}
const GEO_AVAILABLE = typeof geoip?.lookup === 'function';

// Admin-gated like /api/admin/playtest-stats -- exposes IPs (redacted to a
// /24-ish prefix by default; ?full=true for the real addresses, still behind
// the same admin password).
app.get('/api/admin/stats/summary', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const entries = await getVisitorLogEntries();
    const window = STATS_WINDOWS.has(req.query.window) ? req.query.window : '30d';
    const includeBots = req.query.includeBots === 'true';
    const full = req.query.full === 'true';
    const origin = req.query.origin === 'home' || req.query.origin === 'foreign' ? req.query.origin : undefined;
    const filters = {
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      country: typeof req.query.country === 'string' ? req.query.country : undefined,
      origin,
    };
    const result = aggregateVisitorStats(entries, {
      window, includeBots, full, filters, isHomeIP, geoLookup, geoAvailable: GEO_AVAILABLE,
    });
    res.json(result);
  } catch (err) {
    console.error('Failed to compute visitor stats:', err.message);
    res.status(500).json({ error: 'Failed to compute visitor stats' });
  }
});

// ===== SPA FALLBACK & ERROR HANDLERS =====
// For non-API routes, serve index.html (SPA client-side routing)
app.use((req, res, _next) => {
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
        'GET /api/public/feedback/open',
        'POST /api/playtest/track',
        'GET /api/playtest/carriers',
        'POST /api/playtest/remind-me',
        'GET /api/playtest/push-public-key',
        'POST /api/playtest/schedule-push',
        'GET /api/admin/playtest-stats',
        'GET /api/admin/engagement-stats',
        'GET /api/admin/stats/summary'
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

// Express identifies error-handling middleware by ARITY: a 4-argument
// handler gets errors, a 3-argument one is treated as ordinary middleware.
// `_next` is unused but must stay — deleting it would silently turn this
// into a normal handler and every 500 would go unhandled instead of
// returning JSON. Underscore-renamed rather than removed for that reason.
app.use((err, req, res, _next) => {
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
    console.log(`   Version: ${process.env.VITE_GIT_COMMIT || 'dev'}`);
    console.log(`   Port: ${actualPort}`);
    console.log(`   WebSocket: ws://0.0.0.0:${actualPort}/ws`);
    console.log(`   Data dir: ${CONFIG.DATA_DIR}`);
    console.log('');
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
// Deploy-update warning (TODO "📣 Active — deploy-update warning"): before
// tearing the process down, tell every connected client their game is about
// to restart so they aren't left staring at a dead connection with no
// explanation. Each room gets its OWN game code baked into the message (a
// game's join code IS its gameId — see the join-info route above), so
// broadcastToAllRooms takes a per-room message builder rather than one
// shared payload. The countdown itself is CLIENT-SIDE once it receives this
// one message — the server does not wait out any countdown; it only pauses
// briefly below to let the broadcast actually reach clients before the
// process exits. Docker's SIGTERM→SIGKILL grace period is short (~10s
// default, see deploy.sh's `docker stop`), so this stays well under it.
const SHUTDOWN_NOTICE_FLUSH_MS = 300;

function shutdown() {
  console.log('🛑 Shutting down...');
  broadcastToAllRooms((gameId) => ({
    type: 'server_shutdown_notice',
    gameId,
  }));
  setTimeout(() => {
    saveGames();
    server.close(() => {
      console.log('✅ Server shut down');
      process.exit(0);
    });
  }, SHUTDOWN_NOTICE_FLUSH_MS);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
