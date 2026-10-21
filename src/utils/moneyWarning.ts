// src/utils/moneyWarning.ts
//
// "You can't afford this" before the player commits to it (Tom, 2026-10-21, after three
// Farmingdale games ended in bankruptcy right after the builder was signed). Bills that
// arrive by themselves (a fee when you reach a space, the builder's price) are allowed to
// push cash below zero and are only judged when the turn ends (TurnService, check_bankruptcy),
// so nothing stopped a player from walking into one. The End Turn heads-up
// (endTurnWarning.ts) speaks up after the bill has landed; these helpers speak up first.
//
// Pure. Only fees whose size is known ahead of time are counted: a fixed dollar fee and a
// percent of scope. Loan-based and dice-based fees are not guessed.

import type { SpaceEffect } from '../types/DataTypes';
import { determineFeeType, extractPercentage, parseFeeFromDescription } from './parseUtils';

/** Dollars a space charges on arrival that can be known now (fixed and percent-of-scope fees). */
export function knownArrivalFee(effects: SpaceEffect[], scope: number): number {
  let total = 0;
  for (const e of effects) {
    if (e.effect_type !== 'fee' || e.effect_action !== 'deduct') continue;
    const desc = String(e.effect_value ?? '');
    const feeType = e.fee_type || determineFeeType(desc);
    if (feeType === 'FIXED') {
      const parsed = parseFeeFromDescription(desc);
      if (parsed && parsed.type === 'fixed') total += parsed.value;
    } else if (feeType === 'SCOPE_PERCENTAGE') {
      const pct = extractPercentage(desc);
      if (pct !== null && pct > 0 && scope > 0) total += Math.round(scope * (pct / 100));
    }
  }
  return total;
}

/** How many dollars short the player would be after paying `cost` (0 when the cash covers it). */
export function shortBy(money: number, cost: number): number {
  return cost > 0 && money - cost < 0 ? Math.round(cost - money) : 0;
}

export const dollars = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

export const builderShortMessage = (money: number, price: number): string =>
  `You have ${dollars(money)} and this builder costs ${dollars(price)}: you would be ${dollars(shortBy(money, price))} short, and ending the turn like that ends the project. Visit the lender first, or pick a cheaper builder.`;

export const arrivalShortMessage = (money: number, fee: number): string =>
  `Costs ${dollars(fee)} when you get there. You have ${dollars(money)}, so you would be ${dollars(shortBy(money, fee))} short.`;
