import { describe, it, expect } from 'vitest';
import { describeCardAction } from '../../src/services/DiceService';

describe('describeCardAction', () => {
  describe('draw', () => {
    it.each([
      ['W', 1, 'Took on a Work Package'],
      ['W', 3, 'Took on 3 Work Packages'],
      ['B', 1, 'Secured a Bank Loan'],
      ['B', 2, 'Secured 2 Bank Loans'],
      ['E', 1, 'Hired an Expeditor'],
      ['E', 3, 'Hired 3 Expeditors'],
      ['I', 1, 'Secured an Investment'],
      ['I', 5, 'Secured 5 Investments'],
    ])('%s × %i → %s', (type, count, expected) => {
      expect(describeCardAction('draw', type, count)).toBe(expected);
    });

    it('renders L draws as hit-on-player', () => {
      expect(describeCardAction('draw', 'L', 1)).toBe('A Life Event hit');
      expect(describeCardAction('draw', 'L', 2)).toBe('2 Life Events hit');
    });
  });

  describe('replace / remove (regression for v2.63.6)', () => {
    it('uses Swapped for E replace', () => {
      expect(describeCardAction('replace', 'E', 1)).toBe('Swapped an Expeditor');
      expect(describeCardAction('replace', 'E', 2)).toBe('Swapped 2 Expeditors');
    });
    it('uses Released for E remove', () => {
      expect(describeCardAction('remove', 'E', 1)).toBe('Released an Expeditor');
    });
  });

  describe('give (new in v2.63.9)', () => {
    it.each([
      ['W', 1, 'Handed off a Work Package to opponent'],
      ['W', 2, 'Handed off 2 Work Packages to opponent'],
      ['B', 1, 'Transferred a Bank Loan to opponent'],
      ['E', 1, 'Loaned out an Expeditor to opponent'],
      ['E', 3, 'Loaned out 3 Expeditors to opponent'],
      ['I', 1, 'Transferred an Investment to opponent'],
      ['L', 1, 'Passed on a Life Event to opponent'],
    ])('%s × %i → %s', (type, count, expected) => {
      expect(describeCardAction('give', type, count)).toBe(expected);
    });
  });

  describe('return (new in v2.63.9)', () => {
    it.each([
      ['W', 1, 'Returned a Work Package'],
      ['W', 2, 'Returned 2 Work Packages'],
      ['B', 1, 'Repaid a Bank Loan'],
      ['E', 1, 'Released an Expeditor'],
      ['E', 3, 'Released 3 Expeditors'],
      ['I', 1, 'Bought back an Investment'],
      ['L', 1, 'Resolved a Life Event'],
    ])('%s × %i → %s', (type, count, expected) => {
      expect(describeCardAction('return', type, count)).toBe(expected);
    });
  });

  it('never leaks letter-code "X cards" wording', () => {
    const actions: Array<'draw' | 'remove' | 'replace' | 'give' | 'return'> =
      ['draw', 'remove', 'replace', 'give', 'return'];
    const types = ['W', 'B', 'E', 'I', 'L'];
    for (const action of actions) {
      for (const type of types) {
        for (const count of [1, 2, 5]) {
          const out = describeCardAction(action, type, count);
          expect(out).not.toMatch(/\b[EWBIL] cards?\b/i);
        }
      }
    }
  });
});
