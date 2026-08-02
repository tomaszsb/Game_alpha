// src/services/FinancialEffectHandler.ts

import {
  IResourceService,
  IStateService,
  IGameRulesService,
  ILoggingService,
  IDataService,
  INotificationService
} from '../types/ServiceContracts';
import {
  Effect,
  EffectContext,
  EffectResult,
  isResourceChangeEffect,
  isFeeDeductionEffect
} from '../types/EffectTypes';
import { Player } from '../types/DataTypes';
import { extractPercentage, parseFeeFromDescription } from '../utils/parseUtils';
import { debugLog, debugWarn } from '../utils/debugLog';

type ResourceChangePayload = Extract<Effect, { effectType: 'RESOURCE_CHANGE' }>['payload'];
type FeeDeductionPayload = Extract<Effect, { effectType: 'FEE_DEDUCTION' }>['payload'];

/**
 * FinancialEffectHandler - Handles RESOURCE_CHANGE and FEE_DEDUCTION effects
 *
 * Extracted from EffectEngineService to create a focused handler for:
 * - Money additions and deductions
 * - Time additions and deductions
 * - Design fee percentage calculations
 * - Loan fee calculations (tiered and fixed)
 * - Bankruptcy checking
 * - Design fee cap rule (20% cap)
 */
export interface IFinancialEffectHandler {
  handleResourceChange(effect: Effect, context: EffectContext): EffectResult;
  handleFeeDeduction(effect: Effect, context: EffectContext): EffectResult;
}

export class FinancialEffectHandler implements IFinancialEffectHandler {
  private notificationService?: INotificationService;
  private dataService?: IDataService;

  constructor(
    private readonly resourceService: IResourceService,
    private readonly stateService: IStateService,
    private readonly gameRulesService: IGameRulesService,
    private readonly loggingService: ILoggingService,
    dataService?: IDataService,
    notificationService?: INotificationService
  ) {
    this.dataService = dataService;
    this.notificationService = notificationService;
  }

  /**
   * Handle RESOURCE_CHANGE effect
   * Processes money and time changes including percentage-based design fees
   */
  handleResourceChange(effect: Effect, context: EffectContext): EffectResult {
    if (!isResourceChangeEffect(effect)) {
      return {
        success: false,
        effectType: effect.effectType,
        error: 'Invalid RESOURCE_CHANGE effect'
      };
    }

    const { payload } = effect;
    const source = payload.source || context.source;
    const reason = payload.reason || 'Effect processing';
    const sourceType = payload.sourceType || 'other';
    let success = false;

    // Handle percentage-based design fees
    let actualAmount = payload.amount;
    if (payload.percentageOfScope !== undefined && payload.resource === 'MONEY') {
      const player = this.stateService.getPlayer(payload.playerId);
      if (player) {
        // Calculate project scope dynamically from W cards
        const projectScope = this.gameRulesService.calculateProjectScope(payload.playerId);
        actualAmount = -Math.floor((projectScope * payload.percentageOfScope) / 100);
        debugLog(`🔧 FINANCIAL_HANDLER: Calculating design fee: ${payload.percentageOfScope}% of ${projectScope.toLocaleString()} = ${Math.abs(actualAmount).toLocaleString()}`);

        // Track as design expenditure if fee category is provided
        if (payload.feeCategory && actualAmount < 0) {
          this.trackDesignExpenditure(payload.playerId, player, actualAmount, payload);
        }
      }
    }

    debugLog(`🔧 FINANCIAL_HANDLER: Processing ${payload.resource} change for player ${payload.playerId} by ${actualAmount}`);

    if (payload.resource === 'MONEY') {
      success = this.processMoneyChange(payload.playerId, actualAmount, source, reason, sourceType, payload);
    } else if (payload.resource === 'TIME') {
      success = this.processTimeChange(payload.playerId, payload.amount, source, reason);
    }

    if (!success) {
      // Report the amount ACTUALLY processed, not the raw payload. For a
      // percentage-of-scope fee the payload carries `amount: 0` (the real charge
      // is computed here into `actualAmount`), so the old message read
      // "MONEY change of 0" for a genuine fee failure — misleading noise in the
      // console during playtests (fb:f0bdd78a). The usual cause is an unaffordable
      // spend that spendMoney rejected (see the separate reconcile follow-up).
      const attempted = payload.resource === 'MONEY' ? actualAmount : payload.amount;
      return {
        success: false,
        effectType: effect.effectType,
        error: `Failed to process ${payload.resource} change of ${attempted} for player ${payload.playerId}`
      };
    }

    return {
      success: true,
      effectType: effect.effectType
    };
  }

