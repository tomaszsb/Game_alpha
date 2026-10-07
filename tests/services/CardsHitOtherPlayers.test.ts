// Job 3 check: under the three-trophy rule days decide a race, so a card that is meant to hit
// every player (18 L cards target "All Players") must really move EVERY player's days — not just
// the one who drew it — and only the players in the card's phase when it names one.
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

const PHASE_SPACE: Record<string, string> = {
  CONSTRUCTION: 'CON-INITIATION',
  REGULATORY: 'REG-DOB-PLAN-EXAM',
};

async function table() {
  const s = await bootstrapHeadlessServices();
  ['Ann', 'Bo', 'Cy'].forEach(n => s.stateService.addPlayer(n));
  const ids = s.stateService.getAllPlayers().map(p => p.id);
  s.stateService.setCurrentPlayer(ids[0]);
  s.stateService.startGame();
  await s.turnService.startTurn(ids[0]);
  return { s, ids };
}

describe('L cards that target All Players', () => {
  it('each one moves every player it should: all three, or only those in its phase', async () => {
    const { s: probe } = await table();
    const cardIds = probe.dataService.getCardsByType('L').filter(c => c.target === 'All Players').map(c => c.card_id);
    expect(cardIds.length).toBe(18);

    const problems: string[] = [];
    for (const cardId of cardIds) {
      const { s, ids } = await table();
      const card = s.dataService.getCardById(cardId)!;
      const tick = parseInt(String(card.tick_modifier ?? '0'), 10);
      if (tick === 0) continue; // no day change (a discard card): checked elsewhere
      const phase = card.affected_phase?.trim();
      const timed = card.duration === 'Turns' && parseInt(String(card.duration_count ?? '0'), 10) > 0;

      // Ann and Bo stand in the card's phase (or anywhere, if it names none); Cy stands elsewhere.
      const inPhase = phase ? PHASE_SPACE[phase] ?? 'CON-INITIATION' : 'PM-DECISION-CHECK';
      const elsewhere = phase === 'CONSTRUCTION' ? 'REG-DOB-PLAN-EXAM' : 'CON-INITIATION';
      const spaces = [inPhase, inPhase, phase ? elsewhere : inPhase];
      // Days already spent, so a card that SAVES days has something to take off.
      ids.forEach((id, i) => {
        s.stateService.updatePlayer({ id, currentSpace: spaces[i], timeSpent: 50 });
      });

      const before = ids.map(id => s.stateService.getPlayer(id)!.timeSpent);
      const effectsBefore = ids.map(id => s.stateService.getPlayer(id)!.activeEffects?.length ?? 0);
      await s.cardService.applyCardEffects(ids[0], cardId, { onlyResourceEffects: true, diceRoll: 3 });
      const after = ids.map(id => s.stateService.getPlayer(id)!.timeSpent);
      const effectsAfter = ids.map(id => s.stateService.getPlayer(id)!.activeEffects?.length ?? 0);

      const shouldBeHit = [true, true, !phase];
      ids.forEach((_id, i) => {
        if (timed) {
          // Lasts a number of turns: each player it applies to is handed a running effect.
          // (A phase-named card hands one to every player and checks the phase each turn.)
          const expected = shouldBeHit[i] || phase ? 1 : 0;
          if (effectsAfter[i] - effectsBefore[i] !== expected) problems.push(`${cardId}: player ${i + 1} got ${effectsAfter[i] - effectsBefore[i]} running effect(s), expected ${expected}`);
        } else {
          const expected = shouldBeHit[i] ? tick : 0;
          if (after[i] - before[i] !== expected) problems.push(`${cardId}: player ${i + 1} days moved ${after[i] - before[i]}, expected ${expected}`);
        }
      });
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it('E cards that target All Players move everyone; "Choose Opponent" cards move only the one chosen', async () => {
    const { s, ids } = await table();
    const days = () => ids.map(id => s.stateService.getPlayer(id)!.timeSpent);
    const give = (id: string, cardId: string) => s.stateService.updatePlayer({ id, hand: [...s.stateService.getPlayer(id)!.hand, cardId] });
    ids.forEach(id => s.stateService.updatePlayer({ id, currentSpace: 'REG-DOB-PLAN-EXAM', timeSpent: 50 })); // these E cards are Regulatory-phase cards

    for (const cardId of ['E013', 'E031']) {
      const tick = parseInt(String(s.dataService.getCardById(cardId)!.tick_modifier), 10);
      const before = days();
      give(ids[0], cardId);
      await s.cardService.playCard(ids[0], cardId);
      expect(days().map((d, i) => d - before[i]), cardId).toEqual([tick, tick, tick]);
    }

    // Choose Opponent (E009): Ann plays it and picks Bo when asked. E075 is a trade, not days.
    const tick9 = parseInt(String(s.dataService.getCardById('E009')!.tick_modifier), 10);
    const before = days();
    give(ids[0], 'E009');
    const playing = s.cardService.playCard(ids[0], 'E009');
    await new Promise(r => setTimeout(r, 20));
    const pending = s.stateService.getGameState().awaitingChoice;
    if (pending) s.choiceService.resolveChoice(pending.id, ids[1]);
    await playing;
    // The card reads: the opponent's filing takes 2 days more, and yours takes 2 days less.
    expect(days().map((d, i) => d - before[i])).toEqual([-tick9, tick9, 0]);
  }, 60_000);
});
