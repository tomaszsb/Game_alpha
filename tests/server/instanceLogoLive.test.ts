// The school logo on the REAL server: who may change it, what it refuses, where it lives, and how it is
// served. A teacher account owns classroom-1; a second teacher and a stranger try to break in.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '../..');
let child: ChildProcess;
let base = '';
let dataDir = '';
const ADMIN = 'pw-logo';
let owner = '';
let other = '';

const solid = (w: number, h: number) => ({ create: { width: w, height: h, channels: 3 as const, background: '#cc3300' } });
const asPng = (w = 300, h = 200) => sharp(solid(w, h)).png().toBuffer();
const asJpeg = (w = 300, h = 200) => sharp(solid(w, h)).jpeg().toBuffer();
const json = (extra: Record<string, string> = {}) => ({ 'Content-Type': 'application/json', ...extra });
const put = (route: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + route, { method: 'PUT', headers: json(headers), body: JSON.stringify(body) });
const upload = (img: Buffer, headers: Record<string, string>) => put('/api/instances/classroom-1/logo', { image: img.toString('base64') }, headers);
const logoOnDisk = () => path.join(dataDir, 'instance-assets', 'classroom-1', 'logo.png');

async function makeTeacher(username: string): Promise<string> {
  const admin = json({ 'x-admin-password': ADMIN });
  const made = await (await fetch(base + '/api/admin/accounts', { method: 'POST', headers: admin,
    body: JSON.stringify({ username, password: `${username}-pw-1234`, displayName: username }) })).json();
  const login = await (await fetch(base + '/api/accounts/login', { method: 'POST', headers: json(),
    body: JSON.stringify({ username, password: `${username}-pw-1234` }) })).json();
  if (username === 'logo-owner') {
    await fetch(base + '/api/admin/instances/classroom-1/owner', { method: 'POST', headers: admin, body: JSON.stringify({ owner: made.account.id }) });
  }
  return login.sessionToken;
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-logo-live-'));
  child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env, DATA_DIR: dataDir, LOG_FILE: path.join(dataDir, 'visitors.log'), GAMES_FILE: path.join(dataDir, 'games.json'),
      ADMIN_PASSWORD_HASH: crypto.createHash('sha256').update(ADMIN).digest('hex'), FEEDBACK_TOKEN: '',
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
    const r = await fetch(base + '/api/instances/classroom-1').catch(() => null);
    if (r && r.ok) break;
    await new Promise((r2) => setTimeout(r2, 250));
  }
  owner = await makeTeacher('logo-owner');
  other = await makeTeacher('logo-other');
}, 90_000);

afterAll(() => {
  child?.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows */ }
});

