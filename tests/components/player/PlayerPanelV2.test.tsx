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

// "What's affecting you" is collapsed by default (fb:f6e100b7 follow-up) —
// tests that assert on its contents (chips, Activate rows) need to open it first.
const expandEffects = () => {
  fireEvent.click(screen.getByRole('button', { name: /What's affecting you/i }));
};

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
    expandEffects();
    expect(screen.getByText(/Permit Expediter/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate Permit Expediter/i })).toBeInTheDocument();
    // The phase-restricted, not-currently-playable expeditor gets no Activate row.
    expect(screen.queryByText(/Zoning Specialist/)).not.toBeInTheDocument();
  });

  it('plays the expeditor through the service rule when Activate is clicked', async () => {
    renderPanel();
    expandEffects();
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
    expandEffects();
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
    expandEffects();
    const lifeChip = screen.getByRole('button', { name: /Life Event ×1/i });
    const workChip = screen.getByRole('button', { name: /Work Package ×1/i });
    // Grayed = finished/not affecting you; full opacity = a resource you hold.
    expect(lifeChip).toHaveStyle({ opacity: '0.55' });
    expect(workChip).toHaveStyle({ opacity: '1' });
  });

  it('opens the detail view directly when a single-card chip is tapped', () => {
    renderPanel();
    expandEffects();
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
    expandEffects();
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

  const expandMoveOptions = () =>
    fireEvent.click(screen.getByRole('button', { name: /Move — where to go next/i }));

  it('keeps every destination on screen AFTER one is picked (no vanishing)', () => {
    setup('SPACE-A'); // already picked A
    renderPanel();
    expandMoveOptions();
    // Both options still rendered so the player can change their mind.
    expect(screen.getByRole('button', { name: /Go to A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to B/i })).toBeInTheDocument();
    expect(screen.getByText(/switch until you end your turn/i)).toBeInTheDocument();
  });

  it('unchecks the picked destination when tapped again (reversible)', () => {
    setup('SPACE-A');
    renderPanel();
    expandMoveOptions();
    fireEvent.click(screen.getByRole('button', { name: /Go to A/i }));
    // Tapping the chosen one clears the intent — engine treats it as not-yet-moved.
    expect(services.stateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', null);
  });

  it('switches the pick to another destination', () => {
    setup('SPACE-A');
    renderPanel();
    expandMoveOptions();
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

  const renderWith = (player: any, cardById: any = null) => {
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
    services.dataService.getCardById.mockReturnValue(cardById);
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
    expect(screen.queryByText(/in the red|running low|deficit/i)).not.toBeInTheDocument();
  });

  // Post-deploy playtest of v3.0.91: "$70K green while scope grew to millions".
  // Healthy cash must NOT read green while the full project budget (scope +
  // soft costs) exceeds the funding secured — surface the gap on the cue.
  // Word "deficit" chosen by the maintainer (2026-07-02) for the tight slot.
  it('flags "$X deficit" when commitments exceed funding raised', () => {
    const player = makePlayer(80000, { ownerFunding: 100000 }); // cash healthy vs raised
    player.hand = ['W_001'];
    renderWith(player, {
      card_id: 'W_001', card_type: 'W', card_name: 'Test work',
      cost: 500000, work_cost: 400000, work_type_restriction: 'General Construction',
    });
    expect(screen.getByText(/deficit/i)).toBeInTheDocument();
  });

  it('prefers "running low" over the funding-gap word when both apply', () => {
    const player = makePlayer(10000, { ownerFunding: 100000 }); // 10% left AND gap
    player.hand = ['W_001'];
    renderWith(player, {
      card_id: 'W_001', card_type: 'W', card_name: 'Test work',
      cost: 500000, work_cost: 400000, work_type_restriction: 'General Construction',
    });
    expect(screen.getByText(/running low/i)).toBeInTheDocument();
    expect(screen.queryByText(/deficit/i)).not.toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — this-turn cost line on the commit spine (fb:06f7da3b / b53864af)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const player: any = {
    id: 'player1', name: 'Test Player', currentSpace: 'ARCH-FEE-REVIEW',
    visitType: 'First', money: 50000, timeSpent: 55, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none',
    moneySources: { ownerFunding: 100000 }, moveIntent: null,
  };

  const renderPanel = (opts: { moneySpent: number; turnStartTime: number | null; spaceEffects?: any[] }) => {
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 1, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.stateService.getTurnOutflow.mockReturnValue({
      moneySpent: opts.moneySpent, cardsConsumed: [], lifeEventsDrawn: [],
    });
    services.stateService.getRealPlayerState.mockReturnValue(
      opts.turnStartTime === null ? null : { ...player, timeSpent: opts.turnStartTime },
    );
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Fee Review', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue(opts.spaceEffects ?? []);
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

  it('shows the money paid and days added this turn under the commit button', () => {
    renderPanel({ moneySpent: 28000, turnStartTime: 5 }); // 55 - 5 = +50 days
    const line = screen.getByTestId('turn-cost-line');
    expect(line.textContent).toMatch(/this turn:/);
    expect(line.textContent).toMatch(/\+50 days/);
    expect(line.textContent).toMatch(/28K/);
  });

  it('shows no cost line when nothing has been paid or added yet', () => {
    renderPanel({ moneySpent: 0, turnStartTime: 55 }); // no delta
    expect(screen.queryByTestId('turn-cost-line')).not.toBeInTheDocument();
  });

  it('omits the days part when only money moved (no REAL snapshot yet)', () => {
    renderPanel({ moneySpent: 5000, turnStartTime: null });
    const line = screen.getByTestId('turn-cost-line');
    expect(line.textContent).not.toMatch(/day/);
    expect(line.textContent).toMatch(/5K/);
  });

  it("includes the space's own unconditional auto time cost (applied before the REAL snapshot)", () => {
    // Arrival already applied the 50 days (real == current == 55), so the
    // snapshot diff alone shows nothing — the space's own time row must carry it.
    // The dice-conditional row must NOT count (it lands via the diff when it hits).
    renderPanel({
      moneySpent: 0,
      turnStartTime: 55,
      spaceEffects: [
        { space: 'ARCH-FEE-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: 50, condition: '', trigger_type: 'auto', description: 'Spend 50 days' },
        { space: 'ARCH-FEE-REVIEW', visit_type: 'First', effect_type: 'time', effect_action: 'add', effect_value: 7, condition: 'dice_roll_3', trigger_type: 'auto', description: 'conditional — excluded' },
      ],
    });
    const line = screen.getByTestId('turn-cost-line');
    expect(line.textContent).toMatch(/\+50 days/);
  });

  // TODO.md LOW item: 'Add missing space in cost-strip: "1 action leftthis
  // turn"'. Investigated 2026-07-24. This fixture (moneySpent: 28000,
  // turnStartTime: 5, no can_negotiate/onTryAgain) is the exact scenario
  // that produces both texts together: the plain-button fallback (used
  // whenever there's no negotiate option) renders commit.label ("1 action
  // left", from requiredActions:1/completedActionCount:0 with canEndTurn
  // false) in a <span>, and turnCostLine ("this turn: ...") in a sibling
  // <small data-testid="turn-cost-line"> — see PlayerPanelV2.tsx ~1046-1087.
  // Verdict: this is a test-observation artifact, not a real visual bug.
  // `.textContent` walks the DOM and concatenates every descendant text
  // node with ZERO separator, ignoring CSS entirely — so a Playwright/DOM
  // script reading raw textContent reproduces the reported string exactly.
  // A real player never sees it that way: the button is `display:flex;
  // flex-direction:column` with a gap, so the label and cost line are two
  // separate rows, one below the other. No code change is warranted; the
  // proof is this test.
  it('TODO cost-strip "1 action leftthis turn": raw textContent concatenation is a DOM-read artifact, not a real merged line', () => {
    renderPanel({ moneySpent: 28000, turnStartTime: 5 }); // same fixture as the first test above

    const costLine = screen.getByTestId('turn-cost-line');
    const button = costLine.closest('button') as HTMLButtonElement;
    expect(button).not.toBeNull();

    // Sanity: this really is the reported pairing — "1 action left" shown
    // together with "this turn: ..." in the same commit control.
    expect(button.textContent).toMatch(/^1 action left/);

    // This is what reading raw `.textContent` sees: the TODO's exact string,
    // because textContent ignores block/flex layout and just concatenates
    // text nodes in DOM order with no separator.
    expect(button.textContent).toContain('1 action leftthis turn:');

    // But the real DOM keeps them as two distinct elements...
    const labelSpan = button.querySelector('span');
    expect(labelSpan).not.toBeNull();
    expect(labelSpan).not.toBe(costLine);
    expect(labelSpan?.contains(costLine)).toBe(false);
    expect(costLine.contains(labelSpan)).toBe(false);

    // ...laid out as separate rows (column direction, not a single inline
    // run), which is what actually renders in a browser: line 1 "1 action
    // left", line 2 "this turn: ...", never touching.
    expect(button.style.display).toBe('flex');
    expect(button.style.flexDirection).toBe('column');
  });
});

describe('PlayerPanelV2 — End Turn cost preview drops already-completed actions (fb:feedback-1783922070233-49395e17)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const player: any = {
    id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
    visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  };

  // Same shape as OWNER-SCOPE-INITIATION's real dice row: rolling determines
  // how many Work Packages the player gets. Unknowable ahead of the roll, so
  // the preview reads "Varies" — UNLESS the player already rolled it this
  // turn, in which case it's no longer a remaining cost of pressing End Turn.
  const diceEffect: any = {
    space: 'OWNER-SCOPE-INITIATION', visit_type: 'First', effect_type: 'dice',
    effect_action: 'dice_outcome', effect_value: 'W Cards', condition: '',
    trigger_type: 'manual', description: 'Roll for W Cards',
  };

  const renderPanel = (completedActions: { diceRoll?: string; manualActions: Record<string, string> }) => {
    services = createAllMockServices();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 1, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({
      title: 'Scope Initiation', story: '', can_negotiate: true,
      end_turn_label: 'End turn', try_again_label: 'Negotiate again',
    });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([diceEffect]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([diceEffect]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
    return render(
      <DictionaryProvider>
        <PlayerPanelV2
          gameServices={services as any}
          playerId="player1"
          mode="light"
          onTryAgain={vi.fn()}
          completedActions={completedActions as any}
        />
      </DictionaryProvider>,
    );
  };

  afterEach(() => cleanup());

  it('shows "Varies" for the Work row before the dice roll happens', () => {
    renderPanel({ diceRoll: undefined, manualActions: {} });
    // End Turn is the default (first-shown) tab of the toggle.
    expect(screen.getByText('Varies')).toBeInTheDocument();
  });

  it('drops the Work row\'s "Varies" value once the roll already resolved this turn', () => {
    renderPanel({ diceRoll: '3', manualActions: {} });
    expect(screen.queryByText('Varies')).not.toBeInTheDocument();
    // TurnCommitControl always shows all 5 categories (toFullRowSet) — the
    // Work row itself stays, just with the placeholder value now that the
    // mock space (which declares nothing else) no longer populates it.
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
