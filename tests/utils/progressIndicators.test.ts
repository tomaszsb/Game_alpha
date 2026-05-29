import { describe, it, expect } from 'vitest';
import { designFeeIndicator, timelineIndicator } from '../../src/utils/progressIndicators';

// fb:f8491e74 — pin the color thresholds (so the visual treatment can't silently
// drift) and assert every state carries an explanatory tooltip.

describe('designFeeIndicator', () => {
  it('green well under the cap', () => {
    expect(designFeeIndicator(0).color).toBe('#4caf50');
    expect(designFeeIndicator(9.9).color).toBe('#4caf50');
  });

  it('yellow at 10–15%', () => {
    expect(designFeeIndicator(10).color).toBe('#ff9800');
    expect(designFeeIndicator(14.9).color).toBe('#ff9800');
  });

  it('orange at 15–20%', () => {
    expect(designFeeIndicator(15).color).toBe('#ff5722');
    expect(designFeeIndicator(19.9).color).toBe('#ff5722');
  });

  it('red at or over the 20% cap', () => {
    expect(designFeeIndicator(20).color).toBe('#f44336');
    expect(designFeeIndicator(35).color).toBe('#f44336');
  });

  it('always provides a tooltip mentioning the percentage and the cap', () => {
    const ind = designFeeIndicator(22.5);
    expect(ind.tooltip).toContain('22.5%');
    expect(ind.tooltip.toLowerCase()).toContain('cap');
  });
});

describe('timelineIndicator', () => {
  it('green when on track (<75%)', () => {
    expect(timelineIndicator(0).color).toBe('#4caf50');
    expect(timelineIndicator(74).color).toBe('#4caf50');
  });

  it('orange when running long (75–100%)', () => {
    expect(timelineIndicator(75).color).toBe('#ff9800');
    expect(timelineIndicator(99).color).toBe('#ff9800');
  });

  it('red when over the estimate (≥100%)', () => {
    expect(timelineIndicator(100).color).toBe('#f44336');
    expect(timelineIndicator(150).color).toBe('#f44336');
  });

  it('tooltip rounds the percentage and explains the estimate basis', () => {
    const ind = timelineIndicator(82.4);
    expect(ind.tooltip).toContain('82%');
    expect(ind.tooltip.toLowerCase()).toContain('contingency');
  });
});
