// src/services/BuilderBidService.ts
// "Hire a Builder": keeps the bids on the table up to date and signs the one the player picks.
// The rules themselves (how bids are drawn, held and voided) are pure and live in
// utils/builderBids.ts; the numbers and names are TROPHIES.csv through trophyRules. This class
// only reads the player's plan, writes the bids through updateTempState (so a push-back throws
// away the draw and the hire together) and hands the signing to the same CONTRACTOR_UPDATE
// effects the old dice used, so the bill, the schedule, the cost ledger and the bankruptcy check
// are the code that was already there. Owned by TurnService (same wiring as ManualActionProcessor).

import { IStateService, IGameRulesService, ILoggingService, IEffectEngineService } from '../types/ServiceContracts';
import { Effect, EffectContext } from '../types/EffectTypes';
import { BuilderBidSet, refreshBids, isBidLive, Rng } from '../utils/builderBids';
import { getBuilderRules } from '../utils/trophyRules';
import { BUILDER_BIDS } from '../constants/uiStrings';

export type HireFailure = 'not_here' | 'already_hired' | 'bids_changed' | 'no_engine' | 'failed';

export interface HireResult {
  success: boolean;
  reason?: HireFailure;
  /** Plain words for the screen when it did not work. */
  message?: string;
  /** What the player now knows: the revealed quality (as named in the data) and what the deal was. */
  qualityName?: string;
  price?: number;
  days?: number;
}

export class BuilderBidService {
  private effectEngineService?: IEffectEngineService;

  constructor(
    private readonly stateService: IStateService,
    private readonly gameRulesService: IGameRulesService,
    private readonly loggingService: ILoggingService,
    effectEngineService?: IEffectEngineService,
    private readonly rng: Rng = Math.random
  ) {
    this.effectEngineService = effectEngineService;
  }

  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
  }

  /** Is the player standing where builders bid, with nobody hired yet? */
  public isShopping(playerId: string): boolean {
    const player = this.stateService.getPlayer(playerId);
    const space = getBuilderRules().space;
    return !!player && !!space && player.currentSpace === space && !player.contractor;
  }

  /**
   * Bring the bids up to date for today's plan and day (writes only when something changed).
   * Returns undefined when the player is not shopping.
   */
  public ensureBids(playerId: string): BuilderBidSet | undefined {
    if (!this.isShopping(playerId)) return undefined;
    const player = this.stateService.getPlayer(playerId);
    if (!player) return undefined;
    const prev = player.builderBids;
    const next = refreshBids(prev, {
      rng: this.rng,
      workCost: this.gameRulesService.calculateTotalWorkCost(playerId),
      scope: this.gameRulesService.calculateProjectScope(playerId),
      day: player.timeSpent,
      rules: getBuilderRules(),
    });
    if (next !== prev) this.stateService.updateTempState(playerId, { builderBids: next });
    return next;
  }

  /** Sign the bid the player picked. The price and days are exactly the bid's, or nothing happens. */
  public async hireBid(playerId: string, bidId: string): Promise<HireResult> {
    const player = this.stateService.getPlayer(playerId);
    if (!player) return { success: false, reason: 'failed', message: BUILDER_BIDS.ERR_FAILED };
    if (player.contractor) return { success: false, reason: 'already_hired', message: BUILDER_BIDS.ERR_HIRED };
    if (!this.isShopping(playerId)) return { success: false, reason: 'not_here', message: BUILDER_BIDS.ERR_NOT_HERE };
    if (!this.effectEngineService) return { success: false, reason: 'no_engine', message: BUILDER_BIDS.ERR_FAILED };

    // The bids on the screen may be out of date (a price lapsed, the plan changed): bring them
    // up to date first and refuse rather than sign something different from what was shown.
    // Ids are never reused, so a bid that lapsed or was voided simply is not in the new set.
    const set = this.ensureBids(playerId);
    const bid = set?.bids.find((b) => b.id === bidId);
    if (!set || !bid || !isBidLive(bid, player.timeSpent)) {
      return {
        success: false,
        reason: 'bids_changed',
        message: BUILDER_BIDS.ERR_CHANGED,
      };
    }

    const source = player.currentSpace;
    const reason = `Hired a builder: $${bid.price.toLocaleString()}, ${bid.days} days`;
    const effects: Effect[] = [
      { effectType: 'CONTRACTOR_UPDATE', payload: { playerId, kind: 'quality', value: bid.quality, source, reason } },
      { effectType: 'CONTRACTOR_UPDATE', payload: { playerId, kind: 'multiplier', value: String(bid.roll), source, reason } },
    ];
    const context: EffectContext = {
      source: 'builder_hire',
      playerId,
      metadata: { spaceName: source, visitType: player.visitType, playerName: player.name, bidId },
    };
    const result = await this.effectEngineService.processEffects(effects, context);
    if (!result.success) {
      return { success: false, reason: 'failed', message: BUILDER_BIDS.ERR_FAILED };
    }

    this.stateService.updateTempState(playerId, { builderBids: { ...set, hiredId: bid.id } });
    const quality = getBuilderRules().qualities[bid.quality];
    this.stateService.emitGameEvent({
      type: 'quality_event',
      playerId,
      playerName: player.name,
      eventId: quality.event,
      spaceName: source,
    });
    this.loggingService.info(BUILDER_BIDS.log(`$${bid.price.toLocaleString()}`, bid.days, quality.name), {
      playerId,
      playerName: player.name,
      action: 'builder_hired',
      spaceName: source,
    });
    return { success: true, qualityName: quality.name, price: bid.price, days: bid.days };
  }
}
