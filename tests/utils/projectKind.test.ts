import { describe, it, expect } from 'vitest';
import { projectKindOf } from '../../src/utils/projectKind';

// fb:aec545c4 (Tom: "say X"): the site is picked from the scope. A work package tagged 'new' in SCOPE_WORDING.csv counts as
// new building; the kind with more scope dollars wins; a tie goes to existing; no scope = no kind.
const cards: Record<string, { card_id: string; card_type: string; cost: string }> = {
  W1: { card_id: 'W1', card_type: 'W', cost: '100000' },
  W2: { card_id: 'W2', card_type: 'W', cost: '500000' }, // tagged new
  W3: { card_id: 'W3', card_type: 'W', cost: '500000' },
  B1: { card_id: 'B1', card_type: 'B', cost: '999999999' },
};
const source: any = { getCardById: (id: string) => cards[id], getCardScopeKind: (id: string) => (id === 'W2' ? 'new' : undefined) };
const player = (hand: string[], active: string[] = []): any => ({ hand, activeCards: active.map(cardId => ({ cardId })) });

describe('projectKindOf', () => {
  it('no scope cards, no kind', () => {
    expect(projectKindOf(player([]), source)).toBeUndefined();
    expect(projectKindOf(player(['B1']), source)).toBeUndefined();
  });
  it('the kind with more dollars wins, counting held and active cards and drawn-copy ids', () => {
    expect(projectKindOf(player(['W1']), source)).toBe('existing');
    expect(projectKindOf(player(['W1', 'W2_1756274803252_abc_0']), source)).toBe('new');
    expect(projectKindOf(player(['W1'], ['W2']), source)).toBe('new');
    expect(projectKindOf(player(['W2', 'W3']), source)).toBe('existing'); // a tie goes to existing
  });
  it('a data set with no tags means every project is an existing building', () => {
    expect(projectKindOf(player(['W2']), { getCardById: (id: string) => cards[id] } as any)).toBe('existing');
  });
});
