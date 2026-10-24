// Reads the robot banker's situation off a player. Everything here already exists in state:
// the Money page's numbers (computeProjectFinances), the days used against the plan, whether the
// bank has already lent to this project, and how many times it has refused. Pure: lookups are injected.

import { Player } from '../types/StateTypes';
import { computeProjectFinances } from './projectFinances';
import { BankerSituation, BankerOffer } from './bankerRules';

type CardLookup = Parameters<typeof computeProjectFinances>[1];

export interface BankerInputOptions {
  getCardById: CardLookup;
  /** Days the plan calls for right now (GameRulesService.calculateEstimatedProjectLength). */
  plannedDays: number;
  /** Push-backs so far (this turn's count is the best the state keeps). */
  pushBacks?: number;
}

export function bankerInputs(player: Player, opts: BankerInputOptions): BankerSituation {
  const finances = computeProjectFinances(player, opts.getCardById);
  const held = [...(player.hand || []), ...((player.activeCards || []).map(a => a.cardId))];
  const hasExpeditor = held.some(id => {
    const c = opts.getCardById(id);
    return !!c && c.card_type === 'E';
  });
  return {
    costToFinish: Math.max(1, finances.commitments),
    cash: player.money,
    daysUsed: player.timeSpent ?? 0,
    plannedDays: opts.plannedDays,
    pushBacks: opts.pushBacks ?? 0,
    hasBuilderBid: !!player.contractor,
    hasExpeditor,
    bankLentBefore: (player.moneySources?.bankLoans ?? 0) > 0,
    refusals: player.bankRefusals ?? 0,
  };
}

/** What the card offers once the bank's own cap is applied: the smaller of the card and the gap (next $10K). */
export function cappedBankOffer(offeredAmount: number, ratePercent: number, fundingGap: number): BankerOffer {
  const amount = isNaN(offeredAmount) ? 0 : Math.min(offeredAmount, Math.ceil(Math.max(0, fundingGap) / 10000) * 10000);
  return { amount, rate: isNaN(ratePercent) ? 0 : ratePercent };
}
