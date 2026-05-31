import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LogRowDetail } from '../../../src/components/game/LogRowDetail';
import { GameContext } from '../../../src/context/GameContext';
import { ActionLogEntry } from '../../../src/types/StateTypes';
import { IServiceContainer } from '../../../src/types/ServiceContracts';

function wrap(entry: ActionLogEntry, cardLookup: Record<string, string> = {}) {
  const services = {
    dataService: {
      getCardById: (id: string) =>
        cardLookup[id] ? ({ card_id: id, card_name: cardLookup[id] } as any) : undefined,
    },
  } as unknown as IServiceContainer;

  return render(
    <GameContext.Provider value={services}>
      <LogRowDetail entry={entry} />
    </GameContext.Provider>,
  );
}

function makeEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    id: 'entry-1',
    type: 'card_draw',
    timestamp: new Date('2026-05-31T14:23:07.823Z'),
    playerId: 'player1',
    playerName: 'Player 1',
    description: 'Drew 2 Work Packages: W006, W009',
    details: {
      cards: ['W006', 'W009'],
      cardType: 'W',
      count: 2,
      action: 'card_draw',
    },
    isCommitted: true,
    explorationSessionId: 'sess-1',
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnNumber: 3,
    playerTurnNumber: 2,
    visibility: 'player',
    ...overrides,
  };
}

describe('LogRowDetail', () => {
  afterEach(() => cleanup());

  it('renders the raw description', () => {
    wrap(makeEntry());
    expect(screen.getByText('Drew 2 Work Packages: W006, W009')).toBeTruthy();
  });

  it('renders raw card IDs', () => {
    wrap(makeEntry());
    expect(screen.getByText('W006, W009')).toBeTruthy();
  });

  it('renders untruncated card titles when dataService has them', () => {
    wrap(makeEntry(), {
      W006: 'Adaptive reuse of abandoned warehouse into mixed-use development',
      W009: 'Conversion of strip mall into senior living community',
    });
    expect(
      screen.getByText(
        'Adaptive reuse of abandoned warehouse into mixed-use development, Conversion of strip mall into senior living community',
      ),
    ).toBeTruthy();
  });

  it('falls back to raw IDs when card titles are unavailable', () => {
    wrap(makeEntry());
    expect(screen.getByText('W006, W009')).toBeTruthy();
  });

  it('renders Space ID when details.spaceName is set', () => {
    wrap(
      makeEntry({
        type: 'space_effect',
        description: 'Player 1 entered Scope Initiation (first visit)',
        details: { spaceName: 'OWNER-SCOPE-INITIATION', action: 'space_effect' },
      }),
    );
    expect(screen.getByText('OWNER-SCOPE-INITIATION')).toBeTruthy();
  });

  it('renders From → To for movement entries', () => {
    wrap(
      makeEntry({
        type: 'player_movement',
        description: 'Moved from Scope Initiation to Fund Initiation',
        details: {
          sourceSpace: 'OWNER-SCOPE-INITIATION',
          destinationSpace: 'OWNER-FUND-INITIATION',
          action: 'player_movement',
        },
      }),
    );
    expect(
      screen.getByText('OWNER-SCOPE-INITIATION → OWNER-FUND-INITIATION'),
    ).toBeTruthy();
  });

  it('renders the entry type as a discriminant row', () => {
    wrap(makeEntry({ type: 'dice_roll' }));
    expect(screen.getByText('dice_roll')).toBeTruthy();
  });

  it('renders turn context with round, global turn, and player turn', () => {
    wrap(makeEntry());
    expect(
      screen.getByText("round 1 · turn 3 · Player 1's turn 2"),
    ).toBeTruthy();
  });
});