  /**
   * Handle FEE_DEDUCTION effect
   * Processes loan percentage fees, fixed fees, and dice-based fees
   */
  handleFeeDeduction(effect: Effect, context: EffectContext): EffectResult {
    if (!isFeeDeductionEffect(effect)) {
      return {
        success: false,
        effectType: effect.effectType,
        error: 'Invalid FEE_DEDUCTION effect'
      };
    }

    const { payload } = effect;
    debugLog(`💰 FINANCIAL_HANDLER: Processing FEE_DEDUCTION`);
    debugLog(`    Player: ${payload.playerId}`);
    debugLog(`    Fee Type: ${payload.feeType}`);
    debugLog(`    Description: ${payload.feeDescription}`);

    try {
      const player = this.stateService.getPlayer(payload.playerId);
      if (!player) {
        debugWarn(`Player ${payload.playerId} not found for fee deduction`);
        return {
          success: false,
          effectType: effect.effectType,
          error: `Player ${payload.playerId} not found`
        };
      }

      // Calculate fee amount based on fee type
      const totalLoanAmount = (player.loans || []).reduce((sum, loan) => sum + loan.principal, 0);
      debugLog(`    Total loan amount: $${totalLoanAmount}`);

      const feeAmount = this.calculateFeeAmount(payload, totalLoanAmount, context);

      if (feeAmount === null) {
        // Dice-based fee - requires dice roll context
        debugLog(`    Dice-based fee - requires dice roll context, skipping calculation`);
        // Voice rule (no game language): no "dice roll" in the player-visible
        // description — the amount is simply awaiting the outcome.
        this.loggingService.info(`Fee deduction pending: ${payload.feeDescription} (awaiting outcome)`, {
          playerId: payload.playerId,
          action: 'fee_pending',
          source: payload.source || context.source
        });
        return { success: true, effectType: effect.effectType };
      }

      if (feeAmount > 0) {
        return this.applyFeeDeduction(payload, player, feeAmount, totalLoanAmount, context);
      } else if (totalLoanAmount === 0 && (payload.feeType === 'LOAN_PERCENTAGE' || payload.feeType === 'LOAN_TIERED')) {
        // No loan means no fee to pay
        debugLog(`    ℹ️  No loan amount - fee does not apply`);
        this.loggingService.info(`Fee not applicable: No loan to charge against`, {
          playerId: payload.playerId,
          action: 'fee_skipped',
          source: payload.source || context.source
        });
        return { success: true, effectType: effect.effectType };
      } else {
        debugWarn(`    ⚠️  Could not calculate fee amount from: ${payload.feeDescription}`);
        return { success: true, effectType: effect.effectType };
      }
    } catch (error) {
      console.error(`❌ Error processing fee deduction:`, error);
      return {
        success: false,
        effectType: effect.effectType,
        error: `Failed to process fee deduction: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // --- Private helper methods ---

  private processMoneyChange(
    playerId: string,
    amount: number,
    source: string,
    reason: string,
    sourceType: string,
    payload: ResourceChangePayload
  ): boolean {
    let success = false;

    if (amount > 0) {
      success = this.resourceService.addMoney(playerId, amount, source, reason, sourceType as 'bank' | 'investment' | 'owner' | 'other');
      if (success) {
        this.logMoneyChange(playerId, amount, reason);
        this.notifyMoneyReceived(playerId, amount, source, sourceType, reason);
      }
    } else if (amount < 0) {
      // RESOURCE_CHANGE money deductions are engine-applied bills (fees, costs,
      // life-event charges) — mandatory, not discretionary. Charge in full even
      // if it drives cash negative (allowNegative), so an unpayable bill causes
      // real bankruptcy via checkBankruptcy below rather than being silently
      // dropped (fb:f0bdd78a / 0aae9865 / 40caa223).
      success = this.resourceService.spendMoney(playerId, Math.abs(amount), source, reason, undefined, true);
      if (success) {
        this.logMoneyChange(playerId, amount, reason);
        this.notifyFeeDeducted(playerId, amount, payload);
        this.checkBankruptcy(playerId);
      }
    } else {
      success = true; // No change needed for 0 amount
    }

    return success;
  }

  private processTimeChange(playerId: string, amount: number, source: string, reason: string): boolean {
    if (amount > 0) {
      this.resourceService.addTime(playerId, amount, source, reason);
      this.logTimeChange(playerId, amount, 'added');
      this.notifyTimeChange(playerId, amount, source, reason);
    } else if (amount < 0) {
      this.resourceService.spendTime(playerId, Math.abs(amount), source, reason);
      this.logTimeChange(playerId, Math.abs(amount), 'reduced');
      this.notifyTimeChange(playerId, amount, source, reason);
    }
    return true;
  }

  private trackDesignExpenditure(playerId: string, player: Player, actualAmount: number, payload: ResourceChangePayload): void {
    const feeAmount = Math.abs(actualAmount);
    const gameState = this.stateService.getGameState();
    const currentTurn = gameState.globalTurnCount || 0;

    const updateData: Partial<Player> = {};

    if (player.expenditures) {
      updateData.expenditures = {
        ...player.expenditures,
        design: (player.expenditures.design || 0) + feeAmount
      };
    }

    if (player.costs) {
      const costCategory = payload.feeCategory === 'architectural' ? 'architectural' : 'engineering';
      const updatedCosts = { ...player.costs };
      updatedCosts[costCategory] = (updatedCosts[costCategory] || 0) + feeAmount;
      updatedCosts.total = (updatedCosts.total || 0) + feeAmount;
      updateData.costs = updatedCosts;

      const costHistory = [...(player.costHistory || [])];
      costHistory.push({
        id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: costCategory,
        amount: feeAmount,
        description: `${payload.feeCategory === 'architectural' ? 'Architect' : 'Engineer'} fee: ${payload.percentageOfScope}% of scope`,
        turn: currentTurn,
        timestamp: new Date(),
        spaceName: player.currentSpace
      });
      updateData.costHistory = costHistory;
    }

    this.stateService.updateTempState(playerId, updateData);
    this.checkDesignFeeCap(playerId, payload);
  }

  private checkDesignFeeCap(playerId: string, _payload: ResourceChangePayload): void {
    const updatedPlayer = this.stateService.getPlayer(playerId);
    if (!updatedPlayer) return;

    const totalDesignFees = updatedPlayer.expenditures?.design || 0;
    const playerScope = this.gameRulesService.calculateProjectScope(playerId);
    const designFeeRatio = playerScope > 0 ? (totalDesignFees / playerScope) * 100 : 0;

    if (designFeeRatio >= 20) {
      // v2.70.4 (fb:3a57d5d0) — strict 20% rule per user decision: ANY phase,
      // ANY time, design fees over 20% of scope ends the game. The previous
      // behavior only ended the game during the DESIGN phase and applied a
      // softer +2 week time penalty in CONSTRUCTION+; that fallback is gone.
      // Phase is captured in the debug log for diagnostics only.
      const spaceConfig = this.dataService ? this.dataService.getGameConfigBySpace(updatedPlayer.currentSpace) : null;
      const currentPhase = (spaceConfig && spaceConfig.phase) ? spaceConfig.phase.toUpperCase() : 'UNKNOWN';

      debugLog(`💀 GAME OVER: Design fees exceeded 20% cap (${designFeeRatio.toFixed(1)}% = ${totalDesignFees.toLocaleString()} / ${playerScope.toLocaleString()}) during ${currentPhase} phase`);

      // Domain-event stage 4: emit-after-commit (was emitted before endGame,
      // a minor pre-existing inversion, fixed here). Replaces the old
      // 'life_event' repurposing — ToastWriter's life_event case reads
      // cardType/cardName, which this emission never set, so the toast
      // silently rendered "Received: undefined" instead of this message.
      this.stateService.endGame(undefined, { type: 'design_fee_cap', playerId });
      this.stateService.emitGameEvent({
        type: 'game_ended',
        reason: 'design_fee_cap',
        playerId: playerId,
        playerName: updatedPlayer.name,
        spaceName: updatedPlayer.currentSpace,
        message: `⛔ GAME OVER: Design fees exceeded 20% of project scope!`,
      });
    }
  }

  private notifyMoneyReceived(playerId: string, amount: number, source: string, sourceType: string, reason: string): void {
    if (!this.notificationService) return;

    const player = this.stateService.getPlayer(playerId);
    if (!player) return;

    // Trust `sourceType === 'owner'` as the single signal for "Owner Funding"
    // notification copy. Audit 2026-05-19 (v2.66.3) confirmed the other three
    // checks were redundant or dead:
    //  - `card:B` source always carries sourceType='owner' (EffectFactory:39-44).
    //  - `OWNER-FUND` substring never appears here — OWNER_SEED_MONEY in
    //    EffectEngineService bypasses notifyMoneyReceived entirely (calls
    //    resourceService.addMoney directly).
    //  - The `reason.includes('funding')` text check was a string-matching
    //    fallback that didn't catch anything sourceType wouldn't.
    // Worst case if a future caller forgets sourceType: notification reads
    // "Received: +$X" instead of "Owner Funding: +$X". No functional impact.
    const isFunding = sourceType === 'owner';

    const formattedAmount = amount.toLocaleString();
    const notificationMessage = isFunding
      ? `💰 Owner Funding: +$${formattedAmount}`
      : `💵 Received: +$${formattedAmount}`;

    this.notificationService.notify(
      {
        short: `+$${formattedAmount}`,
        medium: notificationMessage,
        detailed: `${player.name} received $${formattedAmount} (${reason})`
      },
      {
        playerId: playerId,
        playerName: player.name,
        actionType: 'money_received',
        notificationDuration: 4000
      }
    );
  }

  private notifyFeeDeducted(playerId: string, amount: number, payload: ResourceChangePayload): void {
    if (!this.notificationService || payload.percentageOfScope === undefined) return;

    const player = this.stateService.getPlayer(playerId);
    if (!player) return;

    const feeType = payload.feeCategory === 'architectural' ? 'Architect' : 'Engineer';
    const formattedAmount = Math.abs(amount).toLocaleString();

    this.notificationService.notify(
      {
        short: `-$${formattedAmount}`,
        medium: `💸 ${feeType} Fee: -$${formattedAmount}`,
        detailed: `${player.name} paid ${feeType} fee: ${payload.percentageOfScope}% of project scope = $${formattedAmount}`
      },
      {
        playerId: playerId,
        playerName: player.name,
        actionType: 'fee_paid',
        notificationDuration: 5000
      }
    );
  }

  // Public since v3.0.92: the contractor signing charge (EffectEngineService's
  // CONTRACTOR_UPDATE) is a mandatory bill too, and shares this one bankruptcy
  // rule instead of growing its own copy.
  public checkBankruptcy(playerId: string): void {
    const updatedPlayer = this.stateService.getPlayer(playerId);
    if (updatedPlayer && updatedPlayer.money < 0) {
      debugLog(`⛔ BANKRUPTCY: ${updatedPlayer.name} has run out of money! Money: $${updatedPlayer.money.toLocaleString()}`);

      // Domain-event stage 4: emit-after-commit + the real GameEnded type
      // (see checkDesignFeeCap's identical fix above for the full rationale).
      this.stateService.endGame(undefined, { type: 'bankruptcy', playerId });
      this.stateService.emitGameEvent({
        type: 'game_ended',
        reason: 'bankruptcy',
        playerId: playerId,
        playerName: updatedPlayer.name,
        spaceName: updatedPlayer.currentSpace,
        message: `💸 BANKRUPTCY: ${updatedPlayer.name} has run out of money and cannot continue the project!`,
      });
    }
  }

  // Real gap found 2026-08-02 scoping the notification-bus TODO item: money
  // RESOURCE_CHANGE effects (owner funding, bank loans, fees, life-event
  // charges) got a toast via notifyMoneyReceived/notifyFeeDeducted but were
  // never logged — confirmed via full-codebase grep that nothing anywhere
  // wrote an `action: 'resource_change'` log entry, even though the log
  // system already has that category (actionLogFormatting.ts renders it
  // with 💰). Time changes had the equivalent logTimeChange all along;
  // money changes just never got one. Mirrors that method's shape.
  private logMoneyChange(playerId: string, amount: number, reason: string): void {
    const formattedAmount = Math.abs(amount).toLocaleString();
    const description = amount > 0
      ? `+$${formattedAmount} received${reason ? ` (${reason})` : ''}`
      : `-$${formattedAmount} paid${reason ? ` (${reason})` : ''}`;

    this.loggingService.info(description, {
      playerId,
      action: 'resource_change',
      moneyChange: amount,
      visibility: 'player'
    });
  }

  private logTimeChange(playerId: string, amount: number, changeType: 'added' | 'reduced'): void {
    // fb:91738221 — terser, less stilted ("of time" was redundant).
    const dayLabel = `day${amount !== 1 ? 's' : ''}`;
    const description = changeType === 'reduced'
      ? `−${amount} ${dayLabel} (filing time reduced)`
      : `+${amount} ${dayLabel}`;

    this.loggingService.info(description, {
      playerId,
      action: 'time_effect',
      timeChange: changeType === 'reduced' ? -amount : amount,
      visibility: 'player'
    });
  }

  private notifyTimeChange(playerId: string, amount: number, source: string, reason: string): void {
    if (!this.notificationService) return;

    const player = this.stateService.getPlayer(playerId);
    if (!player) return;

    const absAmount = Math.abs(amount);
    const isReduction = amount < 0;
    const isFromCard = source.includes('card:');

    // Only notify for E card time changes (most relevant to users)
    if (isFromCard) {
      const shortMsg = isReduction ? `-${absAmount} days` : `+${absAmount} days`;
      const mediumMsg = isReduction
        ? `⏰ Time Saved: ${absAmount} day${absAmount !== 1 ? 's' : ''}`
        : `⏰ Time Added: ${absAmount} day${absAmount !== 1 ? 's' : ''}`;

      this.notificationService.notify(
        {
          short: shortMsg,
          medium: mediumMsg,
          detailed: reason || (isReduction ? `Filing time reduced by ${absAmount} days` : `${absAmount} days added to project time`)
        },
        {
          playerId: playerId,
          playerName: player.name,
          actionType: isReduction ? 'time_reduced' : 'time_added',
          notificationDuration: 4000
        }
      );
    }
  }

  private calculateFeeAmount(payload: FeeDeductionPayload, totalLoanAmount: number, _context: EffectContext): number | null {
    let feeAmount = 0;

    if (payload.feeType === 'LOAN_TIERED' && totalLoanAmount > 0) {
      // 2026-07-16: CSV-portability lift — was detected by sniffing the fee
      // flavor text for "1.4m"/"2.75m", which silently broke if that text
      // was ever reworded. Now a dedicated CSV fee_type (BANK-FUND-REVIEW in
      // SPACE_EFFECTS.csv), so the tiered structure fires regardless of how
      // the description is phrased. Tier thresholds/rates themselves are
      // still fixed game-balance constants, not CSV data.
      if (totalLoanAmount <= 1400000) {
        feeAmount = Math.round(totalLoanAmount * 0.01);
      } else if (totalLoanAmount <= 2750000) {
        feeAmount = Math.round(totalLoanAmount * 0.02);
      } else {
        feeAmount = Math.round(totalLoanAmount * 0.03);
      }
      debugLog(`    Tiered fee: $${feeAmount} (loan: $${totalLoanAmount})`);
    } else if (payload.feeType === 'LOAN_PERCENTAGE' && totalLoanAmount > 0) {
      const feeDesc = payload.feeDescription.toLowerCase();
      const percentValue = extractPercentage(feeDesc);
      if (percentValue !== null) {
        const percent = percentValue / 100;
        feeAmount = Math.round(totalLoanAmount * percent);
        debugLog(`    ${percentValue}% fee: $${feeAmount} (loan: $${totalLoanAmount})`);
      }
    } else if (payload.feeType === 'SCOPE_PERCENTAGE') {
      // "N% of scope" — a one-time fee on the player's project size. Used by
      // teacher-authored spaces (4b slice 4). Deliberately NOT routed through
      // trackDesignExpenditure / the 20% design-fee game-over cap: that cap is
      // for the stock architect/engineer mechanic, and tying authored fees to
      // it would let a teacher accidentally author an instant-loss space.
      const percentValue = extractPercentage(payload.feeDescription.toLowerCase());
      if (percentValue !== null && percentValue > 0) {
        const scope = this.gameRulesService.calculateProjectScope(payload.playerId);
        feeAmount = Math.round(scope * (percentValue / 100));
        debugLog(`    ${percentValue}% of scope fee: $${feeAmount} (scope: $${scope})`);
      }
    } else if (payload.feeType === 'DICE_BASED') {
      return null; // Indicates dice roll required
    } else if (payload.feeType === 'FIXED') {
      const parsed = parseFeeFromDescription(payload.feeDescription);
      if (parsed && parsed.type === 'fixed') {
        feeAmount = parsed.value;
      }
    }

    return feeAmount;
  }

  private applyFeeDeduction(payload: FeeDeductionPayload, player: Player, feeAmount: number, totalLoanAmount: number, context: EffectContext): EffectResult {
    // Check if player can afford the fee
    const canAfford = this.resourceService.canAfford(payload.playerId, feeAmount);

    if (!canAfford) {
      debugLog(`    ❌ Cannot afford fee: $${feeAmount.toLocaleString()} (player has $${player.money.toLocaleString()})`);

      this.loggingService.warn(`Fee payment failed: insufficient funds for $${feeAmount.toLocaleString()}`, {
        playerId: payload.playerId,
        action: 'fee_failed',
        source: payload.source || context.source
      });

      if (this.notificationService) {
        this.notificationService.notify(
          {
            short: 'Insufficient funds',
            medium: `❌ Cannot pay $${feeAmount.toLocaleString()} fee`,
            detailed: `You need $${feeAmount.toLocaleString()} to pay this fee but only have $${player.money.toLocaleString()}`
          },
          {
            playerId: payload.playerId,
            playerName: player.name,
            actionType: 'fee_insufficient_funds',
            notificationDuration: 5000
          }
        );
      }

      return {
        success: false,
        effectType: 'FEE_DEDUCTION',
        error: `Insufficient funds: Need $${feeAmount.toLocaleString()} to pay fee, but only have $${player.money.toLocaleString()}`
      };
    }

    // Player can afford - attempt the deduction
    const deductionResult = this.resourceService.spendMoney(
      payload.playerId,
      feeAmount,
      payload.source || context.source,
      payload.feeDescription
    );

    if (deductionResult) {
      debugLog(`    ✅ Deducted fee: $${feeAmount.toLocaleString()}`);

      // Real bug found 2026-08-02 while scoping the player.money
      // denormalization TODO item: Expenditures.fees's own type comment
      // documents its job as "All regulatory, consultant, and expeditor
      // costs (DOB, FDNY, Bank, Investor fees, E cards)" — exactly the
      // FEE_DEDUCTION effects this method handles — but nothing anywhere
      // ever wrote to it. Every FEE_DEDUCTION correctly reduced player.money
      // via spendMoney above, but PlayerNumbersV2's "Regulatory & filings"
      // ledger line (reads player.expenditures.fees) was permanently stuck
      // at $0 regardless of how much a player had actually paid. Mirrors
      // trackDesignExpenditure's pattern (re-fetch post-spend, update via
      // TEMP so the turn-commit snapshot picks it up, don't clobber a
      // concurrent write via updatePlayer).
      const updatedPlayer = this.stateService.getPlayer(payload.playerId);
      if (updatedPlayer?.expenditures) {
        this.stateService.updateTempState(payload.playerId, {
          expenditures: {
            ...updatedPlayer.expenditures,
            fees: (updatedPlayer.expenditures.fees || 0) + feeAmount
          }
        });
      }

      this.loggingService.info(`Fee paid: $${feeAmount.toLocaleString()} (${payload.feeDescription})`, {
        playerId: payload.playerId,
        action: 'fee_deducted',
        source: payload.source || context.source
      });

      return { success: true, effectType: 'FEE_DEDUCTION' };
    } else {
      console.error(`    ❌ Fee deduction failed unexpectedly`);
      return {
        success: false,
        effectType: 'FEE_DEDUCTION',
        error: `Fee deduction failed unexpectedly`
      };
    }
  }
}
