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
    ['post', '/api/admin/verify'],
    ['post', '/api/admin/save-source-files'],
    ['post', '/api/admin/reset-to-baseline'],
  ])('%s %s is rate-limited against brute-forcing the admin password', (method, route) => {
    // These three previously had their own inline password checks (duplicated
    // SHA-256 + timingSafeEqual) rather than the shared requireAdmin helper;
    // consolidated onto requireAdmin, but each keeps its own rate limiter —
    // requireAdmin itself does not rate-limit, so checkAdminRateLimit must
    // still run before it (as the first statement in the handler).
    expect(handlerHead(method, route)).toContain('checkAdminRateLimit(req, res)');
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

  it.each([
    ['post', '/api/instances/:id/edge-waypoints'],
    ['delete', '/api/instances/:id/edge-waypoints/:edgeId'],
    ['delete', '/api/instances/:id/edge-waypoints'],
  ])('%s %s requires instance write token or admin', (method, route) => {
    expect(handlerHead(method, route, 1200)).toContain('checkInstanceWriteAccess(config');
  });

  it('GET /api/instances/:id/edge-waypoints is open by design (read-only display data)', () => {
    expect(handlerHead('get', '/api/instances/:id/edge-waypoints', 600))
      .not.toContain('checkInstanceWriteAccess');
  });

  it.each([
    ['post', '/api/instances/:id/edge-anchors'],
    ['delete', '/api/instances/:id/edge-anchors/:edgeId/:end'],
    ['delete', '/api/instances/:id/edge-anchors'],
  ])('%s %s requires instance write token or admin', (method, route) => {
    expect(handlerHead(method, route, 1200)).toContain('checkInstanceWriteAccess(config');
  });

  it('GET /api/instances/:id/edge-anchors is open by design (read-only display data)', () => {
    expect(handlerHead('get', '/api/instances/:id/edge-anchors', 600))
      .not.toContain('checkInstanceWriteAccess');
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
    ['patch', '/api/instances/:id/copies/:copyId'],
    ['delete', '/api/instances/:id/copies/:copyId'],
    ['post', '/api/instances/:id/insertions'],
    ['patch', '/api/instances/:id/insertions/:insertionId'],
    ['delete', '/api/instances/:id/insertions/:insertionId'],
  ])('%s %s routes through the guarded mutation flow', (method, route) => {
    expect(handlerHead(method, route, 1200)).toContain('handleInstanceMutation(req, res');
  });

  // POST /copies needs its own slice: the tier privilege boundary below sits
  // between the route's opening line and the mutation call, past the shared
  // 1200-char window. Slice to the NEXT route registration rather than a
  // bigger fixed window, so an assertion can never be satisfied by code
  // belonging to the following route.
  function copiesRouteBody(): string {
    const start = source.indexOf("app.post('/api/instances/:id/copies',");
    expect(start, 'POST /api/instances/:id/copies not found in server.js').toBeGreaterThan(-1);
    // A route registration always starts at column 0, so the next "\napp."
    // is the end of this one.
    const end = source.indexOf('\napp.', start + 1);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('POST /api/instances/:id/copies routes through the guarded mutation flow', () => {
    expect(copiesRouteBody()).toContain('handleInstanceMutation(req, res');
  });

  // ===== Card Library stage 1: the `official` tier is admin-only =====

  it('POST /api/instances/:id/copies requires ADMIN auth to mint an official card', () => {
    // CARD_LIBRARY_DESIGN.md stage 1: `official` is the curated deck every
    // classroom gets, so creating one is an admin act. handleInstanceMutation's
    // own check (checkInstanceWriteAccess) also passes on the instance write
    // token or a classroom-owning teacher session, which must NOT be enough
    // here — so the route adds its own narrow admin check.
    const body = copiesRouteBody();
    expect(body).toContain("tier === 'official'");
    expect(body).toContain('checkAdminPassword(');
    expect(body).toContain('CONFIG.ADMIN_PASSWORD_HASH');
    expect(body).toContain('res.status(403)');
  });

  it('the official-tier admin check runs BEFORE the mutation flow (a refusal must not touch the config)', () => {
    // Ordering is the whole guarantee: handleInstanceMutation loads, mutates,
    // validates, saves and re-bakes the classroom. A refused `official`
    // request must never reach any of that.
    const body = copiesRouteBody();
    const denial = body.indexOf('res.status(403)');
    const mutation = body.indexOf('handleInstanceMutation(req, res');
    // Guard against a vacuous pass: indexOf returns -1 for a missing needle,
    // which would satisfy "less than" all on its own.
    expect(body.indexOf("tier === 'official'")).toBeGreaterThan(-1);
    expect(denial).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(-1);
    expect(denial).toBeLessThan(mutation);
  });

  it('an omitted tier still reaches createTeacherCopy unchanged (Classroom Setup untouched)', () => {
    // The tier is passed straight through; instanceStore defaults it to
    // 'individual', which is exactly what every pre-stage-1 caller meant.
    // (Formatting shifted to multi-line when stage 1b part ii added
    // stockModalRows/stockLogicRows alongside it — the substring below still
    // pins "tier" as its own unmodified shorthand property, just with the
    // trailing comma a multi-line arg list gets instead of the closing brace.)
    expect(copiesRouteBody()).toContain('stockVersion, tier,');
    const store = fs.readFileSync(
      path.resolve(__dirname, '../../server/instanceStore.js'),
      'utf8'
    );
    expect(store).toContain("tier = 'individual'");
  });

  // ===== Card Library stage 1: the Space Data Editor's save path =====

  function contentRouteBody(): string {
    const start = source.indexOf("app.post('/api/instances/:id/content',");
    expect(start, 'POST /api/instances/:id/content not found in server.js').toBeGreaterThan(-1);
    const end = source.indexOf('\napp.', start + 1);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('POST /api/instances/:id/content requires ADMIN auth (it mints official cards)', () => {
    // Same privilege boundary POST /copies draws for tier:'official', for the
    // same reason. handleInstanceMutation's own check also passes on the
    // instance write token or a classroom-owning teacher session, neither of
    // which is admin.
    const body = contentRouteBody();
    expect(body).toContain('checkAdminPassword(');
    expect(body).toContain('CONFIG.ADMIN_PASSWORD_HASH');
    expect(body).toContain('res.status(403)');
  });

  it('the content-save admin check runs BEFORE the mutation flow (a refusal must not touch the config)', () => {
    const body = contentRouteBody();
    const denial = body.indexOf('res.status(403)');
    const mutation = body.indexOf('handleInstanceMutation(req, res');
    // Guard against a vacuous pass: indexOf returns -1 for a missing needle.
    expect(denial).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(-1);
    expect(denial).toBeLessThan(mutation);
  });

  it('POST /api/instances/:id/content routes through the guarded mutation flow', () => {
    // Validate + bake + 422-on-error come from the shared flow, so a bad edit
    // is rejected with the usual report and never half-applied.
    expect(contentRouteBody()).toContain('handleInstanceMutation(req, res');
  });

  it("content saves mint cards at the 'official' tier and upsert rather than duplicate", () => {
    const body = contentRouteBody();
    expect(body).toContain("tier: 'official'");
    expect(body).toContain("findCardForSlot(config, change.slot, 'official')");
    expect(body).toContain('replaceCardContent(');
  });

  it('the editor posts to the classroom content route, not to save-source-files', () => {
    // The whole point of the slice: /api/admin/save-source-files writes the
    // writable stock, which initWritableData re-seeds on boot — so edits saved
    // there are reverted by the next restart.
    const editor = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/editor/DataEditor.tsx'),
      'utf8'
    );
    expect(editor).toContain('/content`');
    // The old target may still be NAMED in a comment explaining the change —
    // what must be gone is the request to it.
    expect(editor).not.toContain('backendURL}/api/admin/save-source-files');
  });

  it('/api/admin/save-source-files still exists and still guards itself', () => {
    // Left in place deliberately (other callers may reach it); retiring it is
    // not this slice's job.
    const head = handlerHead('post', '/api/admin/save-source-files');
    expect(head).toContain('checkAdminRateLimit(req, res)');
    expect(head).toContain('requireAdmin(req, res)');
  });

  it('handleInstanceMutation enforces optimistic concurrency (409 on stale configVersion)', () => {
    const start = source.indexOf('function handleInstanceMutation');
    const body = source.slice(start, start + 1600);
    expect(body).toContain('baseConfigVersion');
    expect(body).toContain('409');
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
    const body = source.slice(start, start + 2400);
    expect(body).toContain('checkInstanceWriteAccess(config');
    // And validation gates the save: errors → 422, never a silent bake.
    expect(body).toContain('validateConfig(');
  });

  // ===== Teacher accounts (Phase 3) =====

  it.each([
    ['get', '/api/admin/accounts'],
    ['post', '/api/admin/accounts'],
    ['post', '/api/admin/accounts/:id/reset-password'],
    ['delete', '/api/admin/accounts/:id'],
  ])('%s %s (account admin) requires admin password', (method, route) => {
    expect(handlerHead(method, route, 800)).toContain('requireAdmin(req, res)');
  });

  it('DELETE /api/admin/accounts/:id also releases the deleted teacher\'s classrooms', () => {
    const head = handlerHead('delete', '/api/admin/accounts/:id', 800);
    expect(head).toContain('deleteAccount(accountsRoot, req.params.id)');
    expect(head).toContain('removeAccountFromAllInstances(instancesRoot, req.params.id)');
  });

  it('POST /api/accounts/login is rate-limited against brute-forcing a teacher account password', () => {
    // Own bucket (checkLoginRateLimit), separate from the admin-password
    // limiter — a shared school IP shouldn't cross-throttle the two.
    expect(handlerHead('post', '/api/accounts/login')).toContain('checkLoginRateLimit(req, res)');
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
    const head = handlerHead('get', '/api/games/:gameId/join-info', 900);
    expect(head).toContain('instanceId: game.instanceId || DEFAULT_INSTANCE_ID');
  });

  it('GET /api/games/:gameId/join-info returns a minimal player roster for the "which player are you?" picker', () => {
    // fb:feedback-1783819148816-bb72760f / fb:feedback-1783819238489-aaae63c0
    // — the client needs id/shortId/name/color/avatar to build a rejoin
    // picker, but nothing else (no money/hand/history) since this route
    // stays open by design.
    const head = handlerHead('get', '/api/games/:gameId/join-info', 1500);
    expect(head).toContain('players: (game.state?.players || []).map(p => ({');
    expect(head).toContain('shortId: p.shortId');
    expect(head).not.toContain('money: p.money');
    expect(head).not.toContain('hand: p.hand');
  });

  it('GET /api/games/:gameId/join-info flags players with a live WebSocket connection', () => {
    // Takeover-warning follow-up (2026-07-12/13): the picker needs to know
    // if the player being picked is already connected elsewhere, computed
    // from the WS server's own connection tracking (not stored on Player).
    const head = handlerHead('get', '/api/games/:gameId/join-info', 1500);
    expect(head).toContain('getConnectedPlayerIds(gameId)');
    expect(head).toContain('connected: connectedPlayerIds.has(p.id)');
  });

  // ===== Phase 3 polish: teacher self-service create + delete =====

  it('POST /api/instances lets a logged-in teacher create a room they own (not admin-gated)', () => {
    const head = handlerHead('post', '/api/instances', 900);
    // Authorized by the teacher session, NOT the admin guard.
    expect(head).toContain('resolveTeacherAccountId(req)');
    expect(head).not.toContain('requireAdmin(req');
    // The new room is owned by the caller automatically.
    expect(head).toContain('setInstanceOwner(config, accountId)');
    // Registered before '/api/instances/:id' so it isn't shadowed by it.
    const createIdx = source.indexOf("app.post('/api/instances'");
    const idIdx = source.indexOf("app.get('/api/instances/:id'");
    expect(createIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeLessThan(idIdx);
  });

  it('DELETE /api/instances/:id allows the owner or admin, and refuses the default classroom', () => {
    const head = handlerHead('delete', '/api/instances/:id', 1400);
    expect(head).toContain('checkInstanceWriteAccess(config');
    expect(head).toContain('accountId: resolveTeacherAccountId(req)');
    // The public default classroom can never be deleted.
    expect(head).toContain('DEFAULT_INSTANCE_ID');
    expect(head).toContain('deleteInstance(instancesRoot, id)');
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
    const body = source.slice(start, start + 650);
    // 2026-07-21 security audit (path traversal) moved id validation out of
    // this route body and into resolvedDir() -> assertValidInstanceId()
    // (server/instanceStore.js), so every caller gets the guard for free.
    // Pin that this route still goes through it (400 on invalid id) and
    // still serves via instanceStatic(id) once validated.
    expect(body).toContain('resolvedDir(instancesRoot, id)');
    expect(body).toContain('res.status(400).end()');
    expect(body).toContain('instanceStatic(id)');

    // The strict id pattern itself (blocks '.'/'/' so a crafted id can't
    // escape the instances dir) now lives in instanceStore.js.
    const instanceStoreSource = fs.readFileSync(
      path.resolve(__dirname, '../../server/instanceStore.js'),
      'utf8'
    );
    expect(instanceStoreSource).toContain('/^[a-z0-9][a-z0-9-]*$/');
  });

  // ===== Owner alert: fires on game start, not on page load (fb:feedback-1783919163453-a98951ab) =====

  it('POST /api/games (CREATE_GAME) no longer sends an owner alert — that fired on every homepage visit, not real play', () => {
    const head = handlerHead('post', '/api/games', 2600);
    expect(head).toContain("logVisitor(req, 'CREATE_GAME'");
    expect(head).not.toContain('sendOwnerAlert(');
    expect(head).not.toContain('foreignGameAlertsEnabled');
  });

  it('POST /api/games/:gameId/state detects the real SETUP->PLAY transition (not the never-true "PLAYING")', () => {
    const start = source.indexOf("app.post('/api/games/:gameId/state'");
    expect(start, "route POST /api/games/:gameId/state not found in server.js").toBeGreaterThan(-1);
    const body = source.slice(start, start + 2200);
    // Every gamePhase value in this codebase is 'PLAY' — 'PLAYING' never matched.
    expect(body).toContain("game.state?.gamePhase === 'SETUP' && state.gamePhase === 'PLAY'");
    expect(body).not.toContain("state.gamePhase === 'PLAYING'");
    expect(body).toContain("logVisitor(req, 'GAME_STARTED'");
  });

  it('GAME_STARTED sends the owner alert (gated on foreignGameAlertsEnabled + !isHomeIP) with player names', () => {
    const start = source.indexOf("app.post('/api/games/:gameId/state'");
    const body = source.slice(start, start + 3000);
    expect(body).toContain('settings.foreignGameAlertsEnabled && !isHomeIP(logEntry.ip)');
    expect(body).toContain('sendOwnerAlert(');
    expect(body).toContain('players: ${playerNames}');
    // Mail failure is swallowed so it can never break the state-push response.
    expect(body).toContain("console.warn('⚠️ Could not send foreign-game alert:', err.message)");
  });

  it('GAME_STARTED owner alert is capped, not just kill-switched — a burst can\'t spam the carrier gateway', () => {
    const start = source.indexOf("app.post('/api/games/:gameId/state'");
    const body = source.slice(start, start + 3000);
    // The alert call must be gated behind the hourly cap, inside the
    // existing kill-switch + foreign-IP check — not a separate bypass path.
    expect(body).toContain('canSendForeignGameAlert()');
    expect(body.indexOf('canSendForeignGameAlert()')).toBeLessThan(body.indexOf('sendOwnerAlert('));
  });

  it('canSendForeignGameAlert enforces a real hourly cap (maxPerHour), not an unlimited passthrough', () => {
    const start = source.indexOf('function canSendForeignGameAlert');
    expect(start, 'canSendForeignGameAlert not found in server.js').toBeGreaterThan(-1);
    const body = source.slice(start, start + 400);
    expect(body).toContain('alertWindow.count >= ALERT_CAP.maxPerHour');
    expect(source).toMatch(/ALERT_CAP\s*=\s*\{\s*maxPerHour:\s*\d+/);
  });

  it('the X-Powered-By framework-fingerprint header is disabled', () => {
    // Must be set right after the Express app is constructed, before any
    // route registration — express only omits the header on responses if
    // this runs before the app starts handling requests.
    const start = source.indexOf('const app = express()');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 150);
    expect(body).toContain("app.disable('x-powered-by')");
  });
});
