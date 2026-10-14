// server/uptimeMonitor.js
// The decision half of the outside uptime check (scripts/uptime-check.mjs). Pure: given what was remembered from the
// last runs and whether /health answered this time, say what to remember next and whether to text the owner.
//
// Why it exists: a Cloudflare tunnel outage sat undetected for 12 days (2026-08). The game cannot report its own
// absence, so the check runs on a machine OUTSIDE the server (the maintainer's PC, every 5 minutes).

/** Misses in a row before the first alert: 3 runs at 5-minute spacing = a 10-15 minute outage, past a normal restart. */
export const FAILS_BEFORE_ALERT = 3;

/**
 * @param {{ fails?: number, alerted?: boolean, downSince?: string | null } | null | undefined} prev what was remembered
 * @param {boolean} ok did /health answer with status ok this time
 * @param {string} nowIso the time of this check
 * @returns {{ state: { fails: number, alerted: boolean, downSince: string | null }, alert: string | null }}
 */
export function decideUptime(prev, ok, nowIso) {
  const fails = prev?.fails ?? 0;
  const alerted = prev?.alerted ?? false;
  const downSince = prev?.downSince ?? null;
  if (ok) {
    if (alerted) {
      const minutes = downSince ? Math.max(1, Math.round((Date.parse(nowIso) - Date.parse(downSince)) / 60000)) : null;
      return {
        state: { fails: 0, alerted: false, downSince: null },
        alert: `Unravel Codes is back up${minutes ? ` after about ${minutes} min` : ''}.`,
      };
    }
    return { state: { fails: 0, alerted: false, downSince: null }, alert: null };
  }
  const nextFails = fails + 1;
  const since = downSince ?? nowIso;
  if (nextFails >= FAILS_BEFORE_ALERT && !alerted) {
    return {
      state: { fails: nextFails, alerted: true, downSince: since },
      alert: `Unravel Codes is DOWN: game.unravelcodes.com/health has not answered ${nextFails} checks in a row (since ${since}).`,
    };
  }
  return { state: { fails: nextFails, alerted, downSince: since }, alert: null };
}
