// projectKind - is this player's project a new building or work on an existing one? (fb:aec545c4, Tom 2026-10-13:
// "say X"). Decided from the scope itself: each work package may carry a `card_kind` tag in SCOPE_WORDING.csv
// ('new' = it builds something new; no tag = work on an existing building), and the kind with more scope
// dollars wins (a tie goes to existing). No scope yet = no kind. The town board uses it to pick which of its two
// construction sites is the player's. A look only: no rule reads it.

import type { Card, Player } from '../types/DataTypes';

export type ProjectKind = 'new' | 'existing';

export interface ProjectKindSource {
  getCardById(cardId: string): Card | undefined;
  getCardScopeKind?(baseCardId: string): string | undefined;
}

export function projectKindOf(player: Pick<Player, 'hand' | 'activeCards'>, source: ProjectKindSource): ProjectKind | undefined {
  const ids = [...(player.hand || []), ...((player.activeCards || []).map(ac => ac.cardId))];
  let fresh = 0;
  let existing = 0;
  let any = false;
  for (const id of ids) {
    const card = source.getCardById(id) ?? source.getCardById(id.split('_')[0]);
    if (!card || card.card_type !== 'W') continue;
    any = true;
    const cost = parseFloat(String(card.cost ?? 0)) || 0;
    if (source.getCardScopeKind?.(card.card_id) === 'new') fresh += cost;
    else existing += cost;
  }
  if (!any) return undefined;
  return fresh > existing ? 'new' : 'existing';
}
