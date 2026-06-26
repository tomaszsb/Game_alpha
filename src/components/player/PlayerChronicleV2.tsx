// PlayerChronicleV2 — the new panel's "what's happened" history (Pile 3 /
// change-legibility; the Project Chronicle, first slice). An openable timeline of
// this player's committed actions so they can look back at what changed and when
// — the recall counterpart to PlayerNumbersV2's current-state snapshot.
//
// It REUSES the canonical log data + formatting the classic Log tab uses
// (getDisplayableLogEntries for the player-filtered, displayable entries;
// formatActionDescription for the wording) so the two can't drift. Grouping by
// space is presentation only. Reuses the proven ModalBase shell (light body,
// like PlayerCardDetailV2 / PlayerNumbersV2 — modals MAY scroll; the no-scroll
// rule is about the main panel, not its drill-downs).
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
  /** Reserved for the panel's light/dark mode; body is light-only for now. */
  mode?: PanelMode;
}

interface SpaceGroup {
  spaceName: string;
  entries: ActionLogEntry[];
}

export const PlayerChronicleV2: React.FC<PlayerChronicleV2Props> = ({
  isOpen,
  onClose,
  playerId,
  gameServices,
}) => {
  const p = panelPalettes.light; // ModalBase body is light-only (mirrors the other drill-downs)
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

  // Group consecutive entries by their space (presentation only). Chronological,
  // oldest first — newest at the bottom, matching the classic Log tab's reading.
  const groups: SpaceGroup[] = [];
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  for (const entry of sorted) {
    const raw = entry.details?.spaceName || entry.details?.space || '';
    const spaceName = raw ? shortName(raw) : 'Setup';
    const last = groups[groups.length - 1];
    if (!last || last.spaceName !== spaceName) {
      groups.push({ spaceName, entries: [entry] });
    } else {
      last.entries.push(entry);
    }
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
                  📍 {group.spaceName}
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
