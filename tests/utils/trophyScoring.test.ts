import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { rankTrophies, computeRow, percentOfPlan, MeasureInput } from '../../src/utils/trophyScoring';
import { configureTrophyRules, getTrophyRules, pointsFor, countsAsReview, spaceEventFor } from '../../src/utils/trophyRules';
import { withQualityEvent, cloneTrophyRecord } from '../../src/utils/trophyRecord';

const rules = { trophiesToWin: 2 };

function player(id: string, over: Partial<MeasureInput> = {}): MeasureInput {
  return {
    playerId: id, name: id, finished: true, out: false, finishOrder: 1,
    daysUsed: 330, daysPlanned: 330, moneySpent: 1_000_000, moneyPlanned: 1_000_000,
    problemPoints: 0, reviews: 4,
    ...over,
  };
}

describe('percentOfPlan / computeRow', () => {
  it('is used ÷ planned as a percent with one decimal', () => {
    expect(percentOfPlan(212, 330)).toBe(64.2);
    expect(percentOfPlan(330, 330)).toBe(100);
  });

  it('reads 0 when there is no plan to measure against', () => {
    expect(percentOfPlan(50, 0)).toBe(0);
  });

  it('quality is problem points ÷ reviews; no reviews means nothing went wrong', () => {
    expect(computeRow(player('a', { problemPoints: 3, reviews: 4 })).quality).toBe(75);
    expect(computeRow(player('a', { problemPoints: 0, reviews: 0 })).quality).toBe(0);
  });

  it('worked example: an ordinary player', () => {
    // 297 of 330 days, $0.9M of a $1.0M budget, one sent-back review out of 4.
    const row = computeRow(player('ordinary', { daysUsed: 297, moneySpent: 900_000, problemPoints: 1, reviews: 4 }));
    expect([row.time, row.money, row.quality, row.sum]).toEqual([90, 90, 25, 205]);
  });

  it('worked example: a player who cut corners', () => {
    // 330 of 330 days, $1.1M of $1.0M, two sent back + a cut corner + a violation over 5 reviews = 1+1+2+2 = 6 points.
    const row = computeRow(player('corner', { daysUsed: 330, moneySpent: 1_100_000, problemPoints: 6, reviews: 5 }));
    expect([row.time, row.money, row.quality, row.sum]).toEqual([100, 110, 120, 330]);
  });
});

describe('rankTrophies', () => {
  it('a player who is fastest and best built wins on two trophies', () => {
    const s = rankTrophies([
      player('fast', { daysUsed: 280, moneySpent: 1_050_000, problemPoints: 0 }),
      player('cheap', { daysUsed: 340, moneySpent: 900_000, problemPoints: 2 }),
    ], rules);
    expect(s.winnerId).toBe('fast');
    expect(s.decidedBy).toBe('trophies');
    expect(s.rows.find(r => r.playerId === 'fast')!.trophies.sort()).toEqual(['quality', 'time']);
    expect(s.rows.find(r => r.playerId === 'cheap')!.trophies).toEqual(['money']);
  });

  it('with nobody holding two, the lowest total of the three percentages wins', () => {
    const s = rankTrophies([
      player('a', { daysUsed: 264, moneySpent: 1_200_000, problemPoints: 4 }),  // 80 / 120 / 100 = 300  (time)
      player('b', { daysUsed: 396, moneySpent: 800_000, problemPoints: 4 }),    // 120 / 80 / 100 = 300  (money)
      player('c', { daysUsed: 330, moneySpent: 1_000_000, problemPoints: 0 }),  // 100 / 100 / 0 = 200   (quality)
    ], rules);
    expect(s.decidedBy).toBe('sum');
    expect(s.winnerId).toBe('c');
  });

  it('a player who is out holds no trophy even with the best numbers, and cannot win', () => {
    const s = rankTrophies([
      player('broke', { out: true, finished: false, daysUsed: 10, moneySpent: 1, problemPoints: 0 }),
      player('ok', { daysUsed: 400, moneySpent: 1_300_000, problemPoints: 3 }),
    ], rules);
    expect(s.winnerId).toBe('ok');
    expect(s.rows.find(r => r.playerId === 'broke')!.trophies).toEqual([]);
    expect(s.rows.find(r => r.playerId === 'broke')!.status).toBe('out');
    expect(s.rows.find(r => r.playerId === 'ok')!.trophies.length).toBe(3);
  });

  it('nobody finished: no winner', () => {
    const s = rankTrophies([
      player('x', { out: true, finished: false }),
      player('y', { out: true, finished: false }),
    ], rules);
    expect(s.winnerId).toBeNull();
    expect(s.decidedBy).toBe('none');
  });

  it('a tie shares the trophy; a dead heat on the total goes to whoever finished first', () => {
    const s = rankTrophies([
      player('late', { finishOrder: 9 }),
      player('early', { finishOrder: 3 }),
    ], rules);
    expect(s.rows.every(r => r.trophies.length === 3)).toBe(true);
    expect(s.winnerId).toBe('early');
    expect(s.decidedBy).toBe('sum');
  });

  it('a lone finisher holds all three and wins', () => {
    const s = rankTrophies([player('solo')], rules);
    expect(s.winnerId).toBe('solo');
    expect(s.decidedBy).toBe('trophies');
  });
});

