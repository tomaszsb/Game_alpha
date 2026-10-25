// The trophy markers after a Commit or Negotiate (Tom, 2026-10-25): a green plus or red minus with the new place,
// only for a race that was on before and after and whose place changed; at most two so the balloon fits a phone.
import { describe, it, expect } from 'vitest';
import { trophyBubbles } from '../../src/utils/townLayout';
import { buildLiveBoard, racePlaces } from '../../src/utils/liveTrophies';
import type { MeasureInput } from '../../src/utils/trophyScoring';

const none = { time: null, money: null, quality: null };

describe('trophyBubbles', () => {
  it('a plus when the place improves, a minus when it slips, with the new place', () => {
    const b = trophyBubbles({ time: 3, money: 1, quality: 2 }, { time: 2, money: 2, quality: 2 });
    expect(b.map(x => [x.trophy, x.text, x.tone])).toEqual([['time', '+ 2nd', 'good'], ['money', '− 2nd', 'bad']]);
    expect(b.every(x => x.kind === 'trophy')).toBe(true);
  });
  it('says nothing for an unchanged place, a race that is not on, or one that has just started', () => {
    expect(trophyBubbles({ time: 2, money: 2, quality: 2 }, { time: 2, money: 2, quality: 2 })).toEqual([]);
    expect(trophyBubbles(none, { time: 1, money: 2, quality: 1 })).toEqual([]);
    expect(trophyBubbles({ time: 1, money: 1, quality: 1 }, none)).toEqual([]);
  });
  it('shows at most two, in the order of the clipboard (Time, Scope, Money)', () => {
    const b = trophyBubbles({ time: 2, money: 2, quality: 2 }, { time: 1, money: 1, quality: 1 });
    expect(b.map(x => x.trophy)).toEqual(['time', 'quality']);
  });
});

describe('racePlaces', () => {
  const inp = (id: string, over: Partial<MeasureInput> = {}): MeasureInput => ({
    playerId: id, name: id, finished: false, out: false, finishOrder: 99,
    daysUsed: 100, daysPlanned: 400, moneySpent: 100_000, moneyPlanned: 1_000_000, problemPoints: 0, reviews: 2, ...over,
  });
  it('gives the place in each race that is on, and null elsewhere', () => {
    const board = buildLiveBoard([inp('a', { daysUsed: 50 }), inp('b')]);
    expect(racePlaces(board, 'a')).toEqual({ time: 1, money: null, quality: null });
    expect(racePlaces(board, 'b')).toEqual({ time: 2, money: null, quality: null });
    expect(racePlaces(buildLiveBoard([inp('a')]), 'a')).toEqual(none);
    expect(racePlaces(board, 'nobody')).toEqual(none);
  });
});

describe('which steps are stamped (data)', () => {
  it('TROPHIES.csv names the stamped steps, and a file with none keeps the stock three', async () => {
    const { getTrophyRules, configureTrophyRules } = await import('../../src/utils/trophyRules');
    const { computeMat } = await import('../../src/utils/projectMat');
    expect(getTrophyRules().stamps).toEqual(['dob_approved', 'fdny_approved', 'builder_hired']);
    configureTrophyRules([{ kind: 'stamp', key: 'builder_hired', value: '', text: '' }, { kind: 'mat', key: 'builder', value: 'builder_hired', text: 'Builder hired' }, { kind: 'mat', key: 'scope', value: 'scope_set', text: 'Scope chosen' }]);
    expect(getTrophyRules().stamps).toEqual(['builder_hired']);
    const tiles = computeMat({} as never, { scopeTotal: 0, fundingGap: 0 });
    expect(tiles.map(t => [t.id, !!t.stamps])).toEqual([['builder', true], ['scope', false]]);
    configureTrophyRules([]);
  });
});
