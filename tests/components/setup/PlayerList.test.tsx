/**
 * PlayerList.test.tsx
 *
 * Covers the PC (non-compact) 8-swatch color picker's "taken color" handling
 * (fb:d6bbcb00 — "Blue is unavailable because player one has it... not very
 * pronounced on my chooser that blue is unavailable"). Before the fix, a
 * swatch already claimed by another player rendered fully opaque and
 * clickable; clicking it triggered StateService's resolveConflicts(), which
 * silently reassigned the color right back — a no-op with zero feedback.
 * Now a taken swatch is dimmed, non-interactive, and its title/aria-label
 * names whose color it is.
 *
 * Also covers player-name persistence on the setup screen (TODO item, from a
 * Playwright playtest of game.unravelcodes.com: "both players remained
 * 'Player 1' / 'Player 2' throughout despite typed names"). The name
 * `<input>` here is a standard React-controlled input
 * (value={player.name} / onChange={... onUpdatePlayer(...)}) — real user
 * input (typing, or a simulated `input`/`change` event) always fires
 * onChange. The suite below proves that with a real StateService instance
 * wired through the exact same subscribe/updatePlayer pattern PlayerSetup.tsx
 * uses in production, a typed name persists and is never reverted back to
 * the "Player N" default. A second test demonstrates why the ORIGINAL
 * Playwright script likely saw the bug: a raw DOM `.value =` assignment that
 * never dispatches a native event bypasses React's synthetic event system
 * entirely, so onChange (and therefore StateService.updatePlayer) never
 * fires — that is a test-harness artifact, not a bug in this component.
 * @vitest-environment jsdom
 */

import React, { useEffect, useState } from 'react';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { PlayerList } from '../../../src/components/setup/PlayerList';
import { createTestPlayer } from '../../fixtures/testData';
import { colors } from '../../../src/styles/theme';
import { StateService } from '../../../src/services/StateService';
import { createMockDataService } from '../../mocks/mockServices';
import { Player } from '../../../src/types/StateTypes';

// The PC picker's card wrapper is identified by its own inline styling
// (border-radius: 12px + a colored border) — same technique used to verify
// this live in the browser during development of the fix.
const findPlayerCard = (displayName: string): HTMLElement => {
  const input = screen.getByDisplayValue(displayName);
  const card = input.closest('div[style*="border-radius: 12px"]');
  if (!card) throw new Error(`Could not find player card for "${displayName}"`);
  return card as HTMLElement;
};

