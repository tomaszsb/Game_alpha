// Regression test for the DataEditor admin-auth gate.
//
// The bug (DEF-3, 2026-06-10 deficiency audit; fixed v3.1.65): the gate's
// early return used to live at the top of the big editor component. That
// component ran one useState, and when unauthenticated returned before its
// other 27 hooks. So React recorded 1 hook on a fresh unauthenticated mount —
// and the moment the admin logged in, setIsAuthed re-rendered the SAME
// component, which now ran all 28. React throws "Rendered more hooks than
// during the previous render" on exactly that transition.
//
// It went unnoticed for months because the only DataEditor test
// (DataEditor.test.tsx) mocks isAdminAuthenticated to `true`, so it always
// mounted straight into the authenticated branch and never crossed the
// unauthenticated -> authenticated boundary where the crash lives. This file
// exists specifically to cross that boundary.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataEditor } from '../../../src/components/editor/DataEditor';
import { GameContext } from '../../../src/context/GameContext';

// Unauthenticated on mount — the opposite of DataEditor.test.tsx — so the gate
// actually renders and we exercise the login transition.
vi.mock('../../../src/utils/adminAuth', () => ({
  isAdminAuthenticated: () => false,
  verifyAdminPassword: vi.fn().mockResolvedValue(true),
  clearAdminAuth: vi.fn()
}));

const mockDataService = {
  getAllSpaces: vi.fn(() => []),
  loadData: vi.fn(),
  isLoaded: vi.fn(() => true),
};

const mockGameContext = {
  dataService: mockDataService,
  stateManager: {} as any,
  turnService: {} as any,
  cardService: {} as any,
  movementService: {} as any,
  effectEngine: {} as any,
  negotiationService: {} as any,
  loggingService: {} as any,
  gameState: null,
  setGameState: vi.fn(),
} as any;

function renderEditor() {
  return render(
    <GameContext.Provider value={mockGameContext}>
      <DataEditor onClose={vi.fn()} />
    </GameContext.Provider>
  );
}

describe('DataEditor admin auth gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The editor's data load fetches CSVs; keep it quiet and deterministic.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    }) as any;
  });

  it('shows the auth gate when the admin is not authenticated', () => {
    renderEditor();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
    expect(screen.getByText('Unlock')).toBeTruthy();
  });

  it('survives the unauthenticated -> authenticated transition without a hook-count crash', async () => {
    // Any React hook-order violation surfaces as a console.error from React
    // plus a thrown render error. Capture console.error so we can assert on
    // the specific message rather than only on "it didn't throw".
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderEditor();

    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'correct-horse-battery-staple' }
    });
    fireEvent.click(screen.getByText('Unlock'));

    // Authenticating must swap the gate out for the editor. Before the fix
    // this re-render threw instead.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Password')).toBeNull();
    });

    const hookOrderComplaints = consoleError.mock.calls
      .map(args => String(args[0] ?? ''))
      .filter(msg => /Rendered more hooks|Rendered fewer hooks|change in the order of Hooks/i.test(msg));

    expect(hookOrderComplaints).toEqual([]);

    consoleError.mockRestore();
  });
});
