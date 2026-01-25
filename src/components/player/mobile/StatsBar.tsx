// src/components/player/mobile/StatsBar.tsx
//
// Compact horizontal stats bar for mobile player panel.
// Shows 4 key stats: Money, Time, Cards, Scope
// Created: January 24, 2026

import React from 'react';

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
  color: string;
  onTap?: () => void;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label, color, onTap }) => (
  <div
    onClick={onTap}
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '4px 2px',
      cursor: onTap ? 'pointer' : 'default',
      borderRadius: '4px',
      transition: 'background-color 0.15s ease'
    }}
    role={onTap ? 'button' : undefined}
    tabIndex={onTap ? 0 : undefined}
    onKeyDown={onTap ? (e) => e.key === 'Enter' && onTap() : undefined}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color
        }}
      >
        {value}
      </span>
    </div>
    <span
      style={{
        fontSize: '9px',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}
    >
      {label}
    </span>
  </div>
);

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
 */
export const StatsBar: React.FC<StatsBarProps> = ({
  money,
  timeSpent,
  cardCount,
  projectScope,
  onStatTap
}) => {
  return (
    <div
      className="mobile-stats-bar"
      style={{
        display: 'flex',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e0e0e0',
        borderBottom: '1px solid #e0e0e0',
        padding: '4px 0',
        minHeight: '36px'
      }}
    >
      <StatItem
        icon="💰"
        value={formatMoney(money)}
        label="Money"
        color={money >= 0 ? '#2e7d32' : '#c62828'}
        onTap={onStatTap ? () => onStatTap('money') : undefined}
      />
      <StatItem
        icon="⏱️"
        value={`${timeSpent}w`}
        label="Time"
        color="#1565c0"
        onTap={onStatTap ? () => onStatTap('time') : undefined}
      />
      <StatItem
        icon="🃏"
        value={String(cardCount)}
        label="Cards"
        color="#6a1b9a"
        onTap={onStatTap ? () => onStatTap('cards') : undefined}
      />
      <StatItem
        icon="📐"
        value={formatScope(projectScope)}
        label="Scope"
        color="#e65100"
        onTap={onStatTap ? () => onStatTap('scope') : undefined}
      />
    </div>
  );
};
