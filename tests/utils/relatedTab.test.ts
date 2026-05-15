import { describe, it, expect } from 'vitest';
import { pickRelatedTab } from '../../src/utils/relatedTab';
import type { DiceResultEffect } from '../../src/types/StateTypes';

const money = (n: number): DiceResultEffect => ({
  type: 'money', description: '', value: n,
});
const card = (cardType: string): DiceResultEffect => ({
  type: 'cards', description: '', cardType, cardCount: 1,
});
const time = (): DiceResultEffect => ({ type: 'time', description: '' });
const movement = (): DiceResultEffect => ({ type: 'movement', description: '' });
const info = (): DiceResultEffect => ({ type: 'info', description: '' });

describe('pickRelatedTab', () => {
  it('returns null for empty or missing effects', () => {
    expect(pickRelatedTab(undefined)).toBeNull();
    expect(pickRelatedTab([])).toBeNull();
  });

  it('returns null when no effect matches a tab', () => {
    expect(pickRelatedTab([movement(), info()])).toBeNull();
  });

  it('routes money effects to the ledger tab', () => {
    expect(pickRelatedTab([money(50000)])).toBe('ledger');
  });

  it('prefers money over card mapping when both are present', () => {
    // Money is the playtester-driving need for at-a-glance feedback.
    expect(pickRelatedTab([card('E'), money(100)])).toBe('ledger');
  });

  it.each([
    ['E', 'expeditors'],
    ['L', 'events'],
    ['W', 'ledger'],
    ['B', 'ledger'],
    ['I', 'ledger'],
  ])('routes %s-card effects to the %s tab', (cardType, expected) => {
    expect(pickRelatedTab([card(cardType)])).toBe(expected);
  });

  it('is case-insensitive on cardType', () => {
    expect(pickRelatedTab([card('e')])).toBe('expeditors');
    expect(pickRelatedTab([card('l')])).toBe('events');
  });

  it('falls back to ledger for time-only effects', () => {
    expect(pickRelatedTab([time()])).toBe('ledger');
  });
});
