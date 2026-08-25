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
//
// 2026-08-25 (maintainer decision, TV history feed): every history surface —
// the player panel's "What's happened", the shared-screen Log, the end-of-game
// viewer and the new TV feed — shows the SAME feed and differs only by which
// filters are applied. So the optional filters below (who / what / search) live
// here, next to the canonical rule, rather than being re-derived per viewer.

import { ActionLogEntry } from '../types/StateTypes';

export interface LogDisplayFilters {
  /** Hard scope to a single player — the surface's own frame of reference
   *  (the player panel is that player's history), not a user-facing choice. */
  playerId?: string;
  /** User-facing "who" chip. 'all' (or omitted) shows every player. */
  filterPlayerId?: string | 'all';
  /** User-facing "what" chip — a raw ActionLogEntry.type. 'all' (or omitted)
   *  shows every kind of event. */
  filterType?: ActionLogEntry['type'] | 'all';
  /** Free-text match over description / player name / formatted details. */
  search?: string;
  /** Keep `turn_start` entries whatever the user-facing filters say. They are
   *  the feed's turn dividers — structure, not content — so HistoryFeed asks
   *  for them and then drops any divider left with nothing under it. Exports
   *  and counts leave this off: a Markdown export scoped to one player should
   *  not carry every other player's turn headers. */
  keepTurnDividers?: boolean;
}

/** Entry types that structure the feed rather than describe an event. They
 *  survive the user-facing "what" filter so turn dividers stay put. */
const STRUCTURAL_TYPES: ReadonlySet<string> = new Set(['turn_start']);

function matchesSearch(entry: ActionLogEntry, query: string): boolean {
  if (entry.description?.toLowerCase().includes(query)) return true;
  if (entry.playerName?.toLowerCase().includes(query)) return true;
  if (entry.details) {
    try {
      if (JSON.stringify(entry.details).toLowerCase().includes(query)) return true;
    } catch {
      // Circular / non-serializable details — treat as no match rather than throw.
    }
  }
  return false;
}

export function getDisplayableLogEntries(
  entries: ActionLogEntry[],
  filters: LogDisplayFilters = {}
): ActionLogEntry[] {
  const query = filters.search?.trim().toLowerCase() || '';
  return entries.filter(entry => {
    if (!entry.isCommitted) return false;
    if (entry.visibility !== 'player') return false;
    if (filters.playerId && entry.playerId !== filters.playerId) return false;

    const structural = !!filters.keepTurnDividers && STRUCTURAL_TYPES.has(entry.type);
    if (filters.filterPlayerId && filters.filterPlayerId !== 'all' && !structural) {
      if (entry.playerId !== filters.filterPlayerId) return false;
    }
    if (filters.filterType && filters.filterType !== 'all' && !structural) {
      if (entry.type !== filters.filterType) return false;
    }
    if (query && !structural && !matchesSearch(entry, query)) return false;
    return true;
  });
}
