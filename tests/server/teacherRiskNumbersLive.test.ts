// Tom, 2026-10-18 ("Close the gap"), end to end on the REAL server: a teacher (the
// classroom's write key, not the admin) changes the stop-work order behind "Steer
// the Inspector" from 30 days / $25,000 to 10 days / $5,000; the classroom's baked
// board carries it, stock does not; a route edit sneaked into the same save is
// ignored; bad numbers are refused; reset puts the original back.
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
const SRC = path.join(ROOT, 'public/data/SOURCE_FILES');
const spacesCSV = fs.readFileSync(path.join(SRC, 'Spaces.csv'), 'utf-8');
const diceCSV = fs.readFileSync(path.join(SRC, 'DiceRoll Info.csv'), 'utf-8');
const modalConfigCSV = fs.readFileSync(path.join(SRC, 'ModalConfig.csv'), 'utf-8');

const cfgPath = () => path.join(dataDir, 'game-data', 'instances', 'classroom-1', 'config.json');
const ADMIN = 'pw-risk';
// The classroom's old write key is no longer accepted (v3.8.58). This is a TEACHER
// test (teacher saves are content-checked, admin saves are not), so a real teacher
// account owns the classroom and its login session signs every request.
let session = '';
const post = (route: string, body: unknown) => fetch(base + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-teacher-session': session }, body: JSON.stringify(body),
});
// A pooled keep-alive socket the server already closed shows up as ECONNRESET: retry once on a fresh one.
const bakedDice = async (): Promise<string> => {
  const url = base + '/data/i/classroom-1/CLEAN_FILES/DICE_EFFECTS.csv';
  try { return await (await fetch(url)).text(); } catch { return (await fetch(url)).text(); }
};
const steerTime = (csv: string) => csv.split(/\r?\n/).find((l) => l.startsWith('CON-STEER,First,time,')) ?? '';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-risk-'));
  child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env, DATA_DIR: dataDir, LOG_FILE: path.join(dataDir, 'visitors.log'), GAMES_FILE: path.join(dataDir, 'games.json'),
      ADMIN_PASSWORD_HASH: crypto.createHash('sha256').update('pw-risk').digest('hex'), FEEDBACK_TOKEN: '',
      DIST_PATH: fs.existsSync(path.join(ROOT, 'dist', 'data')) ? path.join(ROOT, 'dist') : path.join(ROOT, 'public'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise<number>((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('server did not start:\n' + out)), 45_000);
    child.stdout!.on('data', (c) => { out += c; const m = out.match(/Port: (\d+)/); if (m) { clearTimeout(timer); resolve(Number(m[1])); } });
    child.stderr!.on('data', (c) => { out += c; });
    child.on('exit', (code) => reject(new Error(`server exited (${code}):\n${out}`)));
  });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    const r = await fetch(base + '/data/i/classroom-1/CLEAN_FILES/DICE_EFFECTS.csv').catch(() => null);
    if (r && r.ok) break;
    await new Promise((r2) => setTimeout(r2, 250));
  }
  const admin = { 'Content-Type': 'application/json', 'x-admin-password': ADMIN };
  const made = await (await fetch(base + '/api/admin/accounts', { method: 'POST', headers: admin,
    body: JSON.stringify({ username: 'risk-teacher', password: 'risk-teacher-pw-1', displayName: 'Risk Teacher' }) })).json();
  await fetch(base + '/api/admin/instances/classroom-1/owner', { method: 'POST', headers: admin, body: JSON.stringify({ owner: made.account.id }) });
  const login = await (await fetch(base + '/api/accounts/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'risk-teacher', password: 'risk-teacher-pw-1' }) })).json();
  session = login.sessionToken;
}, 90_000);

afterAll(() => {
  child?.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows */ }
});

function editedDice(edit: (cells: string[], line: string) => string | null): string {
  return diceCSV.split(/\r?\n/).map((line) => edit(line.split(','), line) ?? line).join('\n');
}

describe('teacher risk numbers on the real server', () => {
  it('refuses a number out of range, with a plain message', async () => {
    const dice = editedDice((c) => (c[0] === 'CON-STEER' && c[1] === 'Time outcomes' && c[2] === 'First'
      ? [...c.slice(0, 7), '900 days', '900 days', ...c.slice(9)].join(',') : null));
    const r = await post('/api/instances/classroom-1/content', { spacesCSV, diceRollCSV: dice, modalConfigCSV });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/days must be a whole number from 0 to 365/);
  });

  it('a teacher save changes the classroom board, keeps the route, and reset restores it', async () => {
    expect(steerTime(await bakedDice())).toContain('30 days');
    const dice = editedDice((c) => {
      if (c[0] !== 'CON-STEER' || c[2] !== 'First') return null;
      if (c[1] === 'Time outcomes') return [...c.slice(0, 7), '10 days', '10 days', ...c.slice(9)].join(',');
      if (c[1] === 'Fees Paid') return [...c.slice(0, 7), '-5000', '-5000', ...c.slice(9)].join(',');
      if (c[1] === 'Next Step') return [c[0], c[1], c[2], 'FINISH', ...c.slice(4)].join(','); // must be ignored
      return null;
    });
    const r = await post('/api/instances/classroom-1/content', { spacesCSV, diceRollCSV: dice, modalConfigCSV });
    expect(r.status).toBe(200);
    let baked = '';
    for (let i = 0; i < 40; i++) { baked = await bakedDice(); if (steerTime(baked).includes('10 days')) break; await new Promise((x) => setTimeout(x, 250)); }
    expect(steerTime(baked)).toMatch(/0 days,0 days,0 days,0 days,10 days,10 days/);
    expect(baked.split(/\r?\n/).find((l) => l.startsWith('CON-STEER,First,money,'))).toContain('-5000');
    expect(baked.split(/\r?\n/).find((l) => l.startsWith('CON-STEER,First,Next Step,'))).not.toContain('FINISH');
    // The master copy on the server is untouched (plain /data serves the DEFAULT
    // classroom's board, which is classroom-1 itself, so read the file instead).
    expect(steerTime(fs.readFileSync(path.join(dataDir, 'game-data', 'CLEAN_FILES', 'DICE_EFFECTS.csv'), 'utf8'))).toContain('30 days');

    // Reset: stop playing the teacher's card, the original numbers come back.
    const copyId = JSON.parse(fs.readFileSync(cfgPath(), 'utf8')).slots['CON-STEER'].card;
    const del = await fetch(base + `/api/instances/classroom-1/copies/${copyId}`, { method: 'DELETE', headers: { 'x-teacher-session': session } });
    expect(del.status).toBe(200);
    for (let i = 0; i < 40; i++) { baked = await bakedDice(); if (steerTime(baked).includes('30 days')) break; await new Promise((x) => setTimeout(x, 250)); }
    expect(steerTime(baked)).toContain('30 days');
  });
});
