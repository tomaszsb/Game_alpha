// The /data allowlist (security fix 2026-10-18): accounts, classroom config
// tokens and backups were downloadable by anyone. Real express + real files.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
// @ts-expect-error plain JS module
import { dataGate, isAllowedDataPath } from '../../server/dataGate.js';

let root: string;
let server: http.Server;
let port: number;

function write(rel: string, body: string) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
}

function get(p: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    // http.get keeps the path byte-for-byte (fetch would normalise '..')
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    }).on('error', reject);
  });
}

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'datagate-'));
  write('accounts/sessions.json', 'SECRET-SESSIONS');
  write('accounts/accounts.json', 'SECRET-ACCOUNTS');
  write('instances/classroom-1/config.json', 'SECRET-TOKEN');
  write('instances/classroom-1/resolved/bake-stamp.json', 'STAMP');
  write('instances/classroom-1/resolved/CLEAN_FILES/GAME_CONFIG.csv', 'BOARD-1');
  write('backups/2026-10-17_x/Spaces.csv', 'BACKUP');
  write('BASELINE/Spaces.csv', 'BASELINE');
  write('SOURCE_FILES/Spaces.csv', 'SPACES');
  write('SOURCE_FILES/DiceRoll Info.csv', 'DICE');
  write('CLEAN_FILES/GAME_CONFIG.csv', 'CONFIG');
  write('GLOSSARY.csv', 'GLOSS');
  const app = express();
  app.use('/data', dataGate);
  app.use('/data', express.static(root));
  app.use('/data/i/:id', (req, res, next) =>
    express.static(path.join(root, 'instances', req.params.id, 'resolved'))(req, res, next));
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as any).port;
});

afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('/data refuses private files', () => {
  it.each([
    '/data/accounts/sessions.json',
    '/data/accounts/accounts.json',
    '/data/accounts/',
    '/data/instances/classroom-1/config.json',
    '/data/instances/classroom-1/resolved/bake-stamp.json',
    '/data/i/classroom-1/bake-stamp.json',
    '/data/i/classroom-1/../config.json',
    '/data/i/classroom-1/%2e%2e/config.json',
    '/data/backups/2026-10-17_x/Spaces.csv',
    '/data/BASELINE/Spaces.csv',
    '/data/ACCOUNTS/sessions.json',
    '/data/accounts/sessions.json/',
    '/data/accounts%2Fsessions.json',
    '/data/%61ccounts/sessions.json',
    '/data/SOURCE_FILES/../accounts/sessions.json',
    '/data/SOURCE_FILES/%2e%2e/accounts/sessions.json',
    '/data/SOURCE_FILES/..%2Faccounts%2Fsessions.json',
    '/data/SOURCE_FILES/..%5Caccounts%5Csessions.json',
    '/data/SOURCE_FILES/%00.csv',
    '/data/.hidden.json',
  ])('404 for %s', async (p) => {
    const r = await get(p);
    expect(r.status).toBe(404);
    expect(r.body).not.toMatch(/SECRET|STAMP|BACKUP|BASELINE/);
  });
});

describe('/data still serves the board', () => {
  it.each([
    ['/data/SOURCE_FILES/Spaces.csv', 'SPACES'],
    ['/data/SOURCE_FILES/DiceRoll%20Info.csv?_=123', 'DICE'],
    ['/data/CLEAN_FILES/GAME_CONFIG.csv?_=123', 'CONFIG'],
    ['/data/GLOSSARY.csv', 'GLOSS'],
    ['/data/i/classroom-1/CLEAN_FILES/GAME_CONFIG.csv', 'BOARD-1'],
  ])('200 for %s', async (p, body) => {
    const r = await get(p);
    expect(r.status).toBe(200);
    expect(r.body).toBe(body);
  });
});

describe('isAllowedDataPath', () => {
  it('rejects malformed escapes', () => {
    expect(isAllowedDataPath('/%E0%A4%A')).toBe(false);
  });
});
