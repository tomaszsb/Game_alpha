// src/components/game/financial/FeesSection.tsx

import React, { useState, CSSProperties } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';

interface FeesSectionProps {
  totalFees: number;
  colors: any;
  sectionStyle: CSSProperties;
}

/**
 * FeesSection displays fees and costs in an expandable format
 */
export function FeesSection({
  totalFees,
  colors,
  sectionStyle
}: FeesSectionProps): JSX.Element {
  const [expandedFees, setExpandedFees] = useState(false);

  return (
    <div style={sectionStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: colors.danger.bg,
          borderRadius: '6px',
          border: `2px solid ${colors.danger.main}`,
          cursor: 'pointer',
          marginBottom: expandedFees ? '8px' : '0'
        }}
        onClick={() => setExpandedFees(!expandedFees)}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: 'bold',
            color: colors.danger.text,
            marginBottom: '2px'
          }}>
            📊 Fees & Costs
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: colors.secondary.main
          }}>
            {expandedFees ? 'Click to collapse details' : 'Click to expand fee breakdown'}
          </div>
        </div>
        <div style={{
          fontSize: '1rem',
          fontWeight: 'bold',
          color: colors.danger.text,
          marginLeft: '12px'
        }}>
          {totalFees > 0 ? FormatUtils.formatMoney(totalFees) : '$0'}
        </div>
      </div>

      {/* Expanded Fee Details */}
      {expandedFees && (
        <div style={{ marginLeft: '16px' }}>
          <div style={{
            padding: '8px 12px',
            backgroundColor: colors.secondary.bg,
            borderRadius: '6px',
            border: `1px solid ${colors.secondary.border}`,
            fontSize: '0.75rem',
            color: colors.secondary.main
          }}>
            <strong>Fee Structure:</strong>
            <br />
            • Bank Loans: 1-3% processing fee
            <br />
            • Investor Loans: 5% processing fee
            <br />
            • Owner Seed Money: No fees
            <br />
            <em>Note: Fees are calculated when loans are approved</em>
          </div>
        </div>
      )}
    </div>
  );
}
