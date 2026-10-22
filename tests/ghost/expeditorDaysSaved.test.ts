/**
 * PLAYTEST-2 (2026-10-18, "Still broken" #6): "Efficiency Boost (-3) saved me only 2 days" and
 * "some -1 day activations seemed to change nothing". Cause, proven here: there is NO cap on the
 * current filing. A day-saving expeditor takes its days off the running day count, which cannot go
 * below zero, so it only "short-changes" in the first few days of a game (the button already reads
 * "-2 of 3 days" then, see getCardEffectSummary). Later in the game it saves its full face value.
 */
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { getCardEffectSummary } from '../../src/utils/cardTypeNames';

async function play(cardId: string, timeSpent: number) {
  const s: any = await bootstrapHeadlessServices();
  s.stateService.addPlayer('T');
  const id = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(id);
  s.stateService.startGame();
  s.stateService.updatePlayer({ id, hand: [cardId], currentSpace: 'REG-DOB-PLAN-EXAM', visitType: 'First', money: 1_000_000 });
  await s.turnService.startTurn(id);
  // Set the day count after the turn has started: arrival can add days of its own at random.
  s.stateService.updateTempState(id, { timeSpent });
  const before = s.stateService.getPlayer(id).timeSpent;
  await s.cardService.playCard(id, cardId);
  return { saved: before - s.stateService.getPlayer(id).timeSpent, card: s.dataService.getCardById(cardId) };
}

describe('day-saving expeditors', () => {
  it('Efficiency Boost (E003, -3) saves its full 3 days once the game is a few days old', async () => {
    expect((await play('E003', 100)).saved).toBe(3);
    expect((await play('E003', 3)).saved).toBe(3);
  });

  it('with only 2 days on the clock it can save only 2, and the button already says so', async () => {
    const r = await play('E003', 2);
    expect(r.saved).toBe(2);
    expect(getCardEffectSummary(r.card, 2)).toContain('-2 of 3 days');
  });

  it('a -1 day card saves its day mid-game and nothing on day 0', async () => {
    expect((await play('E020', 100)).saved).toBe(1);
    expect((await play('E020', 0)).saved).toBe(0);
  });
});
