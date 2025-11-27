import {
  IResourceService,
  IStateService,
  ResourceChange,
  ResourceTransaction,
  ResourceValidation
} from '../types/ServiceContracts';
import { ErrorNotifications } from '../utils/ErrorNotifications';

/**
 * Unified Resource Management Service
 * 
 * Handles all player resource modifications (money and time) with:
 * - Atomic operations and rollback capability
 * - Source tracking for debugging and logging
 * - Validation and error handling
 * - Transaction history for auditing
 * 
 * This service can be called from any source:
 * - Card effects (e.g., "card:E029")
 * - Space effects (e.g., "space:PM-DECISION-CHECK")
 * - UI actions (e.g., "ui:manual_adjustment")
 */
export class ResourceService implements IResourceService {
  private stateService: IStateService;
  private transactionHistory: Map<string, ResourceTransaction[]> = new Map();

  constructor(stateService: IStateService) {
    this.stateService = stateService;
  }

  // === MONEY OPERATIONS ===

  addMoney(playerId: string, amount: number, source: string, reason?: string, sourceType?: 'bank' | 'investment' | 'owner' | 'other'): boolean {
    if (amount <= 0) {
      const error = ErrorNotifications.resourceOperationFailed('add', 'money', `Invalid amount: ${amount}`);
      console.warn(error.medium);
      return false;
    }

    return this.updateResources(playerId, {
      money: amount,
      source,
      reason: reason || `Added $${amount.toLocaleString()}`,
      moneySourceType: sourceType
    });
  }

  spendMoney(playerId: string, amount: number, source: string, reason?: string, category?: keyof import('../types/DataTypes').Expenditures): boolean {
    if (amount <= 0) {
      const error = ErrorNotifications.resourceOperationFailed('spend', 'money', `Invalid amount: ${amount}`);
      console.warn(error.medium);
      return false;
    }

    // Get player first to check affordability
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    if (!this.canAfford(playerId, amount)) {
      const error = ErrorNotifications.insufficientFunds(amount, player.money);
      console.warn(error.medium);
      return false;
    }

    // Update expenditures if category is provided
    if (category) {
      // Ensure expenditures exists (backward compatibility)
      const currentExpenditures = player.expenditures || {
        design: 0,
        fees: 0,
        construction: 0
      };

      const updatedExpenditures = {
        ...currentExpenditures,
        [category]: currentExpenditures[category] + amount
      };

      // Update both money and expenditures in a single state update
      this.stateService.updatePlayer({
        id: playerId,
        money: player.money - amount,
        expenditures: updatedExpenditures
      });

      console.log(`💸 Expenditure tracked [${playerId}]: $${amount.toLocaleString()} in ${category} category`);
      console.log(`   Total ${category}: $${updatedExpenditures[category].toLocaleString()}`);

      return true;
    }

    // If no category provided, use legacy updateResources method
    return this.updateResources(playerId, {
      money: -amount,
      source,
      reason: reason || `Spent $${amount.toLocaleString()}`
    });
  }

