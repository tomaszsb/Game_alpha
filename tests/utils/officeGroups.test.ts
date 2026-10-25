import { describe, it, expect } from 'vitest';
import { groupMoveOptions, defaultOpenStage, GROUP_MIN_OPTIONS } from '../../src/utils/officeGroups';
import { bootstrapHeadlessServices } from '../../src/headless/bootstrapServices';

const phases: Record<string, string> = {
  'LEND-SCOPE-CHECK': 'FUNDING', 'ARCH-INITIATION': 'DESIGN', 'ENG-INITIATION': 'DESIGN',
  'CHEAT-BYPASS': 'OWNER', 'OWNER-DECISION-REVIEW': 'OWNER', 'CON-INITIATION': 'CONSTRUCTION',
  'REG-DOB-FEE-REVIEW': 'REGULATORY', 'REG-FDNY-FEE-REVIEW': 'REGULATORY', 'REG-DOB-FINAL-REVIEW': 'REGULATORY',
};
const order = ['OWNER', 'FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION'];
const opts = Object.keys(phases).map((id) => ({ id, label: id }));
const phaseOf = (id: string) => phases[id] ?? '';

describe('office list grouped by stage', () => {
  it('groups by stage in the data order of stages', () => {
    const g = groupMoveOptions(opts, [], phaseOf, order);
    expect(g.map((x) => x.phase)).toEqual(['OWNER', 'FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION']);
    expect(g.reduce((n, x) => n + x.items.length, 0)).toBe(9);
    expect(9).toBeGreaterThanOrEqual(GROUP_MIN_OPTIONS);
  });

  it('inside a group, places are in the order first visited; unvisited ones come last in the engine order', () => {
    const visited = ['REG-FDNY-FEE-REVIEW', 'ENG-INITIATION', 'ARCH-INITIATION', 'REG-DOB-FEE-REVIEW'];
    const g = groupMoveOptions(opts, visited, phaseOf, order);
    expect(g.find((x) => x.phase === 'DESIGN')!.items.map((o) => o.id)).toEqual(['ENG-INITIATION', 'ARCH-INITIATION']);
    expect(g.find((x) => x.phase === 'REGULATORY')!.items.map((o) => o.id))
      .toEqual(['REG-FDNY-FEE-REVIEW', 'REG-DOB-FEE-REVIEW', 'REG-DOB-FINAL-REVIEW']);
  });

  it('opens the group with the newest first visit, or the picked place\'s group, or the first', () => {
    const visited = ['ARCH-INITIATION', 'REG-DOB-FEE-REVIEW', 'CON-INITIATION'];
    const g = groupMoveOptions(opts, visited, phaseOf, order);
    expect(defaultOpenStage(g, visited, null)).toBe('CONSTRUCTION');
    expect(defaultOpenStage(g, visited, 'ARCH-INITIATION')).toBe('DESIGN');
    expect(defaultOpenStage(g, [], null)).toBe('OWNER');
    expect(defaultOpenStage([], [], null)).toBeNull();
  });

  it('does not change what the engine offers or the choice by space id (robot and moveIntent keep working)', async () => {
    const s: any = await bootstrapHeadlessServices();
    s.stateService.addPlayer('x'); const pid = s.stateService.getAllPlayers()[0].id;
    s.stateService.setCurrentPlayer(pid); s.stateService.startGame();
    s.stateService.updatePlayer({ id: pid, currentSpace: 'PM-DECISION-CHECK', visitType: 'Subsequent', visitedSpaces: ['OWNER-SCOPE-INITIATION', 'ARCH-INITIATION', 'ARCH-SCOPE-CHECK', 'PM-DECISION-CHECK'] } as never);
    const moves: string[] = await s.movementService.getValidMoves(pid);
    expect(moves).toContain('ENG-INITIATION');
    s.stateService.setPlayerMoveIntent(pid, 'ENG-INITIATION');
    const g = groupMoveOptions(moves.map((id) => ({ id })), s.stateService.getPlayer(pid).visitedSpaces, (id) => s.dataService.getGameConfigBySpace(id)?.phase ?? '', []);
    expect(g.flatMap((x) => x.items.map((o) => o.id)).sort()).toEqual([...moves].sort());
    expect(s.stateService.getPlayer(pid).moveIntent).toBe('ENG-INITIATION');
  });
});
