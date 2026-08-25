// HistoryFeed — the one "what's happened" feed, shared by every surface.
//
// Maintainer decision, 2026-08-25 (answering the TV-history-feed question):
// "all the feeds should look the same, they should just be filtered
// differently — and because it's on a TV, put the filters on screen and let
// people decide what to see."
//
// So this component owns the LOOK (turn-block grouping, one row per event,
// time on the right) and the FILTER BAR, and every surface differs only in
// which filters it starts with and how big it renders:
//
//   • player panel  — "What's happened" modal, starts scoped to that player
//   • shared screen — the Log panel, starts on everyone
//   • TV            — persistent column beside the board, filters always visible
//   • end of game   — PostGameLogViewer, same feed under its export controls
//
// The block shape came from PlayerChronicleV2 (v3.0.86+) and is kept exactly:
// blocks are cut at turn_start boundaries, NOT on space-name changes — "Turn N
// ended" is logged AFTER movement so it carries the DESTINATION space, and
// space-grouping dragged it under the next space's header (fb:1eff7156).
// Each turn_start renders as a divider ("Turn N · 📍 space") instead of a row.
//
// Data + wording are the canonical ones (getDisplayableLogEntries,
// formatActionDescription) so no surface can drift from another.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { ActionLogEntry } from '../../types/StateTypes';
import { formatActionDescription, getLogTypeLabel } from '../../utils/actionLogFormatting';
import { getDisplayableLogEntries, LogDisplayFilters } from '../../utils/logFiltering';
import { panelPalettes, PanelMode } from '../player/panelTheme';
import { shortName } from '../../utils/boardCommon';
import { LogRowDetail } from './LogRowDetail';

/** User-facing filter selection — the part of LogDisplayFilters a viewer can
 *  change from the on-screen chips. The surface's own hard scope (`playerId`)
 *  is passed separately and is not a chip. */
export interface HistoryFeedFilters {
  who: string | 'all';
  what: ActionLogEntry['type'] | 'all';
}

export const DEFAULT_HISTORY_FILTERS: HistoryFeedFilters = { who: 'all', what: 'all' };

export interface HistoryFeedProps {
  gameServices: IServiceContainer;
  /** Hard scope — the surface's frame of reference (the player panel is that
   *  player's history). Not user-changeable; the chips filter within it. */
  playerId?: string;
  mode?: PanelMode;
  /** Show the on-screen filter chips. On by default — the maintainer's rule is
   *  that people choose what they see. Turn off only where an outer screen
   *  already provides the same controls (PostGameLogViewer's dropdowns). */
  showFilters?: boolean;
  /** Controlled filter state. Omit to let the feed own it internally. */
  filters?: HistoryFeedFilters;
  onFiltersChange?: (next: HistoryFeedFilters) => void;
  /** The filters this surface OPENS with (the player panel opens on "just
   *  me"). Used only to word the empty state honestly: still on the opening
   *  filters and empty means nothing has happened yet; narrowed past them and
   *  empty means the viewer filtered it away. */
  defaultFilters?: HistoryFeedFilters;
  /** Extra filtering the surface applies on top of the chips (e.g. the
   *  end-of-game viewer's search box). */
  extraFilters?: Pick<LogDisplayFilters, 'search'>;
  /** Type scale. 1 = panel/phone. The TV passes ~1.6 for 10ft legibility. */
  scale?: number;
  /** Cap the scroll area. Omit to fill the parent (the TV column). */
  maxHeight?: number | string;
  /** Newest at the bottom (chronological, matching every existing viewer) and
   *  keep it scrolled there as events land. */
  autoScroll?: boolean;
  /** Click-entry-to-replay-highlight — called with the block's raw space id
   *  (the CSV space_name / React Flow node id, NOT the shortName() label).
   *  Rows render as plain, non-interactive text when omitted (the phone view
   *  has no board on the same screen to pan). */
  onNavigateToSpace?: (spaceId: string) => void;
  /** Copy shown when nothing matches / nothing has happened yet. */
  emptyText?: string;
  /** Per-row "🔍" expand showing the raw engine detail behind an entry — card
   *  IDs, raw space IDs, the producer's untouched description (fb:91738221).
   *  On for the shared-screen Log and the end-of-game viewer, off for the
   *  phone panel and the TV, where nobody is debugging. Mutually exclusive
   *  with onNavigateToSpace on a given row: a row can't both jump the board
   *  and open its own detail, so navigation wins where both are set. */
  showRowDetail?: boolean;
  testId?: string;
}

interface TurnBlock {
  /** Global turn number from the turn_start entry; null for the pre-game block. */
  turnNumber: number | null;
  spaceName: string;
  /** Raw space id (CSV space_name) the whole block happened at, or null if no
   *  entry in this block carried one. Individual entries don't carry their own
   *  space id — only the block's turn_start does. */
  spaceId: string | null;
  entries: ActionLogEntry[];
}

