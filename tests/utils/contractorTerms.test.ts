// contractorTerms — the v3.0.92 contractor price/schedule model ("A and C",
// maintainer 2026-07-02). Price centers on the scope estimate instead of the
// old 6–90%-of-scope discount; the multiplier finally moves the schedule too.
import { describe, it, expect } from 'vitest';
import { computeContractorTerms } from '../../src/utils/contractorTerms';

describe('computeContractorTerms', () => {
  it('centers the bid on the estimate: roll 3 MED = 100% of work cost', () => {
    const t = computeContractorTerms(1_000_000, 3, 'MED');
    expect(t.cost).toBe(1_000_000); // (0.7 + 0.3) × 1.0
    expect(t.priceFactor).toBeCloseTo(1.0);
  });

  it('spans 80%–130% before quality (roll 1 vs roll 6, MED)', () => {
    expect(computeContractorTerms(1_000_000, 1, 'MED').cost).toBe(800_000);
    expect(computeContractorTerms(1_000_000, 6, 'MED').cost).toBe(1_300_000);
  });

  it('quality trades price for schedule: HIGH costs more but builds faster', () => {
    const high = computeContractorTerms(1_000_000, 3, 'HIGH');
    const low = computeContractorTerms(1_000_000, 3, 'LOW');
    expect(high.cost).toBe(1_150_000);  // 1.0 × 1.15
    expect(low.cost).toBe(900_000);     // 1.0 × 0.9
    expect(high.scheduleDays).toBe(24); // 30 × 0.8
    expect(low.scheduleDays).toBe(39);  // 30 × 1.3
  });

  it('schedule scales with the roll: 10 days per point at MED', () => {
    expect(computeContractorTerms(1_000_000, 1, 'MED').scheduleDays).toBe(10);
    expect(computeContractorTerms(1_000_000, 6, 'MED').scheduleDays).toBe(60);
  });

  it('clamps a malformed multiplier to the middle of the range', () => {
    const t = computeContractorTerms(1_000_000, 99, 'MED');
    expect(t.cost).toBe(1_000_000);
    expect(t.scheduleDays).toBe(30);
  });

  it('zero work cost charges nothing but the crew still takes time', () => {
    const t = computeContractorTerms(0, 4, 'MED');
    expect(t.cost).toBe(0);
    expect(t.scheduleDays).toBe(40);
  });
});
