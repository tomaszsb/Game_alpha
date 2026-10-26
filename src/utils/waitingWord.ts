// A glossary word to read while another player takes their turn (Tom, 2026-10-26: "While other players
// are waiting for their move maybe we can have a random word from glossary pop up on their phone?").
//
// Only checked words: the glossary holds 249 terms but most are AI-written or drafts still waiting for a
// person's review (`needs_review`), and a few are notes, not words (". easter egg"). The pick is seeded by
// the wait itself (player, turn, whose turn it is), so it stays the same while the panel redraws and
// changes on the next wait, with no state to keep.

import type { GlossaryTerm } from '../dictionary/types';
import { isAiGenerated } from '../dictionary/data/terms';
import { hash01 } from './townWeather';

export interface WaitingWord {
  id: string;
  term: string;
  definition: string;
}

/** The words a waiting player may be shown: reviewed, not AI-written, with a plain definition. */
export function waitingWordPool(terms: GlossaryTerm[]): GlossaryTerm[] {
  return terms.filter(t =>
    !t.needsReview
    && !isAiGenerated(t)
    && /^[A-Za-z0-9]/.test(t.term.trim())
    && wordMeaning(t).length > 0);
}

/** The short meaning when there is one, else the longer one (most checked words have only that). */
function wordMeaning(t: GlossaryTerm): string {
  return ((t.definitionSimple ?? '').trim() || (t.definition ?? '').trim());
}

export function pickWaitingWord(terms: GlossaryTerm[], seed: string): WaitingWord | null {
  const pool = waitingWordPool(terms);
  if (pool.length === 0) return null;
  const t = pool[Math.min(pool.length - 1, Math.floor(hash01(seed) * pool.length))];
  return { id: t.id, term: t.term.trim(), definition: wordMeaning(t) };
}
