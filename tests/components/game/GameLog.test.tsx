// tests/components/game/GameLog.test.tsx
//
// GameLog is now the shell around the shared <HistoryFeed/> (2026-08-25
// maintainer decision: every history surface shows the same feed and differs
// only by filter). What this file pins:
//
//  1. The header's singular/plural grammar — the original regression here was
//     a hardcoded plural rendering "1 entries" (playtest finding, TODO.md).
//     The per-space "N visits" badge it also covered is gone with the
//     space-grouped tree the feed replaced.
//  2. The count excludes turn dividers, which the feed draws as headers rather
//     than as entries — so the number matches what a reader can actually count
//     on screen.
//  3. The panel renders the shared feed, with its filter chips visible.

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
    dataService: {
      getCards: () => [],
      getCardById: () => undefined,
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

function makeActionEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    ...makeTurnStartEntry(),
    id: 'action-1',
    type: 'space_effect',
    description: 'Paid the filing fee',
    ...overrides,
  };
}

describe('GameLog — header grammar and count', () => {
  afterEach(() => cleanup());

  it('shows "1 entry" (singular) with exactly one countable entry', () => {
    wrap([makeTurnStartEntry(), makeActionEntry()]);
    expect(screen.getByText('🗒️ Game Log (1 entry)')).toBeInTheDocument();
    expect(screen.queryByText(/1 entries/)).not.toBeInTheDocument();
  });

  it('shows "2 entries" (plural) with two countable entries', () => {
    wrap([
      makeTurnStartEntry(),
      makeActionEntry({ id: 'a1' }),
      makeActionEntry({ id: 'a2', description: 'Filed the application' }),
    ]);
    expect(screen.getByText('🗒️ Game Log (2 entries)')).toBeInTheDocument();
  });

  it('does not count turn dividers, which the feed draws as headers not rows', () => {
    wrap([makeTurnStartEntry()]);
    expect(screen.getByText('🗒️ Game Log (0 entries)')).toBeInTheDocument();
  });
});

describe('GameLog — renders the shared feed', () => {
  afterEach(() => cleanup());

  it('renders HistoryFeed with its filter chips on screen', () => {
    wrap([makeTurnStartEntry(), makeActionEntry()]);
    expect(screen.getByTestId('game-log-feed')).toBeInTheDocument();
    expect(screen.getByTestId('game-log-feed-filters')).toBeInTheDocument();
    // Opens unfiltered — everyone, everything.
    expect(screen.getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Everything' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the entry under its turn divider', () => {
    wrap([makeTurnStartEntry(), makeActionEntry()]);
    expect(screen.getByText(/Turn 1 ·/)).toBeInTheDocument();
    expect(screen.getByText(/Paid the filing fee/)).toBeInTheDocument();
  });
});
