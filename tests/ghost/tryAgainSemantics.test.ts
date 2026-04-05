/**
 * Workstream 2 — Beta Try Again semantics specification.
 *
 * These tests pin down the NEW rule for Try Again (snapshot + costLedger):
 *
 *   outflows from the player STICK (time, money paid, cards consumed)
 *   inflows to the player REVERT (money received, cards drawn, scope bonuses)
 *   L-card effects are permanent exception (a law change doesn't unchange)
 *
 * Tests marked "❌ fails today" document the gap between the current
 * REAL/TEMP implementation (which reverts everything except the time
 * penalty) and the Beta snapshot model. Once the refactor lands, every
 * test here must pass.
 *
 * Space used: OWNER-SCOPE-INITIATION (First visit). Starting space, is
 * negotiable, and the player is already there after startTurn so we don't
 * have to teleport them. Time penalty per SPACE_EFFECTS for that space
 * is the "negotiation cost" that always sticks.
 */

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';

async function setupNegotiableTurn() {
  const services = await bootstrapHeadlessServices();
  const { stateService, turnService } = services;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  await turnService.startTurn(playerId);
  return { ...services, playerId };
}

describe('Beta Try Again semantics', () => {
  it('money the player PAID during the turn must stick after Try Again', async () => {
    // Seed funds BEFORE startTurn so REAL captures the non-zero starting money.
    const services = await bootstrapHeadlessServices();
    const { stateService, resourceService, turnService } = services;
    stateService.addPlayer('Test');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();
    stateService.updatePlayer({ id: playerId, money: 500_000 });
    await turnService.startTurn(playerId);

    const moneyBefore = stateService.getPlayer(playerId)!.money;
    expect(moneyBefore).toBe(500_000);

    resourceService.spendMoney(playerId, 50_000, 'test', 'fee paid during turn');

    const result = await turnService.tryAgainOnSpace(playerId);
    expect(result.success).toBe(true);

    const moneyAfter = stateService.getPlayer(playerId)!.money;
    expect(moneyAfter).toBe(moneyBefore - 50_000);
  });

  it('money the player RECEIVED during the turn must revert after Try Again', async () => {
    const { stateService, resourceService, turnService, playerId } = await setupNegotiableTurn();
    const moneyBefore = stateService.getPlayer(playerId)!.money;

    resourceService.addMoney(playerId, 25_000, 'test', 'funding received during turn', 'other');

    const result = await turnService.tryAgainOnSpace(playerId);
    expect(result.success).toBe(true);

    const moneyAfter = stateService.getPlayer(playerId)!.money;
    expect(moneyAfter).toBe(moneyBefore);
  });

  it('cards DRAWN during the turn must revert to the deck after Try Again', async () => {
    const { stateService, cardService, turnService, playerId } = await setupNegotiableTurn();
    const handBefore = stateService.getPlayer(playerId)!.hand.length;

    cardService.drawCards(playerId, 'W', 2, 'test', 'drew during turn');
    expect(stateService.getPlayer(playerId)!.hand.length).toBe(handBefore + 2);

    const result = await turnService.tryAgainOnSpace(playerId);
    expect(result.success).toBe(true);

    const handAfter = stateService.getPlayer(playerId)!.hand.length;
    expect(handAfter).toBe(handBefore);
  });

  it('a card PLAYED by the player during the turn must stay consumed after Try Again', async () => {
    // ❌ fails today: current REAL/TEMP returns the card to hand on try-again
    // E008 is an Expeditor card with phase_restriction=Any, so it can be played
    // from the starting space.
    const services = await bootstrapHeadlessServices();
    const { stateService, cardService, turnService } = services;
    stateService.addPlayer('Test');
    const playerId = stateService.getAllPlayers()[0].id;
    stateService.setCurrentPlayer(playerId);
    stateService.startGame();

    // Seed the card into hand BEFORE startTurn so it's part of REAL, not TEMP.
    // Give the player enough money to afford the card's side-effect cost.
    const CARD_ID = 'E008';
    stateService.updatePlayer({ id: playerId, hand: [CARD_ID], money: 1_000_000 });

    await turnService.startTurn(playerId);
    expect(stateService.getPlayer(playerId)!.hand).toContain(CARD_ID);

    // Player-initiated play of the card
    await cardService.playCard(playerId, CARD_ID);
    expect(stateService.getPlayer(playerId)!.hand).not.toContain(CARD_ID);

    // Try Again — under Beta rules, the card is GONE (player spent it) even
    // though the turn is being reverted.
    const result = await turnService.tryAgainOnSpace(playerId);
    expect(result.success).toBe(true);

    const handAfter = stateService.getPlayer(playerId)!.hand;
    expect(handAfter, 'played card must not return to hand').not.toContain(CARD_ID);
  });

  it('time penalty from the space applies on Try Again (existing rule, must not regress)', async () => {
    const { stateService, turnService, dataService, playerId } = await setupNegotiableTurn();

    const timeBefore = stateService.getPlayer(playerId)!.timeSpent;
    const p = stateService.getPlayer(playerId)!;
    const spaceEffects = dataService.getSpaceEffects(p.currentSpace, p.visitType) || [];
    const expectedPenalty = spaceEffects
      .filter((e: any) => e.effect_type === 'time' && e.effect_action === 'add')
      .reduce((s: number, e: any) => s + Number(e.effect_value || 0), 0);

    const result = await turnService.tryAgainOnSpace(playerId);
    expect(result.success).toBe(true);

    const timeAfter = stateService.getPlayer(playerId)!.timeSpent;
    expect(timeAfter - timeBefore).toBe(expectedPenalty);
  });

  it('unlimited Try Again — three retries in a row each burn the time penalty', async () => {
    const { stateService, turnService, dataService, playerId } = await setupNegotiableTurn();
    const p0 = stateService.getPlayer(playerId)!;
    const spaceEffects = dataService.getSpaceEffects(p0.currentSpace, p0.visitType) || [];
    const penalty = spaceEffects
      .filter((e: any) => e.effect_type === 'time' && e.effect_action === 'add')
      .reduce((s: number, e: any) => s + Number(e.effect_value || 0), 0);

    const timeBefore = p0.timeSpent;

    // Each Try Again ends the turn; we need to start the next turn ourselves,
    // mimicking the real turn cycle.
    for (let i = 0; i < 3; i++) {
      const r = await turnService.tryAgainOnSpace(playerId);
      expect(r.success, `try-again #${i + 1} must succeed`).toBe(true);
      await turnService.endTurnWithMovement(true, true);
      await turnService.startTurn(playerId);
    }

    const timeAfter = stateService.getPlayer(playerId)!.timeSpent;
    expect(timeAfter - timeBefore).toBe(penalty * 3);
  });
});
