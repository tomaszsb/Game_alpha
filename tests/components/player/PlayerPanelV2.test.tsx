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
import * as uiStrings from '../../../src/constants/uiStrings';
import { initializeTooltipService, resetTooltipService } from '../../../src/services/TooltipService';
import { readFileSync } from 'fs';
import { join } from 'path';

// v3.2.62 (fb:adad1561, Tom 2026-09-17): "What's affecting you" is gone. Its
// contents live behind the at-a-glance boxes — the Expeditors box opens the
// Expeditors page (Activate rows), Scope opens the work packages, Time opens
// History (life events).
const expandEffects = () => {
  fireEvent.click(screen.getByTestId('glance-expeditors'));
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
    // The Expeditors page lists every expeditor you hold, but the
    // phase-restricted, not-currently-playable one gets no Activate button.
    expect(screen.getByText(/Zoning Specialist/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate Zoning Specialist/i })).not.toBeInTheDocument();
  });

  it('the Expeditors box counts what you hold, says how many are ready, and glows', () => {
    renderPanel();
    const box = screen.getByTestId('glance-expeditors');
    expect(box).toHaveTextContent('2');
    expect(box).toHaveTextContent(uiStrings.NUMBERS.ready(1));
    expect(box).toHaveClass('uc-hint-glow');
  });

  it('plays the expeditor through the service rule when Activate is clicked', async () => {
    renderPanel();
    expandEffects();
    fireEvent.click(screen.getByRole('button', { name: /Activate Permit Expediter/i }));
    await waitFor(() => {
      expect(services.cardService.playCard).toHaveBeenCalledWith('player1', 'E001');
    });
  });

  // Workstream 6 audit II, B2 (v3.2.56). Every earlier reskin test kept its
  // card_type at 'E', so the suite varied the card-ID axis and never the
  // card-TYPE axis — which is exactly where this gate was hardcoded
  // (`card_type === 'E'`). These vary the TYPE and let the data decide.
  it('offers Activate for a NON-Expeditor family when CARD_TYPES says it is playable from hand', () => {
    services.stateService.getPlayer.mockReturnValue({ ...mockPlayer, hand: ['E001', 'L007'] });
    services.dataService.getCardById.mockImplementation((id: string) => {
      if (id === 'E001') return { card_id: 'E001', card_type: 'E', card_name: 'Permit Expediter', phase_restriction: 'Any' };
      if (id === 'L007') return { card_id: 'L007', card_type: 'L', card_name: 'Neighbour Complaint', phase_restriction: 'Any' };
      return null;
    });
    services.cardService.canPlayCard.mockReturnValue(true);
    services.dataService.isCardTypePlayableFromHand.mockImplementation((t: string) => t === 'E' || t === 'L');
    renderPanel();
    expandEffects();
    expect(screen.getByRole('button', { name: /Activate Neighbour Complaint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate Permit Expediter/i })).toBeInTheDocument();
  });

  it('offers NO Activate for an Expeditor when CARD_TYPES says the family is not playable from hand', () => {
    services.cardService.canPlayCard.mockReturnValue(true);
    services.dataService.isCardTypePlayableFromHand.mockReturnValue(false);
    renderPanel();
    expandEffects();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
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

describe('PlayerPanelV2 — at-a-glance boxes replace "What\'s affecting you" (fb:adad1561)', () => {
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

  it('shows no "What\'s affecting you" section and no separate numbers/history buttons', () => {
    renderPanel();
    expect(screen.queryByText(/What's affecting you/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /See your numbers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /See what's happened/i })).not.toBeInTheDocument();
  });

  it('the Scope box counts held work packages and opens the scope page', () => {
    renderPanel();
    const box = screen.getByTestId('glance-scope');
    expect(box).toHaveTextContent('1');
    fireEvent.click(box);
    expect(screen.getByTestId('player-numbers-v2')).toHaveTextContent(uiStrings.NUMBERS.SECTION_SCOPE);
  });

  it('the Money box opens the money page', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('glance-money'));
    expect(screen.getByTestId('player-numbers-v2')).toHaveTextContent(/Cash on hand/);
  });

  it('the Time box opens History, which lists the life event; tapping it opens its detail', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('glance-time'));
    const cards = screen.getByTestId('chronicle-history-cards');
    expect(cards).toHaveTextContent('Permit Fee Hike');
    fireEvent.click(screen.getByRole('button', { name: /Details for Permit Fee Hike/i }));
    // The L-type teaching callout is unique to the detail view.
    expect(screen.getByText(/real-world surprises/i)).toBeInTheDocument();
  });
});

