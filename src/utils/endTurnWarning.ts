// src/utils/endTurnWarning.ts
//
// The orange/red heads-up shown right above the End Turn control (Tom, 2026-10-02,
// fb:adb1cc76). A fee quote is not real money until the player ends the turn, and
// both game-enders — running out of cash and the 20% design-fee cap — are now
// checked only at that moment. So the player must be TOLD, before they press, when
// ending the turn would end the project (red) or is getting close (orange), and
// that pushing back is the way out.
//
// Pure: given the numbers, returns the warning to show (or null). One function so
// the panel and the tests can't disagree about the thresholds.

import { DESIGN_FEE_CAP_PCT, DESIGN_FEE_ORANGE_PCT } from './progressIndicators';

/** Orange when cash left after this turn's bills is under this percent of project scope. */
export const LOW_CASH_PCT_OF_SCOPE = 5;

export interface EndTurnWarning {
  level: 'orange' | 'red';
  message: string;
}

export interface EndTurnWarningInput {
  /** Cash right now, including this turn's provisional bills (can be negative). */
  money: number;
  /** Architect + engineer (+ change-order) fees paid so far, including this turn's. */
  designFees: number;
  /** The player's current project scope. */
  scope: number;
  /** Did a bill land this turn (a fee quote the player hasn't accepted yet)? */
  billedThisTurn: boolean;
}

const dollars = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

/**
 * Severity order: can't pay (red) → over the fee cap (red) → near the fee cap
 * (orange) → thin cash after a bill (orange). The cash-thin check only fires when a
 * bill landed this turn, so a player who simply has little money at the start is
 * not nagged.
 */
export function getEndTurnWarning(input: EndTurnWarningInput): EndTurnWarning | null {
  const { money, designFees, scope, billedThisTurn } = input;
  const feePct = scope > 0 ? (designFees / scope) * 100 : 0;

  if (money < 0) {
    return {
      level: 'red',
      message: `You can't pay this bill — you'd be ${dollars(money)} short. Ending the turn now ends the project. You can push back on the quote instead.`,
    };
  }
  if (feePct >= DESIGN_FEE_CAP_PCT) {
    return {
      level: 'red',
      message: `Design fees would reach ${feePct.toFixed(1)}% of the project's scope. At ${DESIGN_FEE_CAP_PCT}% the project is over, and ending the turn now ends it. You can push back on the quote instead.`,
    };
  }
  if (feePct >= DESIGN_FEE_ORANGE_PCT) {
    return {
      level: 'orange',
      message: `Design fees are at ${feePct.toFixed(1)}% of the project's scope. The limit is ${DESIGN_FEE_CAP_PCT}%.`,
    };
  }
  if (billedThisTurn && scope > 0 && money < (scope * LOW_CASH_PCT_OF_SCOPE) / 100) {
    return {
      level: 'orange',
      message: `After this bill you'd have ${dollars(money)} left — one more bill could end the project.`,
    };
  }
  return null;
}
