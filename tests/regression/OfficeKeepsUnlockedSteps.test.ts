// "Unlocked spaces should stay unlocked" (Tom, 2026-10-21, fb:550a3a99). Once a player has been
// through a step, the NEXT sub-phase (architect -> engineer, engineer -> city filing) and a visited
// Fire Dept. intake stay on the office's list, in any order, but only at their FIRST step: the office
// never offers a plan examiner, so steps inside a sub-phase cannot be skipped.
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

async function atOffice(visited: string[]) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService } = s;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({ id: playerId, currentSpace: 'PM-DECISION-CHECK', visitType: 'Subsequent', visitedSpaces: ['PM-DECISION-CHECK', ...visited] } as any);
  return { s, moves: () => s.movementService.getValidMoves(playerId) as string[] };
}

describe('the office keeps unlocked steps', () => {
  it('before the design is done there is no engineer at the office', async () => {
    const { moves } = await atOffice(['ARCH-INITIATION']);
    expect(moves()).not.toContain('ENG-INITIATION');
  });
  it('after the architect\'s design, the engineer stays available', async () => {
    const { moves } = await atOffice(['ARCH-INITIATION', 'ARCH-FEE-REVIEW', 'ARCH-SCOPE-CHECK']);
    expect(moves()).toContain('ENG-INITIATION');
    expect(moves()).toContain('ARCH-INITIATION'); // the architect is still there too: any order
    expect(moves()).not.toContain('REG-DOB-FEE-REVIEW');
  });
  it('after the engineer, the city filing opens at its FIRST step only', async () => {
    const { moves } = await atOffice(['ARCH-SCOPE-CHECK', 'ENG-INITIATION', 'ENG-SCOPE-CHECK']);
    expect(moves()).toContain('REG-DOB-FEE-REVIEW');
    expect(moves()).not.toContain('REG-DOB-PLAN-EXAM');
    expect(moves()).not.toContain('REG-DOB-TYPE-SELECT');
  });
  it('a visited Fire Dept. intake is offered again, but not the plan exam', async () => {
    const { moves } = await atOffice(['ARCH-SCOPE-CHECK', 'ENG-SCOPE-CHECK', 'REG-FDNY-FEE-REVIEW']);
    expect(moves()).toContain('REG-FDNY-FEE-REVIEW');
    expect(moves()).not.toContain('REG-FDNY-PLAN-EXAM');
  });
});
