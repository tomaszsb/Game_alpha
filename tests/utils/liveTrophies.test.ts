import { describe, it, expect } from 'vitest';
import { buildLiveBoard, ordinal } from '../../src/utils/liveTrophies';
import type { MeasureInput } from '../../src/utils/trophyScoring';

const p = (id: string, over: Partial<MeasureInput> = {}): MeasureInput => ({
  playerId: id, name: id, finished: false, out: false, finishOrder: 99,
  daysUsed: 100, daysPlanned: 400, moneySpent: 100_000, moneyPlanned: 1_000_000,
  problemPoints: 0, reviews: 2, ...over,
});
const row = (b: ReturnType<typeof buildLiveBoard>, id: string) => b.rows.find(r => r.playerId === id)!;

describe('buildLiveBoard', () => {
  it('places each player in each race and says how many points behind the leader', () => {
    const b = buildLiveBoard([
      p('a', { daysUsed: 100, moneySpent: 300_000, problemPoints: 0 }),   // 25% / 30% / 0%
      p('b', { daysUsed: 120, moneySpent: 100_000, problemPoints: 2 }),   // 30% / 10% / 100%
      p('c', { daysUsed: 160, moneySpent: 200_000, problemPoints: 1 }),   // 40% / 20% / 50%
    ]);
    expect(row(b, 'a').races.time).toMatchObject({ place: 1, of: 3, behind: 0 });
    expect(row(b, 'b').races.time).toMatchObject({ place: 2, behind: 5 });
    expect(row(b, 'c').races.time).toMatchObject({ place: 3, behind: 15 });
    expect(row(b, 'b').races.money).toMatchObject({ place: 1, behind: 0 });
    expect(row(b, 'a').races.money).toMatchObject({ place: 3, behind: 20 });
    expect(row(b, 'a').races.quality.place).toBe(1);
    expect(row(b, 'b').races.quality).toMatchObject({ place: 3, behind: 100 });
  });

  it('ties share the better place', () => {
    const b = buildLiveBoard([p('a'), p('b'), p('c', { problemPoints: 2 })]);
    expect(row(b, 'a').races.quality.place).toBe(1);
    expect(row(b, 'b').races.quality.place).toBe(1);
    expect(row(b, 'c').races.quality.place).toBe(3);
  });

  it('a place is solid only once every other player has finished or passed this player\'s day', () => {
    const b = buildLiveBoard([
      p('early', { daysUsed: 50 }),
      p('late', { daysUsed: 200 }),
    ]);
    expect(row(b, 'early').solid).toBe(true);   // late is past day 50
    expect(row(b, 'late').solid).toBe(false);   // early has not reached day 200
    expect(b.anyProvisional).toBe(true);
  });

  it('a finished player counts as having passed everyone\'s timeline', () => {
    const b = buildLiveBoard([
      p('done', { daysUsed: 40, finished: true }),
      p('mid', { daysUsed: 60 }),
    ]);
    expect(row(b, 'mid').solid).toBe(true);
    expect(row(b, 'done').solid).toBe(true);  // mid (day 60) has already passed day 40
  });

  it('players who are out are not in the races and do not hold anyone else back', () => {
    const b = buildLiveBoard([
      p('a', { daysUsed: 50 }),
      p('gone', { out: true, daysUsed: 1 }),
    ]);
    expect(row(b, 'gone').status).toBe('out');
    expect(row(b, 'gone').races.time.place).toBeNull();
    expect(row(b, 'a').races.time).toMatchObject({ place: 1, of: 1 });
    expect(row(b, 'a').solid).toBe(true);
    expect(b.anyProvisional).toBe(false);
  });

  it('nothing is provisional when everyone has finished', () => {
    const b = buildLiveBoard([p('a', { finished: true }), p('b', { finished: true })]);
    expect(b.anyProvisional).toBe(false);
  });
});

describe('ordinal', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [21, '21st']])('%i -> %s', (n, s) => {
    expect(ordinal(n as number)).toBe(s);
  });
});
