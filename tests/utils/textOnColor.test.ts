import { describe, it, expect } from 'vitest';
import { contrastRatio, inkOn } from '../../src/utils/textOnColor';

// Every colour a player can pick (src/styles/theme.ts colors.game.player1-8).
const PLAYER_COLOURS = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1', '#e83e8c', '#20c997', '#fd7e14'];

describe('inkOn', () => {
  it('gives every player colour a name colour with at least 4.5:1, and orange and yellow go dark', () => {
    for (const c of PLAYER_COLOURS) {
      const { ink } = inkOn(c);
      expect(contrastRatio(ink, c), c).toBeGreaterThanOrEqual(4.5);
    }
    expect(inkOn('#fd7e14').ink).toBe('#05070d');
    expect(inkOn('#ffc107').ink).toBe('#05070d');
    expect(inkOn('#6f42c1').ink).toBe('#ffffff');
  });
  it('never picks the worse of the two inks', () => {
    for (const c of PLAYER_COLOURS) {
      const { ink } = inkOn(c);
      const other = ink === '#ffffff' ? '#05070d' : '#ffffff';
      expect(contrastRatio(ink, c)).toBeGreaterThanOrEqual(contrastRatio(other, c));
    }
  });
  it('falls back to white on a colour it cannot read', () => {
    expect(inkOn('rebeccapurple').ink).toBe('#ffffff');
  });
});
