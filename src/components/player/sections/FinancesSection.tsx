import React, { useState, useMemo } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { IServiceContainer } from '../../../types/ServiceContracts';
import './FinancesSection.css';

/**
 * Props for the FinancesSection component
 */
export interface FinancesSectionProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose finances to display */
  playerId: string;

  /** Callback to handle dice roll / Get Funding action (deprecated - use onAutomaticFunding for OWNER-FUND-INITIATION) */
  onRollDice?: () => Promise<void>;

  /** Callback to handle automatic funding at OWNER-FUND-INITIATION space */
  onAutomaticFunding?: () => Promise<void>;

  /** Callback to handle manual effect results (to show modal) */
  onManualEffectResult?: (result: import('../../../types/StateTypes').TurnEffectResult) => void;

  /** Completed actions tracking */
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };

  /** Whether it's this player's turn */
  isMyTurn?: boolean;
}

/**
 * FinancesSection Component
 *
 * Displays the player's financial information and provides ALL money-related manual actions.
 * Part of the mobile-first Player Panel UI redesign.
 *
 * **Displays:**
 * - Current balance (money)
 * - Surplus (if positive - currently placeholder)
 *
 * **Actions:**
 * - Dynamically shows ALL manual money effects from current space
 * - Note: Funding at OWNER-FUND-INITIATION is automatic (no manual button needed)
 *
 * **Features:**
 * - Automatically detects ALL manual effects from current space
 * - Error handling with retry functionality
 * - Loading states during action execution
 * - Conditional rendering of action buttons
 *
 * **Integration:**
 * - Uses `triggerManualEffectWithFeedback` from TurnService
 * - Dynamically queries space effects from DataService
 * - Shows action indicator (🔴) when manual actions are available
 *
 * @example
 * ```tsx
 * <FinancesSection
 *   gameServices={gameServices}
 *   playerId="player-1"
 *   isExpanded={isFinancesExpanded}
 *   onToggle={() => setIsFinancesExpanded(!isFinancesExpanded)}
 * />
 * ```
 */
