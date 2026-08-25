// GameLog — the shared-screen "Log" panel.
//
// 2026-08-25 (maintainer decision, answering the TV-history-feed question):
// "all the feeds should look the same, they should just be filtered
// differently." So this panel no longer carries its own presentation. It is
// the shell — the bordered box and its entry count — around the one shared
// <HistoryFeed/>, opened on everyone and everything, with the same on-screen
// Who/What chips every other surface shows.
//
// What this replaced: a second, space-grouped, two-level collapsible tree
// (space → player turn → rows) that read nothing like the player panel's
// history for the same events. Its one capability the block feed lacked —
// per-row raw engine detail (card IDs, raw space IDs; fb:91738221 v3.0.45) —
// moved into HistoryFeed as `showRowDetail`, so nothing was lost with it.

import React from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { getDisplayableLogEntries } from '../../utils/logFiltering';
import { useSyncedGameState } from '../../hooks/useSyncedGameState';
import { HistoryFeed } from './HistoryFeed';

export function GameLog(): JSX.Element {
  const gameServices = useGameContext();
  const { stateService } = gameServices;
  // Phase 1.2 audit (2026-06-04): canonical filter is isCommitted && visibility==='player',
  // shared with the player panel + PostGameLogViewer. Mid-turn provisional entries are
  // hidden until they commit at end-of-turn (or vanish entirely on Try Again).
  // Read here only for the header count — HistoryFeed does its own reading.
  // `turn_start` is excluded because the feed renders it as a turn divider,
  // not as an entry: counting it would claim entries the reader can't see.
  const gameState = useSyncedGameState(stateService);
  const total = getDisplayableLogEntries(gameState.globalActionLog || [])
    .filter(e => e.type !== 'turn_start').length;

  return (
    <div style={{
      height: '300px',
      backgroundColor: colors.secondary.bg,
      border: `1px solid ${colors.secondary.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: colors.secondary.light,
        borderBottom: `1px solid ${colors.secondary.border}`,
        fontWeight: 'bold',
        fontSize: '14px',
        color: colors.text.secondary
      }}>
        🗒️ Game Log ({total} {total === 1 ? 'entry' : 'entries'})
      </div>

      {/* The shared feed */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '8px' }}>
        <HistoryFeed
          gameServices={gameServices}
          autoScroll
          showRowDetail
          emptyText="No actions yet. Start playing to see the game log!"
          testId="game-log-feed"
        />
      </div>
    </div>
  );
}
