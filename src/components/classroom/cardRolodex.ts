// src/components/classroom/cardRolodex.ts
//
// What a rolodex of versions KNOWS, with no layout attached: which versions
// belong to a space, what each one is called, when it was made, whether its
// original has moved since, and which ones stay on screen without asking.
//
// Pulled out of SpaceDeckPanel on 2026-08-22 because the merged screen shows
// the same versions in a very different shape — a full-width strip across the
// top while you are making changes (CARD_LIBRARY_DESIGN.md, "Stage 3's
// screen"), where they finally get real room — and two places deciding
// separately what "the newest three" means is exactly how the two of them
// would drift apart. The layouts differ on purpose; the answers must not.

import type { CatalogResponse, CardOwner, TeacherCopy, ValidationIssue } from './classroomApi';

/**
 * Plain-language ownership words — "tier" itself never appears in the UI.
 * `official`/`group` are shown for completeness (a maintainer making changes
 * already mints `official` versions), even though only `individual` is
 * reachable from the deck today.
 */
export const TIER_WORD: Record<CardOwner['tier'], string> = {
  official: 'Official',
  group: 'Shared',
  individual: 'Your copy',
};

export interface SpaceCard {
  id: string;
  copy: TeacherCopy;
}

/** One space's versions, beyond the original: every copy whose slot matches. */
export function cardsForSpace(catalog: CatalogResponse | null, spaceName: string): SpaceCard[] {
  if (!catalog) return [];
  return Object.entries(catalog.copies)
    .filter(([, copy]) => copy.slot === spaceName)
    .map(([id, copy]) => ({ id, copy }));
}

/** True when a copy-keyed warning says the version's original moved since it was made. */
export function cardHasDrift(warnings: ValidationIssue[] | undefined): boolean {
  return !!warnings?.some(w => w.code === 'COPY_STOCK_UPDATED' || w.code === 'COPY_SCHEMA_DRIFT');
}

/**
 * "Made 20 Aug" — when this version was saved.
 *
 * A space can hold several versions now that editing makes a new one instead
 * of writing over the old one, so each one needs to be tellable from the
 * others at a glance. The note is a version's name; the date is how you tell
 * two unnamed ones apart. The year only appears when it isn't this one.
 */
export function madeOnLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  const thisYear = when.getFullYear() === new Date().getFullYear();
  return `Made ${when.toLocaleDateString(undefined, thisYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/**
 * The warnings that are about one specific version, grouped by the version
 * they concern, so each can be shown on the version itself instead of in a
 * page-level banner (CARD_LIBRARY_DESIGN.md stage 2). Warnings about the
 * classroom generally have no copy id and are left out.
 */
export function warningsByCard(catalog: CatalogResponse | null): Map<string, ValidationIssue[]> {
  const byCard = new Map<string, ValidationIssue[]>();
  for (const warning of catalog?.validation?.warnings ?? []) {
    if (!warning.copyId) continue;
    const list = byCard.get(warning.copyId) ?? [];
    list.push(warning);
    byCard.set(warning.copyId, list);
  }
  return byCard;
}

/** Newest first — the order a rolodex of versions is read in. */
export function newestFirst(a: SpaceCard, b: SpaceCard): number {
  return (b.copy.createdAt || '').localeCompare(a.copy.createdAt || '');
}

/**
 * How many versions stay on screen without asking, in the deck's narrow
 * column. The original and whatever is playing are always shown on top of
 * these, so a space that has been edited once or twice never hides anything.
 */
export const VERSIONS_SHOWN_INLINE = 3;

/**
 * Split a space's versions into the ones shown straight away and the ones
 * folded behind "Show earlier versions". Whatever is playing is never folded
 * away, however old it is — you must always be able to see what your players
 * are getting.
 */
export function splitVersions(
  cards: SpaceCard[],
  playingId: string | null,
  shownInline: number = VERSIONS_SHOWN_INLINE
): { recent: SpaceCard[]; earlier: SpaceCard[] } {
  const sorted = [...cards].sort(newestFirst);
  const recent: SpaceCard[] = [];
  const earlier: SpaceCard[] = [];
  for (const card of sorted) {
    if (recent.length < shownInline || card.id === playingId) recent.push(card);
    else earlier.push(card);
  }
  return { recent, earlier };
}
