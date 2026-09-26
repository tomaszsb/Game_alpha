/**
 * GameLayoutPhoneScroll.test.tsx
 *
 * Regression guard for a bug found reading the Remote play mode branch before
 * merging it (v3.2.82). The branch wrapped PullToRefresh in a plain <div> for
 * EVERY phone view. That looks inert but is not: PullToRefresh sizes itself
 * `height: 100%; overflow: auto`, and its container is `overflow: hidden`, so
 * a wrapper with an auto height lets it grow to its content — the container
 * then clips the panel and there is nothing left to scroll. Measured in a
 * real standards-mode Chromium: scroll area 500px / scrolls with no wrapper,
 * 1200px / does NOT scroll with a plain wrapper, 500px / scrolls with a
 * `height: 100%` wrapper.
 *
 * jsdom does no layout, so this cannot measure scrolling. It pins the one
 * thing that decides it: outside Remote mode, whatever sits directly around
 * PullToRefresh must carry `height: 100%` so the percentage chain survives.
 */

import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameLayout } from '../../../src/components/layout/GameLayout';
import { GameContext } from '../../../src/context/GameContext';
import { DictionaryProvider } from '../../../src/dictionary';
import { createAllMockServices } from '../../mocks/mockServices';

describe('GameLayout — phone view keeps the panel scrollable (outside Remote mode)', () => {
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

  it('wraps PullToRefresh in a full-height element, so its own height:100% still resolves', () => {
    // Skip the one-time "tap to enable haptics" gate shown to a fresh phone session.
    sessionStorage.setItem('unravel.haptics.primed.player1', 'yes');
    render(
      <DictionaryProvider>
        <GameContext.Provider value={services as any}>
          <GameLayout viewPlayerId="player1" />
        </GameContext.Provider>
      </DictionaryProvider>,
    );

    const pullToRefresh = screen.getByTestId('pull-to-refresh');
    const wrapper = pullToRefresh.parentElement as HTMLElement;

    expect(wrapper).not.toBeNull();
    expect(wrapper.style.height).toBe('100%');
  });
});
