// src/utils/endGameLoss.ts
//
// The headline for a game that ENDED IN A LOSS (bankruptcy / the 20% design-fee cap), shared by
// the end-of-game popup and the shared TV screen so the two can never disagree. The TV used to
// say "<first player> Wins!" for every ending, even when that player had just lost
// (fb:ef974f1c, 2026-09-27: "the TV says Sunday wins... but I lost").

import type { GameEndReason } from '../types/StateTypes';

export function lossTitle(reason: GameEndReason): string {
  return reason.type === 'bankruptcy' ? 'The project went under' : 'The design budget sank the project';
}

/** One plain line for a loss, naming the player (works solo and shared screen alike). */
export function lossLine(reason: GameEndReason, playerName: string): string {
  return reason.type === 'bankruptcy'
    ? `${playerName} ran out of money — a bill came due with nothing left to pay it.`
    : `${playerName}'s design fees passed 20% of the project's scope.`;
}

export interface GameOverHeadline {
  kind: 'win' | 'loss' | 'over';
  /** The big line. */
  title: string;
  /** A smaller line under it, if any. */
  detail?: string;
  /** The player the headline is about, for their avatar. */
  playerId?: string;
}

/** What the shared screen should say when the game is over. Falls back to a plain "Game over". */
export function getGameOverHeadline(
  state: { winner?: string; gameEndReason?: GameEndReason },
  players: Array<{ id: string; name: string }>,
): GameOverHeadline {
  const nameOf = (id: string | undefined) => players.find((p) => p.id === id)?.name;
  if (state.winner) {
    const name = nameOf(state.winner);
    if (name) return { kind: 'win', title: `${name} Wins!`, playerId: state.winner };
  }
  if (state.gameEndReason) {
    const name = nameOf(state.gameEndReason.playerId) ?? 'The team';
    return {
      kind: 'loss',
      title: lossTitle(state.gameEndReason),
      detail: lossLine(state.gameEndReason, name),
      playerId: state.gameEndReason.playerId,
    };
  }
  return { kind: 'over', title: 'Game over' };
}
