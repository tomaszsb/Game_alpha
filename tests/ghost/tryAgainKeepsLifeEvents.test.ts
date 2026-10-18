/**
 * PLAYTEST 2026-10-18 (Engineer's Fee): a "Notice of Violation" life event added
 * extra work to the project, the player pushed back, and the push-back erased the
 * event's work package (scope back down, fee back to $0). The L card stayed in
 * hand, but what it DID rolled back with the turn.
 * Rule (Workstream 2): a life event is permanent; a push-back re-opens the deal,
 * it does not undo bad luck already seen.
 */
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from './bootstrapServices';

async function setup() {
  const services = await bootstrapHeadlessServices();
  const { stateService, turnService } = services;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  await turnService.startTurn(playerId);
  return { ...services, playerId };
}

/** Draw a specific life event the way the game does: into hand, then apply. */
async function lifeEvent(services: any, playerId: string, cardId: string, diceRoll?: number) {
  const { stateService, cardService } = services;
  const p = stateService.getPlayer(playerId)!;
  stateService.updateTempState(playerId, { hand: [...p.hand, cardId] });
  stateService.recordTurnOutflow(playerId, { lifeEventDrawn: cardId });
  await cardService.applyCardEffects(playerId, cardId, { onlyResourceEffects: true, diceRoll });
}

describe('Try Again keeps what a life event did', () => {
  it('a Notice of Violation keeps its extra work package and stays active', async () => {
    const s = await setup();
    const { stateService, turnService, playerId } = s;
    const wBefore = stateService.getPlayer(playerId)!.hand.filter((c: string) => c.startsWith('W'));

    await lifeEvent(s, playerId, 'L050');
    const afterEvent = stateService.getPlayer(playerId)!;
    const added = afterEvent.hand.filter((c: string) => c.startsWith('W') && !wBefore.includes(c));
    expect(added.length).toBe(1);
    expect(afterEvent.violationStatus).toBe('active');

    expect((await turnService.tryAgainOnSpace(playerId)).success).toBe(true);

    const after = stateService.getPlayer(playerId)!;
    expect(after.hand).toContain('L050');
    expect(after.hand, 'the corrective work package survives the push-back').toContain(added[0]);
    expect(after.violationStatus).toBe('active');
  });

  it("a life event's days stay on top of the push-back days", async () => {
    const s = await setup();
    const { stateService, turnService, playerId } = s;
    const t0 = stateService.getPlayer(playerId)!.timeSpent;

    // Push-back days alone (no life event), measured on a fresh game.
    const ref = await setup();
    const r0 = ref.stateService.getPlayer(ref.playerId)!.timeSpent;
    await ref.turnService.tryAgainOnSpace(ref.playerId);
    const penalty = ref.stateService.getPlayer(ref.playerId)!.timeSpent - r0;

    const tBeforeEvent = stateService.getPlayer(playerId)!.timeSpent;
    await lifeEvent(s, playerId, 'L009', 1); // NIMBY Lawsuit, roll 1-3: +5 days
    const eventDays = stateService.getPlayer(playerId)!.timeSpent - tBeforeEvent;
    expect(eventDays).toBeGreaterThan(0);

    await turnService.tryAgainOnSpace(playerId);
    expect(stateService.getPlayer(playerId)!.timeSpent).toBe(t0 + penalty + eventDays);
  });
});
