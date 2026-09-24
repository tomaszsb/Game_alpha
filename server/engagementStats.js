// server/engagementStats.js
// Pure aggregation logic for GET /api/admin/engagement-stats — "how far
// players get, what draws their attention" (TODO.md, decided 2026-08-02).
// Sibling to visitorStats.js (same parseLogLine input shape, same
// side-effect-free/importable-in-tests pattern) but a separate file: that
// module is scoped specifically to the acquisition-funnel dashboard;
// this one answers in-game-progression questions instead.
//
// Tracked events (see playtestAnalytics.ts / server.js PLAYTEST_EVENTS):
// PLAYTEST_SPACE_REACHED, PLAYTEST_GAME_FINISHED, PLAYTEST_PANEL_OPENED,
// PLAYTEST_PUSH_BACK.
//
// game_abandoned is deliberately NOT a tracked client event — a
// beforeunload/visibilitychange beacon is unreliable (the tab can be killed
// without ever firing it). Abandonment is INFERRED here instead: any
// GAME_STARTED log entry (already recorded for every game, no new event
// needed) whose gameId never shows up in a PLAYTEST_GAME_FINISHED event,
// more than ABANDON_THRESHOLD_MS after it started, counts as abandoned.
//
// Multiple connected devices (e.g. a TV plus several phones in Phones+TV
// mode) can each independently observe and report the same real-world
// moment — a naive raw event count would inflate "how many players reached
// this space" by however many screens happened to be watching. Space-reach
// and game-finish counts are deduped by identity (gameId+playerId+spaceId,
// gameId respectively) rather than counted as raw events. Panel opens are
// NOT deduped — each open is a genuine local UI click, one client only, and
// repeat opens are the actual signal ("how much they used it").
//
// Push-backs ("Try Again") are the third shape. A player can genuinely push back
// at the same space more than once, so identity-by-space (like space-reach)
// would undercount — a push-back is identified by (game, player, space, visit,
// turn, attempt) instead: two screens reporting the same one collapse to one, a
// real second attempt does not. An event that lacks turn/attempt can't be told
// from a repeat, so it is counted raw rather than risk hiding a real one. Each
// row is split by origin the same way `byOrigin` is (home = the maintainer and
// the nightly robot, foreign = everyone else), decided by the game's OWN
// GAME_STARTED ip; a game with no GAME_STARTED in the log lands in `unknown`
// rather than being quietly counted as a real player.

export const ABANDON_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4h — generous for a ~30-60 min game

/**
 * The extra fields the push_back event puts on its log line. Pure and separate
 * from server.js (which auto-listens on import) so it can be unit-tested; only
 * this event carries them, every other tracked event's log line is unchanged.
 * Same 60-char cap the route applies to every other string field.
 */
export function pushBackLogFields(body) {
  const b = body || {};
  const str = (v) => (typeof v === 'string' ? v.slice(0, 60) : null);
  const int = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-9999, Math.min(9999, Math.trunc(v))) : null);
  return {
    visitType: str(b.visitType),
    daysCharged: int(b.daysCharged),
    turn: int(b.turn),
    attempt: int(b.attempt),
    costChecked: typeof b.costChecked === 'boolean' ? b.costChecked : null,
  };
}

/**
 * @param {Array<object>} rawEntries - output of parseLogLine (nulls filtered), same shape visitorStats.js consumes
 * @param {object} [options]
 * @param {number} [options.now] - epoch ms "current time" (injectable for tests)
 * @param {(ip: string) => boolean} [options.isHomeIP] - same contract as
 *   visitorStats.js's option of the same name (server.js's isHomeIP() wraps
 *   the pure homeIP.js helper). A game's origin is decided from its OWN
 *   GAME_STARTED event's ip — whoever created it — not from every event
 *   that later touched it (a remote player joining a maintainer-created game
 *   would otherwise flip it foreign mid-game). TODO.md 2026-08-15/09-01: the
 *   maintainer's own testing had no way to be excluded from "real player"
 *   counts, and a prior read of this dataset drew a conclusion ("4 of 9
 *   games never got a second player") that dissolved once that was pointed
 *   out — see the RETRACTED note in TODO.md. `byOrigin` makes that
 *   exclusion possible without discarding the maintainer's own data (still
 *   useful for verifying a feature works, just not as a "do real players
 *   get stuck" signal). Defaults to `() => false` (everything foreign) so
 *   omitting the option is a safe no-op, matching visitorStats.js.
 */
