// src/components/game/financial/SurplusDeficitSection.tsx

import React, { CSSProperties } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';
import { FinancialStatus } from './types';

interface SurplusDeficitSectionProps {
  financialStatus: FinancialStatus;
  totalFees: number;
  colors: any;
  sectionStyle: CSSProperties;
  metricRowStyle: CSSProperties;
}

/**
 * SurplusDeficitSection displays the final financial calculation with breakdown
 */
export function SurplusDeficitSection({
  financialStatus,
  totalFees,
  colors,
  sectionStyle,
  metricRowStyle
}: SurplusDeficitSectionProps): JSX.Element {
  return (
    <div style={sectionStyle}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: financialStatus.isDeficit ? colors.danger.bg : colors.success.bg,
        borderRadius: '8px',
        border: `3px solid ${financialStatus.isDeficit ? colors.danger.main : colors.success.main}`,
      }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: 'bold',
          color: financialStatus.isDeficit ? colors.danger.text : colors.success.text,
        }}>
          {financialStatus.isDeficit ? '⚠️ Funding Needed' : '✅ Surplus Available'}
        </div>
        <div style={{
          fontSize: '1.1rem',
          fontWeight: 'bold',
          color: financialStatus.isDeficit ? colors.danger.text : colors.success.text,
        }}>
          {FormatUtils.formatMoney(Math.abs(financialStatus.surplus))}
        </div>
      </div>

      {/* Calculation breakdown */}
      <div style={{
        marginTop: '8px',
        padding: '8px 12px',
        backgroundColor: colors.secondary.bg,
        borderRadius: '6px',
        border: `1px solid ${colors.secondary.border}`,
        fontSize: '0.75rem',
        color: colors.secondary.main
      }}>
        <div style={metricRowStyle}>
          <span>Available Funds:</span>
          <span>{FormatUtils.formatMoney(financialStatus.playerMoney)}</span>
        </div>
        <div style={metricRowStyle}>
          <span>Project Cost:</span>
          <span>-{FormatUtils.formatMoney(financialStatus.totalScopeCost)}</span>
        </div>
        <div style={metricRowStyle}>
          <span>Fees:</span>
          <span>-{FormatUtils.formatMoney(totalFees)}</span>
        </div>
        <div style={{
          ...metricRowStyle,
          paddingTop: '4px',
          borderTop: `1px solid ${colors.secondary.border}`,
          fontWeight: 'bold'
        }}>
          <span>Net Position:</span>
          <span style={{
            color: financialStatus.isDeficit ? colors.danger.text : colors.success.text
          }}>
            {FormatUtils.formatMoney(financialStatus.surplus)}
          </span>
        </div>
      </div>
    </div>
  );
}
