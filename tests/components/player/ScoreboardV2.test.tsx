/**
 * ScoreboardV2.test.tsx
 *
 * The redesigned shared-screen "who" surface (§2). Confirms it renders soft
 * standings from real data — every player on the phase rail + a status row,
 * with the current player marked — using the shared lifecycle helper.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScoreboardV2 } from '../../../src/components/player/ScoreboardV2';
import { createAllMockServices } from '../../mocks/mockServices';

describe('ScoreboardV2 — the "who" screen', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const phaseOf: Record<string, string> = {
    'FUND-A': 'FUNDING',
    'DESIGN-A': 'DESIGN',
    'REG-A': 'REGULATORY',
  };

  const ana: any = {
    id: 'p1', name: 'Ana', color: '#ef4444', money: 50000, timeSpent: 12,
    currentSpace: 'DESIGN-A', visitedSpaces: ['FUND-A', 'DESIGN-A'],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none',
  };
  const ben: any = {
    id: 'p2', name: 'Ben', color: '#3b82f6', money: 80000, timeSpent: 8,
    currentSpace: 'REG-A', visitedSpaces: ['FUND-A', 'DESIGN-A', 'REG-A'],
    dobApprovalStatus: 'approved', fdnyApprovalStatus: 'none',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.stateService.getAllPlayers.mockReturnValue([ana, ben]);
    services.stateService.getGameState.mockReturnValue({ currentPlayerId: 'p1' } as any);
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getPhaseOrder.mockReturnValue(['FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION']);
    services.dataService.getGameConfigBySpace.mockImplementation((s: string) =>
      phaseOf[s] ? ({ phase: phaseOf[s] } as any) : null,
    );
  });

  afterEach(() => cleanup());

  const renderBoard = () => render(<ScoreboardV2 gameServices={services as any} mode="light" />);

  it('renders every player (on the rail and in a status row)', () => {
    renderBoard();
    expect(screen.getByTestId('scoreboard-v2')).toBeInTheDocument();
    // Each name appears at least once (rail token + status row).
    expect(screen.getAllByText('Ana').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ben').length).toBeGreaterThanOrEqual(1);
  });

  it('marks the current player and shows resource stats', () => {
    renderBoard();
    expect(screen.getByText(/their turn/)).toBeInTheDocument();
    expect(screen.getAllByText(/50,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/80,000/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing when there are no players', () => {
    services.stateService.getAllPlayers.mockReturnValue([]);
    const { container } = renderBoard();
    expect(container).toBeEmptyDOMElement();
  });
});
