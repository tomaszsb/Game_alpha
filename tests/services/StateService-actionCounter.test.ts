// Locks the v3.0.4 fix that counts choice-based movement as a required action
// in StateService.calculateRequiredActions.
//
// Background: at a `choice`-movement space (e.g. PM-DECISION-CHECK), the
// player must pick a destination before ending the turn. canEndTurn already
// gates on player.moveIntent, but `requiredActions` previously only counted
// the dice block + manual effects — so the End Turn tooltip claimed
// "1 action remaining" while both the manual effect button AND the destination
// prompt were still visible. fb:feedback-1778642151553-ffff07e2.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { LoggingService } from '../../src/services/LoggingService';
import { GameRulesService } from '../../src/services/GameRulesService';
import { Player } from '../../src/types/StateTypes';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Player 1',
    color: '#ff0000',
    avatar: '',
    currentSpace: 'PM-DECISION-CHECK',
    visitType: 'First',
    money: 0,
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    timeSpent: 0,
    hand: [],
    activeCards: [],
    discardedCards: [],
    transactionHistory: [],
    log: [],
    completedActions: { manualActions: {} },
    skipNextTurn: false,
    skipNextTurnReason: null,
    ...overrides,
  } as unknown as Player;
}

describe('StateService.updateActionCounts — choice-movement spaces', () => {
  let stateService: StateService;
  let dataService: any;

  beforeEach(() => {
    dataService = {
      isLoaded: vi.fn().mockReturnValue(true),
      getGameConfig: vi.fn().mockReturnValue([{
        space_name: 'PM-DECISION-CHECK',
        is_starting_space: false,
        starting_money: 0,
        starting_cards: [],
        min_players: 1,
        max_players: 4,
      }]),
      getGameConfigBySpace: vi.fn().mockReturnValue({
        space_name: 'PM-DECISION-CHECK',
        requires_dice_roll: false,
        phase: 'DESIGN',
      }),
      getMovement: vi.fn(),
      getSpaceEffects: vi.fn().mockReturnValue([]),
      getSpaceContent: vi.fn(),
      getCardsByType: vi.fn().mockReturnValue([]),
      getDiceOutcome: vi.fn(),
      getAllDiceOutcomes: vi.fn().mockReturnValue([]),
      getAllSpaces: vi.fn().mockReturnValue([]),
    };

    stateService = new StateService(dataService);

    // Plug in a GameRulesService that always evaluates conditions to true so
    // condition-filtering doesn't drop our manual-effect rows.
    const fakeRules = {
      evaluateCondition: vi.fn().mockReturnValue(true),
    } as unknown as GameRulesService;
    (stateService as any).gameRulesService = fakeRules;

    // Seed initial game state with a player at PM-DECISION-CHECK.
    const player = makePlayer();
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [player],
      currentPlayerId: player.id,
      gamePhase: 'PLAY',
    });
  });

  it('counts an unresolved choice-movement as +1 required action', () => {
    dataService.getMovement.mockReturnValue({
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      movement_type: 'choice',
      destinations: ['LEND-SCOPE-CHECK', 'ARCH-INITIATION', 'CHEAT-BYPASS'],
    });
    // One manual cards effect — the "expeditor" action from the report.
    dataService.getSpaceEffects.mockReturnValue([{
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      effect_type: 'cards',
      effect_action: 'draw_e',
      effect_value: '1',
      description: 'Hire 1 Expeditor',
      trigger_type: 'manual',
      condition: '',
    }]);

    stateService.updateActionCounts();
    const state = stateService.getGameState();

    // Expected: 1 (manual cards) + 1 (movement choice) = 2 required, 0 completed.
    expect(state.requiredActions).toBe(2);
    expect(state.completedActionCount).toBe(0);
    expect(state.availableActionTypes).toContain('movement_choice');
    expect(state.availableActionTypes).toContain('cards_manual');
  });

  it('marks the choice-movement complete once moveIntent is set', () => {
    dataService.getMovement.mockReturnValue({
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      movement_type: 'choice',
      destinations: ['LEND-SCOPE-CHECK'],
    });
    dataService.getSpaceEffects.mockReturnValue([]);

    const player = makePlayer({ moveIntent: 'LEND-SCOPE-CHECK' } as any);
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [player],
      currentPlayerId: player.id,
    });

    stateService.updateActionCounts();
    const state = stateService.getGameState();

    expect(state.requiredActions).toBe(1);
    expect(state.completedActionCount).toBe(1);
  });

  it('does not double-count dice movement (already counted via dice block)', () => {
    // Override the space config to require a dice roll (CHEAT-BYPASS pattern).
    dataService.getGameConfigBySpace.mockReturnValue({
      space_name: 'CHEAT-BYPASS',
      requires_dice_roll: true,
      phase: 'CONSTRUCTION',
    });
    dataService.getMovement.mockReturnValue({
      space_name: 'CHEAT-BYPASS',
      visit_type: 'First',
      movement_type: 'dice',
      destinations: [],
    });
    dataService.getSpaceEffects.mockReturnValue([]);

    const player = makePlayer({ currentSpace: 'CHEAT-BYPASS' });
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [player],
      currentPlayerId: player.id,
    });

    stateService.updateActionCounts();
    const state = stateService.getGameState();

    // Only the dice action is required; no movement_choice slot added.
    expect(state.requiredActions).toBe(1);
    expect(state.availableActionTypes).toContain('dice');
    expect(state.availableActionTypes).not.toContain('movement_choice');
  });

  it('does not count skippable expeditor actions (replace/return/give) as required', () => {
    // Regression (v3.0.x): an optional expeditor swap (replace_e) was counted as
    // a required action, so backing out of its modal left Move disabled — a
    // dead-end. It must surface the button (cards_manual) but not gate the move.
    dataService.getGameConfigBySpace.mockReturnValue({
      space_name: 'PM-DECISION-CHECK',
      requires_dice_roll: false,
    });
    dataService.getMovement.mockReturnValue({
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      movement_type: 'fixed',
      destinations: ['ARCH-INITIATION'],
    });
    dataService.getSpaceEffects.mockReturnValue([{
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      effect_type: 'cards',
      effect_action: 'replace_e',
      effect_value: '1',
      description: 'Replace Expeditor',
      trigger_type: 'manual',
      condition: '',
    }]);

    stateService.updateActionCounts();
    const state = stateService.getGameState();

    expect(state.requiredActions).toBe(0);
    expect(state.availableActionTypes).toContain('cards_manual');
  });

  it('does not count "fixed" / "logic" / "none" movement types', () => {
    for (const movement_type of ['fixed', 'logic', 'none'] as const) {
      dataService.getMovement.mockReturnValue({
        space_name: 'PM-DECISION-CHECK',
        visit_type: 'First',
        movement_type,
        destinations: ['ANY-DEST'],
      });
      dataService.getSpaceEffects.mockReturnValue([]);
      dataService.getGameConfigBySpace.mockReturnValue({
        space_name: 'PM-DECISION-CHECK',
        requires_dice_roll: false,
      });

      stateService.updateActionCounts();
      const state = stateService.getGameState();

      expect(state.availableActionTypes, `movement_type=${movement_type}`).not.toContain('movement_choice');
      expect(state.requiredActions, `movement_type=${movement_type}`).toBe(0);
    }
  });
});

