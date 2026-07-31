/**
 * GameLayoutTransitionClear.test.tsx
 *
 * Regression test for the useSyncedGameState refactor (v3.1.80,
 * react-hooks/set-state-in-effect cleanup): GameLayout used to re-derive
 * gamePhase/players/currentPlayerId/turnNumber/tvDarkMode/completedActions
 * from a manually-duplicated subscribe callback + a synchronous
 * "initialize with current state" block. The synchronous block was the
 * lint violation; useSyncedGameState replaces both. The one piece of real
 * logic living inside that old callback — clearing per-turn notification
 * state (button feedback, player notifications, approval-revoke notices)
 * on a genuine player or turn change — was rewritten as a ref-based
 * transition detector, since useSyncExternalStore gives no callback to
 * hang that comparison off of. This pins that it still fires exactly on
 * player/turn changes, not on mount and not on unrelated state updates.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { GameLayout } from '../../../src/components/layout/GameLayout';
import { GameContext } from '../../../src/context/GameContext';
import { DictionaryProvider } from '../../../src/dictionary';
import { createAllMockServices } from '../../mocks/mockServices';

describe('GameLayout — transition-based notification clearing', () => {
  let services: ReturnType<typeof createAllMockServices>;
  let subscribeCallback: ((state: any) => void) | null;
  let currentMockState: any;

  const mockPlayer1: any = {
    id: 'player1',
    name: 'Player One',
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

  const mockPlayer2: any = { ...mockPlayer1, id: 'player2', name: 'Player Two', color: '#dc3545' };

  const baseGameState: any = {
    players: [mockPlayer1, mockPlayer2],
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

  const renderLayout = () => {
    // Phone/controller view (viewPlayerId set) renders PlayerPanelWrapper
    // instead of the full desktop layout (BoardCanvas + ProjectProgress),
    // which needs a much larger data-service mock surface. The synced-state
    // + transition-detection logic under test sits above that branch, so
    // either view exercises it identically — this one just needs less setup
    // (same approach as GameLayoutPhoneGlossary.test.tsx).
    sessionStorage.setItem('unravel.haptics.primed.player1', 'yes');
    return render(
      <DictionaryProvider>
        <GameContext.Provider value={services as any}>
          <GameLayout viewPlayerId="player1" />
        </GameContext.Provider>
      </DictionaryProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    currentMockState = { ...baseGameState };
    subscribeCallback = null;

    services.stateService.getPlayer.mockImplementation((id: string) =>
      currentMockState.players.find((p: any) => p.id === id));
    services.stateService.getGameState.mockImplementation(() => currentMockState);
    services.stateService.subscribe.mockImplementation((cb: (s: any) => void) => {
      subscribeCallback = cb;
      return () => { subscribeCallback = null; };
    });
    services.stateService.subscribeToGameEvents.mockReturnValue(() => {});
    services.notificationService.setUpdateCallbacks = vi.fn();

    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.dataService.getAllSpaces.mockReturnValue([]);
    services.dataService.getPhaseOrder.mockReturnValue(['DESIGN', 'REGULATORY', 'CONSTRUCTION']);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  // Pushes a new state broadcast the way the real StateService does: update
  // what getGameState() returns, then invoke the captured subscribe callback.
  const broadcast = (patch: Partial<typeof baseGameState>) => {
    currentMockState = { ...currentMockState, ...patch };
    act(() => {
      subscribeCallback?.(currentMockState);
    });
  };

  it('does not clear notifications on initial mount', () => {
    renderLayout();
    expect(services.notificationService.clearAllNotifications).not.toHaveBeenCalled();
  });

  it('clears notifications when the current player changes', () => {
    renderLayout();
    services.notificationService.clearAllNotifications.mockClear();

    broadcast({ currentPlayerId: 'player2' });

    expect(services.notificationService.clearAllNotifications).toHaveBeenCalledTimes(1);
  });

  it('clears notifications when the turn number advances', () => {
    renderLayout();
    services.notificationService.clearAllNotifications.mockClear();

    broadcast({ globalTurnCount: 2 });

    expect(services.notificationService.clearAllNotifications).toHaveBeenCalledTimes(1);
  });

  it('does not clear notifications when neither the player nor the turn changed', () => {
    renderLayout();
    services.notificationService.clearAllNotifications.mockClear();

    // Same currentPlayerId and globalTurnCount as baseGameState — only an
    // unrelated field changes, e.g. hasPlayerRolledDice flipping.
    broadcast({ hasPlayerRolledDice: true });

    expect(services.notificationService.clearAllNotifications).not.toHaveBeenCalled();
  });

  it('clears notifications on unmount', () => {
    const { unmount } = renderLayout();
    services.notificationService.clearAllNotifications.mockClear();

    unmount();

    expect(services.notificationService.clearAllNotifications).toHaveBeenCalledTimes(1);
  });
});
