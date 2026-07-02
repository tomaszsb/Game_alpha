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
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
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

describe('PlayerPanelV2 — "What\'s affecting you" chips (tappable + graying)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  // A player holding a Work Package and a (past) Life Event, no playable expeditor.
  const handPlayer: any = {
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand: ['W001', 'L001'], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  };

  const gameState: any = {
    players: [handPlayer], currentPlayerId: 'player1', gamePhase: 'PLAY',
    hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
    requiredActions: 0, completedActionCount: 0,
    completedActions: { diceRoll: undefined, manualActions: {} },
  };

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(handPlayer);
    services.stateService.getGameState.mockReturnValue(gameState);
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockImplementation((id: string) => {
      if (id === 'W001') return { card_id: 'W001', card_type: 'W', card_name: 'Foundation' };
      if (id === 'L001') return { card_id: 'L001', card_type: 'L', card_name: 'Permit Fee Hike' };
      return null;
    });
  });

  afterEach(() => cleanup());

  it('grays the Life Event chip (finished) but not a held Work Package', () => {
    renderPanel();
    const lifeChip = screen.getByRole('button', { name: /Life Event ×1/i });
    const workChip = screen.getByRole('button', { name: /Work Package ×1/i });
    // Grayed = finished/not affecting you; full opacity = a resource you hold.
    expect(lifeChip).toHaveStyle({ opacity: '0.55' });
    expect(workChip).toHaveStyle({ opacity: '1' });
  });

  it('opens the detail view directly when a single-card chip is tapped', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Life Event ×1/i }));
    // The L-type teaching callout is unique to the detail view.
    expect(screen.getByText(/real-world surprises/i)).toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — multi-card chip opens a pick list (fb:88a88773)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  // Three expeditors held, none currently playable — they collapse to "×3".
  const player: any = {
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand: ['E001', 'E002', 'E003'], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  };

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 0, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false); // none playable → count chip
    services.dataService.getCardById.mockImplementation((id: string) => {
      const names: Record<string, string> = { E001: 'Equipment Rush Order', E002: 'Permit Expediter', E003: 'Zoning Specialist' };
      return names[id] ? { card_id: id, card_type: 'E', card_name: names[id], phase_restriction: 'Any' } : null;
    });
  });

  afterEach(() => cleanup());

  it('lists all three expeditors, then drills into the chosen one', () => {
    renderPanel();
    // Tapping the "×3" chip opens a list of all three, not just the first.
    fireEvent.click(screen.getByRole('button', { name: /Expeditor ×3/i }));
    expect(screen.getByText('Equipment Rush Order')).toBeInTheDocument();
    expect(screen.getByText('Permit Expediter')).toBeInTheDocument();
    expect(screen.getByText('Zoning Specialist')).toBeInTheDocument();

    // Choosing one opens its detail (the teaching callout is detail-only).
    fireEvent.click(screen.getByText('Zoning Specialist'));
    expect(screen.getByText(/real NYC permitting pros/i)).toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — expeditor-action guard', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const replaceEffect: any = {
    effect_type: 'cards', effect_action: 'replace_e', trigger_type: 'manual',
    condition: 'always', effect_value: 1,
  };

  const makePlayer = (hand: string[]): any => ({
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand, activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  });

  const setup = (hand: string[]) => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player = makePlayer(hand);
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 1, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([replaceEffect]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([replaceEffect]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false); // not played as Activate row
    services.dataService.getCardById.mockImplementation((id: string) =>
      id.startsWith('E') ? { card_id: id, card_type: 'E', card_name: 'Filing Rep' } : null);
  };

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  afterEach(() => cleanup());

  it('hides a Replace-Expeditor action when the player has no expeditors (fb:3accbe92)', () => {
    setup([]); // no E cards
    renderPanel();
    expect(screen.queryByText(/Things you can do/i)).not.toBeInTheDocument();
  });

  it('shows the Replace-Expeditor action when the player has an expeditor to act on', () => {
    setup(['E001']); // has an E card
    renderPanel();
    expect(screen.getByText(/Things you can do/i)).toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — movement check/uncheck (Pile 2: fb:c2e489dc / fb:45cb8b0c)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const options = [
    { id: 'SPACE-A', label: 'Go to A' },
    { id: 'SPACE-B', label: 'Go to B' },
  ];

  const makePlayer = (moveIntent: string | null): any => ({
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent,
  });

  const setup = (moveIntent: string | null) => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player = makePlayer(moveIntent);
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true,
      awaitingChoice: { type: 'MOVEMENT', options },
      requiredActions: 1, completedActionCount: moveIntent ? 1 : 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue({ movement_type: 'choice' });
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(!!moveIntent);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
  };

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  afterEach(() => cleanup());

  it('keeps every destination on screen AFTER one is picked (no vanishing)', () => {
    setup('SPACE-A'); // already picked A
    renderPanel();
    // Both options still rendered so the player can change their mind.
    expect(screen.getByRole('button', { name: /Go to A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to B/i })).toBeInTheDocument();
    expect(screen.getByText(/switch until you end your turn/i)).toBeInTheDocument();
  });

  it('unchecks the picked destination when tapped again (reversible)', () => {
    setup('SPACE-A');
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Go to A/i }));
    // Tapping the chosen one clears the intent — engine treats it as not-yet-moved.
    expect(services.stateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', null);
  });

  it('switches the pick to another destination', () => {
    setup('SPACE-A');
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Go to B/i }));
    expect(services.stateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', 'SPACE-B');
  });
});

