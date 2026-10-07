import { describe, it, expect, afterEach } from 'vitest';
import { computeMat } from '../../src/utils/projectMat';
import { configureTrophyRules, getTrophyRules } from '../../src/utils/trophyRules';

const player = (over: any = {}): any => ({ costs: { architectural: 0, engineering: 0 }, ...over });
const ids = (tiles: ReturnType<typeof computeMat>) => tiles.filter(t => t.done).map(t => t.id);

describe('computeMat', () => {
  afterEach(() => configureTrophyRules([]));

  it('a fresh project has an empty mat in the stock order', () => {
    const tiles = computeMat(player(), { scopeTotal: 0, fundingGap: 0 });
    expect(tiles.map(t => t.id)).toEqual(['scope', 'funded', 'architect', 'engineer', 'dob', 'fdny', 'builder', 'finish']);
    expect(ids(tiles)).toEqual([]);
  });

  it('fills in as the project moves', () => {
    const tiles = computeMat(
      player({ costs: { architectural: 50, engineering: 0 }, dobApprovalStatus: 'approved', contractor: { quality: 'MED', multiplier: 1 } }),
      { scopeTotal: 500_000, fundingGap: 0 },
    );
    expect(ids(tiles)).toEqual(['scope', 'funded', 'architect', 'dob', 'builder']);
  });

  it('not funded while money is still to raise; finished once the player has finished', () => {
    expect(ids(computeMat(player(), { scopeTotal: 500_000, fundingGap: 10 }))).toEqual(['scope']);
    expect(ids(computeMat(player({ finishedAtTurn: 12 }), { scopeTotal: 0, fundingGap: 0 }))).toEqual(['finish']);
  });

  it('the data picks which tiles there are, their order and their labels', () => {
    configureTrophyRules([
      { kind: 'mat', key: 'guild', value: 'builder_hired', text: 'Guild joined' },
      { kind: 'mat', key: 'bad', value: 'not_a_check', text: 'Ignored' },
      { kind: 'mat', key: 'end', value: 'finished', text: 'Quest done' },
    ]);
    expect(getTrophyRules().mat.map(t => t.label)).toEqual(['Guild joined', 'Quest done']);
    expect(computeMat(player({ contractor: {} }), { scopeTotal: 0, fundingGap: 0 }).map(t => [t.label, t.done]))
      .toEqual([['Guild joined', true], ['Quest done', false]]);
  });
});
