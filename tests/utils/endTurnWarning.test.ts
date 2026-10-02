import { describe, it, expect } from 'vitest';
import { getEndTurnWarning, LOW_CASH_PCT_OF_SCOPE } from '../../src/utils/endTurnWarning';

const base = { money: 1_000_000, designFees: 0, scope: 4_000_000, billedThisTurn: false };

describe('getEndTurnWarning', () => {
  it('says nothing when all is well', () => {
    expect(getEndTurnWarning(base)).toBeNull();
  });

  it('RED when the player cannot pay: ending the turn would end the project', () => {
    const w = getEndTurnWarning({ ...base, money: -65_000, billedThisTurn: true })!;
    expect(w.level).toBe('red');
    expect(w.message).toContain('$65,000 short');
    expect(w.message).toContain('push back');
  });

  it('RED when design fees are at or past 20% of scope', () => {
    expect(getEndTurnWarning({ ...base, designFees: 800_000 })!.level).toBe('red'); // exactly 20%
    expect(getEndTurnWarning({ ...base, designFees: 900_000 })!.message).toContain('22.5%');
  });

  it('ORANGE from 15% up to the cap', () => {
    expect(getEndTurnWarning({ ...base, designFees: 600_000 })!.level).toBe('orange'); // 15%
    expect(getEndTurnWarning({ ...base, designFees: 799_999 })!.level).toBe('orange');
    expect(getEndTurnWarning({ ...base, designFees: 599_999 })).toBeNull();
  });

  it('ORANGE for thin cash — but only when a bill landed this turn', () => {
    const thin = (LOW_CASH_PCT_OF_SCOPE / 100) * 4_000_000 - 1;
    expect(getEndTurnWarning({ ...base, money: thin, billedThisTurn: true })!.level).toBe('orange');
    expect(getEndTurnWarning({ ...base, money: thin, billedThisTurn: false })).toBeNull();
    expect(getEndTurnWarning({ ...base, money: thin + 1, billedThisTurn: true })).toBeNull();
  });

  it('the most serious problem wins', () => {
    const w = getEndTurnWarning({ money: -1, designFees: 900_000, scope: 4_000_000, billedThisTurn: true })!;
    expect(w.level).toBe('red');
    expect(w.message).toContain("can't pay");
  });

  it('no scope: no percentage warnings, still catches an unpayable bill', () => {
    expect(getEndTurnWarning({ money: 5, designFees: 999, scope: 0, billedThisTurn: true })).toBeNull();
    expect(getEndTurnWarning({ money: -5, designFees: 0, scope: 0, billedThisTurn: true })!.level).toBe('red');
  });
});
