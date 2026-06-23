/**
 * PlayerPanelV2.test.tsx
 *
 * Covers the redesigned panel's "optional E-card play from the influence zone"
 * increment. The key contract is that the panel gates AND plays expeditors
 * through the canonical SERVICE rule (cardService.canPlayCard / playCard) — never
 * a component-local re-derivation — so a focused test on those service calls is
 * what protects against parallel-systems drift.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerPanelV2 } from '../../../src/components/player/PlayerPanelV2';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';

describe('PlayerPanelV2 — E-card play from the influence zone', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const mockPlayer: any = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First',
    money: 100000,
    timeSpent: 5,
    color: '#007bff',
    hand: ['E001', 'E002'],
    activeCards: [],
    activeEffects: [],
    loans: [],
    dobApprovalStatus: 'none',
    fdnyApprovalStatus: 'none',
    moneySources: {},
    moveIntent: null,
  };

  const makeGameState = (currentPlayerId: string): any => ({
    players: [mockPlayer],
    currentPlayerId,
    gamePhase: 'PLAY',
    hasPlayerRolledDice: false,
    movementChoiceUnlocked: true,
    awaitingChoice: null,
    requiredActions: 0,
    completedActionCount: 0,
    completedActions: { diceRoll: undefined, manualActions: {} },
  });

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();

    services.stateService.getPlayer.mockReturnValue(mockPlayer);
    services.stateService.getGameState.mockReturnValue(makeGameState('player1'));
    services.stateService.subscribe.mockReturnValue(() => {});

    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);

    services.dataService.getCardById.mockImplementation((id: string) => {
      if (id === 'E001') return { card_id: 'E001', card_type: 'E', card_name: 'Permit Expediter', phase_restriction: 'Any' };
      if (id === 'E002') return { card_id: 'E002', card_type: 'E', card_name: 'Zoning Specialist', phase_restriction: 'CONSTRUCTION' };
      return null;
    });
    // Canonical gate: only the unrestricted expeditor is playable here.
    services.cardService.canPlayCard.mockImplementation((_pid: string, cardId: string) => cardId === 'E001');
    services.cardService.playCard.mockResolvedValue(makeGameState('player1'));
  });

  afterEach(() => cleanup());

  it('offers Activate only for a playable expeditor', () => {
    renderPanel();
    expect(screen.getByText(/Permit Expediter/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate Permit Expediter/i })).toBeInTheDocument();
    // The phase-restricted, not-currently-playable expeditor gets no Activate row.
    expect(screen.queryByText(/Zoning Specialist/)).not.toBeInTheDocument();
  });

  it('plays the expeditor through the service rule when Activate is clicked', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Activate Permit Expediter/i }));
    await waitFor(() => {
      expect(services.cardService.playCard).toHaveBeenCalledWith('player1', 'E001');
    });
  });

  it('shows no Activate buttons when it is not the player\'s turn', () => {
    services.stateService.getGameState.mockReturnValue(makeGameState('player2'));
    renderPanel();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
  });

  it('opens the detailed-card view when an expeditor name is tapped', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Details for Permit Expediter/i }));
    // The teaching callout is unique to the detail view, not the row.
    expect(screen.getByText(/real NYC permitting pros/i)).toBeInTheDocument();
  });
});
