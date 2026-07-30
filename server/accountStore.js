// server/accountStore.js
// Teacher instance layer, Phase 3 (docs/core/TEACHER_LAYER_DESIGN.md) —
// the multi-teacher front door, "full accounts, admin-mediated".
//
// Teacher accounts + login sessions, stored as flat JSON in the writable
// volume, mirroring instanceStore's conventions (atomic temp→fsync→rename
// writes; pure helpers wired into endpoints by server.js).
//
// Deliberately minimal, per the settled spec: only the admin creates
// accounts and resets passwords — NO self-signup, NO email infrastructure,
// NO "forgot password" flow. Passwords are scrypt-hashed with Node's
// stdlib crypto (the same toolbox already used for the admin password hash
// and every game/instance token). We do not roll our own crypto.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { timingSafeEqualStr } from './authGuards.js';

const ACCOUNTS_FILE = 'accounts.json';
const SESSIONS_FILE = 'sessions.json';

const SCRYPT_KEYLEN = 64;
// Session lifetime: long enough that a teacher isn't logged out mid-term,
// short enough that a leaked token expires. Sessions are persisted so a
// deploy/restart doesn't log everyone out.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ===== atomic file helpers (same invariant as instanceStore) =====

function atomicWriteJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(obj, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return parsed && typeof parsed === 'object' ? parsed : fallback;
}

// ===== password hashing (stdlib scrypt) =====

/**
 * Hash a password with scrypt + a per-password random salt. Stored format
 * is self-describing: `scrypt$<saltHex>$<derivedHex>` so verifyPassword
 * never needs separate salt storage and we can change params later.
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verify a password against a stored `scrypt$salt$derived` string. Constant
 * time on the hash comparison; returns false (never throws) on any malformed
 * input so a corrupt record can't crash a login.
 * @param {string} password
 * @param {string} stored
 * @returns {boolean}
 */
export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, derived] = parts;
  let computed;
  try {
    computed = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  } catch {
    return false;
  }
  return timingSafeEqualStr(computed, derived);
}

// ===== accounts =====

function accountsPath(accountsRoot) {
  return path.join(accountsRoot, ACCOUNTS_FILE);
}

/** Load the accounts map ({ [id]: record }). Empty object if none yet. */
export function loadAccounts(accountsRoot) {
  return readJson(accountsPath(accountsRoot), {});
}

