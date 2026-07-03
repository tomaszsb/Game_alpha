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

  // fb:1eff7156 — "Turn ended" used to appear under the NEXT space's header,
  // above "Turn started": turn_end is logged after movement so it carries the
  // destination space, and space-grouping dragged it forward. Blocks are now cut
  // at turn_start boundaries, so the reading is: divider, the turn's actions,
  // then "Turn N ended" last.
  describe('turn ordering + dividers (fb:1eff7156)', () => {
    const base = { playerId: 'player1', playerName: 'Test Player', visibility: 'player', isCommitted: true };
    const turnLog: any[] = [
      { ...base, id: 't5', type: 'turn_start', timestamp: new Date('2026-06-26T10:00:00Z'),
        description: 'Turn 5 started', globalTurnNumber: 5, details: { spaceName: 'OWNER-SCOPE-INITIATION' } },
      { ...base, id: 'a1', type: 'space_effect', timestamp: new Date('2026-06-26T10:01:00Z'),
        description: 'Drew 2 work packages', details: { spaceName: 'OWNER-SCOPE-INITIATION' } },
      // Logged AFTER movement → carries the DESTINATION space (the bug's trigger).
      { ...base, id: 'e5', type: 'turn_end', timestamp: new Date('2026-06-26T10:02:00Z'),
        description: 'Turn 5 ended', globalTurnNumber: 5, details: { space: 'OWNER-FUND-INITIATION' } },
      { ...base, id: 't6', type: 'turn_start', timestamp: new Date('2026-06-26T10:03:00Z'),
        description: 'Turn 6 started', globalTurnNumber: 6, details: { spaceName: 'OWNER-FUND-INITIATION' } },
      { ...base, id: 'a2', type: 'resource_change', timestamp: new Date('2026-06-26T10:04:00Z'),
        description: 'Raised $500,000', details: { spaceName: 'OWNER-FUND-INITIATION' } },
    ];

    it('renders "Turn N ended" AFTER the turn\'s last action and BEFORE the next turn\'s divider', () => {
      const { container } = renderChronicle(turnLog);
      const text = container.textContent || '';
      const action = text.indexOf('Drew 2 work packages');
      const ended = text.indexOf('Turn 5 ended');
      const nextDivider = text.indexOf('Turn 6 ·');
      expect(action).toBeGreaterThan(-1);
      expect(ended).toBeGreaterThan(action);
      expect(nextDivider).toBeGreaterThan(ended);
    });

    it('replaces the "Turn N started" row with a turn divider (Turn N · 📍 space)', () => {
      renderChronicle(turnLog);
      expect(screen.getByText(/Turn 5 ·/)).toBeInTheDocument();
      expect(screen.getByText(/Turn 6 ·/)).toBeInTheDocument();
      expect(screen.queryByText(/Turn 5 started/)).not.toBeInTheDocument();
    });

    it('keeps pre-turn (setup) entries in their own leading block', () => {
      const setupEntry = { ...committedEntry, id: 's0', type: 'game_start',
        timestamp: new Date('2026-06-26T09:59:00Z'), description: 'Game started', details: {} };
      const { container } = renderChronicle([setupEntry, ...turnLog]);
      const text = container.textContent || '';
      expect(text.indexOf('Game started')).toBeLessThan(text.indexOf('Turn 5 ·'));
    });
  });
});