describe('school logo on the real server', () => {
  it('has no logo to start with: 404, and the classroom read says null', async () => {
    expect((await fetch(base + '/api/instances/classroom-1/logo')).status).toBe(404);
    expect((await (await fetch(base + '/api/instances/classroom-1')).json()).logoVersion).toBeNull();
  });

  it('refuses a stranger, another teacher and a wrong admin password; nothing is stored', async () => {
    const img = await asPng();
    expect((await upload(img, {})).status).toBe(401);
    expect((await upload(img, { 'x-teacher-session': other })).status).toBeGreaterThanOrEqual(401);
    expect((await upload(img, { 'x-admin-password': 'not-it' })).status).toBeGreaterThanOrEqual(401);
    expect(fs.existsSync(logoOnDisk())).toBe(false);
  });

  it('refuses an SVG, a renamed non-picture and a too-small picture, with plain words', async () => {
    const h = { 'x-teacher-session': owner };
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script></svg>');
    const r1 = await upload(svg, h);
    expect(r1.status).toBe(400);
    expect((await r1.json()).error).toMatch(/PNG or JPEG/);
    expect((await upload(Buffer.from('MZ not a picture at all, just some text bytes'), h)).status).toBe(400);
    const tiny = await upload(await asPng(20, 20), h);
    expect(tiny.status).toBe(400);
    expect((await tiny.json()).error).toMatch(/at least 64/);
    expect(fs.existsSync(logoOnDisk())).toBe(false);
  });

  it('refuses a file over 1 MB', async () => {
    const r = await put('/api/instances/classroom-1/logo', { image: Buffer.alloc(1024 * 1024 + 10, 1).toString('base64') }, { 'x-teacher-session': owner });
    expect(r.status).toBe(413);
    expect((await r.json()).error).toMatch(/under 1 MB/);
  });

  it('the owning teacher can upload a JPEG: stored as a clean PNG outside every open folder', async () => {
    const r = await upload(await asJpeg(1000, 400), { 'x-teacher-session': owner });
    expect(r.status).toBe(200);
    expect(fs.existsSync(logoOnDisk())).toBe(true);
    const meta = await sharp(fs.readFileSync(logoOnDisk())).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(512);
    expect(logoOnDisk().startsWith(path.join(dataDir, 'game-data'))).toBe(false);
  });

  it('serves it with safe headers to anyone, and the classroom read carries a version', async () => {
    const r = await fetch(base + '/api/instances/classroom-1/logo');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-disposition')).toMatch(/^inline/);
    expect(Buffer.from(await r.arrayBuffer()).subarray(1, 4).toString()).toBe('PNG');
    expect(typeof (await (await fetch(base + '/api/instances/classroom-1')).json()).logoVersion).toBe('number');
  });

  it('is not reachable through any open folder or a climbing path', async () => {
    for (const p of [
      '/data/instance-assets/classroom-1/logo.png',
      '/instance-assets/classroom-1/logo.png',
      '/data/../instance-assets/classroom-1/logo.png',
      '/api/instances/..%2F..%2Fx/logo',
    ]) {
      const r = await fetch(base + p).catch(() => null);
      const type = r?.headers.get('content-type') || '';
      expect(r === null || r.status >= 400 || !type.startsWith('image/png')).toBe(true);
    }
  });

  it('the school name is saved by the teacher, refused for a stranger and when too long', async () => {
    expect((await put('/api/instances/classroom-1/school-name', { schoolName: 'Nope' })).status).toBe(401);
    expect((await put('/api/instances/classroom-1/school-name', { schoolName: 'x'.repeat(201) }, { 'x-teacher-session': owner })).status).toBe(400);
    const ok = await put('/api/instances/classroom-1/school-name', { schoolName: '  Farmingdale State  ' }, { 'x-teacher-session': owner });
    expect(ok.status).toBe(200);
    expect((await (await fetch(base + '/api/instances/classroom-1')).json()).meta.schoolName).toBe('Farmingdale State');
  });

  it('a second teacher cannot remove it, but the owner and the admin each can', async () => {
    const del = (headers: Record<string, string>) => fetch(base + '/api/instances/classroom-1/logo', { method: 'DELETE', headers });
    expect((await del({})).status).toBe(401);
    expect((await del({ 'x-teacher-session': other })).status).toBeGreaterThanOrEqual(401);
    expect(fs.existsSync(logoOnDisk())).toBe(true);
    expect((await del({ 'x-teacher-session': owner })).status).toBe(200);
    expect(fs.existsSync(logoOnDisk())).toBe(false);
    expect((await fetch(base + '/api/instances/classroom-1/logo')).status).toBe(404);

    // The admin can put one back and take it off again.
    expect((await upload(await asPng(), { 'x-admin-password': ADMIN })).status).toBe(200);
    expect(fs.existsSync(logoOnDisk())).toBe(true);
    expect((await del({ 'x-admin-password': ADMIN })).status).toBe(200);
    expect(fs.existsSync(logoOnDisk())).toBe(false);
  });

  it('keeps the removed logos with the other classroom backups', () => {
    const dir = path.join(dataDir, 'game-data', 'backups', 'instance-assets', 'classroom-1');
    expect(fs.readdirSync(dir).filter((n) => n.endsWith('.png')).length).toBeGreaterThanOrEqual(2);
  });

  it('answers 429 once one address has used its 20 changes an hour', async () => {
    const h = { 'x-teacher-session': owner };
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await upload(await asPng(100 + i, 100), h)).status);
    expect(statuses).toContain(429);
  });
});
