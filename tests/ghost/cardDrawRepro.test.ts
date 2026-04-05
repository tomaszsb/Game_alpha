/**
 * Minimal repro for Ghost Player finding #1: dice-based W-card draws
 * report success but don't land in player.hand.
 *
 * This test isolates the exact failing call so we can fix it with
 * confidence and use the assertion as a regression guard.
 */

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';

describe('CardService.drawCards on starting space', () => {
  it('direct drawCards(W) after game start should land in player.hand', async () => {
    const { stateService, cardService, turnService } = await bootstrapHeadlessServices();

    stateService.addPlayer('Test');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();
    await turnService.startTurn(playerId);

    const before = stateService.getPlayer(playerId)!;
    expect(before.hand.filter((c) => c.startsWith('W')).length).toBe(0);

    const drawn = cardService.drawCards(playerId, 'W', 1, 'test', 'repro');
    expect(drawn.length).toBe(1);
    expect(drawn[0]).toMatch(/^W/);

    const after = stateService.getPlayer(playerId)!;
    const wInHand = after.hand.filter((c) => c.startsWith('W')).length;
    console.log(`drawn=${JSON.stringify(drawn)} after.hand=${JSON.stringify(after.hand)}`);
    expect(wInHand).toBe(1);
  });

  it('dice roll via rollDiceWithFeedback should land W card in hand', async () => {
    const { stateService, turnService } = await bootstrapHeadlessServices();

    stateService.addPlayer('Test');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();
    await turnService.startTurn(playerId);

    await turnService.rollDiceWithFeedback(playerId);

    const after = stateService.getPlayer(playerId)!;
    const wInHand = after.hand.filter((c) => c.startsWith('W')).length;
    expect(wInHand).toBeGreaterThanOrEqual(1);
  });
});
