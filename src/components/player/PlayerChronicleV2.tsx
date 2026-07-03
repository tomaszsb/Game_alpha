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
// Chronicle (inline deltas, click-an-entry-to-replay-its-highlight, a
// TV-persistent feed via NotificationService) is a larger follow-on (TODO P1/P2).

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
}

interface TurnBlock {
  /** Global turn number from the turn_start entry; null for the pre-game block. */
  turnNumber: number | null;
  spaceName: string;
  entries: ActionLogEntry[];
}

export const PlayerChronicleV2: React.FC<PlayerChronicleV2Props> = ({
  isOpen,
  onClose,
  playerId,
  gameServices,
  mode = 'light',
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
        entries: [],
      });
      continue;
    }
    let last = groups[groups.length - 1];
    if (!last) {
      // Entries before the first turn_start (game setup) get their own block.
      const raw = entry.details?.spaceName || entry.details?.space || '';
      last = { turnNumber: null, spaceName: raw ? shortName(raw) : 'Setup', entries: [] };
      groups.push(last);
    }
    last.entries.push(entry);
  }

  const fmtTime = (t: Date | string) => {
    const d = t instanceof Date ? t : new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            {groups.map((group, gi) => (
              <div key={gi}>
                {/* Turn divider — replaces the "Turn N started" row (fb:1eff7156). */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: p.accent,
                    padding: '4px 0',
                    borderBottom: `1px solid ${p.border}`,
                    marginBottom: 4,
                  }}
                >
                  {group.turnNumber != null ? `Turn ${group.turnNumber} · ` : ''}📍 {group.spaceName}
                </div>
                {group.entries.map((entry, ei) => (
                  <div
                    key={ei}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      padding: '5px 8px',
                      background: p.surf,
                      borderRadius: 7,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ flex: 1 }}>{formatActionDescription(entry)}</span>
                    <span style={{ color: p.muted, fontSize: 10, whiteSpace: 'nowrap' }}>
                      {fmtTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalBase>
  );
};
