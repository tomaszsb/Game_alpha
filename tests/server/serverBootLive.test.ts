// tests/server/serverBootLive.test.ts
// v3.8.56: the smallest "real server" test (REVIEW.md §6 Missing #2): boot server/server.js as a child
// process on a scratch data folder, check /health, create one game and read it back, then stop it and
// prove nothing is left running. No change to server.js was needed: it already walks up from 3001 to the
// first free port and prints "Port: N", which is how the other *Live tests find it (the same boot as
// securityLimitsLive.test.ts, kept separate so a failure here says "the server will not start").

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
let child: ChildProcess;
let base = '';
let dataDir = '';
let exited: Promise<void>;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-boot-'));
  child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      LOG_FILE: path.join(dataDir, 'visitors.log'),
      GAMES_FILE: path.join(dataDir, 'games.json'),
      ADMIN_PASSWORD_HASH: crypto.createHash('sha256').update('throwaway-boot-password').digest('hex'),
      FEEDBACK_TOKEN: '',
      DIST_PATH: fs.existsSync(path.join(ROOT, 'dist', 'data')) ? path.join(ROOT, 'dist') : path.join(ROOT, 'public'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  exited = new Promise((resolve) => child.once('exit', () => resolve()));
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
}, 60_000);

afterAll(async () => {
  // Only this test's own child is touched: never a name-based kill (other node processes run on this machine).
  if (child && child.exitCode === null) child.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows may hold a file briefly */ }
});

describe('the real server boots, serves, and stops', () => {
  it('answers /health', async () => {
    const r = await fetch(base + '/health');
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
  });

  it('creates one game and reads it back (join-info, then the token-guarded state route)', async () => {
    const created = await fetch(base + '/api/games', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(created.status).toBe(200);
    const game = await created.json();
    expect(game.success).toBe(true);
    expect(game.gameId).toMatch(/^G-/);
    expect(game.token).toBeTruthy();

    const info = await fetch(`${base}/api/games/${game.gameId}/join-info`);
    expect(info.status).toBe(200);
    const infoBody = await info.json();
    expect(infoBody.gameId).toBe(game.gameId);
    expect(infoBody.token).toBe(game.token);
    expect(infoBody.playerCount).toBe(0);

    // A new game has no saved state yet: the route answers 404 "No game state", which proves the game exists
    // and the token is accepted. Without the token it must refuse.
    const state = await fetch(`${base}/api/games/${game.gameId}/state`, { headers: { 'x-game-token': game.token } });
    expect(state.status).toBe(404);
    expect((await state.json()).error).toBe('No game state available');
    const noToken = await fetch(`${base}/api/games/${game.gameId}/state`);
    expect(noToken.status).toBe(401);

    const unknown = await fetch(`${base}/api/games/G-NOPE-NOPE/join-info`);
    expect(unknown.status).toBe(404);
  });

  it('stops when told to, and nothing keeps answering', async () => {
    child.kill();
    await Promise.race([exited, new Promise((_, rej) => setTimeout(() => rej(new Error('server did not stop in 15 s')), 15_000))]);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    await expect(fetch(base + '/health')).rejects.toThrow();
  });
});