// v3.0.62 (fb:55b6626f) — movement choice "show last" gate. Hides the
// destination picker on choice-movement spaces until every other required
// action is complete. Tests below pin the flag-setting logic.
describe('StateService.updateActionCounts — movementChoiceUnlocked flag', () => {
  let stateService: StateService;
  let dataService: any;

  beforeEach(() => {
    dataService = {
      isLoaded: vi.fn().mockReturnValue(true),
      getGameConfig: vi.fn().mockReturnValue([{
        space_name: 'PM-DECISION-CHECK',
        is_starting_space: false,
        starting_money: 0,
        starting_cards: [],
        min_players: 1,
        max_players: 4,
      }]),
      getGameConfigBySpace: vi.fn().mockReturnValue({
        space_name: 'PM-DECISION-CHECK',
        requires_dice_roll: false,
        phase: 'DESIGN',
      }),
      getMovement: vi.fn(),
      getSpaceEffects: vi.fn().mockReturnValue([]),
      getSpaceContent: vi.fn(),
      getCardsByType: vi.fn().mockReturnValue([]),
      getDiceOutcome: vi.fn(),
      getAllDiceOutcomes: vi.fn().mockReturnValue([]),
      getAllSpaces: vi.fn().mockReturnValue([]),
    };

    stateService = new StateService(dataService);
    (stateService as any).gameRulesService = {
      evaluateCondition: vi.fn().mockReturnValue(true),
    };
  });

  function seedPlayerAndCompute(player: Player) {
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [player],
      currentPlayerId: player.id,
      gamePhase: 'PLAY',
    });
    stateService.updateActionCounts();
    return stateService.getGameState();
  }

  it('locks the gate (false) while non-movement required actions remain', () => {
    dataService.getMovement.mockReturnValue({
      movement_type: 'choice',
      destinations: ['LEND-SCOPE-CHECK', 'ARCH-INITIATION'],
    });
    // One manual cards effect still pending.
    dataService.getSpaceEffects.mockReturnValue([{
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      effect_type: 'cards',
      effect_action: 'draw_e',
      effect_value: '1',
      description: 'Hire Expeditor',
      trigger_type: 'manual',
      condition: '',
    }]);

    const state = seedPlayerAndCompute(makePlayer());

    expect(state.requiredActions).toBe(2);
    expect(state.completedActionCount).toBe(0);
    expect(state.movementChoiceUnlocked).toBe(false);
  });

  it('unlocks the gate (true) once non-movement actions are completed', () => {
    dataService.getMovement.mockReturnValue({
      movement_type: 'choice',
      destinations: ['LEND-SCOPE-CHECK'],
    });
    dataService.getSpaceEffects.mockReturnValue([{
      space_name: 'PM-DECISION-CHECK',
      visit_type: 'First',
      effect_type: 'cards',
      effect_action: 'draw_e',
      effect_value: '1',
      description: 'Hire Expeditor',
      trigger_type: 'manual',
      condition: '',
    }]);

    // Seed the manual effect as already completed.
    const state0 = stateService.getGameState();
    stateService.setGameState({
      ...state0,
      players: [makePlayer()],
      currentPlayerId: 'p1',
      gamePhase: 'PLAY',
      completedActions: { ...state0.completedActions, manualActions: { 'cards:draw_e': 'Hire Expeditor' } },
    });
    stateService.updateActionCounts();
    const state = stateService.getGameState();

    expect(state.completedActionCount).toBe(1); // manual done
    expect(state.movementChoiceUnlocked).toBe(true); // gate opens
  });

  it('unlocks immediately on pure-choice spaces (no other required actions)', () => {
    dataService.getMovement.mockReturnValue({
      movement_type: 'choice',
      destinations: ['LEND-SCOPE-CHECK', 'ARCH-INITIATION'],
    });
    dataService.getSpaceEffects.mockReturnValue([]); // nothing else required

    const state = seedPlayerAndCompute(makePlayer());

    expect(state.requiredActions).toBe(1); // just movement_choice
    expect(state.movementChoiceUnlocked).toBe(true);
  });

  it('defaults to unlocked (true) on non-choice movement spaces', () => {
    dataService.getMovement.mockReturnValue({
      movement_type: 'fixed',
      destinations: ['ARCH-INITIATION'],
    });

    const state = seedPlayerAndCompute(makePlayer());

    expect(state.availableActionTypes).not.toContain('movement_choice');
    expect(state.movementChoiceUnlocked).toBe(true);
  });

  it('stays unlocked once player sets moveIntent (gate is monotonic forward)', () => {
    dataService.getMovement.mockReturnValue({
      movement_type: 'choice',
      destinations: ['LEND-SCOPE-CHECK'],
    });
    dataService.getSpaceEffects.mockReturnValue([]); // pure choice space

    const state = seedPlayerAndCompute(makePlayer({ moveIntent: 'LEND-SCOPE-CHECK' } as any));

    expect(state.completedActionCount).toBe(1);
    expect(state.movementChoiceUnlocked).toBe(true);
  });
});

