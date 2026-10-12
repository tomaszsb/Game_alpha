// A phase the colour table has never heard of (a reskin's own name) still gets a colour (v3.7.22).
import { describe, it, expect } from 'vitest';
import { PHASE_COLORS, phaseColorsFor } from '../../src/utils/boardCommon';

describe('phaseColorsFor', () => {
  it('gives the stock phases their stock colours, unchanged', () => {
    for (const [name, c] of Object.entries(PHASE_COLORS)) expect(phaseColorsFor(name)).toEqual(c);
  });

  it('gives a renamed phase a steady colour that is not the neutral grey', () => {
    const a = phaseColorsFor('THE ROAD');
    expect(a).toEqual(phaseColorsFor('THE ROAD'));
    expect(a.border).not.toBe('#adb5bd');
    expect(Object.values(PHASE_COLORS).map(c => c.border)).not.toContain(a.border);
  });

  it('keeps the neutral grey for no phase at all', () => {
    expect(phaseColorsFor(undefined).border).toBe('#adb5bd');
    expect(phaseColorsFor('').border).toBe('#adb5bd');
  });
});