describe('PlayerList — PC (non-compact) color picker taken-color handling', () => {
  afterEach(() => {
    cleanup();
  });

  const alice = createTestPlayer({
    id: 'p1',
    name: 'Alice',
    color: colors.game.player1, // Blue
    avatar: '👤'
  });
  const bob = createTestPlayer({
    id: 'p2',
    name: 'Bob',
    color: colors.game.player2, // Green
    avatar: '👤'
  });

  const renderList = (onUpdatePlayer = vi.fn()) => {
    render(
      <PlayerList
        players={[alice, bob]}
        onUpdatePlayer={onUpdatePlayer}
        onRemovePlayer={vi.fn()}
        onCycleAvatar={vi.fn()}
        canRemovePlayer={true}
        hideQR={true}
      />
    );
    return onUpdatePlayer;
  };

  it('renders another player\'s taken color as disabled with their name in the title/aria-label', () => {
    renderList();
    const bobCard = findPlayerCard('Bob');

    // Blue is Alice's color; in Bob's picker it should show as taken by Alice.
    const takenSwatch = within(bobCard).getByTitle('Taken by Alice');
    expect(takenSwatch).toBeDisabled();
    expect(takenSwatch).toHaveAttribute('aria-label', 'Blue color, taken by Alice');
    expect(takenSwatch).toHaveStyle({ cursor: 'not-allowed' });
  });

  it('does not call onUpdatePlayer when a taken swatch is clicked (no more silent reassignment)', () => {
    const onUpdatePlayer = renderList();
    const bobCard = findPlayerCard('Bob');

    const takenSwatch = within(bobCard).getByTitle('Taken by Alice');
    fireEvent.click(takenSwatch);

    expect(onUpdatePlayer).not.toHaveBeenCalled();
  });

  it('still allows picking a genuinely available color (no regression)', () => {
    const onUpdatePlayer = renderList();
    const bobCard = findPlayerCard('Bob');

    const redSwatch = within(bobCard).getByTitle('Red');
    expect(redSwatch).not.toBeDisabled();
    fireEvent.click(redSwatch);

    expect(onUpdatePlayer).toHaveBeenCalledWith('p2', 'color', colors.game.player3);
  });

  it("does not mark a player's own current color as taken in their own picker", () => {
    renderList();
    const aliceCard = findPlayerCard('Alice');

    const ownSwatch = within(aliceCard).getByTitle('Blue');
    expect(ownSwatch).not.toBeDisabled();
    expect(ownSwatch).toHaveAttribute('aria-label', 'Select Blue color');
  });

  it('re-enables a color once the player holding it switches away from it', () => {
    const { rerender } = render(
      <PlayerList
        players={[alice, bob]}
        onUpdatePlayer={vi.fn()}
        onRemovePlayer={vi.fn()}
        onCycleAvatar={vi.fn()}
        canRemovePlayer={true}
        hideQR={true}
      />
    );

    // Bob moves from Green to Red — Green should become available again.
    const bobNowRed = { ...bob, color: colors.game.player3 };
    rerender(
      <PlayerList
        players={[alice, bobNowRed]}
        onUpdatePlayer={vi.fn()}
        onRemovePlayer={vi.fn()}
        onCycleAvatar={vi.fn()}
        canRemovePlayer={true}
        hideQR={true}
      />
    );

    const aliceCard = findPlayerCard('Alice');
    const greenSwatch = within(aliceCard).getByTitle('Green');
    expect(greenSwatch).not.toBeDisabled();
    expect(greenSwatch).toHaveAttribute('aria-label', 'Select Green color');

    const redSwatch = within(aliceCard).getByTitle('Taken by Bob');
    expect(redSwatch).toBeDisabled();
  });
});

/**
 * Builds a real StateService instance the same way tests/services/StateService.test.ts
 * does (mocked DataService, one starting-space config entry) — no mocking of
 * updatePlayer/subscribe themselves, so the production persistence logic runs
 * for real.
 */
function createTestStateService(): StateService {
  const mockDataService = createMockDataService();
  mockDataService.isLoaded.mockReturnValue(true);
  mockDataService.getGameConfig.mockReturnValue([
    {
      space_name: 'OWNER-SCOPE-INITIATION',
      phase: 'SETUP',
      path_type: 'A',
      is_starting_space: true,
      is_ending_space: false,
      min_players: 1,
      max_players: 4,
      requires_dice_roll: false
    }
  ]);
  mockDataService.getMovement.mockReturnValue(undefined);
  mockDataService.getCardsByType.mockReturnValue([]);
  return new StateService(mockDataService);
}

/**
 * Reproduces PlayerSetup.tsx's actual wiring (see its `players` useState +
 * the stateService.subscribe(...) useEffect, and handleUpdatePlayer) around
 * PlayerList — minus the surrounding setup-screen chrome (header, GitHub
 * sync badge, admin drawer, etc.) that isn't relevant to the name-persistence
 * question. The stateService prop is a real StateService, not a mock, so
 * this exercises the same subscribe -> setPlayers -> re-render loop the
 * production screen uses.
 */
function PlayerSetupHarness({
  stateService,
  compact = false
}: {
  stateService: StateService;
  compact?: boolean;
}): JSX.Element {
  const [players, setPlayers] = useState<Player[]>(() => stateService.getGameState().players);

  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setPlayers(gameState.players);
    });
    setPlayers(stateService.getGameState().players);
    return unsubscribe;
  }, [stateService]);

  const handleUpdatePlayer = (playerId: string, property: string, value: string) => {
    stateService.updatePlayer({ id: playerId, [property]: value });
  };

  return (
    <PlayerList
      players={players}
      onUpdatePlayer={handleUpdatePlayer}
      onRemovePlayer={vi.fn()}
      onCycleAvatar={vi.fn()}
      canRemovePlayer={true}
      hideQR={true}
      compact={compact}
    />
  );
}

