// The DOB audit counts for the "best built" trophy like any review (Tom, 2026-10-12: "a is review"):
// a roll that sends the project back (to the plan exam, or all the way back to the architect) is
// sent back, any other roll is a pass - and each roll counts exactly once.
import { describe, it, expect, vi } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { configureTrophyRules } from '../../src/utils/trophyRules';

async function auditRoll(roll: number, visitType: 'First' | 'Subsequent'): Promise<string[]> {
  const s = await bootstrapHeadlessServices();
  configureTrophyRules(s.dataService.getTrophyRuleRows());
  s.stateService.addPlayer('Ann');
  const id = s.stateService.getAllPlayers()[0].id;
  s.stateService.updatePlayer({ id, currentSpace: 'REG-DOB-AUDIT', visitType });
  s.stateService.setCurrentPlayer(id);
  s.stateService.startGame();
  const reviews: string[] = [];
  s.stateService.subscribeToGameEvents(e => {
    if (e.type === 'quality_event' && e.eventId.startsWith('review')) reviews.push(e.eventId);
  });
  vi.spyOn((s.turnService as unknown as { diceService: { rollDice: () => number } }).diceService, 'rollDice').mockReturnValue(roll);
  await s.turnService.rollDiceWithFeedback(id);
  return reviews;
}

describe('the DOB audit is a review (best built)', () => {
  // First visit (DICE_OUTCOMES.csv): 1 final review, 2-3 plan exam, 4-5 the architect, 6 fire dept.
  it.each([
    [1, 'review_passed'],
    [2, 'review_sent_back'],
    [3, 'review_sent_back'],
    [4, 'review_sent_back'],
    [5, 'review_sent_back'],
    [6, 'review_passed'],
  ])('first visit, roll %i counts once as %s', async (roll, expected) => {
    expect(await auditRoll(roll, 'First')).toEqual([expected]);
  });

  // Return visit: 1 final review, 2 fire dept, 3-4 plan exam, 5 the architect, 6 fire dept.
  it.each([
    [1, 'review_passed'],
    [2, 'review_passed'],
    [3, 'review_sent_back'],
    [4, 'review_sent_back'],
    [5, 'review_sent_back'],
    [6, 'review_passed'],
  ])('return visit, roll %i counts once as %s', async (roll, expected) => {
    expect(await auditRoll(roll, 'Subsequent')).toEqual([expected]);
  });
});
