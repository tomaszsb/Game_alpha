// The pure rules of the filing rep's run: what counts as a send-back, when the offer comes, which roll is kept.
import { describe, it, expect } from 'vitest';
import {
  isSendBack, isPass, nextSendBackCount, shouldOffer, pickFilingRep, bestIndex, isBetter, parseFeePct, itemsOfScopeCell,
  circleTwice, circleEnds, loopsBeforeOffer, describeStep, describeTotal,
} from '../../src/utils/autoRunRules';
import { getRepRules } from '../../src/utils/repRules';

describe('what counts as a send-back', () => {
  it('a move from a circle stop to the same or an earlier circle stop is a send-back', () => {
    expect(isSendBack('REG-DOB-PLAN-EXAM', 'ARCH-INITIATION')).toBe(true);
    expect(isSendBack('REG-DOB-PLAN-EXAM', 'REG-DOB-PLAN-EXAM')).toBe(true); // "come back to the exam"
    expect(isSendBack('ENG-SCOPE-CHECK', 'ARCH-INITIATION')).toBe(true);
  });
  it('moving on round the circle, or anywhere off it, is not', () => {
    expect(isSendBack('ARCH-INITIATION', 'ARCH-FEE-REVIEW')).toBe(false);
    expect(isSendBack('ARCH-SCOPE-CHECK', 'PM-DECISION-CHECK')).toBe(false);
    expect(isSendBack('PM-DECISION-CHECK', 'ARCH-INITIATION')).toBe(false); // the student chose that one
    expect(isSendBack(undefined, 'ARCH-INITIATION')).toBe(false);
  });
  it('a pass is leaving the plan exam for somewhere off the circle', () => {
    expect(isPass('REG-DOB-PLAN-EXAM', 'REG-FDNY-FEE-REVIEW')).toBe(true);
    expect(isPass('REG-DOB-PLAN-EXAM', 'ARCH-INITIATION')).toBe(false);
    expect(isPass('ENG-SCOPE-CHECK', 'PM-DECISION-CHECK')).toBe(false);
  });
  it('the counter goes up on a send-back, resets on a pass, and otherwise stays', () => {
    expect(nextSendBackCount(1, 'REG-DOB-PLAN-EXAM', 'ARCH-INITIATION')).toBe(2);
    expect(nextSendBackCount(5, 'REG-DOB-PLAN-EXAM', 'REG-FDNY-FEE-REVIEW')).toBe(0);
    expect(nextSendBackCount(2, 'ARCH-INITIATION', 'ARCH-FEE-REVIEW')).toBe(2);
  });
});

describe('when the offer comes', () => {
  it('after two send-backs in a row, standing at the first stop on a return visit', () => {
    expect(loopsBeforeOffer()).toBe(2);
    expect(shouldOffer(2, 'ARCH-INITIATION', 'Subsequent')).toBe(true);
    expect(shouldOffer(1, 'ARCH-INITIATION', 'Subsequent')).toBe(false); // the first two loops are always by hand
    expect(shouldOffer(0, 'ARCH-INITIATION', 'Subsequent')).toBe(false);
    expect(shouldOffer(3, 'ARCH-FEE-REVIEW', 'Subsequent')).toBe(false);
    expect(shouldOffer(3, 'ARCH-INITIATION', 'First')).toBe(false);
  });
  it('the circle runs from the architect to the plan exam, and a good rep rolls twice only before the city stops', () => {
    expect(circleEnds()).toEqual({ first: 'ARCH-INITIATION', last: 'REG-DOB-PLAN-EXAM' });
    expect(getRepRules().circle.length).toBe(9);
    expect(circleTwice('ARCH-FEE-REVIEW')).toBe(true);
    expect(circleTwice('ENG-SCOPE-CHECK')).toBe(true);
    expect(circleTwice('REG-DOB-FEE-REVIEW')).toBe(false);
    expect(circleTwice('PM-DECISION-CHECK')).toBe(false);
  });
});

describe('which rep goes', () => {
  const good = getRepRules().reps.find(r => r.sign === 'good')!;
  const bad = getRepRules().reps.find(r => r.sign === 'bad')!;
  const held = (id: string) => ({ id, hiredDay: 0, salaryBilledThroughDay: 0, salary: 1, lastRollDay: 0 }) as never;
  it('none held: nobody to send', () => {
    expect(pickFilingRep(undefined)).toBeNull();
    expect(pickFilingRep([])).toBeNull();
  });
  it('a good rep is preferred; otherwise the bad one goes', () => {
    expect(pickFilingRep([held(bad.id), held(good.id)])?.good).toBe(true);
    expect(pickFilingRep([held(bad.id)])?.good).toBe(false);
  });
});

describe('the better of two rolls: fewer days, then lower fee, then fewer work items; a tie keeps the first', () => {
  it('days first', () => {
    expect(bestIndex([{ days: 10, feePct: 0, items: 0 }, { days: 5, feePct: 9, items: 9 }])).toBe(1);
  });
  it('then the fee', () => {
    expect(bestIndex([{ days: 5, feePct: 2, items: 0 }, { days: 5, feePct: 1, items: 9 }])).toBe(1);
  });
  it('then the work items', () => {
    expect(bestIndex([{ days: 5, feePct: 1, items: 2 }, { days: 5, feePct: 1, items: -1 }])).toBe(1);
  });
  it('a tie keeps the first', () => {
    const t = { days: 5, feePct: 1, items: 0 };
    expect(isBetter(t, t)).toBe(false);
    expect(bestIndex([t, { ...t }])).toBe(0);
  });
  it('reads the dice tables', () => {
    expect(parseFeePct('2%')).toBe(2);
    expect(parseFeePct(undefined)).toBe(0);
    expect(itemsOfScopeCell('Remove 1')).toBe(-1);
    expect(itemsOfScopeCell('Draw 1')).toBe(1);
    expect(itemsOfScopeCell('Replace 1')).toBe(0);
    expect(itemsOfScopeCell('No change')).toBe(0);
  });
});

describe('the words', () => {
  it('say what was rolled and what it cost', () => {
    expect(describeStep({ rolls: [2, 5], kept: 2, dMoney: -1000, dDays: 15, dItems: -1 }))
      .toBe('rolled 2 and 5, kept the 2, cost $1,000, +15 days, one work item removed');
    expect(describeStep({ dMoney: 0, dDays: 0, dItems: 0 })).toBe('nothing new');
    expect(describeTotal(-500, 1)).toBe('+1 day, -$500');
  });
});
