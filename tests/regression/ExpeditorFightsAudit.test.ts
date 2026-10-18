// PLAYTEST.md Part 2b #3 (2026-10-18), "send your expeditor": at The Audit and
// Fire Dept. Review, pushing back while you hold an expeditor sends it to fight
// the finding instead of costing days (SPACE_CONTENT `try_again_e_cost`).
import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { getTryAgainCostPreview } from '../../src/utils/costPreview';

async function atSpace(space: string, hand: string[]) {
  const s: any = await bootstrapHeadlessServices();
  const { stateService, turnService } = s;
  stateService.addPlayer('Test');
  const playerId = stateService.getAllPlayers()[0].id;
  stateService.setCurrentPlayer(playerId);
  stateService.startGame();
  stateService.updatePlayer({ id: playerId, currentSpace: space, visitType: 'First', visitedSpaces: [space], money: 1_000_000, hand } as any);
  await turnService.startTurn(playerId);
  return { ...s, playerId, player: () => stateService.getPlayer(playerId)! };
}

describe.each(['REG-DOB-AUDIT', 'REG-FDNY-PLAN-EXAM'])('%s: send your expeditor', (space) => {
  it('with an expeditor: the push-back spends it and costs no days', async () => {
    const s = await atSpace(space, ['E001', 'W001']);
    const t0 = s.stateService.getRealPlayerState(s.playerId).timeSpent;
    const preview = getTryAgainCostPreview(s, s.playerId);
    expect(preview.find((r: any) => r.key === 'expediting')?.value).toContain('Send an expeditor');
    expect(preview.find((r: any) => r.key === 'time')).toBeUndefined();
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.player().hand).not.toContain('E001');
    expect(s.player().hand).toContain('W001');
    expect(s.player().timeSpent).toBe(t0);
    expect(s.stateService.getGameState().discardPiles.E).toContain('E001');
  });

  it('without one: days as before', async () => {
    const s = await atSpace(space, ['W001']);
    const t0 = s.stateService.getRealPlayerState(s.playerId).timeSpent;
    await s.turnService.tryAgainOnSpace(s.playerId);
    expect(s.player().timeSpent).toBeGreaterThan(t0);
  });
});

it('a space without try_again_e_cost keeps costing days even with expeditors', async () => {
  const s = await atSpace('ENG-FEE-REVIEW', ['E001']);
  const t0 = s.stateService.getRealPlayerState(s.playerId).timeSpent;
  await s.turnService.tryAgainOnSpace(s.playerId);
  expect(s.player().hand).toContain('E001');
  expect(s.player().timeSpent).toBeGreaterThan(t0);
});
