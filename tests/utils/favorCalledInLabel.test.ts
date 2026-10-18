import { describe, it, expect } from 'vitest';
import { getCardEffectSummary } from '../../src/utils/cardTypeNames';

// PLAYTEST-2 2026-10-18: "Favor Called In" (you -2 days, an opponent +2) showed
// "Activate (+2 days)", which reads as a penalty to yourself.
describe('Favor Called In label', () => {
  it('shows the days YOU save', () => {
    const card = { card_id: 'E009', card_name: 'Favor Called In', card_type: 'E', tick_modifier: '2', card_mechanic: 'favor_called_in', cost: 0 } as any;
    expect(getCardEffectSummary(card)).toBe('-2 days');
  });
  it('other cards keep their sign', () => {
    expect(getCardEffectSummary({ card_id: 'E1', tick_modifier: '2', cost: 0 } as any)).toBe('+2 days');
  });
});