describe('PlayerPanelV2 — Expeditors page lists every expeditor (fb:88a88773)', () => {
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
    // The Expeditors page shows all three held expeditors, not just the first.
    expect(screen.getByText('Equipment Rush Order')).toBeInTheDocument();
    expect(screen.getByText('Permit Expediter')).toBeInTheDocument();
    expect(screen.getByText('Zoning Specialist')).toBeInTheDocument();

    // Choosing one opens its detail (the teaching callout is detail-only).
    fireEvent.click(screen.getByRole('button', { name: /Details for Zoning Specialist/i }));
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
    expect(screen.queryByText(/This turn/i)).not.toBeInTheDocument();
  });

  it('shows the Replace-Expeditor action when the player has an expeditor to act on', () => {
    setup(['E001']); // has an E card
    renderPanel();
    expect(screen.getByText(/This turn/i)).toBeInTheDocument();
  });
});

// "Pass a team member to your left/right" (`transfer`) needs two things the
// other expeditor actions need one of: an expeditor to pass AND someone to pass
// it to. In a solo game it would be a button that can only say "nobody there".
describe('PlayerPanelV2 — pass-a-team-member (transfer) guard', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const passEffect: any = {
    effect_type: 'cards', effect_action: 'transfer', trigger_type: 'manual',
    condition: 'to_right', effect_value: 1,
    description: 'Pass a team member to your right', button_label: 'Pass a team member to your right',
  };

  const makePlayer = (id: string, hand: string[]): any => ({
    id, name: id === 'player1' ? 'Test Player' : 'Other Player', currentSpace: 'PM-DECISION-CHECK',
    visitType: 'Subsequent', money: 100000, timeSpent: 5, color: '#007bff',
    hand, activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  });

  const setup = (hand: string[], seated: number) => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player = makePlayer('player1', hand);
    const players = [player, ...Array.from({ length: seated - 1 }, (_, i) => makePlayer(`player${i + 2}`, []))];
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players, currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 0, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'PM Check', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'OWNER' });
    services.dataService.getSpaceEffects.mockReturnValue([passEffect]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([passEffect]);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
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

  it('shows the button, tagged optional, when there is an expeditor to pass and a neighbour to pass it to', () => {
    setup(['E001'], 2);
    renderPanel();
    expect(screen.getByText(/Pass a team member to your right/i)).toBeInTheDocument();
    expect(screen.getByTestId('action-optional-tag')).toBeInTheDocument();
  });

  it('hides the button when the player holds no expeditor', () => {
    setup([], 2);
    renderPanel();
    expect(screen.queryByText(/Pass a team member/i)).not.toBeInTheDocument();
  });

  it('hides the button in a solo game — there is nobody to pass it to', () => {
    setup(['E001'], 1);
    renderPanel();
    expect(screen.queryByText(/Pass a team member/i)).not.toBeInTheDocument();
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
    // Scoped to the destination rows: since v3.2.60 the commit caption also
    // names the picked destination, so a bare name query matches both.
    const rows = screen.getAllByTestId('move-option').map((b) => b.textContent);
    expect(rows.some((t) => /Go to A/i.test(t || ''))).toBe(true);
    expect(rows.some((t) => /Go to B/i.test(t || ''))).toBe(true);
    // v3.2.52 named the subject of this rule ("switch" what?) — 14 playtest hits.
    expect(screen.getByText(/change where you.re going until you end your turn/i)).toBeInTheDocument();
  });

  it('unchecks the picked destination when tapped again (reversible)', () => {
    setup('SPACE-A');
    renderPanel();
    expandMoveOptions();
    fireEvent.click(screen.getAllByTestId('move-option').find((b) => /Go to A/i.test(b.textContent || ''))!);
    // Tapping the chosen one clears the intent — engine treats it as not-yet-moved.
    expect(services.stateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', null);
  });

  it('switches the pick to another destination', () => {
    setup('SPACE-A');
    renderPanel();
    expandMoveOptions();
    fireEvent.click(screen.getAllByTestId('move-option').find((b) => /Go to B/i.test(b.textContent || ''))!);
    expect(services.stateService.setPlayerMoveIntent).toHaveBeenCalledWith('player1', 'SPACE-B');
  });

  // v3.2.60 (maintainer's call, 2026-09-12). The 2026-09-12 nightly robot
  // toggled the destination rows ~20 times at "See the Design" and never
  // committed: the commit control was live the moment a destination was
  // picked, but it is named after the in-fiction act while the rows that look
  // like movement only select. The signpost goes on the commit control; the
  // rows are deliberately left alone.
  describe('the commit control names where a picked destination leads', () => {
    afterEach(() => uiStrings._testOnly.resetUIStringOverrides());

    it('appends the destination once one is picked', () => {
      setup('SPACE-A');
      renderPanel();
      const commit = screen.getByTestId('commit-end-turn');
      expect(commit.textContent).toMatch(/End turn\s*→\s*Go to A/);
    });

    it('leaves the caption alone when nothing is picked', () => {
      setup(null);
      renderPanel();
      const commit = screen.getByTestId('commit-end-turn');
      expect(commit.textContent).toMatch(/End turn/);
      expect(commit.textContent).not.toMatch(/Go to A|→/);
    });

    it('carries the signpost on the two-tab control too — the variant the robot meets', () => {
      setup('SPACE-A');
      // can_negotiate + an onTryAgain handler is what renders TurnCommitControl
      // instead of the plain spine (ARCH-SCOPE-CHECK is one of these spaces).
      services.dataService.getSpaceContent.mockReturnValue({
        title: 'Today is the design reveal', story: '',
        can_negotiate: true, end_turn_label: 'Sign off on the design', try_again_label: 'Send it back',
      });
      render(
        <DictionaryProvider>
          <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" onTryAgain={vi.fn()} />
        </DictionaryProvider>,
      );
      const end = screen.getAllByTestId('commit-side').find((b) => b.getAttribute('data-side') === 'end')!;
      expect(end.getAttribute('data-actionable')).toBe('true');
      expect(end.textContent).toMatch(/Sign off on the design\s*→\s*Go to A/);
    });

    it('lets a reskin CSV own the connector and word order (not hardcoded English)', () => {
      uiStrings.configureUIStrings([
        { key: 'COMMIT.withDestination', template: '{label}, then onward to {destination}' },
      ] as any);
      setup('SPACE-A');
      renderPanel();
      expect(screen.getByTestId('commit-end-turn').textContent).toMatch(/End turn, then onward to Go to A/);
    });
  });
});

