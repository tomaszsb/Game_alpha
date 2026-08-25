// tests/components/game/HistoryFeed.test.tsx
//
// HistoryFeed is the one "what's happened" feed every surface renders
// (maintainer decision 2026-08-25: "all the feeds should look the same, they
// should just be filtered differently — and because it's on a TV, put the
// filters on screen and let people decide what to see").
//
// What this pins is that promise: the chips are on screen, picking one
// actually narrows the feed, the turn dividers survive the narrowing, and the
// empty state distinguishes "nothing has happened" from "you filtered it away".

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { HistoryFeed } from '../../../src/components/game/HistoryFeed';
import { ActionLogEntry } from '../../../src/types/StateTypes';
import { IServiceContainer } from '../../../src/types/ServiceContracts';

function makeEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    id: 'e1',
    type: 'space_effect',
    timestamp: new Date('2026-08-25T14:00:00Z'),
    playerId: 'p1',
    playerName: 'Alice',
    description: 'Paid the filing fee',
    details: { spaceName: 'OWNER-SCOPE-INITIATION' },
    isCommitted: true,
    explorationSessionId: 's1',
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnNumber: 1,
    playerTurnNumber: 1,
    visibility: 'player',
    ...overrides,
  };
}

const turnStart = makeEntry({
  id: 'turn1',
  type: 'turn_start',
  description: 'Alice started their turn',
  timestamp: new Date('2026-08-25T13:59:00Z'),
});

function renderFeed(entries: ActionLogEntry[], props: Record<string, unknown> = {}) {
  const services = {
    stateService: {
      subscribe: () => () => {},
      getGameState: () => ({ globalActionLog: entries }),
      getPlayer: () => undefined,
    },
    dataService: { getCards: () => [], getCardById: () => undefined },
  } as unknown as IServiceContainer;

  return render(<HistoryFeed gameServices={services} {...props} />);
}

describe('HistoryFeed — the filters are on screen', () => {
  afterEach(() => cleanup());

  it('shows a Who chip per player and a What chip per kind of event', () => {
    renderFeed([
      turnStart,
      makeEntry({ id: 'a', playerId: 'p1', playerName: 'Alice' }),
      makeEntry({ id: 'b', playerId: 'p2', playerName: 'Bob', type: 'resource_change' }),
    ]);
    expect(screen.getByRole('button', { name: 'Everyone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Everything' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Space effect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resource change' })).toBeInTheDocument();
  });

  it('hides the chips when a surface asks it to', () => {
    renderFeed([turnStart, makeEntry()], { showFilters: false });
    expect(screen.queryByTestId('history-feed-filters')).not.toBeInTheDocument();
  });

  it('picking a Who chip narrows the feed to that player', () => {
    renderFeed([
      turnStart,
      makeEntry({ id: 'a', playerId: 'p1', playerName: 'Alice', description: 'Alice paid a fee' }),
      makeEntry({ id: 'b', playerId: 'p2', playerName: 'Bob', description: 'Bob paid a fee' }),
    ]);
    expect(screen.getByText(/Alice paid a fee/)).toBeInTheDocument();
    expect(screen.getByText(/Bob paid a fee/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));

    expect(screen.queryByText(/Alice paid a fee/)).not.toBeInTheDocument();
    expect(screen.getByText(/Bob paid a fee/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bob' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('picking a What chip narrows the feed to that kind of event', () => {
    renderFeed([
      turnStart,
      makeEntry({ id: 'a', type: 'space_effect', description: 'Paid the filing fee' }),
      makeEntry({ id: 'b', type: 'resource_change', description: 'Received a payment' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Resource change' }));
    expect(screen.queryByText(/Paid the filing fee/)).not.toBeInTheDocument();
    expect(screen.getByText(/Received a payment/)).toBeInTheDocument();
  });

  it('keeps the turn divider over a narrowed feed, and drops dividers left empty', () => {
    const laterTurn = makeEntry({
      id: 'turn2',
      type: 'turn_start',
      description: 'Bob started their turn',
      globalTurnNumber: 2,
      timestamp: new Date('2026-08-25T14:05:00Z'),
    });
    renderFeed([
      turnStart,
      makeEntry({ id: 'a', playerId: 'p1', playerName: 'Alice', description: 'Alice paid a fee' }),
      laterTurn,
      makeEntry({
        id: 'b',
        playerId: 'p2',
        playerName: 'Bob',
        description: 'Bob paid a fee',
        timestamp: new Date('2026-08-25T14:06:00Z'),
      }),
    ]);
    expect(screen.getByText(/Turn 1 ·/)).toBeInTheDocument();
    expect(screen.getByText(/Turn 2 ·/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));

    // Turn 1 had only Alice's entry under it — the divider goes with it.
    expect(screen.queryByText(/Turn 1 ·/)).not.toBeInTheDocument();
    expect(screen.getByText(/Turn 2 ·/)).toBeInTheDocument();
  });
});

describe('HistoryFeed — empty state tells the truth', () => {
  afterEach(() => cleanup());

  it('says nothing has happened when the feed is empty on its opening filters', () => {
    renderFeed([], { emptyText: 'Nothing yet — moves will show up here.' });
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('says nothing matches once the viewer narrows past the opening filters', () => {
    renderFeed([
      turnStart,
      makeEntry({ id: 'a', playerId: 'p1', playerName: 'Alice', type: 'space_effect' }),
      makeEntry({ id: 'b', playerId: 'p2', playerName: 'Bob', type: 'resource_change' }),
    ]);
    // Alice never had a resource change — this combination is genuinely empty.
    fireEvent.click(screen.getByRole('button', { name: 'Alice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resource change' }));
    expect(screen.getByText(/Nothing matches what you picked/)).toBeInTheDocument();
  });

  it('still says nothing has happened when a surface OPENS filtered and has no history', () => {
    // The player panel opens scoped to its own player. An empty feed there
    // means that player has done nothing yet — not that they filtered it away.
    renderFeed([turnStart, makeEntry({ id: 'b', playerId: 'p2', playerName: 'Bob' })], {
      filters: { who: 'p1', what: 'all' },
      defaultFilters: { who: 'p1', what: 'all' },
      emptyText: 'Nothing yet — your moves will show up here.',
    });
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });
});

describe('HistoryFeed — raw detail is opt-in', () => {
  afterEach(() => cleanup());

  it('offers the per-row raw detail toggle only when asked (fb:91738221)', () => {
    const { unmount } = renderFeed([turnStart, makeEntry()]);
    expect(screen.queryByRole('button', { name: 'Show raw detail' })).not.toBeInTheDocument();
    unmount();

    renderFeed([turnStart, makeEntry()], { showRowDetail: true });
    expect(screen.getByRole('button', { name: 'Show raw detail' })).toBeInTheDocument();
  });
});
