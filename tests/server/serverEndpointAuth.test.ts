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
function handlerHead(method: string, route: string): string {
  // Trailing comma disambiguates '/api/feedback' from '/api/feedback/:id'
  const needle = `app.${method}('${route}',`;
  const start = source.indexOf(needle);
  expect(start, `route ${method.toUpperCase()} ${route} not found in server.js`).toBeGreaterThan(-1);
  return source.slice(start, start + 600);
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
});
