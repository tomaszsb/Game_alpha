// PlayerChronicleV2 — the new panel's "what's happened" history (Pile 3 /
// change-legibility; the Project Chronicle, first slice). An openable timeline of
// this player's committed actions so they can look back at what changed and when
// — the recall counterpart to PlayerNumbersV2's current-state snapshot.
//
// It REUSES the canonical log data + formatting the classic Log tab uses
// (getDisplayableLogEntries for the player-filtered, displayable entries;
// formatActionDescription for the wording) so the two can't drift. Grouping is
// presentation only: blocks are cut at turn_start boundaries (like the classic
// GameLog), NOT on space-name changes — "Turn N ended" is logged AFTER movement
// so it carries the DESTINATION space, and space-grouping dragged it under the
// next space's header, above the next "Turn started" (fb:1eff7156). Cutting at
// turn_start keeps it where it belongs: after the turn's last action. Each
// turn_start renders as a divider ("Turn N · 📍 space") instead of a text row.
// Reuses the proven ModalBase shell (body + shell follow the panel's light/dark
// mode — modals MAY scroll; the no-scroll rule is about the main panel, not its
// drill-downs).
//
// First slice deliberately: this is the readable history. The fuller Project
// Chronicle (inline deltas, a TV-persistent feed via NotificationService) is
// a larger follow-on (TODO P1/P2) — click-entry-to-replay-highlight (below)
// shipped as the first piece of that.

import React, { useEffect, useState } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { ActionLogEntry } from '../../types/StateTypes';
import { formatActionDescription } from '../../utils/actionLogFormatting';
import { getDisplayableLogEntries } from '../../utils/logFiltering';
import { ModalBase } from '../modals/shared/ModalBase';
import { panelPalettes, PanelMode } from './panelTheme';
import { shortName } from '../../utils/boardCommon';

export interface PlayerChronicleV2Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  gameServices: IServiceContainer;
  /** The panel's light/dark mode — body and ModalBase shell follow it. */
  mode?: PanelMode;
  /** Click-entry-to-replay-highlight (TODO P1 change-legibility) — called
   *  with the block's raw space id (the CSV space_name / React Flow node
   *  id, NOT the shortName()-displayed label) when the player clicks a log
   *  entry or its turn-block header. Rows render as plain, non-interactive
   *  text when omitted (e.g. the phone/controller view, which has no board
   *  on the same screen to pan). */
  onNavigateToSpace?: (spaceId: string) => void;
}

interface TurnBlock {
  /** Global turn number from the turn_start entry; null for the pre-game block. */
  turnNumber: number | null;
  spaceName: string;
  /** Raw space id (CSV space_name) the whole block happened at, or null if
   *  no entry in this block carried one (shouldn't happen in practice, but
   *  keeps the click handler honest rather than guessing). Every entry in
   *  the block is attributed to this one space — individual entries don't
   *  carry their own space id, only the block's turn_start does. */
  spaceId: string | null;
  entries: ActionLogEntry[];
}

export const PlayerChronicleV2: React.FC<PlayerChronicleV2Props> = ({
  isOpen,
  onClose,
  playerId,
  gameServices,
  mode = 'light',
  onNavigateToSpace,
}) => {
  const p = panelPalettes[mode];
  const [entries, setEntries] = useState<ActionLogEntry[]>([]);

  useEffect(() => {
    const read = () => {
      const gs = gameServices.stateService.getGameState();
      setEntries(getDisplayableLogEntries(gs.globalActionLog || [], { playerId }));
    };
    read();
    const unsubscribe = gameServices.stateService.subscribe(read);
    return unsubscribe;
  }, [gameServices.stateService, playerId]);

  // Cut blocks at turn_start boundaries (presentation only). Chronological,
  // oldest first — newest at the bottom, matching the classic Log tab's reading.
  // The turn_start itself becomes the block's divider (not a row), so within a
  // block the reading is: the turn's actions, then "Turn N ended" last — exactly
  // the order the turn happened in (fb:1eff7156).
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

  const fmtTime = (t: Date | string) => {
    const d = t instanceof Date ? t : new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Click-entry-to-replay-highlight (TODO P1 change-legibility). A block's
  // header AND every row in it jump to the same space — the whole block
  // happened at one space, individual entries don't carry their own.
  // Non-interactive (no cursor/hover, no click) when the parent didn't wire
  // a board to pan (phone/controller view) or a block genuinely has no
  // space id (shouldn't happen, but don't pretend it's clickable if so).
  const canNavigate = !!onNavigateToSpace;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const jumpToSpace = (spaceId: string | null) => {
    if (!spaceId || !onNavigateToSpace) return;
    onNavigateToSpace(spaceId);
    onClose();
  };
  const rowKeyDown = (e: React.KeyboardEvent, spaceId: string | null) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      jumpToSpace(spaceId);
    }
  };

  const footer = (
    <button
      onClick={onClose}
      aria-label="Close"
      style={{
        border: `1px solid ${p.borderStrong}`,
        background: p.surf,
        color: p.text,
        borderRadius: 9,
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      Got it
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="What's happened"
      emoji="📜"
      maxWidth="420px"
      footer={footer}
      testId="player-chronicle-v2"
      mode={mode}
    >
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: p.text }}>
        {groups.length === 0 ? (
          <div style={{ fontSize: 12, color: p.muted, padding: '8px 2px' }}>
            Nothing yet — your moves and changes will show up here as you play.
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {canNavigate && (
              <div style={{ fontSize: 11, color: p.muted, padding: '0 2px 2px' }}>
                Tap a turn to see it on the board.
              </div>
            )}
            {groups.map((group, gi) => {
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
                      fontSize: 11,
                      fontWeight: 600,
                      color: p.accent,
                      padding: '4px 4px',
                      borderRadius: 5,
                      borderBottom: `1px solid ${p.border}`,
                      marginBottom: 4,
                      cursor: clickable ? 'pointer' : undefined,
                      background: clickable && hoveredKey === headerKey ? p.surf : undefined,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{group.turnNumber != null ? `Turn ${group.turnNumber} · ` : ''}📍 {group.spaceName}</span>
                    {clickable && <span aria-hidden="true" style={{ color: p.muted }}>›</span>}
                  </div>
                  {group.entries.map((entry, ei) => {
                    const rowKey = `${gi}-${ei}`;
                    return (
                      <div
                        key={ei}
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
                          gap: 8,
                          fontSize: 12.5,
                          lineHeight: 1.45,
                          padding: '5px 8px',
                          background: clickable && hoveredKey === rowKey ? p.border : p.surf,
                          borderRadius: 7,
                          marginBottom: 4,
                          cursor: clickable ? 'pointer' : undefined,
                        }}
                      >
                        <span style={{ flex: 1 }}>{formatActionDescription(entry)}</span>
                        <span style={{ color: p.muted, fontSize: 10, whiteSpace: 'nowrap' }}>
                          {fmtTime(entry.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalBase>
  );
};
