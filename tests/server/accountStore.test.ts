// tests/server/accountStore.test.ts
// Teacher instance layer Phase 3 — accounts, sessions, and the ownership
// binding that lets a logged-in teacher write to a classroom they own.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  hashPassword,
  verifyPassword,
  createAccount,
  resetPassword,
  verifyLogin,
  getAccount,
  findAccountByUsername,
  createSession,
  verifySession,
  revokeSession,
  revokeAccountSessions,
} from '../../server/accountStore.js';
import {
  createInstance,
  setInstanceOwner,
  instanceOwnedBy,
  checkInstanceWriteAccess,
} from '../../server/instanceStore.js';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('password hashing (stdlib scrypt)', () => {
  it('round-trips a correct password and rejects a wrong one', () => {
    const stored = hashPassword('correct horse battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
    expect(verifyPassword('wrong password', stored)).toBe(false);
  });

  it('produces a different salt+hash each time for the same password', () => {
    expect(hashPassword('samepass1')).not.toBe(hashPassword('samepass1'));
  });

  it('returns false (never throws) on malformed stored values', () => {
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$a$b')).toBe(false);
    // @ts-expect-error intentional bad input
    expect(verifyPassword('x', null)).toBe(false);
  });
});

describe('accounts', () => {
  it('creates an account and never exposes the password hash', () => {
    const acct = createAccount(root, { username: 'MsSmith', password: 'classroom1', displayName: 'Ms. Smith' });
    expect(acct.username).toBe('mssmith'); // normalized lowercase
    expect(acct.displayName).toBe('Ms. Smith');
    expect(acct.id.startsWith('teacher-')).toBe(true);
    expect((acct as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('rejects duplicate usernames (case-insensitive) and weak input', () => {
    createAccount(root, { username: 'teach', password: 'longenough' });
    expect(() => createAccount(root, { username: 'TEACH', password: 'longenough' })).toThrow(/taken/);
    expect(() => createAccount(root, { username: 'bad name', password: 'longenough' })).toThrow(/Invalid username/);
    expect(() => createAccount(root, { username: 'ok', password: 'short' })).toThrow(/at least 8/);
  });

  it('verifies a login and finds the account by username', () => {
    const created = createAccount(root, { username: 'jdoe', password: 'password123' });
    expect(verifyLogin(root, 'jdoe', 'password123')?.id).toBe(created.id);
    expect(verifyLogin(root, 'JDOE', 'password123')?.id).toBe(created.id); // case-insensitive
    expect(verifyLogin(root, 'jdoe', 'wrong')).toBeNull();
    expect(verifyLogin(root, 'nobody', 'password123')).toBeNull();
    expect(findAccountByUsername(root, 'jdoe')?.id).toBe(created.id);
  });

  it('resets a password and invalidates the old one', () => {
    const acct = createAccount(root, { username: 'reset', password: 'oldpassword' });
    resetPassword(root, acct.id, 'newpassword');
    expect(verifyLogin(root, 'reset', 'oldpassword')).toBeNull();
    expect(verifyLogin(root, 'reset', 'newpassword')?.id).toBe(acct.id);
    expect(() => resetPassword(root, 'teacher-nope', 'newpassword')).toThrow(/No such account/);
  });
});

describe('sessions', () => {
  it('creates a session that verifies, then revokes it', () => {
    const acct = createAccount(root, { username: 'sess', password: 'password123' });
    const token = createSession(root, acct.id);
    expect(verifySession(root, token)).toEqual({ accountId: acct.id });
    revokeSession(root, token);
    expect(verifySession(root, token)).toBeNull();
  });

  it('rejects expired and unknown tokens', () => {
    const acct = createAccount(root, { username: 'exp', password: 'password123' });
    const token = createSession(root, acct.id, -1000); // already expired
    expect(verifySession(root, token)).toBeNull();
    expect(verifySession(root, 'bogus')).toBeNull();
    expect(verifySession(root, undefined)).toBeNull();
  });

  it('revokes every session for an account (e.g. after a reset)', () => {
    const acct = createAccount(root, { username: 'multi', password: 'password123' });
    const t1 = createSession(root, acct.id);
    const t2 = createSession(root, acct.id);
    revokeAccountSessions(root, acct.id);
    expect(verifySession(root, t1)).toBeNull();
    expect(verifySession(root, t2)).toBeNull();
  });

  it('persists sessions across calls (survives a restart)', () => {
    const acct = createAccount(root, { username: 'persist', password: 'password123' });
    const token = createSession(root, acct.id);
    // A fresh verifySession reads from disk — no in-memory state carried over.
    expect(verifySession(root, token)?.accountId).toBe(acct.id);
    expect(getAccount(root, acct.id)?.username).toBe('persist');
  });
});

describe('ownership binding (instanceStore + accounts)', () => {
  it('a classroom owner can write; a stranger cannot', () => {
    const config = createInstance(root, { id: 'classroom-2', displayName: 'Room 2' });
    const owner = createAccount(root, { username: 'owner', password: 'password123' });
    const stranger = createAccount(root, { username: 'stranger', password: 'password123' });

    // No owner yet → ownership check fails for everyone.
    expect(instanceOwnedBy(config, owner.id)).toBe(false);
    expect(checkInstanceWriteAccess(config, { accountId: owner.id }).ok).toBe(false);

    setInstanceOwner(config, owner.id);
    expect(instanceOwnedBy(config, owner.id)).toBe(true);
    expect(checkInstanceWriteAccess(config, { accountId: owner.id })).toEqual({ ok: true, via: 'owner' });
    expect(checkInstanceWriteAccess(config, { accountId: stranger.id }).ok).toBe(false);
  });

  it('a co-teacher can write; clearing the owner returns it to admin-only', () => {
    const config = createInstance(root, { id: 'classroom-3' });
    config.meta.coTeachers = ['teacher-co'];
    expect(checkInstanceWriteAccess(config, { accountId: 'teacher-co' })).toEqual({ ok: true, via: 'coteacher' });

    setInstanceOwner(config, 'teacher-x');
    expect(instanceOwnedBy(config, 'teacher-x')).toBe(true);
    setInstanceOwner(config, null);
    expect(instanceOwnedBy(config, 'teacher-x')).toBe(false);
  });

  it('the instance write token still works alongside ownership', () => {
    const config = createInstance(root, { id: 'classroom-4' });
    expect(checkInstanceWriteAccess(config, { token: config.meta.writeToken })).toEqual({ ok: true, via: 'token' });
  });
});