/** A login-safe view of an account: never includes the password hash. */
export function publicAccount(account) {
  if (!account) return null;
  // Destructured purely to strip it from `rest` — never read. Underscore-
  // renamed per the convention used elsewhere in server/ (see `_writeToken`).
  const { passwordHash: _passwordHash, ...rest } = account;
  return rest;
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

/** Find an account by username (case-insensitive). Null if none. */
export function findAccountByUsername(accountsRoot, username) {
  const uname = normalizeUsername(username);
  if (!uname) return null;
  const accounts = loadAccounts(accountsRoot);
  for (const account of Object.values(accounts)) {
    if (normalizeUsername(account.username) === uname) return account;
  }
  return null;
}

/** Get an account by id. Null if none. */
export function getAccount(accountsRoot, id) {
  if (!id) return null;
  return loadAccounts(accountsRoot)[id] || null;
}

/**
 * Create a teacher account (admin-mediated). Throws on a duplicate username
 * or invalid input. Returns the public record (no hash).
 * @param {string} accountsRoot
 * @param {{ username: string, password: string, displayName?: string }} opts
 */
export function createAccount(accountsRoot, { username, password, displayName }) {
  const uname = normalizeUsername(username);
  if (!uname || !/^[a-z0-9][a-z0-9._-]*$/.test(uname)) {
    throw new Error('Invalid username (lowercase letters, digits, . _ - ; must start alphanumeric)');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (findAccountByUsername(accountsRoot, uname)) {
    throw new Error(`Username "${uname}" is already taken`);
  }
  const accounts = loadAccounts(accountsRoot);
  const id = `teacher-${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  const account = {
    id,
    username: uname,
    displayName: displayName ? String(displayName).trim() : uname,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  accounts[id] = account;
  atomicWriteJson(accountsPath(accountsRoot), accounts);
  return publicAccount(account);
}

/**
 * Admin-mediated password reset. Throws if the account doesn't exist or the
 * new password is too short.
 * @param {string} accountsRoot
 * @param {string} accountId
 * @param {string} newPassword
 */
export function resetPassword(accountsRoot, accountId, newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const accounts = loadAccounts(accountsRoot);
  const account = accounts[accountId];
  if (!account) throw new Error(`No such account: "${accountId}"`);
  account.passwordHash = hashPassword(newPassword);
  account.updatedAt = new Date().toISOString();
  atomicWriteJson(accountsPath(accountsRoot), accounts);
  return publicAccount(account);
}

/**
 * Delete a teacher account and revoke all of its sessions (so a deleted
 * teacher can't keep acting on a still-valid token). Throws if the account
 * doesn't exist. Ownership of any classrooms the account held is the
 * caller's concern — accountStore has no instance dependency, mirroring how
 * instanceStore stays free of any session dependency.
 * @param {string} accountsRoot
 * @param {string} accountId
 */
export function deleteAccount(accountsRoot, accountId) {
  const accounts = loadAccounts(accountsRoot);
  if (!accounts[accountId]) throw new Error(`No such account: "${accountId}"`);
  delete accounts[accountId];
  atomicWriteJson(accountsPath(accountsRoot), accounts);
  revokeAccountSessions(accountsRoot, accountId);
}

/**
 * Verify a login. Returns the public account on success, null on any failure
 * (unknown user, bad password). Constant-ish: we still run a verify against a
 * dummy hash when the user is unknown to blunt username enumeration timing.
 * @param {string} accountsRoot
 * @param {string} username
 * @param {string} password
 */
export function verifyLogin(accountsRoot, username, password) {
  const account = findAccountByUsername(accountsRoot, username);
  if (!account) {
    // Spend roughly the same time as a real verify to avoid leaking which
    // usernames exist via response timing.
    verifyPassword(String(password || ''), 'scrypt$0$0');
    return null;
  }
  if (!verifyPassword(String(password || ''), account.passwordHash)) return null;
  return publicAccount(account);
}

// ===== sessions =====

function sessionsPath(accountsRoot) {
  return path.join(accountsRoot, SESSIONS_FILE);
}

function loadSessions(accountsRoot) {
  return readJson(sessionsPath(accountsRoot), {});
}

function saveSessions(accountsRoot, sessions) {
  atomicWriteJson(sessionsPath(accountsRoot), sessions);
}

/** Drop expired sessions from a sessions map (mutates + returns it). */
function pruneSessions(sessions, now = Date.now()) {
  for (const [token, s] of Object.entries(sessions)) {
    if (!s || typeof s.expiresAt !== 'number' || s.expiresAt <= now) {
      delete sessions[token];
    }
  }
  return sessions;
}

/**
 * Create a login session for an account. Returns the opaque session token.
 * Prunes expired sessions on write so the file can't grow unbounded.
 * @param {string} accountsRoot
 * @param {string} accountId
 * @param {number} [ttlMs]
 */
export function createSession(accountsRoot, accountId, ttlMs = SESSION_TTL_MS) {
  if (!accountId) throw new Error('createSession requires an accountId');
  const sessions = pruneSessions(loadSessions(accountsRoot));
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions[token] = { accountId, createdAt: now, expiresAt: now + ttlMs };
  saveSessions(accountsRoot, sessions);
  return token;
}

/**
 * Resolve a session token to its accountId, or null if missing/expired.
 * A timing-safe lookup isn't meaningful here (the token is the secret and
 * is looked up by exact key), but expired tokens are pruned lazily on write.
 * @param {string} accountsRoot
 * @param {string|string[]|undefined} token
 * @returns {{ accountId: string } | null}
 */
export function verifySession(accountsRoot, token) {
  const tok = Array.isArray(token) ? token[0] : token;
  if (!tok || typeof tok !== 'string') return null;
  const sessions = loadSessions(accountsRoot);
  const s = sessions[tok];
  if (!s) return null;
  if (typeof s.expiresAt !== 'number' || s.expiresAt <= Date.now()) return null;
  return { accountId: s.accountId };
}

/** Revoke a single session (logout). No-op if it doesn't exist. */
export function revokeSession(accountsRoot, token) {
  const tok = Array.isArray(token) ? token[0] : token;
  if (!tok) return;
  const sessions = loadSessions(accountsRoot);
  if (sessions[tok]) {
    delete sessions[tok];
    saveSessions(accountsRoot, sessions);
  }
}

/** Revoke every session for an account (e.g. after a password reset). */
export function revokeAccountSessions(accountsRoot, accountId) {
  const sessions = loadSessions(accountsRoot);
  let changed = false;
  for (const [token, s] of Object.entries(sessions)) {
    if (s?.accountId === accountId) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) saveSessions(accountsRoot, sessions);
}
