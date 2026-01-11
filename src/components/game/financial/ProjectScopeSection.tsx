// src/components/game/financial/ProjectScopeSection.tsx

import React, { useState, CSSProperties } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';
import { GroupedWCards, SharedStyles } from './types';

interface ProjectScopeSectionProps {
  groupedWCards: GroupedWCards;
  totalScopeCost: number;
  colors: any;
  sectionStyle: CSSProperties;
  sectionTitleStyle: CSSProperties;
  metricRowStyle: CSSProperties;
  metricLabelStyle: CSSProperties;
  metricValueStyle: CSSProperties;
}

/**
 * ProjectScopeSection displays W cards grouped by work type with expandable details
 */
export function ProjectScopeSection({
  groupedWCards,
  totalScopeCost,
  colors,
  sectionStyle,
  sectionTitleStyle,
  metricRowStyle,
  metricLabelStyle,
  metricValueStyle
}: ProjectScopeSectionProps): JSX.Element | null {
  const [expandedWorkTypes, setExpandedWorkTypes] = useState<Set<string>>(new Set());

  const toggleWorkType = (workType: string) => {
    const newExpanded = new Set(expandedWorkTypes);
    if (newExpanded.has(workType)) {
      newExpanded.delete(workType);
    } else {
      newExpanded.add(workType);
    }
    setExpandedWorkTypes(newExpanded);
  };

  if (Object.keys(groupedWCards).length === 0) {
    return null;
  }

  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>
        🏗️ Project Scope
      </div>
      {Object.entries(groupedWCards).map(([workType, cards]) => {
        const totalCost = cards.reduce((sum, { card }) => sum + (card.cost || 0), 0);
        const isExpanded = expandedWorkTypes.has(workType);

        return (
          <div key={workType} style={{ marginBottom: '8px' }}>
            {/* Work Type Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: colors.warning.bg,
                borderRadius: '6px',
                border: `2px solid ${colors.warning.main}`,
                cursor: 'pointer',
                marginBottom: isExpanded ? '4px' : '0'
              }}
              onClick={() => toggleWorkType(workType)}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: colors.warning.text,
                  marginBottom: '2px'
                }}>
                  📋 {workType} ({cards.length} project{cards.length > 1 ? 's' : ''})
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: colors.secondary.main
                }}>
                  {isExpanded ? 'Click to collapse' : 'Click to expand details'}
                </div>
              </div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: colors.warning.text,
                marginLeft: '12px'
              }}>
                {FormatUtils.formatMoney(totalCost)}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && cards.map(({ cardId, card }) => (
              <div key={cardId} style={{
                padding: '6px 12px',
                marginLeft: '16px',
                backgroundColor: colors.secondary.bg,
                borderRadius: '4px',
                border: `1px solid ${colors.secondary.border}`,
                marginBottom: '2px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{
                    fontSize: '0.8rem',
                    color: colors.secondary.dark,
                    flex: 1
                  }}>
                    {card.card_name}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: colors.warning.text
                  }}>
                    {FormatUtils.formatCardCost(card.cost)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Total Scope Cost */}
      <div style={{
        ...metricRowStyle,
        paddingTop: '8px',
        borderTop: `2px solid ${colors.warning.main}`,
        fontWeight: 'bold'
      }}>
        <span style={metricLabelStyle}>Total Project Cost:</span>
        <span style={{
          ...metricValueStyle,
          color: colors.warning.text,
          fontSize: '0.9rem'
        }}>
          {FormatUtils.formatMoney(totalScopeCost)}
        </span>
      </div>
    </div>
  );
}
