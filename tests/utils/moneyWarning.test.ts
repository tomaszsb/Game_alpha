// "You would be short" before the purchase, not only after it (Tom, 2026-10-21).
import { describe, it, expect } from 'vitest';
import { knownArrivalFee, shortBy, arrivalShortMessage, builderShortMessage } from '../../src/utils/moneyWarning';

const fee = (effect_value: string, fee_type: string) => ({ effect_type: 'fee', effect_action: 'deduct', effect_value, fee_type }) as any;

describe('knownArrivalFee', () => {
  it('counts a fixed fee and a percent-of-scope fee, and nothing it cannot know', () => {
    expect(knownArrivalFee([fee('$10000', 'FIXED')], 0)).toBe(10_000);
    expect(knownArrivalFee([fee('2% of scope', 'SCOPE_PERCENTAGE')], 1_000_000)).toBe(20_000);
    expect(knownArrivalFee([fee('1%', 'LOAN_PERCENTAGE'), fee('varies', 'DICE_BASED')], 1_000_000)).toBe(0);
  });
  it('adds several fees and ignores rows that are not fees', () => {
    const rows = [fee('$5000', 'FIXED'), fee('0.5% of scope', 'SCOPE_PERCENTAGE'), { effect_type: 'time', effect_action: 'add', effect_value: '3' } as any];
    expect(knownArrivalFee(rows, 1_000_000)).toBe(10_000);
  });
});

describe('shortBy and the messages', () => {
  it('is zero when the cash covers the cost, and the gap when it does not', () => {
    expect(shortBy(50_000, 10_000)).toBe(0);
    expect(shortBy(10_000, 10_000)).toBe(0);
    expect(shortBy(4_000, 10_000)).toBe(6_000);
    expect(shortBy(NaN, 10_000)).toBe(0);
  });
  it('the messages name the amounts in plain words', () => {
    expect(arrivalShortMessage(4_000, 10_000)).toBe('Costs $10,000 when you get there. You have $4,000, so you would be $6,000 short.');
    expect(builderShortMessage(800_000, 1_000_000)).toContain('you would be $200,000 short');
  });
});
