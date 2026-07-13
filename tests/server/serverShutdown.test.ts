// tests/server/serverShutdown.test.ts
// Wiring fingerprint: server.js auto-listens on import (see
// serverEndpointAuth.test.ts's header comment), so shutdown() can't be
// invoked directly in a unit test. Pin its source shape instead — the
// deploy-update warning (TODO "📣 Active — deploy-update warning") depends
// on shutdown() broadcasting BEFORE the process starts tearing down, and on
// broadcastToAllRooms being wired in at all. Room fan-out + per-room gameId
// correctness is covered live by websocketBroadcastAll.test.ts.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../../server/server.js'),
  'utf8'
);

describe('server.js graceful shutdown', () => {
  it('imports broadcastToAllRooms from websocket.js', () => {
    expect(source).toContain('broadcastToAllRooms');
    const importLine = source.split('\n').find(l => l.includes("from './websocket.js'"));
    expect(importLine).toBeDefined();
    expect(importLine).toContain('broadcastToAllRooms');
  });

  it('shutdown() broadcasts the shutdown notice before saveGames()/server.close()/process.exit()', () => {
    const start = source.indexOf('function shutdown()');
    expect(start, 'function shutdown() not found in server.js').toBeGreaterThan(-1);
    const body = source.slice(start, start + 900);

    const broadcastIdx = body.indexOf('broadcastToAllRooms(');
    const saveIdx = body.indexOf('saveGames()');
    const closeIdx = body.indexOf('server.close(');
    const exitIdx = body.indexOf('process.exit(0)');

    expect(broadcastIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(-1);

    // Ordering: broadcast happens first — before the flush delay that leads
    // into save/close/exit.
    expect(broadcastIdx).toBeLessThan(saveIdx);
    expect(saveIdx).toBeLessThan(closeIdx);
    expect(closeIdx).toBeLessThan(exitIdx);
  });

  it('the shutdown-notice message carries the per-room gameId (not a single shared payload)', () => {
    const start = source.indexOf('function shutdown()');
    const body = source.slice(start, start + 900);
    expect(body).toContain("type: 'server_shutdown_notice'");
    // A per-room builder function `(gameId) => ({ ... gameId ... })`, not a
    // single precomputed message object shared across every room.
    expect(body).toMatch(/broadcastToAllRooms\(\s*\(gameId\)\s*=>/);
  });

  it('shutdown() is wired to both SIGINT and SIGTERM (Docker sends SIGTERM before killing the container)', () => {
    expect(source).toContain("process.on('SIGINT', shutdown)");
    expect(source).toContain("process.on('SIGTERM', shutdown)");
  });

  it('the post-broadcast delay stays well under Docker\'s default ~10s SIGTERM grace period', () => {
    const start = source.indexOf('function shutdown()');
    const body = source.slice(Math.max(0, start - 300), start + 900);
    const match = body.match(/SHUTDOWN_NOTICE_FLUSH_MS\s*=\s*(\d+)/);
    expect(match, 'SHUTDOWN_NOTICE_FLUSH_MS constant not found near shutdown()').not.toBeNull();
    const ms = Number(match![1]);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5000);
  });
});