export function aggregateEngagementStats(rawEntries, options = {}) {
  const { now = Date.now(), isHomeIP = () => false } = options;
  const entries = (rawEntries || []).filter((e) => e && typeof e.action === 'string');

  const spaceReachedKeys = new Set(); // `${gameId}|${playerId}|${spaceId}`
  const spacesReached = {};
  const panelOpens = {};
  const startedGames = new Map(); // gameId -> { ts: _ts, origin: 'home'|'foreign' }
  const finishedGameIds = new Set();
  const pushBackKeys = new Set(); // one real push-back — see the header note
  const pushBackEvents = [];

  for (const e of entries) {
    if (e.action === 'GAME_STARTED' && e.gameId) {
      if (!startedGames.has(e.gameId)) {
        startedGames.set(e.gameId, { ts: e._ts, origin: isHomeIP(e.ip) ? 'home' : 'foreign' });
      }
    } else if (e.action === 'PLAYTEST_SPACE_REACHED' && e.gameId && e.playerId && e.spaceId) {
      const key = `${e.gameId}|${e.playerId}|${e.spaceId}`;
      if (!spaceReachedKeys.has(key)) {
        spaceReachedKeys.add(key);
        spacesReached[e.spaceId] = (spacesReached[e.spaceId] || 0) + 1;
      }
    } else if (e.action === 'PLAYTEST_GAME_FINISHED' && e.gameId) {
      finishedGameIds.add(e.gameId);
    } else if (e.action === 'PLAYTEST_PANEL_OPENED' && e.panel) {
      panelOpens[e.panel] = (panelOpens[e.panel] || 0) + 1;
    } else if (e.action === 'PLAYTEST_PUSH_BACK' && e.gameId && e.playerId && e.spaceId) {
      const identified = Number.isInteger(e.turn) && Number.isInteger(e.attempt);
      const key = identified
        ? [e.gameId, e.playerId, e.spaceId, e.visitType ?? '', e.turn, e.attempt].join('|')
        : null;
      if (key === null || !pushBackKeys.has(key)) {
        if (key !== null) pushBackKeys.add(key);
        pushBackEvents.push(e);
      }
    }
  }

  // Bucket by origin only after the loop, so a push-back logged before its
  // game's GAME_STARTED line (out-of-order log) is still attributed correctly.
  const pushBackRows = { home: new Map(), foreign: new Map(), unknown: new Map() };
  for (const e of pushBackEvents) {
    const rows = pushBackRows[startedGames.get(e.gameId)?.origin ?? 'unknown'];
    const rowKey = `${e.spaceId}|${e.visitType ?? ''}|${e.daysCharged ?? ''}`;
    let row = rows.get(rowKey);
    if (!row) {
      row = {
        spaceId: e.spaceId,
        visitType: e.visitType ?? null,
        daysCharged: typeof e.daysCharged === 'number' ? e.daysCharged : null,
        count: 0,
        // Had the player opened this side's cost box before committing? `unknown`
        // = the client couldn't tell (older build, or a caller that didn't say).
        costChecked: { yes: 0, no: 0, unknown: 0 },
      };
      rows.set(rowKey, row);
    }
    row.count++;
    row.costChecked[e.costChecked === true ? 'yes' : e.costChecked === false ? 'no' : 'unknown']++;
  }
  const summarizePushBacks = (rows) => {
    const bySpace = [...rows.values()].sort((a, b) => b.count - a.count || a.spaceId.localeCompare(b.spaceId));
    return { total: bySpace.reduce((n, r) => n + r.count, 0), bySpace };
  };
  const pushBacks = {
    home: summarizePushBacks(pushBackRows.home),
    foreign: summarizePushBacks(pushBackRows.foreign),
    unknown: summarizePushBacks(pushBackRows.unknown),
  };

  let gamesAbandoned = 0;
  const byOrigin = {
    home: { gamesStarted: 0, gamesFinished: 0, gamesAbandoned: 0 },
    foreign: { gamesStarted: 0, gamesFinished: 0, gamesAbandoned: 0 },
  };
  for (const [gameId, game] of startedGames) {
    const bucket = byOrigin[game.origin];
    bucket.gamesStarted++;
    const finished = finishedGameIds.has(gameId);
    if (finished) bucket.gamesFinished++;
    if (!finished && typeof game.ts === 'number' && (now - game.ts) > ABANDON_THRESHOLD_MS) {
      gamesAbandoned++;
      bucket.gamesAbandoned++;
    }
  }

  const spacesReachedSorted = Object.entries(spacesReached)
    .map(([spaceId, count]) => ({ spaceId, count }))
    .sort((a, b) => b.count - a.count);
  const panelOpensSorted = Object.entries(panelOpens)
    .map(([panel, count]) => ({ panel, count }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date(now).toISOString(),
    gamesStarted: startedGames.size,
    gamesFinished: finishedGameIds.size,
    gamesAbandoned,
    byOrigin,
    spacesReached: spacesReachedSorted,
    panelOpens: panelOpensSorted,
    pushBacks,
  };
}
