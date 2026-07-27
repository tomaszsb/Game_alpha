/**
 * PlayerPanelWrapper.test.tsx
 *
 * Covers the `onOpenGlossary` contract added for the TV-mode glossary-access
 * fix (fb: "There seem so way to access glossary words in tv mode", filed
 * 2026-07-22 v3.1.20). PlayerPanelWrapper renders on BOTH the phone/controller
 * branch and the desktop per-player panel list in GameLayout.tsx — only the
 * phone branch passes `onOpenGlossary` (the desktop view already has its own
 * single Glossary entry point in ProjectProgress's toolbar). This test pins
 * that the button only appears when the prop is supplied, and that clicking
 * it calls the supplied handler (GameLayout wires this to its existing
 * `handleToggleGlossary` / DictionaryContext — no parallel state here).
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerPanelWrapper } from '../../../src/components/player/PlayerPanelWrapper';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';

describe('PlayerPanelWrapper — onOpenGlossary', () => {
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

  const makeGameState = (): any => ({
    players: [mockPlayer],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    hasPlayerRolledDice: false,
    movementChoiceUnlocked: true,
    awaitingChoice: null,
    requiredActions: 0,
    completedActionCount: 0,
    completedActions: { diceRoll: undefined, manualActions: {} },
  });

  const renderWrapper = (onOpenGlossary?: () => void) =>
    render(
      <DictionaryProvider>
        <PlayerPanelWrapper
          gameServices={services as any}
          playerId="player1"
          onOpenGlossary={onOpenGlossary}
        />
      </DictionaryProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();

    services.stateService.getPlayer.mockReturnValue(mockPlayer);
    services.stateService.getGameState.mockReturnValue(makeGameState());
    services.stateService.subscribe.mockReturnValue(() => {});

    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
  });

  afterEach(() => cleanup());

  it('renders no Glossary control when onOpenGlossary is not supplied (desktop panel list)', () => {
    renderWrapper(undefined);
    expect(screen.queryByRole('button', { name: /glossary/i })).not.toBeInTheDocument();
  });

  it('renders a Glossary control and calls the handler on tap when supplied (phone view)', () => {
    const onOpenGlossary = vi.fn();
    renderWrapper(onOpenGlossary);

    const button = screen.getByRole('button', { name: /glossary/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onOpenGlossary).toHaveBeenCalledTimes(1);
  });
});
