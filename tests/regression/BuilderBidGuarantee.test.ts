// tests/regression/BuilderBidGuarantee.test.ts
//
// The Manager's rule for Job 6 (2026-10-08): do not type "80". The smallest price-hold option
// must be longer than the WORST trip to the bank or the investor and back, derived here from the
// board's own data (movement + effects), plus a stated margin. If someone lengthens a loan
// desk, an investor roll or the hub's days, or shortens the smallest option, this fails and
// says by how much.
//
// The trip: builder's desk -> loan desk -> (bank | investor) -> hub -> builder's desk. Days are
// charged when a space is LEFT, so the builder's desk costs nothing, and each other stop charges
// its own time rows. The worst visit type of each stop is taken.

import { describe, it, expect } from 'vitest';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';
import { getBuilderRules } from '../../src/utils/trophyRules';

/** Spare days over the worst trip: one more turn's worth of delay somewhere on the way. */
const MARGIN_DAYS = 10;

function daysIn(text: string | number | undefined): number {
  const m = String(text ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

describe('the price-hold options cover the worst trip to the lender and back', () => {
  it('the smallest option is longer than the worst trip plus the margin', async () => {
    const s: any = await bootstrapHeadlessServices();
    const { dataService } = s;
    const rules = getBuilderRules();
    const visits = ['First', 'Subsequent'] as const;

    // Plain days charged on leaving a space (auto "time" rows).
    const plainDays = (space: string) => Math.max(...visits.map((v) =>
      dataService.getSpaceEffects(space, v)
        .filter((e: any) => e.effect_type === 'time' && e.trigger_type !== 'manual' && !e.condition)
        .reduce((sum: number, e: any) => sum + daysIn(e.effect_value), 0)));

    // The loan desk -> the two places money comes from -> the hub.
    const loanDesk = rules.door;
    const next = new Set<string>();
    for (const v of visits) {
      const m = dataService.getMovement(loanDesk, v);
      for (const d of [m.destination_1, m.destination_2, m.destination_3, m.destination_4, m.destination_5]) if (d) next.add(d);
    }
    expect(next.size).toBeGreaterThan(0);

    // The hub both lead back to.
    const hubs = new Set<string>();
    for (const place of next) {
      for (const v of visits) {
        const m = dataService.getMovement(place, v);
        if (m?.destination_1) hubs.add(m.destination_1);
      }
    }
    expect(hubs.size).toBe(1);
    const hub = [...hubs][0];

    // The bank charges per $200K borrowed: bound it by the biggest loan card in the deck.
    const biggestLoan = Math.max(...dataService.getCards()
      .filter((c: any) => c.card_type === 'B')
      .map((c: any) => parseFloat(String(c.loan_amount ?? '0').replace(/[^0-9.]/g, '')) || 0));

    const stopDays = (space: string): number => {
      let worst = plainDays(space);
      for (const v of visits) {
        // days per $200K borrowed
        for (const e of dataService.getSpaceEffects(space, v)) {
          if (e.effect_type === 'time' && e.trigger_type !== 'manual' && String(e.condition ?? '').toLowerCase() === 'per_200k') {
            worst = Math.max(worst, plainDays(space) + daysIn(e.effect_value) * Math.ceil(biggestLoan / 200_000));
          }
        }
        // days the dice can add (investors take weeks)
        for (const d of dataService.getDiceEffects(space, v)) {
          if (d.effect_type === 'time') {
            const rolls = [d.roll_1, d.roll_2, d.roll_3, d.roll_4, d.roll_5, d.roll_6].map(daysIn);
            worst = Math.max(worst, plainDays(space) + Math.max(...rolls));
          }
        }
      }
      return worst;
    };

    const worstTrip = plainDays(loanDesk) + Math.max(...[...next].map(stopDays)) + plainDays(hub);
    const smallest = Math.min(...rules.guaranteeDays);

    // Say what was derived, so a failure explains itself.
    const note = `worst trip ${worstTrip} days (loan desk ${plainDays(loanDesk)} + lender up to ${Math.max(...[...next].map(stopDays))} + hub ${plainDays(hub)}); smallest hold ${smallest}; margin ${MARGIN_DAYS}`;
    expect(worstTrip, note).toBeGreaterThan(0);
    expect(smallest, note).toBeGreaterThan(worstTrip + MARGIN_DAYS);
  });
});
