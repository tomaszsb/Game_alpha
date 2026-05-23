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
      return {
        success: false,
        effectType: effect.effectType,
        error: `Failed to process ${payload.resource} change of ${payload.amount} for player ${payload.playerId}`
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
        this.loggingService.info(`Fee deduction pending: ${payload.feeDescription} (dice roll required)`, {
          playerId: payload.playerId,
          action: 'fee_pending',
          source: payload.source || context.source
        });
        return { success: true, effectType: effect.effectType };
      }

      if (feeAmount > 0) {
        return this.applyFeeDeduction(payload, player, feeAmount, totalLoanAmount, context);
      } else if (totalLoanAmount === 0 && payload.feeType === 'LOAN_PERCENTAGE') {
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
        this.notifyMoneyReceived(playerId, amount, source, sourceType, reason);
      }
    } else if (amount < 0) {
      success = this.resourceService.spendMoney(playerId, Math.abs(amount), source, reason);
      if (success) {
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
    const currentTurn = gameState.globalTurnCount || gameState.turn || 0;

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

  private checkDesignFeeCap(playerId: string, payload: ResourceChangePayload): void {
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

      this.stateService.emitAutoAction({
        type: 'life_event',
        playerId: playerId,
        playerName: updatedPlayer.name,
        success: false,
        spaceName: updatedPlayer.currentSpace,
        message: `⛔ GAME OVER: Design fees exceeded 20% of project scope!`
      });
      this.stateService.endGame();
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

  private checkBankruptcy(playerId: string): void {
    const updatedPlayer = this.stateService.getPlayer(playerId);
    if (updatedPlayer && updatedPlayer.money < 0) {
      debugLog(`⛔ BANKRUPTCY: ${updatedPlayer.name} has run out of money! Money: $${updatedPlayer.money.toLocaleString()}`);

      this.stateService.emitAutoAction({
        type: 'life_event',
        playerId: playerId,
        playerName: updatedPlayer.name,
        success: false,
        spaceName: updatedPlayer.currentSpace,
        message: `💸 BANKRUPTCY: ${updatedPlayer.name} has run out of money and cannot continue the project!`
      });

      this.stateService.endGame();
    }
  }

  private logTimeChange(playerId: string, amount: number, changeType: 'added' | 'reduced'): void {
    const description = changeType === 'reduced'
      ? `Reduced filing time by ${amount} day${amount !== 1 ? 's' : ''}`
      : `Added ${amount} day${amount !== 1 ? 's' : ''} of time`;

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

  private calculateFeeAmount(payload: FeeDeductionPayload, totalLoanAmount: number, context: EffectContext): number | null {
    let feeAmount = 0;

    if (payload.feeType === 'LOAN_PERCENTAGE' && totalLoanAmount > 0) {
      const feeDesc = payload.feeDescription.toLowerCase();

      // Check for tiered fee structure
      if (feeDesc.includes('1.4m') || feeDesc.includes('2.75m')) {
        if (totalLoanAmount <= 1400000) {
          feeAmount = Math.round(totalLoanAmount * 0.01);
        } else if (totalLoanAmount <= 2750000) {
          feeAmount = Math.round(totalLoanAmount * 0.02);
        } else {
          feeAmount = Math.round(totalLoanAmount * 0.03);
        }
        debugLog(`    Tiered fee: $${feeAmount} (loan: $${totalLoanAmount})`);
      } else {
        // Check for fixed percentage
        const percentValue = extractPercentage(feeDesc);
        if (percentValue !== null) {
          const percent = percentValue / 100;
          feeAmount = Math.round(totalLoanAmount * percent);
          debugLog(`    ${percentValue}% fee: $${feeAmount} (loan: $${totalLoanAmount})`);
        }
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
