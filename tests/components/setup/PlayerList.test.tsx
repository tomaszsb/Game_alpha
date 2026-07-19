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
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { PlayerList } from '../../../src/components/setup/PlayerList';
import { createTestPlayer } from '../../fixtures/testData';
import { colors } from '../../../src/styles/theme';

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
