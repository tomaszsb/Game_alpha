/* @vitest-pool forks */
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

vi.mock('../../../src/utils/adminAuth', () => ({ getAdminPassword: () => 'x' }));

import { AdminGameManager } from '../../../src/components/setup/AdminGameManager';

// fb:bf9dd267 (Tom, 10-13): the games list should say whether a game is a home game or an off-network one, with its players.
describe('Active games list: home / off-network', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        games: [
          { gameId: 'G-A', playerCount: 2, playerNames: ['Ann', 'Bo'], gamePhase: 'PLAY', origin: 'home' },
          { gameId: 'G-B', playerCount: 1, playerNames: ['Cy'], gamePhase: 'PLAY', origin: 'foreign' },
          { gameId: 'G-C', playerCount: 1, playerNames: ['Di'], gamePhase: 'SETUP', origin: 'unknown' },
        ],
      }),
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('marks a home game and an off-network game, and shows the player count and names', async () => {
    render(<AdminGameManager />);
    await waitFor(() => expect(screen.getByText('G-A')).toBeInTheDocument());
    expect(screen.getAllByTestId('game-origin-home')).toHaveLength(1);
    expect(screen.getAllByTestId('game-origin-foreign')).toHaveLength(1);
    expect(screen.getByText(/2p: Ann, Bo/)).toBeInTheDocument();
  });
});
