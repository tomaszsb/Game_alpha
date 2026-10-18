// tests/server/classAnswersLive.test.ts
// v3.8.15 (Tom, 2026-10-18, Review Q4 + Q5): certificate-step answers are saved on
// the server with NO IP or device, are NOT downloadable under the public /data
// path (the v3.8.5 leak was exactly that shape), and only the admin can list them.
// Boots the REAL server as a child process on a scratch data folder, the same way
// securityLimitsLive.test.ts does.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const PASSWORD = 'throwaway-test-password-2';
let child: ChildProcess;
let base = '';
let dataDir = '';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-classanswers-'));
  child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      LOG_FILE: path.join(dataDir, 'visitors.log'),
      GAMES_FILE: path.join(dataDir, 'games.json'),
      ADMIN_PASSWORD_HASH: crypto.createHash('sha256').update(PASSWORD).digest('hex'),
      FEEDBACK_TOKEN: '',
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
}, 60_000);

afterAll(() => {
  child?.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows may hold a file briefly */ }
});

const answer = {
  name: 'Ada Student',
  gameCode: 'G-TEST-0001',
  fun: { playAgain: 'maybe', mostBoring: 'the filing loop', bestPart: 'haggling with the owner' },
  why: [{ question: 'Your project took 502 days. What caused most of the delay?', answer: 'Fire Dept. sent me back twice.' }],
  // A client must not be able to smuggle extra personal data in.
  ip: '203.0.113.9',
  userAgent: 'Mozilla/5.0 test',
};

describe('certificate answers on the real server', () => {
  it('saves the answers with name, game code, answers and date only', async () => {
    const r = await fetch(base + '/api/class-answers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(answer),
    });
    expect(r.status).toBe(200);
    const file = path.join(dataDir, 'class-answers.jsonl');
    expect(fs.existsSync(file)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n').pop()!);
    expect(Object.keys(saved).sort()).toEqual(['date', 'fun', 'gameCode', 'name', 'why']);
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).not.toContain('203.0.113.9');
    expect(raw).not.toContain('Mozilla');
    expect(raw).not.toContain('127.0.0.1');
    // Stored outside the folder /data serves.
    expect(fs.existsSync(path.join(dataDir, 'game-data', 'class-answers.jsonl'))).toBe(false);
  });

  it('is NOT reachable under /data, however the path is written', async () => {
    for (const p of ['/data/class-answers.jsonl', '/data/../class-answers.jsonl', '/data/%2e%2e/class-answers.jsonl', '/data/CLEAN_FILES/../../class-answers.jsonl']) {
      const r = await fetch(base + p);
      const body = await r.text();
      expect(body, p).not.toContain('Ada Student');
    }
  });

  it('lists the answers for the admin only', async () => {
    const noPw = await fetch(base + '/api/admin/class-answers');
    expect(noPw.status).toBe(401);
    const ok = await fetch(base + '/api/admin/class-answers', { headers: { 'x-admin-password': PASSWORD } });
    expect(ok.status).toBe(200);
    const { answers } = await ok.json();
    expect(answers[0].name).toBe('Ada Student');
    expect(answers[0].why[0].answer).toContain('Fire Dept.');
  });

  it('refuses an empty submission', async () => {
    const r = await fetch(base + '/api/class-answers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x', fun: {} }),
    });
    expect(r.status).toBe(400);
  });
});
