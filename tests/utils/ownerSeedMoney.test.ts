// ownerSeedMoney — the shared owner seed-money calculation, extracted
// v3.0.119 to fix a drift risk flagged by the 2026-07-11 blind code review:
// TurnService.handleAutomaticFunding and EffectEngineService's
// OWNER_SEED_MONEY case each had their own copy of this formula.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateOwnerSeedMoney } from '../../src/utils/ownerSeedMoney';

describe('calculateOwnerSeedMoney', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('centers on the scope estimate: Math.random 0.5 = 100% of scope', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = calculateOwnerSeedMoney(1_000_000);
    expect(result.multiplier).toBeCloseTo(1.0);
    expect(result.amount).toBe(1_000_000);
  });

  it('spans 80%-120% of scope (random 0 vs random 1)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(calculateOwnerSeedMoney(1_000_000).amount).toBe(800_000);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(calculateOwnerSeedMoney(1_000_000).amount).toBe(1_200_000);
  });

  it('rounds the final amount to the nearest $10,000', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37); // multiplier 0.948
    const result = calculateOwnerSeedMoney(1_234_567);
    expect(result.amount % 10_000).toBe(0);
  });

  it('zero scope yields zero seed money', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(calculateOwnerSeedMoney(0).amount).toBe(0);
  });
});