describe('PlayerPanelV2 — completed-action checkmark trace (Pile 2: fb:d2070ed1)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const drawEffect: any = {
    effect_type: 'cards', effect_action: 'draw_W', trigger_type: 'manual',
    condition: 'always', effect_value: 1,
  };

  const player: any = {
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 1, completedActionCount: 1,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([drawEffect]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([drawEffect]);
    services.gameRulesService.canEndTurn.mockReturnValue(true);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
  });

  afterEach(() => cleanup());

  it('leaves a non-interactive ✓ trace instead of vanishing the used action', () => {
    render(
      <DictionaryProvider>
        <PlayerPanelV2
          gameServices={services as any}
          playerId="player1"
          mode="light"
          completedActions={{ manualActions: { 'cards:draw_W': true } } as any}
        />
      </DictionaryProvider>,
    );
    // The done action is still shown (as a trace) but is no longer a button.
    expect(screen.getByLabelText(/Done: Add Work Package/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Work Package/i })).not.toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — between-turns move overlay (Pile 3: fb:15499d9b)', () => {
  let services: ReturnType<typeof createAllMockServices>;
  let sub: (() => void) | undefined;

  // A mutable player so a test can "move" it and push a state update.
  const player: any = {
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  };

  const renderPanel = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    player.currentSpace = 'OWNER-SCOPE-INITIATION';
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 0, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockImplementation((cb: any) => { sub = cb; return () => {}; });
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockImplementation((id: string) => ({
      phase: 'DESIGN',
      display_label_override: id === 'OWNER-SCOPE-INITIATION' ? 'Scope Start' : undefined,
    }));
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
  });

  afterEach(() => cleanup());

  it('shows no overlay on first render (no flash on game load)', () => {
    renderPanel();
    expect(screen.queryByText(/You moved/i)).not.toBeInTheDocument();
  });

  it('shows "you moved from X to Y" once the player\'s space changes', () => {
    renderPanel();
    act(() => {
      player.currentSpace = 'OWNER-FUND-INITIATION'; // the move
      sub?.(); // push a state update (engine would do this)
    });
    expect(screen.getByText(/You moved/i)).toBeInTheDocument();
    // Friendly "from" label (display_label_override), not the raw space id.
    expect(screen.getByText('Scope Start')).toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — money runway cue (fb:0aae9865)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const makePlayer = (money: number, moneySources: any): any => ({
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources, moveIntent: null,
  });

  const renderWith = (player: any) => {
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 0, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Scope Initiation', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
    return render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );
  };

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('flags "in the red" when cash is negative (bankruptcy territory)', () => {
    renderWith(makePlayer(-5000, { ownerFunding: 100000 }));
    expect(screen.getByText(/in the red/i)).toBeInTheDocument();
  });

  it('flags "running low" when under 20% of the money raised is left', () => {
    renderWith(makePlayer(10000, { ownerFunding: 100000 })); // 10% left
    expect(screen.getByText(/running low/i)).toBeInTheDocument();
  });

  it('shows no warning word when cash is healthy', () => {
    renderWith(makePlayer(80000, { ownerFunding: 100000 })); // 80% left
    expect(screen.queryByText(/in the red|running low/i)).not.toBeInTheDocument();
  });
});
