// v3.8.95 - the end of the job has two new choices: how the TR1 is signed (full report or sign today) and which
// certificate of occupancy to take (temporary or final). A ghost player walks both, and a data check makes sure
// every space the stretch can reach exists and nothing dead-ends.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { bootstrapHeadlessServices } from './bootstrapServices';

async function setup(space: string, money = 500_000) {
  const services = await bootstrapHeadlessServices();
  const { stateService } = services;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({
    id: playerId, currentSpace: space, visitType: 'First', visitedSpaces: [space], money,
    dobApprovalStatus: 'approved', fdnyApprovalStatus: 'approved',
  } as any);
  return { ...services, playerId };
}

/** One hop the way the game plays it: the move must be a legal one from here, then the arrival runs once. */
async function hop(s: any, dest: string) {
  expect(s.movementService.getValidMoves(s.playerId)).toContain(dest);
  const p = s.stateService.getPlayer(s.playerId);
  s.stateService.updatePlayer({ id: s.playerId, currentSpace: dest, visitType: 'First', visitedSpaces: [...p.visitedSpaces, dest] } as any);
  await s.turnService.startTurn(s.playerId);
}

describe('the stretch from the last inspection to FINISH (data)', () => {
  const rows = (f: string) => fs.readFileSync(`public/data/CLEAN_FILES/${f}.csv`, 'utf-8').split(/\r?\n/).slice(1).filter(Boolean).map(l => l.split(','));
  const spaces = new Set(rows('GAME_CONFIG').map(r => r[0]));
  const movement = rows('MOVEMENT');
  const outcomes = rows('DICE_OUTCOMES');

  it('every space MOVEMENT and DICE_OUTCOMES can reach exists, and the new ones are all on the board', () => {
    for (const r of movement) for (const d of r.slice(3, 8).filter(Boolean).flatMap(x => x.split(' or '))) expect(spaces.has(d), `${r[0]} -> ${d}`).toBe(true);
    for (const r of outcomes) for (const d of r.slice(2).filter(Boolean).flatMap(x => x.split(' or '))) expect(spaces.has(d), `${r[0]} -> ${d}`).toBe(true);
    for (const n of ['SI-SIGNOFF', 'SI-FULL-REPORT', 'SI-RUSH', 'CO-CHOOSE', 'CO-TEMP', 'CO-FINAL']) expect(spaces.has(n), n).toBe(true);
  });

  it('the last inspection leads to the sign-off, never straight to Final Approval; Final Approval leads to the certificate choice', () => {
    for (const r of outcomes.filter(o => ['CON-INSPECT', 'CON-FIX', 'CON-STEER'].includes(o[0]))) expect(r.slice(2)).not.toContain('REG-DOB-FINAL-REVIEW');
    for (const r of outcomes.filter(o => o[0] === 'REG-DOB-FINAL-REVIEW')) expect(r.slice(2)).not.toContain('FINISH');
    expect(outcomes.find(o => o[0] === 'CON-FIX' && o[1] === 'First')!.slice(2)).toContain('SI-SIGNOFF');
    expect(outcomes.find(o => o[0] === 'REG-DOB-FINAL-REVIEW' && o[1] === 'First')!.slice(2)).toContain('CO-CHOOSE');
  });

  it('both certificates lead only to FINISH, and the sign-off offers exactly the two ways', () => {
    expect(movement.filter(r => r[0] === 'CO-CHOOSE').map(r => r.slice(3, 5))).toEqual([['CO-TEMP', 'CO-FINAL'], ['CO-TEMP', 'CO-FINAL']]);
    expect(movement.filter(r => r[0] === 'SI-SIGNOFF').map(r => r.slice(3, 5))).toEqual([['SI-FULL-REPORT', 'SI-RUSH'], ['SI-FULL-REPORT', 'SI-RUSH']]);
    for (const n of ['CO-TEMP', 'CO-FINAL']) for (const r of movement.filter(m => m[0] === n)) expect(r.slice(3, 8).filter(Boolean)).toEqual(['FINISH']);
    const rush = outcomes.find(o => o[0] === 'SI-RUSH' && o[1] === 'First')!.slice(2);
    expect(rush.filter(d => d === 'CON-ISSUES').length).toBe(2); // 2 in 6 an item is missing
  });
});

/** Arrive on `space`, take its turn, and end it: what the stop cost in money and in days (with the same turn-end baseline each time). */
async function costOf(space: string) {
  const s = await setup(space);
  const p0 = s.stateService.getPlayer(s.playerId);
  await s.turnService.startTurn(s.playerId);
  const legal = s.movementService.getValidMoves(s.playerId);
  await s.turnService.endTurnWithMovement(true);
  const p1 = s.stateService.getPlayer(s.playerId);
  return { money: p0.money - p1.money, days: p1.timeSpent - p0.timeSpent, legal, p1 };
}

describe('a ghost player walks both new choices', () => {
  it('the sign-off offers the full report and sign today; the full report leads on to Final Approval', async () => {
    const s = await setup('SI-SIGNOFF');
    await s.turnService.startTurn(s.playerId);
    expect(s.movementService.getValidMoves(s.playerId).sort()).toEqual(['SI-FULL-REPORT', 'SI-RUSH']);
    await hop(s, 'SI-FULL-REPORT');
    expect(s.movementService.getValidMoves(s.playerId)).toEqual(['REG-DOB-FINAL-REVIEW']);
  });

  it('sign today leads on to Final Approval or back to Trouble On Site, and costs one day', async () => {
    const s = await setup('SI-RUSH');
    await s.turnService.startTurn(s.playerId);
    expect(s.movementService.getValidMoves(s.playerId).sort()).toEqual(['CON-ISSUES', 'REG-DOB-FINAL-REVIEW']);
    // the one day is charged when the dice are rolled: every roll is "1 day"
    const t = fs.readFileSync('public/data/CLEAN_FILES/DICE_EFFECTS.csv', 'utf-8').split(/\r?\n/).filter(l => l.startsWith('SI-RUSH,') && l.includes(',time,'));
    expect(t.length).toBe(2);
    for (const l of t) expect(l.split(',').slice(4, 10)).toEqual(Array(6).fill('1 day'));
    expect((await costOf('SI-FULL-REPORT')).money).toBe(0);
  });

  it('the certificate choice: temporary costs $2,500 and 40 days less than the final one, which costs no money; both lead to FINISH', async () => {
    const s = await setup('CO-CHOOSE');
    await s.turnService.startTurn(s.playerId);
    expect(s.movementService.getValidMoves(s.playerId).sort()).toEqual(['CO-FINAL', 'CO-TEMP']);
    const temp = await costOf('CO-TEMP');
    const fin = await costOf('CO-FINAL');
    expect(temp.money).toBe(2500);
    expect(fin.money).toBe(0);
    expect(fin.days - temp.days).toBe(40);
    expect(temp.legal).toEqual(['FINISH']);
    expect(fin.legal).toEqual(['FINISH']);
  });

  it('only the temporary certificate marks the build down, by one point', async () => {
    const temp = await costOf('CO-TEMP');
    const fin = await costOf('CO-FINAL');
    expect((temp.p1 as any).trophyRecord?.counts?.temp_certificate ?? 0).toBeGreaterThanOrEqual(1);
    expect((fin.p1 as any).trophyRecord?.counts?.temp_certificate ?? 0).toBe(0);
    expect((temp.p1 as any).trophyRecord?.problemPoints).toBe(1);
  });
});
