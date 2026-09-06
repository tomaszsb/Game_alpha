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
// established in-character verb "Determine Outcome".
// Voice rule (no game language): player-facing copy avoids game-machinery words
// like "roll" / "dice" / "card(s)" / "game" AND the 🎲 icon — dropped here too.
//
// v3.2.52: "Determine Outcome" was the single most-quoted confusing string in the
// 2026-09-05 playtest (22 hits). v3.2.51 authored 46 plain-English dice labels, but
// this constant OVERWRITES the authored label whenever two dice rows collapse into
// one button — so on the 8 space/visit combinations that collapse (CHEAT-BYPASS,
// CON-INITIATION, INVESTOR-FUND-REVIEW, OWNER-DECISION-REVIEW × First/Subsequent)
// v3.2.51's wording never reached the screen and the bureaucrat wording survived.
// Same shape as v3.2.51's own generator bug: an authored value that a later stage
// silently throws away. This stays a generic label ON PURPOSE — the one button
// fires BOTH outcome rows, so naming only the first would misdescribe it — but the
// generic wording is now plain English, per the maintainer's button rule.
export const COLLAPSED_DICE_LABEL = 'See what happens';

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

// v2.70.3 rule, extracted (2026-06-08) so the second half of the CHEAT-BYPASS
// two-button fix is testable, not just an inline boolean. A dice-movement space
// resolves movement from the SAME physical roll as its SPACE_EFFECTS dice
// outcomes. So when a (collapsed) dice-effect button is already showing, the
// separate "Determine Next Step" movement button must be SUPPRESSED — otherwise
// the player sees two buttons that both fire the one roll (the fb:89d9f101(b)
// complaint). Show the movement button only on a dice-movement space, before
// the roll, and when no dice-effect button is already present.
export function shouldShowMovementDiceButton(
  visiblePendingActions: Pick<CollapsibleAction, 'isDiceEffect'>[],
  flags: { isDiceMovementSpace: boolean; hasPlayerRolledDice: boolean }
): boolean {
  const hasDiceEffectButton = visiblePendingActions.some((a) => a.isDiceEffect);
  return flags.isDiceMovementSpace && !flags.hasPlayerRolledDice && !hasDiceEffectButton;
}