// v3.2.65 (fb:ae480630): "when actions are completed the negotiate and/or
// accept buttons should become the highlighted buttons." Previously the
// commit control's highlight (green dot / uc-hint-glow) was gated to
// player.visitType === 'First' — so a player who completed a space's
// actions on a SUBSEQUENT visit (a real case: re-entering a space via Try
// Again, or a board loop) never saw the commit control light up, even
// though it had just become pressable. Fixed by tracking commit.ready
// alone, independent of visit count.
describe('PlayerPanelV2 — commit control highlights once actionable, any visit (fb:ae480630)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const makePlayer = (): any => ({
    id: 'player1', name: 'Test Player', currentSpace: 'LEND-SCOPE-CHECK',
    visitType: 'Subsequent', money: 100000, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  });

  const setup = () => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player = makePlayer();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 0, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'FUNDING' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    // The action(s) are already done; the turn is ready to commit right now.
    services.gameRulesService.canEndTurn.mockReturnValue(true);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
  };

  afterEach(() => cleanup());

  it('single-button path: glows on a Subsequent visit once ready (previously required First)', () => {
    setup();
    services.dataService.getSpaceContent.mockReturnValue({ title: 'You again', story: '' }); // no can_negotiate
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
      </DictionaryProvider>,
    );
    const commit = screen.getByTestId('commit-end-turn');
    expect(commit.getAttribute('data-ready')).toBe('true');
    expect(commit).toHaveClass('uc-hint-glow');
  });

  it('two-tab path: the End side carries the dot on a Subsequent visit once ready', () => {
    setup();
    services.dataService.getSpaceContent.mockReturnValue({
      title: 'You again', story: '',
      can_negotiate: true, end_turn_label: 'Take what they\'re offering', try_again_label: 'Push for better terms',
    });
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" onTryAgain={vi.fn()} />
      </DictionaryProvider>,
    );
    const end = screen.getAllByTestId('commit-side').find((b) => b.getAttribute('data-side') === 'end')!;
    expect(end.getAttribute('data-actionable')).toBe('true');
    // The dot is an aria-hidden span with no testid of its own — assert it
    // exists inside the actionable End tab by its distinctive fill color.
    // jsdom normalizes the inline hex (#34d399) to rgb() on serialization.
    expect(end.querySelector('span[style*="rgb(52, 211, 153)"]')).not.toBeNull();
  });
});

