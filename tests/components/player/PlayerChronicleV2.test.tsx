/**
 * PlayerChronicleV2.test.tsx
 *
 * The new panel's "what's happened" history (Pile 3 Chronicle, first slice).
 * Confirms it reuses the canonical log pipeline — getDisplayableLogEntries
 * (which only surfaces committed, player-visible entries, so discardable TEMP
 * "pencil marks" never show) + formatActionDescription — and groups by space.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerChronicleV2 } from '../../../src/components/player/PlayerChronicleV2';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';

describe('PlayerChronicleV2 — history timeline', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const committedEntry: any = {
    id: '1', type: 'space_effect', timestamp: new Date('2026-06-26T10:00:00Z'),
    playerId: 'player1', playerName: 'Test Player', visibility: 'player', isCommitted: true,
    description: 'Drew 2 work packages', details: { spaceName: 'OWNER-SCOPE-INITIATION' },
  };

  const renderChronicle = (log: any[]) => {
    services.stateService.getGameState.mockReturnValue({ globalActionLog: log } as any);
    return render(
      <DictionaryProvider>
        <PlayerChronicleV2 isOpen onClose={vi.fn()} playerId="player1" gameServices={services as any} mode="light" />
      </DictionaryProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.stateService.subscribe.mockReturnValue(() => {});
  });

  afterEach(() => cleanup());

  it('shows the empty state when there is no history', () => {
    renderChronicle([]);
    expect(screen.getByText(/Nothing yet/i)).toBeInTheDocument();
  });

  it('renders a committed player entry grouped under its space', () => {
    renderChronicle([committedEntry]);
    expect(screen.queryByText(/Nothing yet/i)).not.toBeInTheDocument();
    // A space-group header renders (📍 …).
    expect(screen.getByText(/📍/)).toBeInTheDocument();
  });

  it('hides uncommitted entries — REAL/TEMP-safe via the shared filter', () => {
    renderChronicle([{ ...committedEntry, isCommitted: false }]);
    expect(screen.getByText(/Nothing yet/i)).toBeInTheDocument();
  });

  it('hides another player\'s entries', () => {
    renderChronicle([{ ...committedEntry, playerId: 'player2' }]);
    expect(screen.getByText(/Nothing yet/i)).toBeInTheDocument();
  });
});
