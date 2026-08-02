// server/engagementStats.js
// Pure aggregation logic for GET /api/admin/engagement-stats — "how far
// players get, what draws their attention" (TODO.md, decided 2026-08-02).
// Sibling to visitorStats.js (same parseLogLine input shape, same
// side-effect-free/importable-in-tests pattern) but a separate file: that
// module is scoped specifically to the acquisition-funnel dashboard;
// this one answers in-game-progression questions instead.
//
// Tracked events (see playtestAnalytics.ts / server.js PLAYTEST_EVENTS):
// PLAYTEST_SPACE_REACHED, PLAYTEST_GAME_FINISHED, PLAYTEST_PANEL_OPENED.
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

export const ABANDON_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4h — generous for a ~30-60 min game

/**
 * @param {Array<object>} rawEntries - output of parseLogLine (nulls filtered), same shape visitorStats.js consumes
 * @param {object} [options]
 * @param {number} [options.now] - epoch ms "current time" (injectable for tests)
 */
export function aggregateEngagementStats(rawEntries, options = {}) {
  const { now = Date.now() } = options;
  const entries = (rawEntries || []).filter((e) => e && typeof e.action === 'string');

  const spaceReachedKeys = new Set(); // `${gameId}|${playerId}|${spaceId}`
  const spacesReached = {};
  const panelOpens = {};
  const startedGames = new Map(); // gameId -> _ts
  const finishedGameIds = new Set();

  for (const e of entries) {
    if (e.action === 'GAME_STARTED' && e.gameId) {
      if (!startedGames.has(e.gameId)) startedGames.set(e.gameId, e._ts);
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
    }
  }

  let gamesAbandoned = 0;
  for (const [gameId, startedTs] of startedGames) {
    if (finishedGameIds.has(gameId)) continue;
    if (typeof startedTs === 'number' && (now - startedTs) > ABANDON_THRESHOLD_MS) gamesAbandoned++;
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
    spacesReached: spacesReachedSorted,
    panelOpens: panelOpensSorted,
  };
}
