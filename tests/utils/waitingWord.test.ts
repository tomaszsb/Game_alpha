import { describe, it, expect } from 'vitest';
import { pickWaitingWord, waitingWordPool } from '../../src/utils/waitingWord';
import type { GlossaryTerm } from '../../src/dictionary/types';

const t = (over: Partial<GlossaryTerm>): GlossaryTerm =>
  ({ id: over.term ?? 'x', term: 'Word', definition: '', source: 'iqarius', needsReview: false, ...over } as GlossaryTerm);

const terms = [
  t({ term: 'Variance', definition: 'Permission to build differently from the zoning rules.' }),
  t({ term: 'Permit', definitionSimple: 'The city says yes.', definition: 'A long legal meaning.' }),
  t({ term: 'Draft word', definition: 'Not checked yet.', needsReview: true }),
  t({ term: 'Robot word', definition: 'Written by a model.', source: 'iqarius_excel | AI Generated' }),
  t({ term: '. easter egg', definition: 'Thank you' }),
  t({ term: 'Empty', definition: '' }),
];

describe('waiting word (Tom 2026-10-26: a glossary word while others play)', () => {
  it('only offers checked, human-written words that have a meaning', () => {
    expect(waitingWordPool(terms).map(x => x.term)).toEqual(['Variance', 'Permit']);
  });

  it('uses the short meaning when there is one, else the longer one', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const w = pickWaitingWord(terms, `P1|${i}|P2`)!;
      picks.add(`${w.term}: ${w.definition}`);
    }
    expect([...picks].sort()).toEqual([
      'Permit: The city says yes.',
      'Variance: Permission to build differently from the zoning rules.',
    ]);
  });

  it('keeps the same word for the same wait, and has none when nothing qualifies', () => {
    expect(pickWaitingWord(terms, 'P1|7|P2')).toEqual(pickWaitingWord(terms, 'P1|7|P2'));
    expect(pickWaitingWord([terms[2], terms[3]], 'P1|1|P2')).toBeNull();
  });
});
