// src/components/game/FinancialStatusDisplay.tsx

import React, { useMemo } from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';
import {
  GroupedWCards,
  SourcesOfMoneySection,
  ProjectScopeSection,
  FeesSection,
  SurplusDeficitSection
} from './financial';

interface FinancialStatusDisplayProps {
  player: Player;
}

/**
 * FinancialStatusDisplay provides detailed financial metrics including money,
 * scope cost calculations, and surplus/deficit analysis.
 *
 * Structure:
 * 1. Sources of Money - Expandable funding breakdown
 * 2. Project Scope - W cards grouped by work type
 * 3. Fees & Costs - Fee structure information
 * 4. Surplus/Deficit - Final calculation
 */
export function FinancialStatusDisplay({ player }: FinancialStatusDisplayProps): JSX.Element {
  const { dataService, cardService, stateService, gameRulesService } = useGameContext();

  // Get cards from player's hand and filter by type
  const hand = player.hand || [];
  const wCards = hand.filter(cardId => cardService.getCardType(cardId) === 'W');
  const bCards = hand.filter(cardId => cardService.getCardType(cardId) === 'B');
  const iCards = hand.filter(cardId => cardService.getCardType(cardId) === 'I');

  // Calculate financial status - memoized to avoid recalculating on every render
  const handKey = JSON.stringify(player.hand || []);
  const activeCardsKey = JSON.stringify((player.activeCards || []).map(ac => ac.cardId));
  const financialStatus = useMemo(() => {
    // Calculate project scope from W cards (single source of truth)
    const totalScopeCost = gameRulesService.calculateProjectScope(player.id);
    const surplus = player.money - totalScopeCost;

    return {
      playerMoney: player.money,
      totalScopeCost,
      surplus,
      isDeficit: surplus < 0
    };
  }, [player.id, player.money, handKey, activeCardsKey]);

  // Group W cards by work type
  const groupedWCards: GroupedWCards = useMemo(() => {
    return wCards.reduce((groups, cardId) => {
      const card = dataService.getCardById(cardId);
      if (!card) return groups;

      const workType = card.work_type_restriction || 'General Construction';
      if (!groups[workType]) {
        groups[workType] = [];
      }
      groups[workType].push({ cardId, card });
      return groups;
    }, {} as GroupedWCards);
  }, [wCards, dataService]);

  // Calculate total fees (simplified - actual fees tracked in game state)
  const totalFees = useMemo(() => {
    // This would typically come from game state
    // For now returns 0 as fees are calculated when loans are approved
    return 0;
  }, []);

  // Shared styles
  const containerStyle = {
    background: `linear-gradient(135deg, ${colors.secondary.bg}, ${colors.secondary.light})`,
    borderRadius: '12px',
    padding: '16px',
    marginTop: '12px',
    border: `2px solid ${colors.secondary.border}`,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  };

  const sectionStyle = {
    marginBottom: '16px',
    padding: '12px',
    background: colors.white,
    borderRadius: '8px',
    border: `1px solid ${colors.secondary.light}`
  };

  const sectionTitleStyle = {
    fontSize: '0.85rem',
    fontWeight: 'bold' as const,
    color: colors.secondary.dark,
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  };

  const metricRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  };

  const metricLabelStyle = {
    fontSize: '0.8rem',
    color: colors.secondary.main
  };

  const metricValueStyle = {
    fontSize: '0.8rem',
    fontWeight: 'bold' as const,
    color: colors.secondary.dark
  };

  return (
    <div style={containerStyle}>
      {/* 1. SOURCES OF MONEY */}
      <SourcesOfMoneySection
        player={{ currentSpace: player.currentSpace, moneySources: player.moneySources }}
        bCards={bCards}
        iCards={iCards}
        financialStatus={financialStatus}
        dataService={dataService}
        stateService={stateService}
        colors={colors}
        sectionStyle={sectionStyle}
      />

      {/* 2. PROJECT SCOPE */}
      <ProjectScopeSection
        groupedWCards={groupedWCards}
        totalScopeCost={financialStatus.totalScopeCost}
        colors={colors}
        sectionStyle={sectionStyle}
        sectionTitleStyle={sectionTitleStyle}
        metricRowStyle={metricRowStyle}
        metricLabelStyle={metricLabelStyle}
        metricValueStyle={metricValueStyle}
      />

      {/* 3. FEES & COSTS */}
      <FeesSection
        totalFees={totalFees}
        colors={colors}
        sectionStyle={sectionStyle}
      />

      {/* 4. SURPLUS/DEFICIT */}
      <SurplusDeficitSection
        financialStatus={financialStatus}
        totalFees={totalFees}
        colors={colors}
        sectionStyle={sectionStyle}
        metricRowStyle={metricRowStyle}
      />
    </div>
  );
}