// Regression for fb:feedback-1784464219688-ae480630 ("Next-action button
// highlight disappears... maybe when switching the player panel between
// mobile and PC"). Root cause: updateActionCounts() is the ONLY notify (and
// thus the only server-sync trigger, via notifyListeners' debouncedSync) for
// setPlayerHasMoved / setPlayerCompletedManualAction / setPlayerHasRolledDice
// — none of those call notifyListeners() themselves. It used to return
// early — skipping notifyListeners() entirely — whenever there was no
// current player or the data service hadn't finished loading, both of which
// are reachable mid-game (a turn-transition racing a manual-action
// completion, a client still mid-load). That silently dropped the UI
// refresh (the "what to press next" hint staying stuck on stale data) AND
// the sync to any other screen/device watching the same game. The fix:
// updateActionCounts() now always calls notifyListeners(), and only SKIPS
// the requiredActions/movementChoiceUnlocked recompute when there's no
// valid current player or data isn't loaded yet.
describe('StateService.updateActionCounts — always notifies (fb:feedback-1784464219688-ae480630)', () => {
  let stateService: StateService;
  let dataService: any;

  beforeEach(() => {
    dataService = {
      isLoaded: vi.fn().mockReturnValue(true),
      getGameConfig: vi.fn().mockReturnValue([]),
      getGameConfigBySpace: vi.fn().mockReturnValue({ requires_dice_roll: false }),
      getMovement: vi.fn().mockReturnValue(undefined),
      getSpaceEffects: vi.fn().mockReturnValue([]),
      getSpaceContent: vi.fn(),
      getCardsByType: vi.fn().mockReturnValue([]),
      getDiceOutcome: vi.fn(),
      getAllDiceOutcomes: vi.fn().mockReturnValue([]),
      getAllSpaces: vi.fn().mockReturnValue([]),
    };

    stateService = new StateService(dataService);
    (stateService as any).gameRulesService = {
      evaluateCondition: vi.fn().mockReturnValue(true),
    };
  });

  it('notifies subscribers even with no currentPlayerId set', () => {
    stateService.setGameState({
      ...stateService.getGameState(),
      currentPlayerId: null,
      gamePhase: 'PLAY',
    });
    const listener = vi.fn();
    stateService.subscribe(listener);

    stateService.updateActionCounts();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when currentPlayerId points at a player not in the players array', () => {
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [],
      currentPlayerId: 'ghost-player',
      gamePhase: 'PLAY',
    });
    const listener = vi.fn();
    stateService.subscribe(listener);

    stateService.updateActionCounts();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when the data service has not finished loading yet', () => {
    const player = makePlayer();
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [player],
      currentPlayerId: player.id,
      gamePhase: 'PLAY',
    });
    dataService.isLoaded.mockReturnValue(false);
    const listener = vi.fn();
    stateService.subscribe(listener);

    stateService.updateActionCounts();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('still skips the requiredActions/movementChoiceUnlocked recompute when there is no valid current player', () => {
    stateService.setGameState({
      ...stateService.getGameState(),
      players: [],
      currentPlayerId: null,
      gamePhase: 'PLAY',
      requiredActions: 3,
      completedActionCount: 1,
    });

    stateService.updateActionCounts();
    const state = stateService.getGameState();

    // Unchanged — there's no valid player to recompute counts from, so the
    // fix only guarantees the NOTIFY still fires, not a (meaningless) recompute.
    expect(state.requiredActions).toBe(3);
    expect(state.completedActionCount).toBe(1);
  });

  it('a manual-action completion (setPlayerCompletedManualAction) still reaches subscribers when currentPlayerId is unset — this is the exact path the reported highlight bug goes through', () => {
    // setPlayerCompletedManualAction has no notifyListeners() call of its
    // own — it relies entirely on updateActionCounts() to notify. Before the
    // fix, an unset currentPlayerId at this exact moment (e.g. a turn
    // transition racing the async manual-effect completion) meant this
    // subscriber — and the server sync that keeps other screens/devices in
    // sync — never fired, so the UI (and any other connected screen) kept
    // showing stale "things you can do" state instead of picking up the
    // completed action.
    stateService.setGameState({
      ...stateService.getGameState(),
      currentPlayerId: null,
      gamePhase: 'PLAY',
    });
    const listener = vi.fn();
    stateService.subscribe(listener);

    stateService.setPlayerCompletedManualAction('cards:draw_e', 'Hire 1 Expeditor');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].completedActions.manualActions['cards:draw_e']).toBe('Hire 1 Expeditor');
  });
});
