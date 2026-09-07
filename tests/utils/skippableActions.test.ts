/**
 * The skippable-action rule had been hand-written in three files and then
 * missed in a fourth (PlayerPanelV2's blocking-reason line), which is what put
 * "Finish “Swap one helper for another” above first" on a gate that action
 * could not open. These tests pin the shared predicate that replaced all four.
 */
import { describe, it, expect } from 'vitest';
import { isSkippableEffectAction } from '../../src/utils/skippableActions';

describe('isSkippableEffectAction', () => {
  it('treats the three optional expeditor actions as skippable, bare or compound', () => {
    for (const bare of ['replace_e', 'replace_l', 'return_e', 'return_l', 'give_e']) {
      expect(isSkippableEffectAction(bare)).toBe(true);
      expect(isSkippableEffectAction(`cards:${bare}`)).toBe(true);
      expect(isSkippableEffectAction(bare.toUpperCase())).toBe(true);
    }
  });

  it('does not treat required actions as skippable', () => {
    for (const bare of ['draw_w', 'draw_b', 'draw_e', 'draw_l', 'draw_i', 'dice_outcome', 'transfer']) {
      expect(isSkippableEffectAction(bare)).toBe(false);
      expect(isSkippableEffectAction(`cards:${bare}`)).toBe(false);
    }
  });

  it('is false for missing or empty input rather than throwing', () => {
    expect(isSkippableEffectAction(undefined)).toBe(false);
    expect(isSkippableEffectAction(null)).toBe(false);
    expect(isSkippableEffectAction('')).toBe(false);
    expect(isSkippableEffectAction('cards:')).toBe(false);
  });

  it('matches on the action, never on a type prefix that merely contains one', () => {
    // The prefix test must apply to the part AFTER the colon: a compound key
    // is `type:action`, and only the action half carries the skippable rule.
    expect(isSkippableEffectAction('return_e:draw_w')).toBe(false);
    expect(isSkippableEffectAction('cards:draw_w')).toBe(false);
  });
});
