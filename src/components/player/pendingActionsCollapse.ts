// Pure helper extracted from ActionCenterPanel's pendingActions useMemo so the
// v2.70.1 dedup logic is unit-testable. CHEAT-BYPASS has multiple SPACE_EFFECTS
// dice_outcome rows (Time outcomes / Fees Paid) that share one dice roll —
// rendering them as separate buttons misleads the player into thinking each
// fires its own roll. This helper collapses consecutive dice effects sharing
// the same effectKey into a single button and relabels it to a generic "Roll
// dice" so the UI matches the truth.
//
// Sibling fix v2.70.3 (in ActionCenterPanel) suppresses the separate movement
// dice button when this collapsed dice button is already in the list.

export interface CollapsibleAction {
  effectKey: string;
  isDiceEffect: boolean;
  label: string;
}

export const COLLAPSED_DICE_LABEL = '🎲 Roll dice';

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