// TODO.md "Decisions waiting on the user" #5, confirmed 2026-09-26: on a
// Subsequent (redo) visit to ARCH-INITIATION/ENG-INITIATION, the space's own
// end_turn_label ("Accept the redesign" / "Accept the engineer's findings")
// is the wording for the REAL commit, which only happens after the required
// dice roll. Before that roll, MOVEMENT.csv marks this same visit
// movement_type=dice, so the commit spine's dice-roll button used to borrow
// that same "Accept…" label — implying the player had already accepted
// something they hadn't even seen yet. The roll step now shows the generic
// "Take your next step" instead; the real "Accept…" wording is untouched
// once the roll resolves and the button becomes the actual commit.
describe('PlayerPanelV2 — Arch/Eng redo visit: roll step says "Take your next step", not "Accept…"', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const makePlayer = (): any => ({
    id: 'player1', name: 'Test Player', currentSpace: 'ARCH-INITIATION',
    visitType: 'Subsequent', money: 100000, timeSpent: 5, color: '#007bff',
    hand: [], activeCards: [], activeEffects: [], loans: [],
    dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
  });

  const setup = (hasPlayerRolledDice: boolean, canEndTurn: boolean) => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player = makePlayer();
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice, movementChoiceUnlocked: true, awaitingChoice: null,
      requiredActions: 0, completedActionCount: 0,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({
      title: 'I want another look at these drawings', story: '',
      can_negotiate: true, end_turn_label: 'Accept the redesign', try_again_label: 'Push back on the changes',
    });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue([]);
    // MOVEMENT.csv: ARCH-INITIATION/Subsequent is movement_type=dice.
    services.dataService.getMovement.mockReturnValue({ movement_type: 'dice' });
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
    services.gameRulesService.canEndTurn.mockReturnValue(canEndTurn);
    services.cardService.canPlayCard.mockReturnValue(false);
    services.dataService.getCardById.mockReturnValue(null);
  };

  afterEach(() => cleanup());

  const renderAndGetEndSide = () => {
    render(
      <DictionaryProvider>
        <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" onTryAgain={vi.fn()} />
      </DictionaryProvider>,
    );
    return screen.getAllByTestId('commit-side').find((b) => b.getAttribute('data-side') === 'end')!;
  };

  it('before the roll: shows "Take your next step", not the redesign-accept wording', () => {
    setup(false, false);
    const end = renderAndGetEndSide();
    expect(end.textContent).toMatch(/Take your next step/);
    expect(end.textContent).not.toMatch(/Accept the redesign/);
  });

  it('after the roll: the real "Accept the redesign" wording is back', () => {
    setup(true, true);
    const end = renderAndGetEndSide();
    expect(end.textContent).toMatch(/Accept the redesign/);
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

    // Sanity: this really is the reported pairing — the not-ready commit
    // caption shown together with "this turn: ..." in the same control. The
    // caption is now the space's forward label plus a reason sub-line (was
    // "1 action left" until 2026-09-02 — see PlayerPanelV2's commit block).
    expect(button.textContent).toMatch(/^End turnFinish 1 thing above first/);

    // This is what reading raw `.textContent` sees: the TODO's exact shape,
    // because textContent ignores block/flex layout and just concatenates
    // text nodes in DOM order with no separator.
    expect(button.textContent).toContain('Finish 1 thing above firstthis turn:');

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

/**
 * The commit spine must name the gate that is ACTUALLY open.
 *
 * 2026-09-06 and 2026-09-07 robot playtests: all 12 games were abandoned at
 * PM-DECISION-CHECK ("Pick Your Path"). The spine read
 *   Move forward / Finish “Swap one helper for another” above first
 * while the only outstanding requirement was picking a destination. The named
 * action is SKIPPABLE — StateService.calculateRequiredActions leaves
 * replace_/return_/give_ out of `requiredActions` — so doing it could never
 * clear the gate, and the robot clicked the disabled spine three times and quit.
 *
 * Two faults, both covered here:
 *  1. blockingActionLabels included skippable actions, which by construction
 *     can never be what is blocking.
 *  2. `remaining > 0` won the branch race on every choice-movement space
 *     (movement_choice keeps remaining ≥1 until moveIntent is set), so
 *     "Pick where you're going first" was unreachable dead code.
 */
describe('PlayerPanelV2 — commit spine names the gate that is actually open (2026-09-07 playtest)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  // PM-DECISION-CHECK / First, verbatim from SPACE_EFFECTS.csv + MOVEMENT.csv.
  const swapEffect: any = {
    effect_type: 'cards', effect_action: 'replace_e', trigger_type: 'manual',
    condition: '', effect_value: 1, description: 'Swap one helper for another',
    button_label: 'Swap one helper for another',
  };
  // A genuinely required manual action, for contrast — draw_ is not skippable.
  const drawEffect: any = {
    effect_type: 'cards', effect_action: 'draw_e', trigger_type: 'manual',
    condition: '', effect_value: 1, description: 'Bring in more help',
    button_label: 'Bring in more help',
  };

  // The player object the mocks hand out — kept so a test can move them or pick a
  // destination and then re-render, the way the real StateService would.
  let panelPlayer: any;

  const setup = (opts: {
    effects: any[];
    movementType?: string;
    requiredActions: number;
    completedActionCount: number;
    // The engine's "everything else on this space is done" flag. Defaults true —
    // the value every test here used before v3.2.70; the picker tests below set it
    // to match `requiredActions`/`completedActionCount`, as the real engine does.
    movementChoiceUnlocked?: boolean;
  }) => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player: any = {
      id: 'player1', name: 'Test Player', currentSpace: 'PM-DECISION-CHECK',
      visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
      hand: ['E001'], activeCards: [], activeEffects: [], loans: [],
      dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {},
      moveIntent: null,
    };
    panelPlayer = player;
    services.stateService.getPlayer.mockReturnValue(player);
    services.stateService.getGameState.mockReturnValue({
      players: [player], currentPlayerId: 'player1', gamePhase: 'PLAY',
      hasPlayerRolledDice: false, movementChoiceUnlocked: opts.movementChoiceUnlocked ?? true,
      awaitingChoice: opts.movementType === 'choice'
        ? { type: 'MOVEMENT', options: [
            { id: 'LEND-SCOPE-CHECK', label: 'Lender' },
            { id: 'ARCH-INITIATION', label: 'Architect' },
            { id: 'CHEAT-BYPASS', label: 'Shortcut' },
          ] }
        : null,
      requiredActions: opts.requiredActions,
      completedActionCount: opts.completedActionCount,
      completedActions: { diceRoll: undefined, manualActions: {} },
    });
    services.stateService.subscribe.mockReturnValue(() => {});
    services.dataService.getSpaceContent.mockReturnValue({ title: 'Pick Your Path', story: '' });
    services.dataService.getGameConfigBySpace.mockReturnValue({ phase: 'DESIGN' });
    services.dataService.getSpaceEffects.mockReturnValue(opts.effects);
    services.dataService.getMovement.mockReturnValue(
      opts.movementType ? { movement_type: opts.movementType } : undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue(opts.effects);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
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

  it('asks for the destination — not the optional swap — when the pick is the only thing missing', () => {
    // Exactly PM-DECISION-CHECK/First: choice movement (+1 required, 0 completed)
    // and one SKIPPABLE manual action, which contributes nothing to `required`.
    setup({ effects: [swapEffect], movementType: 'choice', requiredActions: 1, completedActionCount: 0 });
    renderPanel();

    expect(screen.getByText(/Pick where you.re going first/i)).toBeInTheDocument();
    // The exact string that stranded 12 of 12 robot playthroughs.
    expect(screen.queryByText(/Swap one helper for another.{0,3} above first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Finish 1 thing above first/i)).not.toBeInTheDocument();
  });

  it('still names a genuinely required action, and does not count the destination pick as one of them', () => {
    // draw_e is required, replace_e is not: required = 1 (draw) + 1 (movement).
    setup({ effects: [drawEffect, swapEffect], movementType: 'choice', requiredActions: 2, completedActionCount: 0 });
    renderPanel();

    // One real blocker outstanding, so it is named — singular, not "2 things".
    expect(screen.getByText(/Finish .Bring in more help. above first/i)).toBeInTheDocument();
    expect(screen.queryByText(/2 things above first/i)).not.toBeInTheDocument();
    // The skippable action is on screen as a button but is never blamed.
    expect(screen.queryByText(/Swap one helper for another.{0,3} above first/i)).not.toBeInTheDocument();
  });

  // fb:ba16e596 — a player who skipped the swap read the open gate as a bug
  // ("I still did not do replace expeditor"). The skippable action says it is
  // optional; the required one does not.
  it('tags a skippable action as optional and leaves a required one untagged', () => {
    setup({ effects: [drawEffect, swapEffect], movementType: 'choice', requiredActions: 2, completedActionCount: 0 });
    renderPanel();

    const buttons = screen.getAllByTestId('action-button');
    const swap = buttons.find((b) => /replace_e/.test(b.getAttribute('data-effect-key') || ''))!;
    const draw = buttons.find((b) => /draw_e/.test(b.getAttribute('data-effect-key') || ''))!;
    expect(swap).toHaveTextContent(/optional/);
    expect(draw).not.toHaveTextContent(/optional/);
    expect(screen.getAllByTestId('action-optional-tag')).toHaveLength(1);
  });

  it('is unchanged on a space with no destination to pick (fixed movement)', () => {
    setup({ effects: [drawEffect], movementType: 'fixed', requiredActions: 1, completedActionCount: 0 });
    renderPanel();

    expect(screen.getByText(/Finish .Bring in more help. above first/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pick where you.re going first/i)).not.toBeInTheDocument();
  });

  /**
   * The drive path the nightly playtest robot needs, pinned to attributes
   * instead of prose.
   *
   * Three consecutive releases each broke a different handle the robot was
   * using, and every one of them was a legitimate improvement to the game:
   *   v3.2.52 renamed "Move — N options" to "…N places to pick from" (the old
   *           wording never said WHICH options — an 8-hit playtest complaint),
   *           and the robot's opener regex went dead. Destination clicks fell
   *           7 → 0 and stayed 0 for three nights on three different seeds.
   *   v3.2.53 rewrote the commit gate's reason line, and the robot's "is this
   *           gated?" check — which keyed on the OLD wording — started handing
   *           a disabled button to the model as if it were live.
   *   v3.2.54 wrapped each action row in a <div> to hang "What's this?" beside
   *           it, breaking a direct-child selector.
   * The game is not going to stop rewriting its own copy — that IS the current
   * workstream — so the handles must not be copy. These assertions exist so the
   * next voice pass fails here, loudly, instead of going quiet at 03:26.
   *
   * This is the exact screen that stranded 18 of 18 robot playthroughs:
   * PM-DECISION-CHECK/First, choice movement outstanding, commit spine gated.
   */
  it('exposes the whole drive path as stable test hooks, not as prose', () => {
    setup({ effects: [swapEffect], movementType: 'choice', requiredActions: 1, completedActionCount: 0 });
    renderPanel();

    // The destination picker's opener, and its open/closed state. Choosing where
    // to go is the ONLY thing left on this screen (the swap is optional), so since
    // v3.2.70 the list is already open when the robot arrives. That is the point —
    // and it means a blind click on the opener would now FOLD the list it needs.
    // The robot reads `aria-expanded`, never assumes.
    const expander = screen.getByTestId('move-expander');
    expect(expander).toHaveAttribute('aria-expanded', 'true');

    // The action that is on screen but skippable — findable without its label.
    expect(screen.getByTestId('action-button')).toBeInTheDocument();

    // The commit spine, and the fact that it cannot be pressed yet. `data-ready`
    // must agree with `disabled`: the robot scores a click that cannot land as a
    // strike, and three strikes end the run.
    const commit = screen.getByTestId('commit-end-turn');
    expect(commit).toHaveAttribute('data-ready', 'false');
    expect(commit).toBeDisabled();

    // Destinations, each carrying its own space id so the robot never has to
    // parse an authored label or a ➡️/✅ glyph.
    const options = screen.getAllByTestId('move-option');
    expect(options.map((o) => o.getAttribute('data-space-id'))).toEqual([
      'LEND-SCOPE-CHECK', 'ARCH-INITIATION', 'CHEAT-BYPASS',
    ]);
    // Unlocked here, so every destination is genuinely pickable. Lockedness is
    // `disabled`/`aria-disabled` — never the glyph, which is ➡️ both when a
    // destination is locked and when it is merely unpicked.
    options.forEach((o) => expect(o).not.toBeDisabled());

    // The opener still works in both directions: fold it, then open it again.
    fireEvent.click(expander);
    expect(expander).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByTestId('move-option')).toHaveLength(0);
    fireEvent.click(expander);
    expect(expander).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('move-option')).toHaveLength(3);
  });

  /**
   * Tom, 2026-09-19 — the destination picker: "narrow". Open it for the player
   * when choosing where to go is the ONLY thing left; keep it folded whenever a
   * real action remains. (He was offered narrow / leave it / always open.)
   *
   * Why: the nightly robot hit a folded picker 13 times (09-08, 09-18). With the
   * real actions done, the commit spine is gated on nothing but the pick, and a
   * folded list hides the one thing left to do. Why not always open: a choice
   * space would look like N more actions (fb:feedback-1782843206015-8edd02b4), and
   * while an action is outstanding it should be the thing the player sees first.
   */
  describe('destination picker opens itself only when choosing is all that is left', () => {
    // Re-render the way the real StateService does: change what the mocks return,
    // then fire the panel's own subscription.
    const pushState = (changes: Record<string, unknown>) => {
      const next = { ...services.stateService.getGameState(), ...changes };
      services.stateService.getGameState.mockReturnValue(next);
      act(() => {
        services.stateService.subscribe.mock.calls.forEach(([cb]: any) => cb());
      });
    };
    const expander = () => screen.getByTestId('move-expander');

    it('is open on arrival when only the pick is left, even with an optional action on screen', () => {
      // PM-DECISION-CHECK/First: one SKIPPABLE swap (contributes nothing to
      // `required`) and choice movement (+1). The swap is on screen; it is not a
      // reason to hide the destinations.
      setup({ effects: [swapEffect], movementType: 'choice', requiredActions: 1, completedActionCount: 0 });
      renderPanel();

      expect(screen.getByTestId('action-button')).toHaveTextContent(/optional/);
      expect(expander()).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getAllByTestId('move-option')).toHaveLength(3);
    });

    it('stays folded while a real action remains', () => {
      // draw_e is required (replace_e is not): required = 1 (draw) + 1 (pick). The
      // engine keeps the destinations locked until the draw is done.
      setup({
        effects: [drawEffect, swapEffect], movementType: 'choice',
        requiredActions: 2, completedActionCount: 0, movementChoiceUnlocked: false,
      });
      renderPanel();

      expect(expander()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryAllByTestId('move-option')).toHaveLength(0);
    });

    it('opens the moment the last real action is done', () => {
      setup({
        effects: [drawEffect, swapEffect], movementType: 'choice',
        requiredActions: 2, completedActionCount: 0, movementChoiceUnlocked: false,
      });
      renderPanel();
      expect(expander()).toHaveAttribute('aria-expanded', 'false');

      // The player finishes the draw: 1 of 2 required done, and the engine
      // unlocks the picker.
      pushState({ completedActionCount: 1, movementChoiceUnlocked: true });

      expect(expander()).toHaveAttribute('aria-expanded', 'true');
      screen.getAllByTestId('move-option').forEach((o) => expect(o).not.toBeDisabled());
    });

    it('leaves a player who folds it alone', () => {
      setup({ effects: [swapEffect], movementType: 'choice', requiredActions: 1, completedActionCount: 0 });
      renderPanel();
      expect(expander()).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(expander());
      expect(expander()).toHaveAttribute('aria-expanded', 'false');

      // Unrelated state churn re-renders the panel; the fold must survive it.
      // (Edge-triggered, not derived — a derived "open while pick-only" would
      // make the opener look dead.)
      pushState({ globalTurnCount: 7 });
      expect(expander()).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not close when a destination is picked', () => {
      // fb:c2e489dc: options stay on screen so the player can change their mind.
      setup({ effects: [swapEffect], movementType: 'choice', requiredActions: 1, completedActionCount: 0 });
      renderPanel();
      expect(expander()).toHaveAttribute('aria-expanded', 'true');

      panelPlayer.moveIntent = 'ARCH-INITIATION';
      pushState({ completedActionCount: 1 });

      expect(expander()).toHaveAttribute('aria-expanded', 'true');
      expect(expander()).toHaveTextContent(/you picked Architect/i);
      expect(screen.getAllByTestId('move-option')).toHaveLength(3);
    });

    it('opens again on the next space where the pick is also all that is left', () => {
      // The player folds the list here, moves on, and arrives somewhere else that
      // is ALSO pick-only. Without forgetting the last space's answer the panel
      // would see "was pick-only: yes, is pick-only: yes" — no change — and leave
      // the new space folded.
      setup({ effects: [swapEffect], movementType: 'choice', requiredActions: 1, completedActionCount: 0 });
      renderPanel();
      fireEvent.click(expander());
      expect(expander()).toHaveAttribute('aria-expanded', 'false');

      panelPlayer.currentSpace = 'ARCH-SCOPE-CHECK';
      pushState({ globalTurnCount: 8 });

      expect(expander()).toHaveAttribute('aria-expanded', 'true');
    });
  });
});

