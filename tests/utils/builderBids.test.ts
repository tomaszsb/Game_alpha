import { describe, it, expect, afterEach } from 'vitest';
import { drawBid, refreshBids, isBidLive, cheapestLiveBid, typicalQuote, planKeyOf, BidContext, BuilderBidSet } from '../../src/utils/builderBids';
import { computeContractorTerms } from '../../src/utils/contractorTerms';
import { configureTrophyRules, getBuilderRules } from '../../src/utils/trophyRules';

/** A tiny repeatable "random": cycles through the given numbers. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

function ctx(over: Partial<BidContext> = {}): BidContext {
  return { rng: seq(0.1, 0.5, 0.9), workCost: 1_000_000, scope: 1_000_000, day: 10, rules: getBuilderRules(), ...over };
}

afterEach(() => configureTrophyRules([]));

describe('drawBid', () => {
  it('quotes exactly what the engine will charge (the one formula)', () => {
    const bid = drawBid(ctx(), 'bid-1');
    const terms = computeContractorTerms(1_000_000, bid.roll, bid.quality);
    expect([bid.price, bid.days]).toEqual([terms.cost, terms.scheduleDays]);
  });

  it('holds the price for its own number of days, counted from today', () => {
    const bid = drawBid(ctx({ day: 40 }), 'bid-1');
    expect(getBuilderRules().guaranteeDays).toContain(bid.guaranteeDays);
    expect(bid.expiresDay).toBe(40 + bid.guaranteeDays);
  });

  it('draws each bidder independently: the same draws give an identical bidder', () => {
    const a = drawBid(ctx({ rng: seq(0.2, 0.2, 0.2) }), 'a');
    const b = drawBid(ctx({ rng: seq(0.2, 0.2, 0.2) }), 'b');
    expect({ ...a, id: '' }).toEqual({ ...b, id: '' });
  });

  it('covers every quality, every job size and every price-hold option', () => {
    const qualities = new Set<string>();
    const rolls = new Set<number>();
    const guarantees = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const bid = drawBid(ctx({ rng: Math.random }), 'x');
      qualities.add(bid.quality);
      rolls.add(bid.roll);
      guarantees.add(bid.guaranteeDays);
    }
    expect([...qualities].sort()).toEqual(['HIGH', 'LOW', 'MED']);
    expect([...rolls].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...guarantees].sort((x, y) => x - y)).toEqual(getBuilderRules().guaranteeDays);
  });
});

describe('refreshBids', () => {
  it('offers the data\'s number of bidders the first time', () => {
    const set = refreshBids(undefined, ctx({ rng: Math.random }));
    expect(set.bids).toHaveLength(getBuilderRules().bidsOffered);
    expect(set.lapsed).toEqual([]);
    expect(new Set(set.bids.map((b) => b.id)).size).toBe(set.bids.length);
  });

  it('keeps every bid, untouched, while all prices are held and the plan is the same', () => {
    const first = refreshBids(undefined, ctx({ rng: Math.random }));
    const again = refreshBids(first, ctx({ rng: Math.random, day: 10 + 99 }));
    expect(again).toBe(first);
  });

  it('a bid is held through its last day and lapses the day after', () => {
    const set = refreshBids(undefined, ctx({ rng: Math.random }));
    const bid = set.bids[0];
    expect(isBidLive(bid, bid.expiresDay)).toBe(true);
    expect(isBidLive(bid, bid.expiresDay + 1)).toBe(false);
  });

  it('replaces only the lapsed bid, by a fresh one, and says plainly which and why', () => {
    const first = refreshBids(undefined, ctx({ rng: Math.random }));
    // age the first bidder out; the others still hold
    const stale: BuilderBidSet = { ...first, bids: first.bids.map((b, i) => (i === 0 ? { ...b, expiresDay: 12 } : { ...b, expiresDay: 500 })) };
    const next = refreshBids(stale, ctx({ rng: Math.random, day: 13 }));
    expect(next.bids[0].id).not.toBe(stale.bids[0].id);
    expect(next.bids[1]).toBe(stale.bids[1]);
    expect(next.bids[2]).toBe(stale.bids[2]);
    expect(next.lapsed).toEqual([{ reason: 'expired', guaranteeDays: stale.bids[0].guaranteeDays, price: stale.bids[0].price, day: 13 }]);
  });

  it('a fresh replacement is priced at today\'s day', () => {
    const first = refreshBids(undefined, ctx({ rng: Math.random }));
    const stale: BuilderBidSet = { ...first, bids: first.bids.map((b) => ({ ...b, expiresDay: 12 })) };
    const next = refreshBids(stale, ctx({ rng: Math.random, day: 50 }));
    for (const b of next.bids) expect(b.expiresDay).toBe(50 + b.guaranteeDays);
  });

  it('ANY change to the plan voids every bid, even ones with plenty of days left', () => {
    const first = refreshBids(undefined, ctx({ rng: Math.random }));
    const next = refreshBids(first, ctx({ rng: Math.random, workCost: 1_100_000 }));
    expect(next.bids.map((b) => b.id)).not.toEqual(first.bids.map((b) => b.id));
    expect(next.lapsed).toHaveLength(first.bids.length);
    expect(next.lapsed.every((l) => l.reason === 'plan_changed')).toBe(true);
    // and the new ones are priced on the new plan
    for (const b of next.bids) {
      const t = computeContractorTerms(1_100_000, b.roll, b.quality);
      expect(b.price).toBe(t.cost);
    }
  });

  it('a change in scope alone also voids the bids', () => {
    const first = refreshBids(undefined, ctx({ rng: Math.random }));
    const next = refreshBids(first, ctx({ rng: Math.random, scope: 900_000 }));
    expect(next.planKey).toBe(planKeyOf(900_000, 1_000_000));
    expect(next.lapsed.every((l) => l.reason === 'plan_changed')).toBe(true);
  });

  it('ids are never reused, so a lapsed bid\'s id cannot be hired by mistake', () => {
    let set = refreshBids(undefined, ctx({ rng: Math.random }));
    const seen = new Set(set.bids.map((b) => b.id));
    for (let day = 200; day < 1400; day += 200) {
      set = refreshBids(set, ctx({ rng: Math.random, day }));
      for (const b of set.bids) seen.add(b.id);
    }
    expect(seen.size).toBeGreaterThan(getBuilderRules().bidsOffered);
  });
});

describe('quotes for the bank line', () => {
  it('names the cheapest bid still held and its days left', () => {
    const set: BuilderBidSet = {
      planKey: 'k', nextId: 4, lapsed: [],
      bids: [
        { id: 'a', quality: 'MED', roll: 3, price: 900, days: 30, guaranteeDays: 100, expiresDay: 110 },
        { id: 'b', quality: 'LOW', roll: 3, price: 800, days: 40, guaranteeDays: 100, expiresDay: 60 },
        { id: 'c', quality: 'HIGH', roll: 3, price: 700, days: 25, guaranteeDays: 100, expiresDay: 50 },
      ],
    };
    expect(cheapestLiveBid(set, 20)).toEqual({ price: 700, days: 25, daysLeft: 30 });
    expect(cheapestLiveBid(set, 55)).toEqual({ price: 800, days: 40, daysLeft: 5 });
    expect(cheapestLiveBid(set, 61)).toEqual({ price: 900, days: 30, daysLeft: 49 });
    expect(cheapestLiveBid(set, 111)).toBeUndefined();
    expect(cheapestLiveBid(undefined, 1)).toBeUndefined();
  });

  it('with no bids yet there is only a rough figure (the screen must say "about")', () => {
    expect(typicalQuote(1_000_000)).toBe(computeContractorTerms(1_000_000, 3, 'MED').cost);
  });
});

describe('the builder rules in TROPHIES.csv', () => {
  it('reads bidders, price-hold options, quality names and the door from data', () => {
    configureTrophyRules([
      { kind: 'rule', key: 'bids_offered', value: '2', text: '' },
      { kind: 'guarantee', key: 'g1', value: '90', text: '' },
      { kind: 'guarantee', key: 'g2', value: '200', text: '' },
      { kind: 'builder_quality', key: 'HIGH', value: 'blade_master', text: 'Master' },
      { kind: 'builder_space', key: 'SMITHY', value: 'BANK', text: '' },
      { kind: 'builder_note_space', key: 'BANK', value: '', text: '' },
      { kind: 'points', key: 'blade_master', value: '0', text: '' },
    ]);
    const r = getBuilderRules();
    expect(r.bidsOffered).toBe(2);
    expect(r.guaranteeDays).toEqual([90, 200]);
    expect(r.qualities.HIGH).toEqual({ event: 'blade_master', name: 'Master' });
    expect(r.qualities.MED.name).toBe('Medium'); // not mentioned -> stock
    expect([r.space, r.door, r.noteSpaces]).toEqual(['SMITHY', 'BANK', ['BANK']]);
  });

  it('a file with no builder rows keeps the stock bids', () => {
    configureTrophyRules([{ kind: 'rule', key: 'trophies_to_win', value: '2', text: '' }]);
    const r = getBuilderRules();
    expect([r.space, r.door, r.bidsOffered]).toEqual(['CON-INITIATION', 'LEND-SCOPE-CHECK', 3]);
    expect(r.guaranteeDays.length).toBeGreaterThan(0);
  });
});
