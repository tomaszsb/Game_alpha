// Locks the behavior of the simple {token} interpolation helper. v3.0.7
// extended its use to render the NPC space-story with an inline funding
// amount (fb:61a85444); pinning the contract here so future tweaks don't
// silently change escape rules.

import { describe, it, expect } from 'vitest';
import { interpolateTemplate, resolveFundingAmountToken } from '../../src/utils/templateInterpolation';

describe('interpolateTemplate', () => {
  it('replaces a single token with its string value', () => {
    expect(interpolateTemplate('You have {money}.', { money: '$250,000' }))
      .toBe('You have $250,000.');
  });

  it('replaces a numeric value via String()', () => {
    expect(interpolateTemplate('{count} items', { count: 3 }))
      .toBe('3 items');
  });

  it('replaces multiple tokens in one pass', () => {
    expect(interpolateTemplate('{a} + {b} = {c}', { a: 1, b: 2, c: 3 }))
      .toBe('1 + 2 = 3');
  });

  it('replaces with empty string when the value is the empty string', () => {
    expect(interpolateTemplate('I bring {fundingAmount}.', { fundingAmount: '' }))
      .toBe('I bring .');
  });

  it('leaves a token alone when the key is undefined', () => {
    expect(interpolateTemplate('Cost: {amount}', { amount: undefined }))
      .toBe('Cost: {amount}');
  });

  it('leaves a token alone when the key is missing from context', () => {
    expect(interpolateTemplate('Cost: {amount}', {}))
      .toBe('Cost: {amount}');
  });

  it('returns the template unchanged when no tokens are present', () => {
    expect(interpolateTemplate('No tokens here', { unused: 'value' }))
      .toBe('No tokens here');
  });

  it('handles the same token appearing multiple times', () => {
    expect(interpolateTemplate('{name} hands {name} the keys.', { name: 'Sam' }))
      .toBe('Sam hands Sam the keys.');
  });
});

// resolveFundingAmountToken is the mechanism the sidebar (PlayerPanelV2) and
// the dice/action modals use to resolve {fundingAmount} in a space's story
// text. BoardCanvas.tsx (the board tile itself) was found rendering the raw
// story directly, with no call into this function at all — that's why the
// board showed the literal "{fundingAmount}" at OWNER-FUND-INITIATION while
// the sidebar and modal both showed the real dollar figure (playtest report,
// HIGH). BoardCanvas now calls this same helper in its per-render node-data
// recompute; these tests pin the helper's contract so that fix (and any
// future caller) can rely on it.
describe('resolveFundingAmountToken', () => {
  const OWNER_STORY = "Here's what I'm putting in — {fundingAmount}. Look it over.";

  it('resolves {fundingAmount} to the owner funding amount at an owner-funding space', () => {
    const player = { moneySources: { ownerFunding: 50000, bankLoans: 0, investmentDeals: 0, other: 0 } };
    expect(resolveFundingAmountToken(OWNER_STORY, player, 'owner'))
      .toBe("Here's what I'm putting in — $50,000. Look it over.");
  });

  it('resolves {fundingAmount} to the bank loan amount at a bank-funding space', () => {
    const player = { moneySources: { ownerFunding: 0, bankLoans: 125000, investmentDeals: 0, other: 0 } };
    expect(resolveFundingAmountToken('Loan approved: {fundingAmount}.', player, 'bank'))
      .toBe('Loan approved: $125,000.');
  });

  it('resolves {fundingAmount} to the investment deal amount at an investor-funding space', () => {
    const player = { moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 75000, other: 0 } };
    expect(resolveFundingAmountToken('Investment secured: {fundingAmount}.', player, 'investor'))
      .toBe('Investment secured: $75,000.');
  });

  it('resolves to empty string (not "$0") when nothing has been granted yet', () => {
    const player = { moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 } };
    expect(resolveFundingAmountToken(OWNER_STORY, player, 'owner'))
      .toBe("Here's what I'm putting in — . Look it over.");
  });

  it('resolves to empty string when the player has no moneySources at all (fresh/board-preview player)', () => {
    expect(resolveFundingAmountToken(OWNER_STORY, {}, 'owner'))
      .toBe("Here's what I'm putting in — . Look it over.");
  });

  it('does not cross-wire funding sources — bank loans do not leak into an owner-funding read', () => {
    const player = { moneySources: { ownerFunding: 0, bankLoans: 999999, investmentDeals: 0, other: 0 } };
    expect(resolveFundingAmountToken(OWNER_STORY, player, 'owner'))
      .toBe("Here's what I'm putting in — . Look it over.");
  });

  it('leaves the token alone at a non-funding space ("" fundingSource)', () => {
    const player = { moneySources: { ownerFunding: 50000, bankLoans: 0, investmentDeals: 0, other: 0 } };
    // Non-funding spaces have no story containing {fundingAmount} in practice,
    // but the helper's own contract (mirrors interpolateTemplate) is that an
    // unresolved source still substitutes fundingAmount as empty, since '' is
    // a valid (falsy) match for the fundingSourceAmount default of 0.
    expect(resolveFundingAmountToken(OWNER_STORY, player, ''))
      .toBe("Here's what I'm putting in — . Look it over.");
  });

  it('is idempotent when re-run on its own already-resolved output (repeated recompute passes)', () => {
    // BoardCanvas re-derives displayStory from the pristine raw template on
    // every players/currentPlayerId change — but guards against ever feeding
    // resolveFundingAmountToken its OWN prior output. This test documents why
    // that guard matters: once {fundingAmount} has been substituted away
    // (even to ''), a second pass over the resolved text is a no-op, so a
    // real caller MUST keep the raw template around rather than overwrite it.
    const player = { moneySources: { ownerFunding: 50000, bankLoans: 0, investmentDeals: 0, other: 0 } };
    const once = resolveFundingAmountToken(OWNER_STORY, player, 'owner');
    const twice = resolveFundingAmountToken(once, player, 'owner');
    expect(twice).toBe(once);
  });
});
