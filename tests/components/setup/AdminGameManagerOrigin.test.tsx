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

describe('AdminGameManager helpers (admin list shows how far each game is)', () => {
  it('placeWords makes a space id readable', async () => {
    const { placeWords } = await import('../../../src/components/setup/AdminGameManager');
    expect(placeWords('ARCH-FEE-REVIEW')).toBe('Arch Fee Review');
    expect(placeWords(undefined)).toBe('');
  });
  it('agoWords says how long ago in plain words', async () => {
    const { agoWords } = await import('../../../src/components/setup/AdminGameManager');
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(agoWords('2026-10-21T11:59:40Z', now)).toBe('just now');
    expect(agoWords('2026-10-21T11:56:00Z', now)).toBe('4 min ago');
    expect(agoWords('2026-10-21T09:00:00Z', now)).toBe('3 h ago');
    expect(agoWords('2026-10-19T12:00:00Z', now)).toBe('2 days ago');
    expect(agoWords(undefined, now)).toBe('');
  });
});
