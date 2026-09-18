/**
 * "Pass a team member to your left/right" really passes one.
 *
 * Four Subsequent-visit spaces (PM-DECISION-CHECK, ARCH-SCOPE-CHECK,
 * CON-ISSUES to the right; INVESTOR-FUND-REVIEW to the left) authored the
 * legacy sentence "The person to your right takes a card." The data pipeline
 * recognised only Return/Replace/Give/Draw verbs, so the sentence fell through
 * to the default `draw_E` — and pressing the button GAVE the presser a free
 * expeditor while the label said "pass", the story said a rival took one, and
 * the engine's own `transfer` action sat unused. Found 2026-09-18 by running
 * the real row through the real services (Alice 0 -> 1, Bob 0 -> 0).
 *
 * These drive the same path a player's button press does, so a future change to
 * the pipeline, the condition vocabulary, or the transfer handler that puts the
 * free draw back — or sends the card to the wrong side — fails here.
 */

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { settleManualEffect } from '../helpers/settleManualEffect';

const RIGHT_SPACES = ['PM-DECISION-CHECK', 'ARCH-SCOPE-CHECK', 'CON-ISSUES'];
const LEFT_SPACES = ['INVESTOR-FUND-REVIEW'];

async function seatTable(names: string[], space: string, expeditorsFor: Record<number, number> = {}) {
  const s = await bootstrapHeadlessServices();
  names.forEach((n) => s.stateService.addPlayer(n));
  const players = s.stateService.getAllPlayers();
  s.stateService.setCurrentPlayer(players[0].id);
  s.stateService.startGame();
  await s.turnService.startTurn(players[0].id);
  s.stateService.updatePlayer({ id: players[0].id, currentSpace: space, visitType: 'Subsequent' });
  for (const [seat, count] of Object.entries(expeditorsFor)) {
    if (count > 0) s.cardService.drawCards(players[Number(seat)].id, 'E', count, 'test', 'seed expeditors');
  }
  const held = () => players.map((p) => s.cardService.getPlayerCards(p.id, 'E').length);
  const press = () => settleManualEffect(
    s.turnService.triggerManualEffect(players[0].id, 'cards:transfer'),
    s.stateService,
    s.choiceService,
  );
  return { s, players, held, press };
}

describe('the shipped data', () => {
  it('authors the neighbour rows as `transfer` with a to_left / to_right directive — never a free draw', async () => {
    const s = await bootstrapHeadlessServices();
    for (const [spaces, condition] of [[RIGHT_SPACES, 'to_right'], [LEFT_SPACES, 'to_left']] as const) {
      for (const space of spaces) {
        const rows = s.dataService
          .getSpaceEffects(space, 'Subsequent')
          .filter((e) => e.trigger_type === 'manual' && e.effect_type === 'cards' && /team member/i.test(e.button_label ?? ''));
        expect(rows, `${space} should offer one pass button`).toHaveLength(1);
        expect(rows[0].effect_action).toBe('transfer');
        expect(rows[0].condition).toBe(condition);
        expect(rows[0].button_label).toMatch(new RegExp(`^Pass a team member to your ${condition.replace('to_', '')}$`));
      }
    }
  });
});

describe('pressing "Pass a team member to your right/left"', () => {
  it.each(RIGHT_SPACES)('%s: the presser loses the expeditor and the player on their right gains it', async (space) => {
    const t = await seatTable(['Alice', 'Bob', 'Charlie'], space, { 0: 1 });
    expect(t.held()).toEqual([1, 0, 0]);
    await t.press();
    expect(t.held()).toEqual([0, 1, 0]);
  });

  it.each(LEFT_SPACES)('%s: the card goes to the player on the LEFT, wrapping around the table', async (space) => {
    const t = await seatTable(['Alice', 'Bob', 'Charlie'], space, { 0: 1 });
    await t.press();
    expect(t.held()).toEqual([0, 0, 1]);
  });

  it('never creates an expeditor: the total held across the table is unchanged (the old free draw would add one)', async () => {
    const t = await seatTable(['Alice', 'Bob'], 'PM-DECISION-CHECK', { 0: 1, 1: 2 });
    const before = t.held().reduce((a, b) => a + b, 0);
    await t.press();
    expect(t.held().reduce((a, b) => a + b, 0)).toBe(before);
  });

  it('holding two, the presser chooses which to pass: one leaves, one stays', async () => {
    const t = await seatTable(['Alice', 'Bob'], 'PM-DECISION-CHECK', { 0: 2 });
    await t.press();
    expect(t.held()).toEqual([1, 1]);
  });

  it('holding none, nothing happens — and nobody gains anything', async () => {
    const t = await seatTable(['Alice', 'Bob'], 'PM-DECISION-CHECK', {});
    await t.press();
    expect(t.held()).toEqual([0, 0]);
  });

  it('a solo game has no neighbour: nothing moves and nothing crashes', async () => {
    const t = await seatTable(['Alice'], 'PM-DECISION-CHECK', { 0: 1 });
    await t.press();
    expect(t.held()).toEqual([1]);
  });

  it('the outcome modal reports a card that LEFT the hand (a pass), not an expeditor that was drawn', async () => {
    const t = await seatTable(['Alice', 'Bob'], 'PM-DECISION-CHECK', { 0: 1 });
    const result = await t.s.turnService.triggerManualEffectWithFeedback(t.players[0].id, 'cards:transfer');
    const effect = result.effects.find((e) => e.type === 'cards');
    expect(effect?.cardType).toBe('E');
    expect(effect?.cardAction).toBe('give');
    expect(effect?.cardIds ?? []).toHaveLength(0);
    expect(effect?.removedCardIds).toHaveLength(1);
  });
});
