// Pure helper extracted from ActionCenterPanel's pendingActions useMemo so the
// v2.70.1 dedup logic is unit-testable. CHEAT-BYPASS has multiple SPACE_EFFECTS
// dice_outcome rows (Time outcomes / Fees Paid) that share one dice roll —
// rendering them as separate buttons misleads the player into thinking each
// fires its own roll. This helper collapses consecutive dice effects sharing
// the same effectKey into a single button.
//
// Sibling fix v2.70.3 (in ActionCenterPanel) suppresses the separate movement
// dice button when this collapsed dice button is already in the list.

export interface CollapsibleAction {
  effectKey: string;
  isDiceEffect: boolean;
  label: string;
}

// v3.0.22 (fb:adbc48b0): switched from "🎲 Roll dice" to the project's
// established in-character verb "Determine Outcome" (already used at
// ActionCenterPanel.tsx:71, StoryAccordion.tsx:92, uiStrings.ts:21).
// Voice rule: player-facing copy avoids game-machinery words like
// "roll" / "dice" / "card(s)" / "game".
export const COLLAPSED_DICE_LABEL = '🎲 Determine Outcome';

export function collapsePairedDiceActions<T extends CollapsibleAction>(actions: T[]): T[] {
  const collapsed: T[] = [];
  const seenDiceKeys = new Set<string>();
  let diceCollapseCount = 0;

  for (const action of actions) {
    if (action.isDiceEffect) {
      if (seenDiceKeys.has(action.effectKey)) {
        diceCollapseCount++;
        continue;
      }
      seenDiceKeys.add(action.effectKey);
    }
    collapsed.push(action);
  }

  if (diceCollapseCount > 0) {
    for (let i = 0; i < collapsed.length; i++) {
      if (collapsed[i].isDiceEffect) {
        collapsed[i] = { ...collapsed[i], label: COLLAPSED_DICE_LABEL };
        break;
      }
    }
  }

  return collapsed;
}
