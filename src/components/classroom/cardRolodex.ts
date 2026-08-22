// src/components/classroom/cardRolodex.ts
//
// What a space's cards KNOW, with no layout attached: which cards belong to a
// space, when each was made, and whether the original has moved since.
//
// Pulled out of SpaceDeckPanel on 2026-08-22 because the deck and the strip
// across the top of the editing screen show the same thing in two different
// shapes. The layouts differ on purpose; the answers must not.
//
// A space normally has exactly two things to show now — the original and yours
// — because a save edits your card instead of making another one. The list
// shape stays because a config written before that change can still hold
// several, and those must be shown rather than hidden.

import type { CatalogResponse, TeacherCopy, ValidationIssue } from './classroomApi';

/**
 * What your card is called on screen. One word for all of them: the stored
 * ownership value is a storage detail, and showing it made the screen ask the
 * reader to care about a distinction that has no meaning to them. Where a
 * config still holds several, the date each was made is what tells them apart.
 */
export const YOUR_VERSION = 'Your version';

export interface SpaceCard {
  id: string;
  copy: TeacherCopy;
}

/** One space's cards, beyond the original: every copy whose slot matches. */
export function cardsForSpace(catalog: CatalogResponse | null, spaceName: string): SpaceCard[] {
  if (!catalog) return [];
  return Object.entries(catalog.copies)
    .filter(([, copy]) => copy.slot === spaceName)
    .map(([id, copy]) => ({ id, copy }));
}

/** True when a copy-keyed warning says the original moved since this was made. */
export function cardHasDrift(warnings: ValidationIssue[] | undefined): boolean {
  return !!warnings?.some(w => w.code === 'COPY_STOCK_UPDATED' || w.code === 'COPY_SCHEMA_DRIFT');
}

/**
 * "Made 20 Aug" — when this card was saved. The year only appears when it
 * isn't this one. Where an old config holds several cards for one space, this
 * is what tells them apart.
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
 * The warnings that are about one specific card, grouped by the card they
 * concern, so each can be shown on that card instead of in a page-level
 * banner. Warnings about the classroom generally have no copy id and are left
 * out.
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

/** Newest first — the order a space's cards are read in. */
export function newestFirst(a: SpaceCard, b: SpaceCard): number {
  return (b.copy.createdAt || '').localeCompare(a.copy.createdAt || '');
}