describe('TROPHIES.csv', () => {
  afterEach(() => configureTrophyRules([]));

  it('the shipped file sets the sizes the plan was approved with', () => {
    const text = readFileSync(join(process.cwd(), 'public', 'data', 'CLEAN_FILES', 'TROPHIES.csv'), 'utf-8');
    const [head, ...lines] = text.trim().split(/\r?\n/);
    const cols = head.split(',');
    const rows = lines.map(l => {
      const v = l.split(',');
      return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ''])) as { kind: string; key: string; value: string; text: string };
    });
    configureTrophyRules(rows);
    expect(getTrophyRules().trophiesToWin).toBe(2);
    expect(pointsFor('review_passed')).toBe(0);
    expect(pointsFor('review_sent_back')).toBe(1);
    expect(pointsFor('violation')).toBe(2);
    expect(pointsFor('cut_corner')).toBe(2);
    expect(countsAsReview('review_passed')).toBe(true);
    expect(countsAsReview('violation')).toBe(false);
    expect(spaceEventFor('CHEAT-BYPASS')).toBe('cut_corner');
  });

  it('a reskin changes names, sizes and the space event by data alone', () => {
    configureTrophyRules([
      { kind: 'trophy', key: 'time', value: '', text: 'Swiftest' },
      { kind: 'rule', key: 'trophies_to_win', value: '3', text: '' },
      { kind: 'points', key: 'review_sent_back', value: '5', text: '' },
      { kind: 'review', key: 'review_sent_back', value: '', text: '' },
      { kind: 'space_event', key: 'THIEVES-GUILD', value: 'cut_corner', text: '' },
    ]);
    expect(getTrophyRules().names.time).toBe('Swiftest');
    expect(getTrophyRules().names.money).toBe('On budget');
    expect(getTrophyRules().trophiesToWin).toBe(3);
    expect(pointsFor('review_sent_back')).toBe(5);
    expect(spaceEventFor('CHEAT-BYPASS')).toBeUndefined();
    expect(spaceEventFor('THIEVES-GUILD')).toBe('cut_corner');
  });

  it('a missing or empty file keeps the built-in defaults', () => {
    configureTrophyRules([]);
    expect(getTrophyRules().trophiesToWin).toBe(2);
    expect(pointsFor('cut_corner')).toBe(2);
  });
});

describe('quality ledger', () => {
  it('adds reviews and problem points by the data sizes', () => {
    configureTrophyRules([]);
    let rec = withQualityEvent(undefined, 'review_passed');
    rec = withQualityEvent(rec, 'review_sent_back');
    rec = withQualityEvent(rec, 'cut_corner');
    expect(rec).toEqual({ reviews: 2, problemPoints: 3, counts: { review_passed: 1, review_sent_back: 1, cut_corner: 1 } });
  });

  it('does not change the record it was given, and clones do not share counts', () => {
    const a = withQualityEvent(undefined, 'violation');
    const b = withQualityEvent(a, 'violation');
    expect(a.counts.violation).toBe(1);
    expect(b.counts.violation).toBe(2);
    const c = cloneTrophyRecord(b)!;
    c.counts.violation = 99;
    expect(b.counts.violation).toBe(2);
  });
});
