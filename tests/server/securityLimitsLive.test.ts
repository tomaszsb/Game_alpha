// tests/server/securityLimitsLive.test.ts
// v3.8.6: the two holes the 2026-10-18 independent review proved, re-tried
// against a REAL server (server.js auto-listens on import, so it is booted as
// a child process on a scratch data folder with a throwaway admin password).
//
//  1. Wrong admin passwords sent to classroom routes were never rate-limited
//     (8 wrong guesses → 8×401). Now: 5 wrong, then 429 — while the classroom's
//     own write token still works from the same connection.
//  2. A story had no size limit (5,000,000 letters saved, froze the server
//     ~8 s). Now: refused fast, with a plain-English message, and /health
//     stays quick.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const PASSWORD = 'throwaway-test-password';
let child: ChildProcess;
let base = '';
let dataDir = '';

function writeToken(): string {
  const cfgPath = path.join(dataDir, 'game-data', 'instances', 'classroom-1', 'config.json');
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8')).meta.writeToken;
}

function post(route: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-seclimits-'));
  child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      LOG_FILE: path.join(dataDir, 'visitors.log'),
      GAMES_FILE: path.join(dataDir, 'games.json'),
      ADMIN_PASSWORD_HASH: crypto.createHash('sha256').update(PASSWORD).digest('hex'),
      FEEDBACK_TOKEN: '',
      // The server seeds its data from <DIST_PATH>/data. A fresh checkout (the
      // deploy's test gate) has no build yet, so fall back to the same files in
      // public/data, which is what the build copies there.
      DIST_PATH: fs.existsSync(path.join(ROOT, 'dist', 'data')) ? path.join(ROOT, 'dist') : path.join(ROOT, 'public'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise<number>((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('server did not start:\n' + out)), 45_000);
    child.stdout!.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/Port: (\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
    child.stderr!.on('data', (chunk) => { out += chunk; });
    child.on('exit', (code) => reject(new Error(`server exited (${code}):\n${out}`)));
  });
  base = `http://127.0.0.1:${port}`;
  // The default classroom is created during startup; wait until it can be read.
  for (let i = 0; i < 60; i++) {
    const r = await fetch(base + '/api/instances/classroom-1').catch(() => null);
    if (r && r.ok) break;
    await new Promise(r2 => setTimeout(r2, 250));
  }
}, 60_000);

afterAll(() => {
  child?.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows may hold a file briefly */ }
});

describe('old classroom write key (v3.8.58)', () => {
  it.each([
    ['/api/instances/classroom-1/insertions', { from: 'A', to: 'B', displayName: 'X', dryRun: true }],
    ['/api/instances/classroom-1/positions', { positions: { 'OWNER-SCOPE-INITIATION': { x: 1, y: 1 } } }],
    ['/api/instances/classroom-1/board-check', {}],
  ])('refuses a request that carries only the old key: %s', async (route, body) => {
    const r = await post(route, body, { 'x-instance-token': writeToken() });
    expect(r.status).toBe(401);
    // And the right admin password still gets in, so the refusal is about the key, not the route.
    const ok = await post(route, body, { 'x-admin-password': PASSWORD });
    expect(ok.status).not.toBe(401);
  });
});

describe('story size cap', () => {
  it('refuses a 5,000,000-letter story fast, and the server stays responsive', async () => {
    const started = Date.now();
    const r = await post('/api/instances/classroom-1/insertions',
      { from: 'A', to: 'B', displayName: 'Big', story: 'x'.repeat(5_000_000) },
      { 'x-admin-password': PASSWORD });
    expect([400, 413]).toContain(r.status);
    expect((await r.json()).error).toMatch(/too/i);
    expect(Date.now() - started).toBeLessThan(2000);

    const h0 = Date.now();
    const health = await fetch(base + '/health');
    expect(health.ok).toBe(true);
    expect(Date.now() - h0).toBeLessThan(1000);
  });

  it('refuses a story just over 2,000 characters with a plain-English 400', async () => {
    const r = await post('/api/instances/classroom-1/insertions',
      { from: 'A', to: 'B', displayName: 'Long', story: 'x'.repeat(2001), dryRun: true },
      { 'x-admin-password': PASSWORD });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe(
      'The story is too long (2,001 characters). Please keep it under 2,000 characters and save again.');
  });

  it('accepts a 2,000-character story (the cap itself is allowed)', async () => {
    const r = await post('/api/instances/classroom-1/insertions',
      { from: 'A', to: 'B', displayName: 'Ok', story: 'x'.repeat(2000), dryRun: true },
      { 'x-admin-password': PASSWORD });
    expect(r.status).toBe(200);
  });
});

describe('admin password side door (classroom routes)', () => {
  it('5 wrong admin passwords get 401, then 429 — even for the right one', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await post('/api/instances/classroom-1/insertions',
        { from: 'A', to: 'B', displayName: 'X', dryRun: true },
        { 'x-admin-password': `wrong-${i}` });
      statuses.push(r.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429, 429]);

    // Blocked means the password is not even looked at, so a right guess
    // can't be told apart from a wrong one.
    const right = await post('/api/instances/classroom-1/insertions',
      { from: 'A', to: 'B', displayName: 'X', dryRun: true },
      { 'x-admin-password': PASSWORD });
    expect(right.status).toBe(429);
    expect((await right.json()).error).toMatch(/Too many wrong admin passwords/);

    // Other side doors share the same count.
    const positions = await post('/api/instances/classroom-1/positions', { positions: { 'OWNER-SCOPE-INITIATION': { x: 1, y: 1 } } },
      { 'x-admin-password': 'wrong-again' });
    expect(positions.status).toBe(429);
    const debug = await fetch(base + '/api/games', { headers: { 'x-admin-password': 'wrong-again' } });
    expect(debug.status).toBe(429);
  });

  it('the old classroom write key opens nothing, blocked or not', async () => {
    // (v3.8.58) Nothing in the app sent it; it is no longer accepted anywhere, so it is a plain 401.
    const r = await post('/api/instances/classroom-1/insertions',
      { from: 'A', to: 'B', displayName: 'X', dryRun: true },
      { 'x-instance-token': writeToken() });
    expect([401, 429]).toContain(r.status);
    expect(r.status).not.toBe(200);
  });
});
