/**
 * Live robot game G-FP58-9Q46 (2026-10-22): a "lasting" life event (Natural Disaster L034, 2 turns,
 * all players) reached every player EXCEPT the one who drew it and pushed back that same turn.
 * Rule (Workstream 2): a life event is permanent; a push-back re-opens the deal, it does not undo
 * bad luck. The drawer's copy of the lasting effect lives in the turn's provisional state, which
 * the push-back rolls back, so it was lost.
 */
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';

async function setup(names: string[]) {
  const services = await bootstrapHeadlessServices();
  const { stateService, turnService } = services;
  names.forEach((n) => stateService.addPlayer(n));
  const ids = stateService.getAllPlayers().map((p: any) => p.id);
  stateService.setCurrentPlayer(ids[0]);
  stateService.startGame();
  await turnService.startTurn(ids[0]);
  return { ...services, ids };
}

async function drawLifeEvent(services: any, playerId: string, cardId: string) {
  const { stateService, cardService } = services;
  const p = stateService.getPlayer(playerId)!;
  stateService.updateTempState(playerId, { hand: [...p.hand, cardId] });
  stateService.recordTurnOutflow(playerId, { lifeEventDrawn: cardId });
  await cardService.applyCardEffects(playerId, cardId, { onlyResourceEffects: true });
}

const copies = (services: any, playerId: string, cardId: string) =>
  (services.stateService.getPlayer(playerId)!.activeEffects ?? []).filter((e: any) => e.sourceCardId === cardId).length;

describe('Try Again keeps the drawer\'s own lasting life event', () => {
  it('Natural Disaster: the drawer still carries it after a push-back, like everyone else', async () => {
    const s = await setup(['Drawer', 'Other']);
    const [drawer, other] = s.ids;
    await drawLifeEvent(s, drawer, 'L034');
    expect(copies(s, drawer, 'L034')).toBeGreaterThan(0);
    const othersCopies = copies(s, other, 'L034');
    expect(othersCopies).toBeGreaterThan(0);

    expect((await s.turnService.tryAgainOnSpace(drawer)).success).toBe(true);

    expect(copies(s, drawer, 'L034'), 'drawer keeps the lasting effect through the push-back').toBe(othersCopies);
    expect(copies(s, other, 'L034')).toBe(othersCopies);
  });

  it('solo: a single player who pushes back on the draw turn does not escape the event', async () => {
    const s = await setup(['Solo']);
    const [solo] = s.ids;
    await drawLifeEvent(s, solo, 'L034');
    const before = copies(s, solo, 'L034');
    expect(before).toBeGreaterThan(0);
    await s.turnService.tryAgainOnSpace(solo);
    expect(copies(s, solo, 'L034')).toBe(before);
  });

  it('a push-back does not duplicate the effect when none was lost (no event drawn)', async () => {
    const s = await setup(['A', 'B']);
    await s.turnService.tryAgainOnSpace(s.ids[0]);
    expect(copies(s, s.ids[0], 'L034')).toBe(0);
  });
});