/**
 * Teaching layer — the per-action "What's this?" disclosure (Onboarding Phase C).
 *
 * The structural point, and the reason this is a SIBLING of the action button
 * rather than anything inside it: TextWithTerms renders a glossary term as
 * <span role="button"> with stopPropagation(), so a term nested inside a real
 * <button> swallows the press. That constraint is why v3.2.51 put plain words on
 * the buttons — which taught a beginner what to press and nothing about what it
 * meant. Explaining alongside the button is the only place the two can coexist.
 */
describe('PlayerPanelV2 — "What\'s this?" action explanations (Onboarding Phase C)', () => {
  let services: ReturnType<typeof createAllMockServices>;

  const drawEffect: any = {
    effect_type: 'cards', effect_action: 'draw_e', trigger_type: 'manual',
    condition: '', effect_value: 1, description: 'Expeditors speed up approvals.',
    button_label: 'Bring in extra help',
  };

  const setup = (effects: any[] = [drawEffect]) => {
    vi.clearAllMocks();
    services = createAllMockServices();
    const player: any = {
      id: 'player1', name: 'Test Player', currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First', money: 100000, timeSpent: 5, color: '#007bff',
      hand: ['E001'], activeCards: [], activeEffects: [], loans: [],
      dobApprovalStatus: 'none', fdnyApprovalStatus: 'none', moneySources: {}, moveIntent: null,
    };
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
    services.dataService.getSpaceEffects.mockReturnValue(effects);
    services.dataService.getMovement.mockReturnValue(undefined);
    services.turnService.filterSpaceEffectsByCondition.mockReturnValue(effects);
    services.gameRulesService.canEndTurn.mockReturnValue(false);
    services.cardService.canPlayCard.mockReturnValue(false);
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

  it('offers an explanation per action, named for the question a beginner asks', () => {
    setup();
    renderPanel();
    // Its accessible name carries the action it belongs to, so a screen-reader
    // user hears which "What's this?" this is — there is one per row.
    expect(screen.getByRole('button', { name: /What's this\? Bring in extra help/i })).toBeInTheDocument();
  });

  it('is closed until asked, then reveals the authored explanation', () => {
    setup();
    renderPanel();
    const why = screen.getByRole('button', { name: /What's this\? Bring in extra help/i });

    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Expeditors speed up approvals/i)).not.toBeInTheDocument();

    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Expeditors speed up approvals/i)).toBeInTheDocument();

    fireEvent.click(why);
    expect(screen.queryByText(/Expeditors speed up approvals/i)).not.toBeInTheDocument();
  });

  it('does not intercept the action button it explains', () => {
    setup();
    renderPanel();
    // Opening the explanation must leave the action itself pressable — the whole
    // reason the disclosure is a sibling and not a child.
    fireEvent.click(screen.getByRole('button', { name: /What's this\? Bring in extra help/i }));
    fireEvent.click(screen.getByRole('button', { name: /^⚡?\s*Bring in extra help$/i }));
    expect(services.turnService.triggerManualEffectWithFeedback).toHaveBeenCalled();
  });

  /**
   * Dice actions (v3.2.69). Before this, the "?" on a dice button opened a box
   * that repeated the button's own label — tapping it on "See what he wants
   * built" said "See what he wants built." — so the row a beginner most needs
   * explained was the one that explained nothing. These render the REAL
   * ACTION_TOOLTIPS.csv through the real component; the unit-level guard is
   * tests/utils/actionTooltips.test.ts.
   */
  describe('dice actions', () => {
    const TOOLTIPS_CSV = readFileSync(
      join(process.cwd(), 'public', 'data', 'CLEAN_FILES', 'ACTION_TOOLTIPS.csv'), 'utf-8');

    const diceRow = (effect_value: string, button_label: string): any => ({
      effect_type: 'dice', effect_action: 'dice_outcome', trigger_type: 'manual',
      condition: '', effect_value, description: button_label, button_label,
    });

    // tests/vitest.setup.ts resets this singleton after EVERY test, so it is
    // loaded per test here rather than once.
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true, text: () => Promise.resolve(TOOLTIPS_CSV),
      }) as unknown as typeof fetch;
      await initializeTooltipService().loadTooltips();
    });
    afterEach(() => resetTooltipService());

    it('explains what pressing it decides, not just what it is called', () => {
      setup([diceRow('Time outcomes', 'See how long it slows you')]);
      renderPanel();

      fireEvent.click(screen.getByRole('button', { name: /What's this\? See how long it slows you/i }));

      expect(screen.getByText(/Some steps take longer than you planned for/i)).toBeInTheDocument();
      expect(screen.getByText(/Days you spend count against your final score/i)).toBeInTheDocument();
    });

    it('a merged button explains BOTH outcomes it fires', () => {
      // Investor Review: two dice rows share one roll, so the panel shows ONE
      // "See what happens" button — which decides how much they put in AND how
      // long they take. Explaining only the first would be a half-truth.
      setup([
        diceRow('I Cards', "See what they'll put in"),
        diceRow('Time outcomes', 'See how long they take'),
      ]);
      renderPanel();

      expect(screen.getAllByTestId('action-button')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: /What's this\? See what happens/i }));

      expect(screen.getByText(/how much they put in/i)).toBeInTheDocument();
      expect(screen.getByText(/how many days this step costs you/i)).toBeInTheDocument();
    });

    it('keeps a blank line between the two explanations', () => {
      setup([
        diceRow('I Cards', "See what they'll put in"),
        diceRow('Time outcomes', 'See how long they take'),
      ]);
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: /What's this\? See what happens/i }));

      // Two authored paragraphs are joined with "\n\n"; without pre-line the
      // browser folds that to a single space and they read as one run-on.
      const box = screen.getByText(/how much they put in/i).closest('[style*="pre-line"]');
      expect(box).not.toBeNull();
      expect(box!.textContent).toMatch(/put in\.\s*Some steps take longer/);
      expect(box!.textContent).toContain('\n\n');
    });

    it('the contractor pair gets its own combined text', () => {
      setup([
        diceRow('Quality', 'See how good his work is'),
        diceRow('Multiplier', 'See what it adds up to'),
      ]);
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: /What's this\? See what happens/i }));

      expect(screen.getByText(/Two things get decided here/i)).toBeInTheDocument();
      expect(screen.getByText(/Better crews cost more up front but finish sooner/i)).toBeInTheDocument();
    });
  });
});
