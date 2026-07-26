// tests/components/game/GameLog.test.tsx
//
// Regression test for grammar bug: the header ("N entries, M visits") and the
// per-space visit-count badge both hardcoded the plural "visits"/"entries",
// so a single entry/visit rendered as "1 entries" / "1 visits" instead of
// "1 entry" / "1 visit" (playtest finding, TODO.md).

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GameLog } from '../../../src/components/game/GameLog';
import { GameContext } from '../../../src/context/GameContext';
import { ActionLogEntry } from '../../../src/types/StateTypes';
import { IServiceContainer } from '../../../src/types/ServiceContracts';

function wrap(entries: ActionLogEntry[]) {
  const services = {
    stateService: {
      subscribe: () => () => {},
      getGameState: () => ({ globalActionLog: entries }),
      getPlayer: () => undefined,
    },
  } as unknown as IServiceContainer;

  return render(
    <GameContext.Provider value={services}>
      <GameLog />
    </GameContext.Provider>,
  );
}

function makeTurnStartEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    id: 'entry-1',
    type: 'turn_start',
    timestamp: new Date('2026-07-24T14:23:07.823Z'),
    playerId: 'player1',
    playerName: 'Alice',
    description: 'Alice started their turn',
    details: {
      spaceName: 'OWNER-SCOPE-INITIATION',
      visitType: 'First',
    },
    isCommitted: true,
    explorationSessionId: 'sess-1',
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnNumber: 1,
    playerTurnNumber: 1,
    visibility: 'player',
    ...overrides,
  };
}

describe('GameLog — singular/plural grammar', () => {
  afterEach(() => cleanup());

  it('shows "1 entry, 1 visit" (singular) with exactly one logged turn', () => {
    wrap([makeTurnStartEntry()]);

    expect(screen.getByText('🗒️ Game Log (1 entry, 1 visit)')).toBeInTheDocument();
    expect(screen.getByText('1 visit')).toBeInTheDocument();
    expect(screen.queryByText(/1 entries/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 visits\b/)).not.toBeInTheDocument();
  });

  it('shows "2 entries, 1 visit" (plural entries, singular visit) with two turns at the same space', () => {
    wrap([
      makeTurnStartEntry({ id: 'entry-1', globalTurnNumber: 1, playerTurnNumber: 1 }),
      makeTurnStartEntry({ id: 'entry-2', globalTurnNumber: 2, playerTurnNumber: 2 }),
    ]);

    expect(screen.getByText('🗒️ Game Log (2 entries, 1 visit)')).toBeInTheDocument();
    expect(screen.getByText('2 visits')).toBeInTheDocument();
  });

  it('shows "2 entries, 2 visits" (plural) when the two turns are at different spaces', () => {
    wrap([
      makeTurnStartEntry({
        id: 'entry-1',
        globalTurnNumber: 1,
        playerTurnNumber: 1,
        details: { spaceName: 'OWNER-SCOPE-INITIATION', visitType: 'First' },
      }),
      makeTurnStartEntry({
        id: 'entry-2',
        globalTurnNumber: 2,
        playerTurnNumber: 2,
        details: { spaceName: 'BANK-FUND-REVIEW', visitType: 'First' },
      }),
    ]);

    expect(screen.getByText('🗒️ Game Log (2 entries, 2 visits)')).toBeInTheDocument();
  });
});
