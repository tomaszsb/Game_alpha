// src/utils/scopeWording.ts
//
// Tom, 2026-10-02 (fb:612fbdc4): a player's scope read like a school + an airport +
// a brewery at once, because every work package named its own building. Now chance
// hands each player ONE kind of project (CardService → player.projectType), and each
// work package carries a `{project}` blank (SCOPE_WORDING.csv) that this fills in:
// "Facade restoration of the {project}" → "Facade restoration of the school".
//
// Data-driven: the kinds of project and every template come from SCOPE_WORDING.csv, so
// a reskin supplies its own ("castle", "dungeon"). With no type picked, or no template
// for a card, the card keeps its original wording — so nothing changes for boards that
// don't use the file.

import type { Card } from '../types/DataTypes';

/** The slice of IDataService this needs (so tests and views can pass a fake). */
export interface ScopeWordingSource {
  getCardById(cardId: string): Card | undefined;
  getCardScopeTemplate(baseCardId: string): string | undefined;
}

/** "school" → "a school"; "airport terminal" → "an airport terminal". English only; a reskin can
 *  pick nouns that read right with it. */
export function withIndefiniteArticle(noun: string): string {
  return /^[aeiou]/i.test(noun.trim()) ? `an ${noun.trim()}` : `a ${noun.trim()}`;
}

/** Fills every `{project}` blank in a template. */
export function fillProjectBlank(template: string, projectType: string): string {
  return template.replace(/\{project\}/g, projectType);
}

/** Instance ids look like W111_1756274803252_sezfko0rc_0 — the base id is the part before `_`. */
const baseCardId = (cardId: string): string => cardId.split('_')[0];

/**
 * The card as THIS player should read it: name and description filled in with their project
 * type, when they have one and the card has a template. Otherwise the card, untouched.
 */
export function getCardWordedFor(
  source: ScopeWordingSource,
  cardId: string,
  projectType: string | undefined,
): Card | undefined {
  const card = source.getCardById(cardId) ?? source.getCardById(baseCardId(cardId));
  if (!card || !projectType) return card;
  const template = source.getCardScopeTemplate(card.card_id);
  if (!template) return card;
  const text = fillProjectBlank(template, projectType);
  return { ...card, card_name: text, description: text };
}
