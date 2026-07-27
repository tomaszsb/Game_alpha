/**
 * GameLayoutPhoneGlossary.test.tsx
 *
 * Regression test for the TV-mode bug report "There seem so way to access
 * glossary words in tv mode" (fb, filed 2026-07-22, v3.1.20).
 *
 * Root cause: GameLayout's `handleToggleGlossary` was only ever passed to
 * ProjectProgress — which renders exclusively on the desktop/PC branch
 * (`!effectiveViewPlayerId`). The per-player phone/controller view (the
 * `effectiveViewPlayerId && gamePhase === 'PLAY'` branch, which renders
 * PlayerPanelWrapper) had no glossary control at all, and TVDisplay — the
 * TV's own screen — deliberately doesn't get one either (no pointer, would
 * cover the shared board).
 *
 * This pins the wiring at the exact spot that broke: a real GameLayout
 * render, in PLAY phase, with `viewPlayerId` set (the phone/controller
 * view), must expose a "Glossary" control, and clicking it must actually
 * open the shared DictionaryPanel via the existing DictionaryContext — not
 * a parallel state. A future edit that drops the prop on this branch again
 * (the same class of bug) will fail this test.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameLayout } from '../../../src/components/layout/GameLayout';
import { GameContext } from '../../../src/context/GameContext';
import { DictionaryProvider, useDictionaryPanel } from '../../../src/dictionary';
import { createAllMockServices } from '../../mocks/mockServices';

// A minimal stand-in for App.tsx's real composition: GameLayout and the
// dictionary panel are siblings under one DictionaryProvider, and only the
// panel's open/close state (not any GameLayout-local state) proves the
// button is wired to the real, shared dictionary context.
function DictionaryOpenProbe(): JSX.Element {
  const { isOpen } = useDictionaryPanel();
  return <div data-testid="dictionary-open-probe">{isOpen ? 'open' : 'closed'}</div>;
}

describe('GameLayout — phone/controller view glossary access (TV mode)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const mockPlayer: any = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First',
    money: 100000,
    timeSpent: 5,
    color: '#007bff',
    hand: [],
    activeCards: [],
    activeEffects: [],
    loans: [],
    dobApprovalStatus: 'none',
    fdnyApprovalStatus: 'none',
    moneySources: {},
    moveIntent: null,
  };

  const mockGameState: any = {
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    hasPlayerRolledDice: false,
    movementChoiceUnlocked: true,
    awaitingChoice: null,
    requiredActions: 0,
    completedActionCount: 0,
    completedActions: { diceRoll: undefined, manualActions: {} },
    globalTurnCount: 1,
    tvDarkMode: false,
  };

  const renderPhoneView = () => {
    // Skip the one-time "tap to enable haptics" gate (fb:6e1e8ac4) shown to
    // every fresh phone-view session — irrelevant to this test and would
    // otherwise hide the panel (and its Glossary control) behind a tap.
    sessionStorage.setItem('unravel.haptics.primed.player1', 'yes');
    return render(
      <DictionaryProvider>
        <GameContext.Provider value={services as any}>
          <GameLayout viewPlayerId="player1" />
        </GameContext.Provider>
        <DictionaryOpenProbe />
      </DictionaryProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();

    services.stateService.getPlayer.mockReturnValue(mockPlayer);
    services.stateService.getGameState.mockReturnValue(mockGameState);
    services.stateService.subscribe.mockImplementation((cb: (s: any) => void) => {
      cb(mockGameState);
      return () => {};
    });
    services.stateService.subscribeToGameEvents.mockReturnValue(() => {});
    // Not in the shared mock helper (tests/mocks/mockServices.ts) yet — GameLayout
    // calls this directly in a mount effect, so it needs to exist as a no-op here.
    services.notificationService.setUpdateCallbacks = vi.fn();

    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.dataService.getAllSpaces.mockReturnValue([]);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('exposes a Glossary control on the per-player phone view', () => {
    renderPhoneView();
    expect(screen.getByRole('button', { name: /glossary/i })).toBeInTheDocument();
  });

  it('opens the shared DictionaryPanel (via DictionaryContext) when tapped', () => {
    renderPhoneView();

    expect(screen.getByTestId('dictionary-open-probe')).toHaveTextContent('closed');

    fireEvent.click(screen.getByRole('button', { name: /glossary/i }));

    expect(screen.getByTestId('dictionary-open-probe')).toHaveTextContent('open');
  });
});
