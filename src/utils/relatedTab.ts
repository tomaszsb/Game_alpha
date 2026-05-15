// Map a result-modal effect set to the player-panel reference tab that
// best matches what the player needs to see post-modal. Used by GameLayout
// to auto-open the matching tab when DiceResultModal appears, so the
// playtester doesn't have to hunt for what changed.
//
// Decisions:
//   Money     → 'ledger'      (money lives in Ledger alongside scope)
//   Cards W   → 'ledger'      (W cards drive scope, which is in Ledger)
//   Cards B/I → 'ledger'      (funding cards, shown in Ledger)
//   Cards E   → 'expeditors'  (E cards have their own tab)
//   Cards L   → 'events'      (L cards have their own tab)
//   Time      → 'ledger'      (Ledger surfaces time info)
//   Movement / info / choice → null (no clear match — modal speaks for itself)

import type { DiceResultEffect } from '../types/StateTypes';
import type { ReferenceTab } from '../components/player/ActionCenterPanel';

export function pickRelatedTab(
  effects: DiceResultEffect[] | undefined
): NonNullable<ReferenceTab> | null {
  if (!effects || effects.length === 0) return null;
  if (effects.some(e => e.type === 'money')) return 'ledger';
  const cardEffect = effects.find(e => e.type === 'cards');
  if (cardEffect) {
    const t = (cardEffect.cardType || '').toUpperCase();
    if (t === 'E') return 'expeditors';
    if (t === 'L') return 'events';
    if (t === 'W' || t === 'B' || t === 'I') return 'ledger';
  }
  if (effects.some(e => e.type === 'time')) return 'ledger';
  return null;
}