describe('PlayerList — player-name persistence on the setup screen (TODO: "both players remained Player 1/Player 2")', () => {
  afterEach(() => {
    cleanup();
  });

  it('persists a typed name through the real StateService subscribe/updatePlayer path (simulated real user input)', () => {
    const stateService = createTestStateService();
    stateService.addPlayer('Player 1');
    stateService.addPlayer('Player 2');

    render(<PlayerSetupHarness stateService={stateService} />);

    const player1Input = screen.getByDisplayValue('Player 1');
    fireEvent.change(player1Input, { target: { value: 'Alice' } });

    // The input re-renders showing the typed name, not the default...
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Player 1')).not.toBeInTheDocument();

    // ...and it actually persisted in StateService (not just local component
    // state), matching what a real user typing a name should produce.
    expect(stateService.getGameState().players[0].name).toBe('Alice');
  });

  it('persists names typed for BOTH players independently (the exact reported symptom was both staying default)', () => {
    const stateService = createTestStateService();
    stateService.addPlayer('Player 1');
    stateService.addPlayer('Player 2');

    render(<PlayerSetupHarness stateService={stateService} />);

    fireEvent.change(screen.getByDisplayValue('Player 1'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByDisplayValue('Player 2'), { target: { value: 'Bob' } });

    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Player 1')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Player 2')).not.toBeInTheDocument();

    const [p1, p2] = stateService.getGameState().players;
    expect(p1.name).toBe('Alice');
    expect(p2.name).toBe('Bob');
  });

  it('persists a typed name in the compact (TV-mode) input variant too', () => {
    const stateService = createTestStateService();
    stateService.addPlayer('Player 1');

    render(<PlayerSetupHarness stateService={stateService} compact />);

    fireEvent.change(screen.getByDisplayValue('Player 1'), { target: { value: 'Casey' } });

    expect(screen.getByDisplayValue('Casey')).toBeInTheDocument();
    expect(stateService.getGameState().players[0].name).toBe('Casey');
  });

  it('does not revert an edited name back to the default after further, unrelated state updates (e.g. a color change)', () => {
    const stateService = createTestStateService();
    stateService.addPlayer('Player 1');

    render(<PlayerSetupHarness stateService={stateService} />);

    fireEvent.change(screen.getByDisplayValue('Player 1'), { target: { value: 'Alice' } });
    expect(stateService.getGameState().players[0].name).toBe('Alice');

    // An unrelated update (money) must not resurrect the "Player N" default —
    // guards against a stale-default-regeneration regression anywhere in
    // updatePlayer/resolveConflicts.
    const playerId = stateService.getGameState().players[0].id;
    stateService.updatePlayer({ id: playerId, money: 250 });

    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(stateService.getGameState().players[0].name).toBe('Alice');
  });

  it('demonstrates the Playwright-artifact theory: a raw DOM value assignment with no dispatched event never reaches onChange', () => {
    // This is what `element.value = 'Alice'` does under the hood in a
    // Playwright/browser automation script that sets the property directly
    // instead of typing or dispatching a native `input`/`change` event: it
    // mutates the DOM node without going through React's synthetic event
    // system, so the component's onChange (and therefore
    // StateService.updatePlayer) is never invoked.
    const onUpdatePlayer = vi.fn();
    const player = createTestPlayer({ id: 'p1', name: 'Player 1' });

    render(
      <PlayerList
        players={[player]}
        onUpdatePlayer={onUpdatePlayer}
        onRemovePlayer={vi.fn()}
        onCycleAvatar={vi.fn()}
        canRemovePlayer={true}
        hideQR={true}
      />
    );

    const input = screen.getByDisplayValue('Player 1') as HTMLInputElement;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    nativeInputValueSetter.call(input, 'Alice');
    // Deliberately NOT dispatching an 'input' or 'change' event — this is
    // the crux of the artifact: React never finds out the value changed.

    expect(onUpdatePlayer).not.toHaveBeenCalled();
  });
});
