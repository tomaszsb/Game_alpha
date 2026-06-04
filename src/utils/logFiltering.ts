// Parallel-systems audit (2026-06-04) — Phase 1.2.
//
// Three log viewers (PlayerLogSection in-game, GameLog in-game admin toggle,
// PostGameLogViewer end-of-game) each carried their own filter inline. Pre-v3.0.63
// the divergence was harmless because everything was committed by end-of-turn.
// Post-v3.0.63, uncommitted entries exist during an active turn (mid-turn
// "pencil marks" that vanish on Try Again), so the filter rule matters.
//
// Canonical rule: only show entries that are `visibility === 'player'` AND
// `isCommitted === true`. Mid-turn provisional entries are hidden until the
// turn commits (or removed entirely via discardCurrentSession on Try Again).
// This matches v3.0.63's log-honesty theme — the log should not display
// actions that the state side has already disclaimed or might disclaim.

import { ActionLogEntry } from '../types/StateTypes';

export interface LogDisplayFilters {
  /** Restrict to a single player (PlayerLogSection passes this). */
  playerId?: string;
}

export function getDisplayableLogEntries(
  entries: ActionLogEntry[],
  filters: LogDisplayFilters = {}
): ActionLogEntry[] {
  return entries.filter(entry => {
    if (!entry.isCommitted) return false;
    if (entry.visibility !== 'player') return false;
    if (filters.playerId && entry.playerId !== filters.playerId) return false;
    return true;
  });
}
