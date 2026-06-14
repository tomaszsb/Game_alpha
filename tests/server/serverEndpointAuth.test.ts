// tests/server/serverEndpointAuth.test.ts
// Wiring fingerprint: server.js auto-listens on import, so it can't be
// imported in a unit test. Instead, pin that each protected route's
// handler calls its auth guard as the FIRST statement. The guard logic
// itself is unit-tested in authGuards.test.ts; this test only guards the
// wiring so a refactor can't silently drop an auth check (DEF-5/DEF-6).

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../../server/server.js'),
  'utf8'
);

/**
 * Find the registration of a route and return the first ~200 chars of its
 * handler body — enough to see the guard call that must lead the handler.
 */
function handlerHead(method: string, route: string, len = 600): string {
  // Trailing comma disambiguates '/api/feedback' from '/api/feedback/:id'
  const needle = `app.${method}('${route}',`;
  const start = source.indexOf(needle);
  expect(start, `route ${method.toUpperCase()} ${route} not found in server.js`).toBeGreaterThan(-1);
  return source.slice(start, start + len);
}

describe('server.js endpoint auth wiring', () => {
  it.each([
    ['get', '/api/debug/state'],
    ['get', '/api/debug/games'],
  ])('%s %s requires admin password', (method, route) => {
    expect(handlerHead(method, route)).toContain('requireAdmin(req, res)');
  });

  it.each([
    ['get', '/api/feedback'],
    ['get', '/api/feedback/:id'],
    ['patch', '/api/feedback/:id'],
  ])('%s %s requires feedback access (admin password or FEEDBACK_TOKEN)', (method, route) => {
    expect(handlerHead(method, route)).toContain('requireFeedbackAccess(req, res)');
  });

  it.each([
    ['get', '/api/logs'],
    ['get', '/api/logs/summary'],
  ])('%s %s requires feedback access (visitor logs carry IPs)', (method, route) => {
    expect(handlerHead(method, route)).toContain('requireFeedbackAccess(req, res)');
  });

  it('GET /api/games (full game-code list) requires admin password', () => {
    // Game codes are the join secret (join-info exchanges a code for the
    // game token) — a public list of all codes = write access to all games.
    expect(handlerHead('get', '/api/games')).toContain('requireAdmin(req, res)');
  });

  it.each([
    ['delete', '/api/games/:gameId'],
    ['delete', '/api/games/:gameId/state'],
    ['delete', '/api/gamestate'],
  ])('%s %s (destructive) requires game token or admin', (method, route) => {
    expect(handlerHead(method, route)).toContain('requireGameTokenOrAdmin(req, res');
  });

  it('POST /api/gamestate (legacy write) requires the legacy game token', () => {
    expect(handlerHead('post', '/api/gamestate')).toContain('validateGameToken(req, res, LEGACY_GAME_ID)');
  });

  it('GET /health does not leak game ids (codes are the join secret)', () => {
    // /health stays public for uptime checks, but it used to list every
    // gameId (plus websocket room keys = gameIds), defeating the
    // GET /api/games admin lock. Pin counts-only.
    const head = handlerHead('get', '/health');
    expect(head).not.toContain('games.entries()');
    expect(head).not.toContain('gameId:');
    expect(head).not.toContain('rooms:');
  });

  it.each([
    ['post', '/api/feedback'],          // the in-game bug-report button
    ['post', '/api/games'],             // lobby "create game" button
    ['get', '/api/games/:gameId/join-info'], // join-by-code (documented design)
    ['get', '/api/gamestate'],          // legacy read (spectators welcome)
  ])('%s %s stays open by design', (method, route) => {
    const head = handlerHead(method, route);
    // Match guard CALLS (with open paren + req) — not mentions in comments.
    expect(head).not.toContain('requireFeedbackAccess(req');
    expect(head).not.toContain('requireAdmin(req');
    expect(head).not.toContain('requireGameTokenOrAdmin(req');
    expect(head).not.toContain('validateGameToken(req');
  });

  // ===== Teacher instance layer (Phase 1) =====

  it('POST /api/instances/:id/positions requires instance write token or admin', () => {
    expect(handlerHead('post', '/api/instances/:id/positions', 1200))
      .toContain('checkInstanceWriteAccess(config');
  });

  it('GET /api/instances/:id is open by design but never includes the write token', () => {
    const head = handlerHead('get', '/api/instances/:id', 800);
    // The destructure that strips writeToken from the response must stay.
    expect(head).toContain('writeToken: _writeToken');
    expect(head).not.toContain('requireAdmin(req');
  });

  it('POST /api/games is gated on a fresh bake (configVersion == resolvedVersion)', () => {
    // Spec: a game may only be seeded from a resolved board matching the
    // current classroom config; a half-failed bake can never seed a game.
    // Phase 3b: bakes the game's chosen classroom (default or a teacher's).
    expect(handlerHead('post', '/api/games', 2600)).toContain('rebakeInstance(requestedInstanceId)');
  });

  it.each([
    ['post', '/api/instances/:id/board'],
    ['post', '/api/instances/:id/copies'],
    ['patch', '/api/instances/:id/copies/:copyId'],
    ['delete', '/api/instances/:id/copies/:copyId'],
  ])('%s %s routes through the guarded mutation flow', (method, route) => {
    expect(handlerHead(method, route, 1200)).toContain('handleInstanceMutation(req, res');
  });

  it('GET /api/instances/:id/catalog is open by design (full deck read, no token)', () => {
    const head = handlerHead('get', '/api/instances/:id/catalog', 800);
    expect(head).not.toContain('requireAdmin(req');
    expect(head).not.toContain('checkInstanceWriteAccess(');
    expect(head).toContain('buildCatalog(');
  });

  it('handleInstanceMutation itself enforces write token or admin', () => {
    const start = source.indexOf('function handleInstanceMutation');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 1200);
    expect(body).toContain('checkInstanceWriteAccess(config');
    // And validation gates the save: errors → 422, never a silent bake.
    expect(body).toContain('validateConfig(');
  });

  // ===== Teacher accounts (Phase 3) =====

  it.each([
    ['get', '/api/admin/accounts'],
    ['post', '/api/admin/accounts'],
    ['post', '/api/admin/accounts/:id/reset-password'],
  ])('%s %s (account admin) requires admin password', (method, route) => {
    expect(handlerHead(method, route, 800)).toContain('requireAdmin(req, res)');
  });

  it.each([
    ['post', '/api/accounts/login'],   // authenticating — open by necessity
    ['post', '/api/accounts/logout'],  // revokes the presented session, idempotent
  ])('%s %s stays open by design (not behind the admin/game guards)', (method, route) => {
    const head = handlerHead(method, route, 600);
    expect(head).not.toContain('requireAdmin(req');
    expect(head).not.toContain('requireGameTokenOrAdmin(req');
    expect(head).not.toContain('requireFeedbackAccess(req');
  });

  it('GET /api/accounts/me authorizes via the teacher session, not a req-guard', () => {
    // Tight window: this handler is short and the next route (admin account
    // creation) legitimately contains requireAdmin — don't spill into it.
    const head = handlerHead('get', '/api/accounts/me', 360);
    expect(head).toContain('resolveTeacherAccountId(req)');
    expect(head).not.toContain('requireAdmin(req');
  });

  it('instance write endpoints accept a teacher session (ownership) as well', () => {
    // The two instance-mutating auth sites must pass the resolved accountId
    // into the access check so a classroom owner can write to their own room.
    const positions = handlerHead('post', '/api/instances/:id/positions', 1400);
    expect(positions).toContain('accountId: resolveTeacherAccountId(req)');
    const mutation = source.slice(source.indexOf('function handleInstanceMutation'), source.indexOf('function handleInstanceMutation') + 1400);
    expect(mutation).toContain('accountId: resolveTeacherAccountId(req)');
  });

  // ===== Multi-classroom plumbing (Phase 3b) =====

  it.each([
    ['get', '/api/admin/instances'],
    ['post', '/api/admin/instances'],
    ['post', '/api/admin/instances/:id/owner'],
  ])('%s %s (classroom admin) requires admin password', (method, route) => {
    expect(handlerHead(method, route, 800)).toContain('requireAdmin(req, res)');
  });

  it('POST /api/games binds the chosen classroom and authorizes non-default ones', () => {
    const head = handlerHead('post', '/api/games', 2600);
    // Reads the requested classroom, defaulting to classroom-1 (open).
    expect(head).toContain('req.body.instanceId');
    // A non-default classroom requires ownership/admin to spawn a game.
    expect(head).toContain('checkInstanceWriteAccess(cfg');
    expect(head).toContain('accountId: resolveTeacherAccountId(req)');
    // Bakes the requested instance (not just the default) and records it.
    expect(head).toContain('rebakeInstance(requestedInstanceId)');
    expect(head).toContain('instanceId: requestedInstanceId');
  });

  it('GET /api/games/:gameId/join-info returns the game\'s classroom id', () => {
    const head = handlerHead('get', '/api/games/:gameId/join-info', 800);
    expect(head).toContain('instanceId: game.instanceId || DEFAULT_INSTANCE_ID');
  });

  it('GET /api/instances/mine requires a teacher session, registered before :id', () => {
    const head = handlerHead('get', '/api/instances/mine', 400);
    expect(head).toContain('resolveTeacherAccountId(req)');
    // Registration order matters: '/api/instances/:id' would otherwise
    // capture "mine" as an id and never reach this handler.
    const mineIdx = source.indexOf("app.get('/api/instances/mine'");
    const idIdx = source.indexOf("app.get('/api/instances/:id'");
    expect(mineIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(mineIdx).toBeLessThan(idIdx);
  });

  it('per-instance board serving validates the id (no path traversal)', () => {
    const needle = "app.use('/data/i/:instanceId'";
    const start = source.indexOf(needle);
    expect(start, '/data/i/:instanceId route not found').toBeGreaterThan(-1);
    const body = source.slice(start, start + 500);
    // Strict id pattern blocks '.'/'/' so a crafted id can't escape the dir.
    expect(body).toContain('/^[a-z0-9][a-z0-9-]*$/.test(id)');
    expect(body).toContain('instanceStatic(id)');
  });
});