/** Group entries into turn blocks. Presentation only — see the header note. */
export function buildTurnBlocks(entries: ActionLogEntry[]): TurnBlock[] {
  const groups: TurnBlock[] = [];
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  for (const entry of sorted) {
    if (entry.type === 'turn_start') {
      const raw = entry.details?.spaceName || entry.details?.space || '';
      groups.push({
        turnNumber: entry.globalTurnNumber ?? null,
        spaceName: raw ? shortName(raw) : 'Setup',
        spaceId: raw || null,
        entries: [],
      });
      continue;
    }
    let last = groups[groups.length - 1];
    if (!last) {
      // Entries before the first turn_start (game setup) get their own block.
      const raw = entry.details?.spaceName || entry.details?.space || '';
      last = { turnNumber: null, spaceName: raw ? shortName(raw) : 'Setup', spaceId: raw || null, entries: [] };
      groups.push(last);
    }
    last.entries.push(entry);
  }
  // A divider with nothing under it is a turn the current filter emptied out —
  // turn_start survives filtering so blocks stay anchored, but an empty block
  // is noise, not history.
  return groups.filter(g => g.entries.length > 0);
}

const fmtTime = (t: Date | string): string => {
  const d = t instanceof Date ? t : new Date(t);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const HistoryFeed: React.FC<HistoryFeedProps> = ({
  gameServices,
  playerId,
  mode = 'light',
  showFilters = true,
  filters,
  onFiltersChange,
  defaultFilters = DEFAULT_HISTORY_FILTERS,
  extraFilters,
  scale = 1,
  maxHeight,
  autoScroll = false,
  onNavigateToSpace,
  emptyText = 'Nothing yet — moves and changes will show up here as the game is played.',
  showRowDetail = false,
  testId = 'history-feed',
}) => {
  const p = panelPalettes[mode];
  const [internalFilters, setInternalFilters] = useState<HistoryFeedFilters>(() => defaultFilters);
  const active = filters ?? internalFilters;
  const setActive = (next: HistoryFeedFilters) => {
    if (onFiltersChange) onFiltersChange(next);
    if (!filters) setInternalFilters(next);
  };

  // Live log. Subscribed rather than read once so the TV column updates as the
  // game is played, without its own polling.
  const [log, setLog] = useState<ActionLogEntry[]>([]);
  useEffect(() => {
    const read = () => setLog(gameServices.stateService.getGameState().globalActionLog || []);
    read();
    return gameServices.stateService.subscribe(read);
  }, [gameServices.stateService]);

  // Everything that passes the canonical rule + this surface's hard scope,
  // BEFORE the chips — this is what the chips get their options from, so the
  // "who" list doesn't shrink to one name the moment you pick a name.
  const scoped = useMemo(
    () => getDisplayableLogEntries(log, { playerId }),
    [log, playerId],
  );

  const shown = useMemo(() => {
    return getDisplayableLogEntries(log, {
      playerId,
      filterPlayerId: active.who,
      filterType: active.what,
      search: extraFilters?.search,
      keepTurnDividers: true,
    });
  }, [log, playerId, active.who, active.what, extraFilters?.search]);

  const blocks = useMemo(() => buildTurnBlocks(shown), [shown]);

  const whoOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of scoped) {
      if (e.type === 'turn_start') continue;
      if (e.playerId && e.playerName && e.playerId !== 'system') m.set(e.playerId, e.playerName);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [scoped]);

  const whatOptions = useMemo(() => {
    const s = new Set<ActionLogEntry['type']>();
    for (const e of scoped) {
      if (e.type === 'turn_start') continue;
      s.add(e.type);
    }
    return [...s].sort((a, b) => getLogTypeLabel(a).localeCompare(getLogTypeLabel(b)));
  }, [scoped]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [autoScroll, blocks.length, shown.length]);

  const canNavigate = !!onNavigateToSpace;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const rowDetailAvailable = showRowDetail && !canNavigate;
  const jumpToSpace = (spaceId: string | null) => {
    if (!spaceId || !onNavigateToSpace) return;
    onNavigateToSpace(spaceId);
  };
  const rowKeyDown = (e: React.KeyboardEvent, spaceId: string | null) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      jumpToSpace(spaceId);
    }
  };

  const px = (n: number) => Math.round(n * scale);

  const chip = (label: string, selected: boolean, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        fontSize: px(11),
        lineHeight: 1.2,
        fontWeight: selected ? 700 : 500,
        padding: `${px(5)}px ${px(9)}px`,
        borderRadius: px(999),
        border: `1px solid ${selected ? p.accent : p.border}`,
        background: selected ? p.accent : p.surf,
        color: selected ? '#ffffff' : p.text,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      data-testid={testId}
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: p.text,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: maxHeight === undefined ? '100%' : undefined,
      }}
    >
      {showFilters && (
        <div
          data-testid={`${testId}-filters`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: px(4),
            paddingBottom: px(8),
            marginBottom: px(6),
            borderBottom: `1px solid ${p.border}`,
            flex: '0 0 auto',
          }}
        >
          <div style={{ display: 'flex', gap: px(5), flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: px(10), color: p.muted, fontWeight: 600, minWidth: px(34) }}>Who</span>
            {chip('Everyone', active.who === 'all', () => setActive({ ...active, who: 'all' }), 'who-all')}
            {whoOptions.map(o => chip(o.name, active.who === o.id, () => setActive({ ...active, who: o.id }), `who-${o.id}`))}
          </div>
          <div style={{ display: 'flex', gap: px(5), flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: px(10), color: p.muted, fontWeight: 600, minWidth: px(34) }}>What</span>
            {chip('Everything', active.what === 'all', () => setActive({ ...active, what: 'all' }), 'what-all')}
            {whatOptions.map(t =>
              chip(getLogTypeLabel(t), active.what === t, () => setActive({ ...active, what: t }), `what-${t}`),
            )}
          </div>
        </div>
      )}

      {blocks.length === 0 ? (
        <div style={{ fontSize: px(12), color: p.muted, padding: `${px(8)}px ${px(2)}px` }}>
          {active.who !== defaultFilters.who || active.what !== defaultFilters.what
            ? 'Nothing matches what you picked above.'
            : emptyText}
        </div>
      ) : (
        <div
          ref={scrollRef}
          style={{
            maxHeight,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: px(10),
            flex: '1 1 auto',
            minHeight: 0,
          }}
        >
          {canNavigate && (
            <div style={{ fontSize: px(11), color: p.muted, padding: `0 ${px(2)}px ${px(2)}px` }}>
              Tap a turn to see it on the board.
            </div>
          )}
          {blocks.map((group, gi) => {
            const clickable = canNavigate && !!group.spaceId;
            const headerKey = `h${gi}`;
            return (
              <div key={gi}>
                {/* Turn divider — replaces the "Turn N started" row (fb:1eff7156).
                    Doubles as the click-to-highlight target for the whole block
                    when a space id is available. */}
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => jumpToSpace(group.spaceId) : undefined}
                  onKeyDown={clickable ? (e) => rowKeyDown(e, group.spaceId) : undefined}
                  onMouseEnter={clickable ? () => setHoveredKey(headerKey) : undefined}
                  onMouseLeave={clickable ? () => setHoveredKey(null) : undefined}
                  aria-label={clickable ? `Go to ${group.spaceName} on the board` : undefined}
                  style={{
                    fontSize: px(11),
                    fontWeight: 600,
                    color: p.accent,
                    padding: `${px(4)}px ${px(4)}px`,
                    borderRadius: px(5),
                    borderBottom: `1px solid ${p.border}`,
                    marginBottom: px(4),
                    cursor: clickable ? 'pointer' : undefined,
                    background: clickable && hoveredKey === headerKey ? p.surf : undefined,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: px(6),
                  }}
                >
                  <span>{group.turnNumber != null ? `Turn ${group.turnNumber} · ` : ''}📍 {group.spaceName}</span>
                  {clickable && <span aria-hidden="true" style={{ color: p.muted }}>›</span>}
                </div>
                {group.entries.map((entry, ei) => {
                  const rowKey = `${gi}-${ei}`;
                  const isExpanded = !!expandedRows[rowKey];
                  return (
                    <div key={ei}>
                      <div
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={clickable ? () => jumpToSpace(group.spaceId) : undefined}
                        onKeyDown={clickable ? (e) => rowKeyDown(e, group.spaceId) : undefined}
                        onMouseEnter={clickable ? () => setHoveredKey(rowKey) : undefined}
                        onMouseLeave={clickable ? () => setHoveredKey(null) : undefined}
                        aria-label={clickable ? `${formatActionDescription(entry)} — go to ${group.spaceName} on the board` : undefined}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: px(8),
                          fontSize: px(12.5),
                          lineHeight: 1.45,
                          padding: `${px(5)}px ${px(8)}px`,
                          background: clickable && hoveredKey === rowKey ? p.border : p.surf,
                          borderRadius: px(7),
                          marginBottom: px(4),
                          cursor: clickable ? 'pointer' : undefined,
                        }}
                      >
                        <span style={{ flex: 1 }}>{formatActionDescription(entry)}</span>
                        <span style={{ color: p.muted, fontSize: px(10), whiteSpace: 'nowrap' }}>
                          {fmtTime(entry.timestamp)}
                        </span>
                        {rowDetailAvailable && (
                          <button
                            type="button"
                            onClick={() => setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Hide raw detail' : 'Show raw detail'}
                            title={isExpanded ? 'Hide raw detail' : 'Show raw detail'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: p.muted,
                              cursor: 'pointer',
                              fontSize: px(10),
                              padding: `0 ${px(2)}px`,
                              lineHeight: 1,
                            }}
                          >
                            🔍
                          </button>
                        )}
                      </div>
                      {rowDetailAvailable && isExpanded && <LogRowDetail entry={entry} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
