// Locks the behavior of the simple {token} interpolation helper. v3.0.7
// extended its use to render the NPC space-story with an inline funding
// amount (fb:61a85444); pinning the contract here so future tweaks don't
// silently change escape rules.

import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from '../../src/utils/templateInterpolation';

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
