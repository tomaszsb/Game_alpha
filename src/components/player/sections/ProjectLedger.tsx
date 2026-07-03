import React, { useState, useMemo } from 'react';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { Player } from '../../../types/StateTypes';
import { FormatUtils } from '../../../utils/FormatUtils';
import './ProjectLedger.css';

export interface ProjectLedgerProps {
  gameServices: IServiceContainer;
  playerId: string;
  renderMode?: 'accordion' | 'content';
}

type LedgerView = 'ledger' | 'variance';

interface CategoryData {
  id: string;
  icon: string;
  name: string;
  budget: number;
  actual: number;
  colorClass: string;
  items?: { name: string; budget: number; actual: number }[];
}

export const ProjectLedger: React.FC<ProjectLedgerProps> = ({
  gameServices,
  playerId,
  renderMode = 'content',
}) => {
  const [activeView, setActiveView] = useState<LedgerView>('ledger');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Compute all financial data
  const data = useMemo(() => {
    const ms = player.moneySources || { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
    const ex = player.expenditures || { design: 0, fees: 0, construction: 0 };
    const projectScope = gameServices.gameRulesService.calculateProjectScope(playerId);

    // W-cards for scope line items (cost = project value, work_cost = construction base)
    const hand = player.hand || [];
    const activeCards = (player.activeCards || []).map(ac => ac.cardId);
    const allCardIds = [...hand, ...activeCards];
    const wCards = allCardIds
      .map(id => gameServices.dataService.getCardById(id))
      .filter(c => c && c.card_type === 'W');

    // Scope = sum of W-card cost values (what we're building)
    const totalScope = wCards.reduce((sum, c) => sum + parseFloat(String(c!.cost || 0)), 0);

    // Construction budget = sum of W-card work_cost values (base construction cost before dice)
    const constructionBaseCost = wCards.reduce((sum, c) => sum + parseFloat(String(c!.work_cost || 0)), 0);

    // Budget assumptions: design ~20% of scope, regulatory ~5%, contingency 10%
    const designBudget = Math.round(totalScope * 0.20);
    const regulatoryBudget = Math.round(totalScope * 0.05);
    const totalUseBudget = designBudget + regulatoryBudget + constructionBaseCost;
    const contingencyBudget = Math.round(totalUseBudget * 0.10);

    const totalSources = ms.ownerFunding + ms.bankLoans + ms.investmentDeals + ms.other;
    const totalSpent = ex.design + ex.fees + ex.construction;
    const cashOnHand = player.money;

    // Deficit: total commitments vs available funds
    const totalCommitments = totalScope + designBudget + regulatoryBudget + contingencyBudget;
    const deficit = totalCommitments - totalSources;

    // Contingency: any overrun vs budget gets absorbed here
    const designOverrun = Math.max(0, ex.design - designBudget);
    const regulatoryOverrun = Math.max(0, ex.fees - regulatoryBudget);
    const contingencyUsed = designOverrun + regulatoryOverrun;

    // Design ratio
    const designRatio = totalScope > 0 ? (ex.design / totalScope) * 100 : 0;

    // Contractor info
    const contractor = player.contractor;
    const qualityLabel = contractor ? { HIGH: 'High', MED: 'Medium', LOW: 'Low' }[contractor.quality] : null;
    // (The price/schedule math lives in utils/contractorTerms — this ledger only
    // displays recorded actuals, so it carries no copy of the formula.)

    // Funding breakdown from fundingHistory
    const fundingHistory = player.fundingHistory || [];
    const ownerFundingItems = fundingHistory.filter(f => f.sourceType === 'owner');
    const bankFundingItems = fundingHistory.filter(f => f.sourceType === 'bank');
    const investFundingItems = fundingHistory.filter(f => f.sourceType === 'investment');

    // Cost breakdown from costHistory
    const costHistory = player.costHistory || [];
    const archCosts = costHistory.filter(c => c.category === 'architectural');
    const engCosts = costHistory.filter(c => c.category === 'engineering');
    const regCosts = costHistory.filter(c => c.category === 'regulatory');
    const expCosts = costHistory.filter(c => c.category === 'expeditor');
    const investFeeCosts = costHistory.filter(c => c.category === 'investmentFee');

    // Source categories
    const sources: CategoryData[] = [
      {
        id: 'owner-equity',
        icon: '👤',
        name: 'Owner Equity',
        budget: ms.ownerFunding,
        actual: ms.ownerFunding,
        colorClass: 'cat-teal',
        items: ownerFundingItems.length > 0
          ? ownerFundingItems.map(f => ({ name: f.description || 'Owner Draw', budget: f.amount, actual: f.amount }))
          : undefined,
      },
      {
        id: 'bank-debt',
        icon: '🏦',
        name: 'Bank Debt',
        budget: ms.bankLoans,
        actual: ms.bankLoans,
        colorClass: 'cat-orange',
        items: bankFundingItems.length > 0
          ? bankFundingItems.map(f => ({ name: f.cardName || f.description || 'Bank Loan', budget: f.amount, actual: f.amount }))
          : undefined,
      },
    ];

    // Only show investment if player has any
    if (ms.investmentDeals > 0 || investFundingItems.length > 0) {
      sources.push({
        id: 'investments',
        icon: '📈',
        name: 'Investments',
        budget: ms.investmentDeals,
        actual: ms.investmentDeals,
        colorClass: 'cat-teal',
        items: investFundingItems.length > 0
          ? investFundingItems.map(f => ({ name: f.cardName || f.description || 'Investment', budget: f.amount, actual: f.amount }))
          : undefined,
      });
    }

    // Use categories — reordered: Scope → Design → Regulatory → Contractor → Contingency
    const uses: CategoryData[] = [
      // SCOPE: What we're building (W-card face values)
      {
        id: 'scope',
        icon: '🏢',
        name: 'Project Scope',
        budget: totalScope,
        actual: totalScope, // Scope is committed once cards are drawn
        colorClass: 'cat-blue',
        items: wCards.map(c => ({
          name: c!.card_name || c!.card_id,
          budget: parseFloat(String(c!.cost || 0)),
          actual: parseFloat(String(c!.cost || 0)),
        })),
      },
      // DESIGN: Architectural + Engineering fees
      {
        id: 'design',
        icon: '📐',
        name: 'Design / Prof.',
        budget: designBudget,
        actual: ex.design,
        colorClass: 'cat-green',
        items: [
          ...(archCosts.length > 0
            ? archCosts.map(c => ({ name: c.description || 'Architectural', budget: 0, actual: c.amount }))
            : []),
          ...(engCosts.length > 0
            ? engCosts.map(c => ({ name: c.description || 'Engineering', budget: 0, actual: c.amount }))
            : []),
          // Fallback if no detailed cost history but design spending exists
          ...(archCosts.length === 0 && engCosts.length === 0 && ex.design > 0
            ? [{ name: 'Design Fees', budget: designBudget, actual: ex.design }]
            : []),
        ],
      },
      // REGULATORY
      {
        id: 'regulatory',
        icon: '📋',
        name: 'Regulatory',
        budget: regulatoryBudget,
        actual: ex.fees,
        colorClass: ex.fees > regulatoryBudget ? 'cat-red' : 'cat-orange',
        items: [
          ...regCosts.map(c => ({ name: c.description || 'Regulatory Fee', budget: 0, actual: c.amount })),
          ...expCosts.map(c => ({ name: c.description || 'Expeditor Cost', budget: 0, actual: c.amount })),
          ...investFeeCosts.map(c => ({ name: c.description || 'Investment Fee', budget: 0, actual: c.amount })),
        ],
      },
      // CONTRACTOR: Actual construction costs from dice rolls
      {
        id: 'contractor',
        icon: '🏗️',
        name: contractor ? `Contractor (${qualityLabel})` : 'Contractor',
        budget: constructionBaseCost,
        actual: ex.construction,
        colorClass: 'cat-purple',
        items: contractor ? [
          { name: `Quality: ${qualityLabel}`, budget: 0, actual: 0 },
          { name: `Multiplier: ${contractor.multiplier}`, budget: 0, actual: 0 },
          ...(ex.construction > 0 ? [{ name: 'Construction to date', budget: constructionBaseCost, actual: ex.construction }] : []),
        ] : undefined,
      },
      // CONTINGENCY
      {
        id: 'contingency',
        icon: '🛡️',
        name: 'Contingency',
        budget: contingencyBudget,
        actual: contingencyUsed,
        colorClass: 'cat-contingency',
      },
    ];

    // ROI
    const projectedValue = totalScope + ex.design;
    const roi = ms.ownerFunding > 0 ? projectedValue / ms.ownerFunding : 0;

    return {
      sources,
      uses,
      totalSources,
      totalSpent,
      cashOnHand,
      contingencyBudget,
      contingencyUsed,
      designRatio,
      projectScope: totalScope,
      projectedValue,
      roi,
      designBudget,
      regulatoryBudget,
      constructionBaseCost,
      deficit,
      totalCommitments,
      contractor,
    };
  }, [player, playerId, gameServices]);

  const fmt = (n: number) => FormatUtils.formatMoney(n);

  const pct = (actual: number, budget: number) => {
    if (budget <= 0) return 0;
    return Math.min(100, (actual / budget) * 100);
  };

  const renderCategory = (cat: CategoryData) => {
    const isExpanded = expandedCategories.has(cat.id);
    const hasItems = cat.items && cat.items.length > 0;
    const progress = pct(cat.actual, cat.budget);

    return (
      <div key={cat.id} className={`ledger-category ${cat.colorClass}`}>
        <button
          className="ledger-cat-header"
          onClick={() => hasItems && toggleCategory(cat.id)}
          style={{ cursor: hasItems ? 'pointer' : 'default' }}
          aria-expanded={isExpanded}
          aria-label={`${cat.name} category${hasItems ? '' : ' (empty)'}`}
        >
          <span className="ledger-cat-title">
            {hasItems && <span className="ledger-cat-arrow">{isExpanded ? '▼' : '▶'}</span>}
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </span>
          <span className="ledger-cat-budget">{fmt(cat.budget)}</span>
          <span className="ledger-cat-actual">{fmt(cat.actual)}</span>
        </button>
        <div className="ledger-cat-progress">
          <div
            className="ledger-cat-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        {isExpanded && hasItems && (
          <div className="ledger-cat-items">
            {cat.items!.map((item, i) => (
              <div key={i} className="ledger-item-row">
                <span className="ledger-item-name">{item.name}</span>
                <span className="ledger-item-budget">{item.budget > 0 ? fmt(item.budget) : ''}</span>
                <span className="ledger-item-actual">{fmt(item.actual)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div className="project-ledger">
      {/* Tab nav */}
      <div className="ledger-tab-nav">
        <button
          className={`ledger-tab-btn ${activeView === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveView('ledger')}
        >
          📊 Pro Ledger
        </button>
        <button
          className={`ledger-tab-btn ${activeView === 'variance' ? 'active' : ''}`}
          onClick={() => setActiveView('variance')}
        >
          🏁 Variance
        </button>
      </div>

      {activeView === 'ledger' && (
        <div className="ledger-view">
          {/* Column headers - Sources */}
          <div className="ledger-col-headers">
            <span>Capital Stack</span>
            <span>Target</span>
            <span>Actual</span>
          </div>

          {data.sources.map(renderCategory)}

          {/* Column headers - Uses */}
          <div className="ledger-col-headers">
            <span>Project Uses</span>
            <span>Budget</span>
            <span>Paid</span>
          </div>

          {data.uses.map(renderCategory)}

          {/* Design ratio */}
          <div className="ledger-ratio-bar">
            <span className="ledger-ratio-label">📐 Design Ratio</span>
            <div className="ledger-ratio-track">
              <div
                className="ledger-ratio-fill"
                style={{
                  width: `${Math.min(100, data.designRatio * 5)}%`,
                  background: data.designRatio > 20 ? '#e74c3c' : data.designRatio > 18 ? '#f39c12' : '#3498db',
                }}
              />
              <div className="ledger-ratio-threshold" />
            </div>
            <span className="ledger-ratio-value" style={{
              color: data.designRatio > 20 ? '#e74c3c' : '#3498db'
            }}>
              {data.designRatio.toFixed(1)}%
            </span>
          </div>

          {/* Deficit indicator */}
          {data.deficit > 0 && (
            <div className="ledger-deficit-bar">
              <span className="ledger-deficit-icon">⚠️</span>
              <span className="ledger-deficit-label">Funding Gap</span>
              <span className="ledger-deficit-value">{fmt(data.deficit)}</span>
            </div>
          )}
        </div>
      )}

      {activeView === 'variance' && (
        <div className="ledger-view">
          {/* Summary boxes */}
          <div className="ledger-variance-header">
            <div className="ledger-variance-stat">
              <div className="ledger-variance-stat-label">Project Value</div>
              <div className="ledger-variance-stat-value green">{fmt(data.projectedValue)}</div>
            </div>
            <div className="ledger-variance-stat">
              <div className="ledger-variance-stat-label">Equity Multiplier</div>
              <div className="ledger-variance-stat-value purple">{data.roi.toFixed(1)}× ROI</div>
            </div>
          </div>

          <div className="ledger-col-headers">
            <span>Variance Analysis</span>
            <span></span>
            <span>Over/Under</span>
          </div>

          <div className="ledger-variance-rows">
            {/* Design variance (index 1) */}
            <div className="ledger-variance-row" style={{ background: '#f0faf0' }}>
              <span>📐 Design</span>
              <span></span>
              <span className={data.uses[1].actual <= data.uses[1].budget ? 'green' : 'red'}>
                {data.uses[1].actual <= data.uses[1].budget
                  ? `${fmt(data.uses[1].budget - data.uses[1].actual)} under ✓`
                  : `(${fmt(data.uses[1].actual - data.uses[1].budget)}) over`}
              </span>
            </div>
            {/* Regulatory variance (index 2) */}
            <div className="ledger-variance-row" style={{
              background: data.uses[2].actual > data.uses[2].budget ? '#fff5f5' : '#f0faf0'
            }}>
              <span>📋 Regulatory</span>
              <span></span>
              <span className={data.uses[2].actual <= data.uses[2].budget ? 'green' : 'red'}>
                {data.uses[2].actual <= data.uses[2].budget
                  ? `${fmt(data.uses[2].budget - data.uses[2].actual)} under ✓`
                  : `(${fmt(data.uses[2].actual - data.uses[2].budget)}) over`}
              </span>
            </div>
            {/* Contractor variance (index 3) */}
            <div className="ledger-variance-row">
              <span>🏗️ Contractor</span>
              <span></span>
              <span style={{ color: '#7f8c8d' }}>
                {data.uses[3].actual < data.uses[3].budget
                  ? `${fmt(data.uses[3].budget - data.uses[3].actual)} remaining`
                  : data.uses[3].actual > 0 ? `${fmt(data.uses[3].actual)} spent` : 'Not started'}
              </span>
            </div>
            {/* Contingency/Buffer */}
            <div className="ledger-variance-row" style={{
              background: data.contingencyUsed > 0 ? '#fef5f5' : '#f5fff5'
            }}>
              <span>🛡️ Buffer</span>
              <span></span>
              <span className={data.contingencyUsed > 0 ? 'red' : 'green'}>
                {data.contingencyUsed > 0
                  ? `${fmt(data.contingencyUsed)} used (${Math.round(((data.contingencyBudget - data.contingencyUsed) / data.contingencyBudget) * 100)}% left)`
                  : `+${fmt(data.contingencyBudget)} saved ✓`}
              </span>
            </div>
            {/* Deficit row */}
            {data.deficit > 0 && (
              <div className="ledger-variance-row" style={{ background: '#fff5f5' }}>
                <span>⚠️ Funding Gap</span>
                <span></span>
                <span className="red">{fmt(data.deficit)} short</span>
              </div>
            )}
          </div>

          {/* Health summary */}
          <div className="ledger-health-summary">
            <div className="ledger-health-title">📊 Project Health</div>
            <div className="ledger-health-stats">
              <div className="ledger-health-stat">
                <div className="ledger-health-stat-label">Owner Equity</div>
                <div className="ledger-health-stat-value green">{fmt(data.sources[0]?.actual || 0)}</div>
              </div>
              <div className="ledger-health-stat">
                <div className="ledger-health-stat-label">Total Spent</div>
                <div className="ledger-health-stat-value blue">{fmt(data.totalSpent)}</div>
              </div>
              <div className="ledger-health-stat">
                <div className="ledger-health-stat-label">Built Value</div>
                <div className="ledger-health-stat-value purple">{fmt(data.projectedValue)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="ledger-footer">
        {activeView === 'ledger' ? (
          <>
            <span className="ledger-footer-label">Cash on Hand</span>
            <span className="ledger-footer-value blue">{FormatUtils.formatMoney(data.cashOnHand)}</span>
          </>
        ) : (
          <>
            <span className="ledger-footer-label">Projected ROI</span>
            <span className="ledger-footer-value green">{data.roi.toFixed(1)}×</span>
          </>
        )}
      </div>
    </div>
  );

  return content;
};