  canAfford(playerId: string, amount: number): boolean {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }
    return player.money >= amount;
  }

  /**
   * Record a cost/fee and track it by category
   * This deducts money AND adds to cost history for detailed tracking
   */
  recordCost(
    playerId: string,
    category: import('../types/DataTypes').CostCategory,
    amount: number,
    description: string,
    source: string
  ): boolean {
    if (amount <= 0) {
      const error = ErrorNotifications.resourceOperationFailed('record', 'cost', `Invalid amount: ${amount}`);
      console.warn(error.medium);
      return false;
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    if (!this.canAfford(playerId, amount)) {
      const error = ErrorNotifications.insufficientFunds(amount, player.money);
      console.warn(error.medium);
      return false;
    }

    const gameState = this.stateService.getGameState();
    const currentTurn = gameState.globalTurnCount || 0;

    // Create cost entry
    const costEntry: import('../types/DataTypes').CostEntry = {
      id: `cost_${playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      amount,
      description,
      turn: currentTurn,
      timestamp: new Date(),
      spaceName: player.currentSpace
    };

    // Initialize costHistory and costs if they don't exist (backward compatibility)
    const costHistory = player.costHistory || [];
    const costs = player.costs || {
      bank: 0,
      investor: 0,
      expeditor: 0,
      architectural: 0,
      engineering: 0,
      regulatory: 0,
      miscellaneous: 0,
      total: 0
    };

    // Add cost entry to history
    const updatedCostHistory = [...costHistory, costEntry];

    // Update costs breakdown
    const updatedCosts = {
      ...costs,
      [category]: costs[category] + amount,
      total: costs.total + amount
    };

    // Map cost category to expenditure category for backward compatibility
    const expenditureCategory = this.mapCostToExpenditure(category);

    // Update player state
    this.stateService.updatePlayer({
      id: playerId,
      money: player.money - amount,
      costHistory: updatedCostHistory,
      costs: updatedCosts,
      expenditures: expenditureCategory ? {
        ...player.expenditures,
        [expenditureCategory]: (player.expenditures?.[expenditureCategory] || 0) + amount
      } : player.expenditures
    });

    // Log the transaction for debugging
    console.log(`💸 Cost Recorded [${playerId}]: ${category} - $${amount.toLocaleString()} - ${description}`);

    return true;
  }

  /**
   * Map cost category to expenditure category for backward compatibility
   */
  private mapCostToExpenditure(category: import('../types/DataTypes').CostCategory): keyof import('../types/DataTypes').Expenditures | null {
    switch (category) {
      case 'architectural':
      case 'engineering':
        return 'design';
      case 'bank':
      case 'investor':
      case 'expeditor':
      case 'regulatory':
        return 'fees';
      default:
        return null;
    }
  }

  // === TIME OPERATIONS ===

  addTime(playerId: string, amount: number, source: string, reason?: string): void {
    this.updateResources(playerId, {
      timeSpent: amount,
      source,
      reason: reason || `Added ${amount} time`
    });
  }

  spendTime(playerId: string, amount: number, source: string, reason?: string): void {
    this.updateResources(playerId, {
      timeSpent: -amount,
      source,
      reason: reason || `Spent ${amount} time`
    });
  }

  // === COMBINED OPERATIONS ===

  updateResources(playerId: string, changes: ResourceChange): boolean {
    // Validate the change
    const validation = this.validateResourceChange(playerId, changes);
    if (!validation.valid) {
      const error = ErrorNotifications.resourceOperationFailed(
        'update',
        'resources',
        validation.errors.join(', ')
      );
      console.error(error.detailed);
      return false;
    }

    // Get current player state
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    // Calculate new values
    const balanceBefore = {
      money: player.money,
      timeSpent: player.timeSpent
    };

    const newMoney = changes.money ? player.money + changes.money : player.money;
    const newTimeSpent = changes.timeSpent ? player.timeSpent + changes.timeSpent : player.timeSpent;

    // Update money sources if money is being added
    // Provide default if player doesn't have moneySources yet (backward compatibility)
    const updatedMoneySources = player.moneySources ? { ...player.moneySources } : {
      ownerFunding: 0,
      bankLoans: 0,
      investmentDeals: 0,
      other: 0
    };

    if (changes.money && changes.money > 0) {
      const amount = changes.money;

      // Use explicit sourceType if provided (preferred method)
      if (changes.moneySourceType) {
        switch (changes.moneySourceType) {
          case 'bank':
            updatedMoneySources.bankLoans = (updatedMoneySources.bankLoans || 0) + amount;
            break;
          case 'investment':
            updatedMoneySources.investmentDeals = (updatedMoneySources.investmentDeals || 0) + amount;
            break;
          case 'owner':
            updatedMoneySources.ownerFunding = (updatedMoneySources.ownerFunding || 0) + amount;
            break;
          case 'other':
            updatedMoneySources.other = (updatedMoneySources.other || 0) + amount;
            break;
        }
      } else {
        // Fallback to categorization for backward compatibility
        const category = this.categorizeMoneySource(changes.source, player.currentSpace);
        updatedMoneySources[category] += changes.money;
      }
    }

    // Apply the changes
    try {
      const updatedState = this.stateService.updatePlayer({
        id: playerId,
        money: newMoney,
        timeSpent: Math.max(0, newTimeSpent), // Ensure time doesn't go negative
        moneySources: updatedMoneySources
      });

      const balanceAfter = {
        money: newMoney,
        timeSpent: Math.max(0, newTimeSpent)
      };

      // Log the transaction
      this.logTransaction(playerId, changes, balanceBefore, balanceAfter, true);

      // Log to console for debugging
      const changeDescription = this.formatChangeDescription(changes);
      console.log(`💰 Resource Update [${playerId}]: ${changeDescription} (Source: ${changes.source})`);
      console.log(`   Balance: $${balanceBefore.money.toLocaleString()} → $${balanceAfter.money.toLocaleString()}, Time: ${balanceBefore.timeSpent} → ${balanceAfter.timeSpent}`);

      return true;

    } catch (error) {
      const errorNotification = ErrorNotifications.resourceOperationFailed(
        'update',
        'resources',
        (error as Error).message
      );
      console.error(errorNotification.detailed);

      // Log failed transaction
      this.logTransaction(playerId, changes, balanceBefore, balanceBefore, false);

      throw new Error(errorNotification.detailed);
    }
  }

  getResourceHistory(playerId: string): ResourceTransaction[] {
    return this.transactionHistory.get(playerId) || [];
  }

  // === VALIDATION ===

  validateResourceChange(playerId: string, changes: ResourceChange): ResourceValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate player exists
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      errors.push(`Player ${playerId} does not exist`);
      return { valid: false, errors, warnings };
    }

    // Validate source is provided
    if (!changes.source || changes.source.trim().length === 0) {
      errors.push('Source is required for all resource changes');
    }

    // Validate money changes
    if (changes.money !== undefined) {
      if (isNaN(changes.money)) {
        errors.push('Money change must be a valid number');
      }
      
      // Check if spending more money than player has
      if (changes.money < 0 && player.money + changes.money < 0) {
        errors.push(`Insufficient funds: trying to spend $${Math.abs(changes.money).toLocaleString()}, but player only has $${player.money.toLocaleString()}`);
      }

      // Warning for large transactions
      if (Math.abs(changes.money) > 1000000) {
        warnings.push(`Large money transaction: ${changes.money > 0 ? '+' : ''}$${changes.money.toLocaleString()}`);
      }
    }

    // Validate time changes
    if (changes.timeSpent !== undefined) {
      if (isNaN(changes.timeSpent)) {
        errors.push('Time change must be a valid number');
      }

      // Warning for large time changes
      if (Math.abs(changes.timeSpent) > 20) {
        warnings.push(`Large time change: ${changes.timeSpent > 0 ? '+' : ''}${changes.timeSpent} ticks`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // === PRIVATE HELPERS ===

  private logTransaction(
    playerId: string, 
    changes: ResourceChange, 
    balanceBefore: { money: number; timeSpent: number },
    balanceAfter: { money: number; timeSpent: number },
    successful: boolean
  ): void {
    const transaction: ResourceTransaction = {
      id: this.generateTransactionId(),
      playerId,
      timestamp: Date.now(),
      changes,
      balanceBefore,
      balanceAfter,
      successful
    };

    // Initialize history if needed
    if (!this.transactionHistory.has(playerId)) {
      this.transactionHistory.set(playerId, []);
    }

    // Add transaction to history
    const playerHistory = this.transactionHistory.get(playerId)!;
    playerHistory.push(transaction);

    // Keep only last 100 transactions per player
    if (playerHistory.length > 100) {
      playerHistory.splice(0, playerHistory.length - 100);
    }
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatChangeDescription(changes: ResourceChange): string {
    const parts: string[] = [];

    if (changes.money !== undefined) {
      const sign = changes.money >= 0 ? '+' : '';
      parts.push(`${sign}$${changes.money.toLocaleString()}`);
    }

    if (changes.timeSpent !== undefined) {
      const sign = changes.timeSpent >= 0 ? '+' : '';
      parts.push(`${sign}${changes.timeSpent} time`);
    }

    let description = parts.join(', ');

    if (changes.reason) {
      description += ` (${changes.reason})`;
    }

    return description;
  }

  /**
   * Categorize money source into one of the tracked categories
   * @param source - Source string from ResourceChange
   * @param currentSpace - Player's current space
   * @returns Category key for moneySources
   */
  private categorizeMoneySource(source: string, currentSpace: string): 'ownerFunding' | 'bankLoans' | 'investmentDeals' | 'other' {
    const sourceLower = source.toLowerCase();

    // Owner funding from OWNER-FUND-INITIATION space
    if (currentSpace === 'OWNER-FUND-INITIATION' || sourceLower.includes('owner') || sourceLower.includes('funding')) {
      return 'ownerFunding';
    }

    // Bank loans
    if (sourceLower.includes('loan') || sourceLower.includes('bank')) {
      return 'bankLoans';
    }

    // Investment deals
    if (sourceLower.includes('invest') || sourceLower.includes('investor')) {
      return 'investmentDeals';
    }

    // Everything else (cards, space effects, etc.)
    return 'other';
  }

  // === LOAN OPERATIONS ===

  /**
   * Take out a loan for a player
   * @param playerId - Player taking the loan
   * @param amount - Principal amount of the loan
   * @param interestRate - Interest rate per turn (e.g., 0.05 for 5%)
   * @returns True if loan was successfully taken
   */
  takeOutLoan(playerId: string, amount: number, interestRate: number): boolean {
    if (amount <= 0) {
      const error = ErrorNotifications.resourceOperationFailed('take', 'loan', `Invalid amount: ${amount}`);
      console.warn(error.medium);
      return false;
    }

    if (interestRate < 0) {
      const error = ErrorNotifications.resourceOperationFailed('take', 'loan', `Invalid interest rate: ${interestRate}`);
      console.warn(error.medium);
      return false;
    }

    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    const gameState = this.stateService.getGameState();
    
    try {
      // Generate unique loan ID
      const loanId = `loan_${playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      // Create new loan object
      const newLoan = {
        id: loanId,
        principal: amount,
        interestRate: interestRate,
        startTurn: gameState.turn
      };

      // Add loan to player's loans array
      const updatedLoans = [...player.loans, newLoan];
      
      // Update player with new loan
      this.stateService.updatePlayer({
        id: playerId,
        loans: updatedLoans
      });

      // Add the loan amount to player's money
      const success = this.addMoney(playerId, amount, 'loan', `Loan ${loanId}: $${amount.toLocaleString()} at ${(interestRate * 100).toFixed(1)}%`);
      
      if (success) {
        console.log(`💰 LOAN: Player ${player.name} took loan ${loanId} for $${amount.toLocaleString()} at ${(interestRate * 100).toFixed(1)}% interest`);
        return true;
      } else {
        // Rollback loan if money addition failed
        this.stateService.updatePlayer({
          id: playerId,
          loans: player.loans
        });
        return false;
      }
      
    } catch (error) {
      const errorNotification = ErrorNotifications.resourceOperationFailed(
        'take',
        'loan',
        (error as Error).message
      );
      console.error(errorNotification.detailed);
      throw new Error(errorNotification.detailed);
    }
  }

  /**
   * Apply interest to all of a player's active loans
   * @param playerId - Player to apply interest to
   */
  applyInterest(playerId: string): void {
    const player = this.stateService.getPlayer(playerId);
    if (!player) {
      const error = ErrorNotifications.invalidState(`Player ${playerId} not found`);
      throw new Error(error.detailed);
    }

    if (!player.loans || player.loans.length === 0) {
      // No loans, nothing to do
      return;
    }

    let totalInterest = 0;
    const interestDetails: string[] = [];

    // Calculate total interest from all loans
    for (const loan of player.loans) {
      const interest = loan.principal * loan.interestRate;
      totalInterest += interest;
      interestDetails.push(`${loan.id}: $${interest.toLocaleString()}`);
    }

    if (totalInterest <= 0) {
      return;
    }

    console.log(`💸 INTEREST: Player ${player.name} owes $${totalInterest.toLocaleString()} in loan interest`);
    console.log(`   Breakdown: ${interestDetails.join(', ')}`);

    // Check if player can afford the interest
    if (player.money < totalInterest) {
      console.warn(`⚠️ INTEREST: Player ${player.name} cannot afford $${totalInterest.toLocaleString()} interest (has $${player.money.toLocaleString()})`);
      
      // Handle insufficient funds - for now, we'll deduct what they can afford and log the shortfall
      const affordableAmount = player.money;
      const shortfall = totalInterest - affordableAmount;
      
      if (affordableAmount > 0) {
        this.spendMoney(playerId, affordableAmount, 'interest', `Partial interest payment (shortfall: $${shortfall.toLocaleString()})`);
      }
      
      console.warn(`💸 INTEREST SHORTFALL: Player ${player.name} owes additional $${shortfall.toLocaleString()} in unpaid interest`);
      
      // NOTE: Interest shortfalls are forgiven (intentional game design)
      // This makes loans more accessible to struggling players
      // If harsher penalties are desired, consider:
      // - Adding unpaid interest to loan principal
      // - Applying late payment penalties
      // - Tracking payment history
      
    } else {
      // Player can afford full interest payment
      const success = this.spendMoney(playerId, totalInterest, 'interest', `Interest payment on ${player.loans.length} loan(s)`);
      
      if (success) {
        console.log(`✅ INTEREST: Player ${player.name} paid $${totalInterest.toLocaleString()} in loan interest`);
      }
    }
  }

  // === DEBUG HELPERS ===

  /**
   * Get summary of all resource transactions for debugging
   */
  getTransactionSummary(): { [playerId: string]: { totalTransactions: number; lastTransaction?: ResourceTransaction } } {
    const summary: { [playerId: string]: { totalTransactions: number; lastTransaction?: ResourceTransaction } } = {};
    
    for (const [playerId, transactions] of this.transactionHistory.entries()) {
      summary[playerId] = {
        totalTransactions: transactions.length,
        lastTransaction: transactions[transactions.length - 1]
      };
    }
    
    return summary;
  }

  /**
   * Clear transaction history (for testing or reset)
   */
  clearTransactionHistory(playerId?: string): void {
    if (playerId) {
      this.transactionHistory.delete(playerId);
    } else {
      this.transactionHistory.clear();
    }
  }
}