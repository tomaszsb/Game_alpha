// src/utils/teacherAuth.ts
// Teacher instance layer, Phase 3c — client side of the combined login.
//
// Mirrors adminAuth.ts, but for per-teacher accounts (admin uses a single
// master password; teachers use username + password accounts created by the
// admin). A successful login stores an opaque session token that's sent as
// the x-teacher-session header to authorize writes to the teacher's own
// classroom. sessionStorage so it clears when the tab closes; all reads are
// wrapped (storage access can throw in private/sandboxed contexts).

import { getBackendURL } from './networkDetection';

const SESSION_KEY = 'teacher_session';
const ACCOUNT_KEY = 'teacher_account';

export interface TeacherAccount {
  id: string;
  username: string;
  displayName: string;
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable — session just won't persist across reloads */
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** The stored session token, or null. Sent as the x-teacher-session header. */
export function getTeacherSession(): string | null {
  return safeGet(SESSION_KEY);
}

/** The logged-in teacher's public account, or null. */
export function getTeacherAccount(): TeacherAccount | null {
  const raw = safeGet(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeacherAccount;
  } catch {
    return null;
  }
}

export function isTeacherLoggedIn(): boolean {
  return getTeacherSession() !== null;
}

/**
 * Attempt a teacher login. Returns the account on success, null on bad
 * credentials, and throws only on a network/server error so the caller can
 * distinguish "wrong password" from "couldn't reach the server".
 */
export async function teacherLogin(username: string, password: string): Promise<TeacherAccount | null> {
  const response = await fetch(`${getBackendURL()}/api/accounts/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.status === 401) return null; // invalid credentials
  if (!response.ok) {
    throw new Error(`Login failed: server returned ${response.status}`);
  }
  const data: { sessionToken: string; account: TeacherAccount } = await response.json();
  safeSet(SESSION_KEY, data.sessionToken);
  safeSet(ACCOUNT_KEY, JSON.stringify(data.account));
  return data.account;
}

/** Log out: best-effort server revoke, then clear local session. */
export async function teacherLogout(): Promise<void> {
  const token = getTeacherSession();
  safeRemove(SESSION_KEY);
  safeRemove(ACCOUNT_KEY);
  if (!token) return;
  try {
    await fetch(`${getBackendURL()}/api/accounts/logout`, {
      method: 'POST',
      headers: { 'x-teacher-session': token },
    });
  } catch {
    /* already cleared locally — server session expires on its own TTL */
  }
}