export const FinancesSection: React.FC<FinancesSectionProps> = ({
  gameServices,
  playerId,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions = { manualActions: {} },
  isMyTurn = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Internal state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [isRollingDice, setIsRollingDice] = useState(false);

  // Get player state
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) {
    return null;
  }

  // Ensure moneySources and expenditures exist (for backward compatibility)
  const playerMoneySources = player.moneySources || {
    ownerFunding: 0,
    bankLoans: 0,
    investmentDeals: 0,
    other: 0
  };

  const expenditures = player.expenditures || {
    design: 0,
    fees: 0,
    construction: 0
  };

  // Calculate financial metrics using useMemo for performance
  const financialMetrics = useMemo(() => {
    const totalBudget = Object.values(playerMoneySources).reduce((sum, val) => sum + val, 0);
    const totalExpenditures = Object.values(expenditures).reduce((sum, val) => sum + val, 0);
    const cashOnHand = player.money;
    // Calculate project scope dynamically from W cards (not stored value which may be stale)
    const projectScope = gameServices.gameRulesService.calculateProjectScope(playerId);

    // Design cost ratio (20% threshold is industry standard)
    const designCostRatio = projectScope > 0 ? (expenditures.design / projectScope) * 100 : 0;
    const isDesignOverBudget = designCostRatio > 20;

    // Budget variance (positive = under budget, negative = over budget)
    const budgetVariance = totalBudget - totalExpenditures;

    // Funding mix (percentage of owner vs external funding)
    const ownerFundingPct = totalBudget > 0 ? (playerMoneySources.ownerFunding / totalBudget) * 100 : 0;
    const externalFundingPct = 100 - ownerFundingPct;

    return {
      totalBudget,
      totalExpenditures,
      cashOnHand,
      projectScope,
      designCostRatio,
      isDesignOverBudget,
      budgetVariance,
      ownerFundingPct,
      externalFundingPct
    };
  }, [playerMoneySources, expenditures, player.money, player.hand, player.activeCards, playerId, gameServices]);

  // Get ALL manual effects for money from current space, filtered by conditions
  // Wrapped in useMemo to prevent state updates during render (evaluateCondition may update projectScope)
  const { moneyManualEffects, fundingCardEffects, moneyDiceEffects } = useMemo(() => {
    const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
    const conditionFilteredEffects = gameServices.turnService.filterSpaceEffectsByCondition(allSpaceEffects, player) || [];

    const moneyEffects = conditionFilteredEffects.filter(
      effect => effect.trigger_type === 'manual' && effect.effect_type === 'money'
    );

    // Get manual card effects that represent funding (B/I cards at OWNER-FUND-INITIATION)
    // These are condition-filtered, so only ONE will show (B for scope ≤ $4M, I for scope > $4M)
    const fundingEffects = conditionFilteredEffects.filter(
      effect => effect.trigger_type === 'manual' &&
                effect.effect_type === 'cards' &&
                (effect.effect_action === 'draw_b' || effect.effect_action === 'draw_i')
    );

    // Get dice effects for money (design fees at ARCH-FEE-REVIEW, ENG-FEE-REVIEW)
    const allDiceEffects = gameServices.dataService.getDiceEffects(player.currentSpace, player.visitType) || [];
    const diceMoneyEffects = allDiceEffects.filter(
      effect => effect.effect_type === 'money'
    );

    return { moneyManualEffects: moneyEffects, fundingCardEffects: fundingEffects, moneyDiceEffects: diceMoneyEffects };
  }, [gameServices, player.currentSpace, player.visitType, player.id]);

  // Check if there are any money manual actions available (including funding via cards and dice)
  const hasMoneyActions = moneyManualEffects.length > 0 || fundingCardEffects.length > 0 || moneyDiceEffects.length > 0;

  const handleManualEffect = async (effectType: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectType);

      // Trigger the onManualEffectResult callback if provided
      if (onManualEffectResult && result) {
        onManualEffectResult(result);
      }
    } catch (err) {
      setError(`Failed to perform ${effectType} action. Please try again.`);
      console.error(`Manual effect error (${effectType}):`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  // Handler for dice roll (design fees)
  const handleDiceRoll = async () => {
    if (!onRollDice) return;

    setIsRollingDice(true);
    setError(null);

    try {
      await onRollDice();
    } catch (err) {
      setError('Failed to roll dice. Please try again.');
      console.error('Dice roll error:', err);
    } finally {
      setIsRollingDice(false);
    }
  };

  const toggleSource = (sourceName: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceName)) {
        newSet.delete(sourceName);
      } else {
        newSet.add(sourceName);
      }
      return newSet;
    });
  };

  // Money sources structure (showing sources with money received)
  const moneySourcesList = [
    {
      name: 'Owner Funding',
      amount: playerMoneySources.ownerFunding || 0,
      description: 'Seed money from project owner',
      processed: playerMoneySources.ownerFunding > 0
    },
    {
      name: 'Bank Loans',
      amount: playerMoneySources.bankLoans || 0,
      description: 'Financing from bank lenders',
      processed: playerMoneySources.bankLoans > 0
    },
    {
      name: 'Investment Deals',
      amount: playerMoneySources.investmentDeals || 0,
      description: 'Capital from investors',
      processed: playerMoneySources.investmentDeals > 0
    },
    {
      name: 'Other Sources',
      amount: playerMoneySources.other || 0,
      description: 'Miscellaneous funding (cards, space effects, etc.)',
      processed: playerMoneySources.other > 0
    }
  ].filter(source => source.processed); // Only show sources with money

  // Helper to format button label from effect
  const getButtonLabel = (effect: any): string => {
    // For funding card effects at OWNER-FUND-INITIATION - override description
    if (effect.effect_type === 'cards' && (effect.effect_action === 'draw_b' || effect.effect_action === 'draw_i')) {
      return 'Accept Owner Funding';
    }
    if (effect.description) return effect.description;
    if (effect.effect_type === 'money') return 'Get Money';
    return effect.effect_type;
  };

  // Helper to get dice roll button label based on space
  const getDiceButtonLabel = (): string => {
    if (player.currentSpace.includes('ARCH')) {
      return 'Roll for Architect Fee';
    } else if (player.currentSpace.includes('ENG')) {
      return 'Roll for Engineer Fee';
    }
    return 'Roll for Fee';
  };

  // Create header actions (action buttons always visible)
  const headerActions = (moneyManualEffects.length > 0 || fundingCardEffects.length > 0 || moneyDiceEffects.length > 0) ? (
    <>
      {/* Dice roll button for design fees (ARCH-FEE-REVIEW, ENG-FEE-REVIEW) */}
      {(() => {
        const isDiceCompleted = completedActions.diceRoll !== undefined;
        return moneyDiceEffects.length > 0 && onRollDice && !isDiceCompleted && (
          <ActionButton
            label={isMyTurn ? getDiceButtonLabel() : "⏳ Wait for your turn"}
            variant="primary"
            onClick={handleDiceRoll}
            disabled={!isMyTurn || isLoading || isRollingDice}
            isLoading={isRollingDice}
            ariaLabel={isMyTurn ? "Roll dice to determine design fee percentage" : "Wait for your turn"}
          />
        );
      })()}

      {/* Render funding card effects (B/I cards for owner funding) */}
      {fundingCardEffects.map((effect, index) => {
        // Use compound key: "cards:draw_b" or "cards:draw_i" to identify specific effect
        const effectKey = `${effect.effect_type}:${effect.effect_action}`;
        const isEffectCompleted = completedActions.manualActions[effectKey] !== undefined;
        return !isEffectCompleted && (
          <ActionButton
            key={`funding-${index}`}
            label={isMyTurn ? getButtonLabel(effect) : "⏳ Wait for your turn"}
            variant="primary"
            onClick={() => handleManualEffect(effectKey)}
            disabled={!isMyTurn || isLoading}
            isLoading={isLoading}
            ariaLabel={isMyTurn ? "Accept owner funding" : "Wait for your turn"}
          />
        );
      })}

      {/* Render ALL money manual effects as buttons */}
      {moneyManualEffects.map((effect, index) => {
        const isEffectCompleted = completedActions.manualActions[effect.effect_type] !== undefined;
        return !isEffectCompleted && (
          <ActionButton
            key={`money-${index}`}
            label={isMyTurn ? getButtonLabel(effect) : "⏳ Wait for your turn"}
            variant="primary"
            onClick={() => handleManualEffect(effect.effect_type)}
            disabled={!isMyTurn || isLoading}
            isLoading={isLoading}
            ariaLabel={isMyTurn ? `Perform ${effect.effect_type} action` : "Wait for your turn"}
          />
        );
      })}
    </>
  ) : undefined;

  // Summary content - always visible, shows cash on hand and design fee status
  const designFeeColor = financialMetrics.designCostRatio >= 20 ? '#f44336' :
                         financialMetrics.designCostRatio >= 15 ? '#ff5722' :
                         financialMetrics.designCostRatio >= 10 ? '#ff9800' : '#4caf50';

  // Money vs Scope color: red when money < scope, green otherwise
  const moneyVsScopeColor = financialMetrics.cashOnHand < financialMetrics.projectScope ? '#f44336' : '#4caf50';
  const moneyVsScopeIcon = financialMetrics.cashOnHand < financialMetrics.projectScope ? '⚠️' : '✅';

  const summary = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{
        color: financialMetrics.projectScope > 0 ? moneyVsScopeColor : 'inherit',
        fontWeight: financialMetrics.projectScope > 0 && financialMetrics.cashOnHand < financialMetrics.projectScope ? 'bold' : 'normal'
      }}>
        {financialMetrics.projectScope > 0 && moneyVsScopeIcon} Cash: ${financialMetrics.cashOnHand.toLocaleString()}
      </span>
      {financialMetrics.projectScope > 0 && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '2px 6px',
          backgroundColor: designFeeColor,
          color: 'white',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 'bold'
        }}>
          {financialMetrics.designCostRatio >= 20 ? '🚨' :
           financialMetrics.designCostRatio >= 15 ? '⚠️' : '📐'}
          {financialMetrics.designCostRatio.toFixed(0)}%/20%
        </span>
      )}
    </span>
  );

  return (
    <ExpandableSection
      title="FINANCES"
      icon="💰"
      hasAction={hasMoneyActions}
      isExpanded={isExpanded}
      onToggle={() => {
        console.log('FINANCES toggle clicked, isExpanded:', isExpanded, '-> will be:', !isExpanded);
        setIsExpanded(!isExpanded);
      }}
      ariaControls="finances-content"
      isLoading={isLoading}
      error={error || undefined}
      onRetry={error ? handleRetry : undefined}
      headerActions={headerActions}
      summary={summary}
    >
      <div className="finances-content" id="finances-content">
        {/* Section A: Scope & Budget */}
        <div className="financial-section">
          <h3 className="section-heading">📊 Scope & Budget</h3>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-label">Project Scope</span>
              <span className="stat-value">${financialMetrics.projectScope.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Budget</span>
              <span className="stat-value">${financialMetrics.totalBudget.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Cash on Hand</span>
              <span
                className="stat-value stat-highlight"
                style={{
                  color: financialMetrics.projectScope > 0 ? moneyVsScopeColor : undefined,
                  fontWeight: financialMetrics.projectScope > 0 && financialMetrics.cashOnHand < financialMetrics.projectScope ? 'bold' : undefined
                }}
              >
                {financialMetrics.projectScope > 0 && moneyVsScopeIcon} ${financialMetrics.cashOnHand.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Section B: Expenditures */}
        {financialMetrics.totalExpenditures > 0 && (
          <div className="financial-section">
            <h3 className="section-heading">💸 Expenditures</h3>
            <div className="stat-list">
              <div className="stat-item">
                <span className="stat-label">Design</span>
                <span className="stat-value">${expenditures.design.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Fees</span>
                <span className="stat-value">${expenditures.fees.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Construction</span>
                <span className="stat-value">${expenditures.construction.toLocaleString()}</span>
              </div>
              <div className="stat-item stat-total">
                <span className="stat-label">Total Spent</span>
                <span className="stat-value">${financialMetrics.totalExpenditures.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Section B2: Costs (detailed fee tracking) */}
        {player.costs && player.costs.total > 0 && (
          <div className="financial-section">
            <h3 className="section-heading">💵 Costs (Detailed)</h3>
            <div className="cost-categories">
              {/* Bank Fees */}
              {player.costs.bank > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('bank-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('bank-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Bank Fees</span>
                    </span>
                    <span className="category-amount">${player.costs.bank.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('bank-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'bank').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Investor Fees */}
              {player.costs.investor > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('investor-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('investor-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Investor Fees</span>
                    </span>
                    <span className="category-amount">${player.costs.investor.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('investor-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'investor').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Expeditor Fees */}
              {player.costs.expeditor > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('expeditor-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('expeditor-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Expeditor Fees</span>
                    </span>
                    <span className="category-amount">${player.costs.expeditor.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('expeditor-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'expeditor').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Architectural Fees */}
              {player.costs.architectural > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('architectural-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('architectural-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Architectural Fees</span>
                    </span>
                    <span className="category-amount">${player.costs.architectural.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('architectural-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'architectural').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Engineering Fees */}
              {player.costs.engineering > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('engineering-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('engineering-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Engineering Fees</span>
                    </span>
                    <span className="category-amount">${player.costs.engineering.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('engineering-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'engineering').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Regulatory Fees */}
              {player.costs.regulatory > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('regulatory-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('regulatory-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Regulatory Fees</span>
                    </span>
                    <span className="category-amount">${player.costs.regulatory.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('regulatory-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'regulatory').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Miscellaneous Fees */}
              {player.costs.miscellaneous > 0 && (
                <div className="cost-category-group">
                  <button
                    className="cost-category-header"
                    onClick={() => toggleSource('miscellaneous-costs')}
                  >
                    <span className="category-info">
                      <span className="expand-icon">{expandedSources.has('miscellaneous-costs') ? '▼' : '▶'}</span>
                      <span className="category-name">Miscellaneous</span>
                    </span>
                    <span className="category-amount">${player.costs.miscellaneous.toLocaleString()}</span>
                  </button>
                  {expandedSources.has('miscellaneous-costs') && (
                    <div className="cost-details">
                      {player.costHistory?.filter(c => c.category === 'miscellaneous').map((cost, idx) => (
                        <div key={idx} className="cost-entry">
                          <span className="cost-description">{cost.description}</span>
                          <span className="cost-amount">${cost.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Total Costs */}
              <div className="stat-item stat-total">
                <span className="stat-label">Total Costs</span>
                <span className="stat-value">${player.costs.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Section C: Financial Health */}
        {financialMetrics.totalBudget > 0 && (
          <div className="financial-section">
            <h3 className="section-heading">📈 Financial Health</h3>
            <div className="stat-list">
              <div className={`stat-item ${financialMetrics.isDesignOverBudget ? 'stat-warning' : ''}`}>
                <span className="stat-label">Design Cost %</span>
                <span className="stat-value">
                  {financialMetrics.designCostRatio.toFixed(1)}%
                  {financialMetrics.isDesignOverBudget && ' ⚠️'}
                </span>
              </div>
              {financialMetrics.isDesignOverBudget && (
                <div className="stat-warning-message">
                  Design costs exceed 20% threshold - project at risk
                </div>
              )}
              <div className="stat-item">
                <span className="stat-label">Budget Variance</span>
                <span className={`stat-value ${financialMetrics.budgetVariance < 0 ? 'stat-negative' : 'stat-positive'}`}>
                  ${Math.abs(financialMetrics.budgetVariance).toLocaleString()}
                  {financialMetrics.budgetVariance >= 0 ? ' under' : ' over'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Funding Mix</span>
                <span className="stat-value">
                  {financialMetrics.ownerFundingPct.toFixed(0)}% owner / {financialMetrics.externalFundingPct.toFixed(0)}% external
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section D: Money Sources (collapsible details) */}
        {moneySourcesList.length > 0 && (
          <div className="financial-section">
            <h3 className="section-heading">💰 Sources of Money</h3>
            {moneySourcesList.map((source, index) => {
              const isExpanded = expandedSources.has(source.name);
              return (
                <div key={index} className="money-source-group">
                  <button
                    className="money-source-header"
                    onClick={() => toggleSource(source.name)}
                  >
                    <span className="source-info">
                      <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                      <span className="source-name">{source.name}</span>
                    </span>
                    {source.amount > 0 && (
                      <span className="source-amount">${source.amount.toLocaleString()}</span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="source-details">
                      <div className="source-description">{source.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ExpandableSection>
  );
};
