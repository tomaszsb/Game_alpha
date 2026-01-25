// src/components/player/mobile/StatsBar.tsx
//
// Compact horizontal stats bar for mobile player panel.
// Shows 4 key stats: Money, Time, Cards, Scope
// Created: January 24, 2026
// Updated: January 25, 2026 - Added CSS classes, theme support, 2x2 grid fallback

import React from 'react';
import './StatsBar.css';

export interface StatsBarProps {
  money: number;
  timeSpent: number;
  cardCount: number;
  projectScope: number;
  onStatTap?: (stat: 'money' | 'time' | 'cards' | 'scope') => void;
}

interface StatItemProps {
  icon: string;
  value: string;
  label: string;
  colorClass: string;
  onTap?: () => void;
  testId?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label, colorClass, onTap, testId }) => {
  const className = `mobile-stats-bar__item ${onTap ? 'mobile-stats-bar__item--tappable' : ''}`;

  return (
    <div
      className={className}
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={onTap ? (e) => e.key === 'Enter' && onTap() : undefined}
      data-testid={testId}
    >
      <div className="mobile-stats-bar__value-row">
        <span className="mobile-stats-bar__icon">{icon}</span>
        <span className={`mobile-stats-bar__value ${colorClass}`}>
          {value}
        </span>
      </div>
      <span className="mobile-stats-bar__label">{label}</span>
    </div>
  );
};

/**
 * Format money value for compact display.
 * - Under 1000: show as-is
 * - 1000-999999: show as K (e.g., 50K)
 * - 1M+: show as M (e.g., 2.1M)
 */
function formatMoney(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const prefix = isNegative ? '-$' : '$';

  if (absAmount < 1000) {
    return `${prefix}${absAmount}`;
  }
  if (absAmount < 1000000) {
    const k = absAmount / 1000;
    return `${prefix}${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  const m = absAmount / 1000000;
  return `${prefix}${m % 1 === 0 ? m : m.toFixed(1)}M`;
}

/**
 * Format scope value for compact display.
 */
function formatScope(scope: number): string {
  if (scope < 1000) {
    return `$${scope}`;
  }
  if (scope < 1000000) {
    const k = scope / 1000;
    return `$${k % 1 === 0 ? k : k.toFixed(0)}K`;
  }
  const m = scope / 1000000;
  return `$${m.toFixed(1)}M`;
}

/**
 * StatsBar - Compact horizontal stats bar for mobile.
 * Shows key player stats at a glance with optional tap handlers.
 * Falls back to 2x2 grid on very narrow screens (<360px).
 */
export const StatsBar: React.FC<StatsBarProps> = ({
  money,
  timeSpent,
  cardCount,
  projectScope,
  onStatTap
}) => {
  return (
    <div className="mobile-stats-bar" data-testid="stats-bar">
      <StatItem
        icon="💰"
        value={formatMoney(money)}
        label="Money"
        colorClass={money >= 0 ? 'mobile-stats-bar__value--money-positive' : 'mobile-stats-bar__value--money-negative'}
        onTap={onStatTap ? () => onStatTap('money') : undefined}
        testId="stat-money"
      />
      <StatItem
        icon="⏱️"
        value={`${timeSpent}w`}
        label="Time"
        colorClass="mobile-stats-bar__value--time"
        onTap={onStatTap ? () => onStatTap('time') : undefined}
        testId="stat-time"
      />
      <StatItem
        icon="🃏"
        value={String(cardCount)}
        label="Cards"
        colorClass="mobile-stats-bar__value--cards"
        onTap={onStatTap ? () => onStatTap('cards') : undefined}
        testId="stat-cards"
      />
      <StatItem
        icon="📐"
        value={formatScope(projectScope)}
        label="Scope"
        colorClass="mobile-stats-bar__value--scope"
        onTap={onStatTap ? () => onStatTap('scope') : undefined}
        testId="stat-scope"
      />
    </div>
  );
};
