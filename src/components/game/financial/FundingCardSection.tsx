// src/components/game/financial/FundingCardSection.tsx

import React, { useState } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';
import { FundingCardSectionProps } from './types';

/**
 * FundingCardSection displays detailed information about B or I cards
 * with expandable card details like the Project Scope section
 */
export function FundingCardSection({ title, cards, cardType, dataService, colors }: FundingCardSectionProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  // Calculate total funding value from cards
  const totalFunding = cards.reduce((sum, cardId) => {
    const card = dataService.getCardById(cardId);
    if (!card) return sum;

    // First try card name
    const nameMatch = card.card_name?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
    if (nameMatch) {
      return sum + FormatUtils.parseMoney(nameMatch[1]);
    }

    // Then try description
    const descMatch = card.description?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
    if (descMatch) {
      return sum + FormatUtils.parseMoney(descMatch[1]);
    }

    return sum;
  }, 0);

  const sectionHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: cardType === 'B' ? colors.info.bg : colors.primary.bg,
    borderRadius: '6px',
    border: `2px solid ${cardType === 'B' ? colors.info.main : colors.primary.main}`,
    cursor: 'pointer',
    marginBottom: isExpanded ? '8px' : '0'
  };

  const cardDetailStyle = {
    padding: '6px 12px',
    marginLeft: '16px',
    backgroundColor: colors.secondary.bg,
    borderRadius: '4px',
    border: `1px solid ${colors.secondary.border}`,
    marginBottom: '4px'
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={sectionHeaderStyle} onClick={toggleExpanded}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            color: cardType === 'B' ? colors.info.text : colors.primary.text,
            marginBottom: '2px'
          }}>
            {title} ({cards.length} option{cards.length > 1 ? 's' : ''})
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
          color: cardType === 'B' ? colors.info.text : colors.primary.text,
          marginLeft: '12px'
        }}>
          {totalFunding > 0 ? FormatUtils.formatMoney(totalFunding) : 'Various amounts'}
        </div>
      </div>

      {/* Expanded Card Details */}
      {isExpanded && cards.map((cardId) => {
        const card = dataService.getCardById(cardId);
        if (!card) return null;

        return (
          <div key={cardId} style={cardDetailStyle}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '0.8rem',
                color: colors.secondary.dark,
                flex: 1,
                marginRight: '8px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                  {card.card_name}
                </div>
                {card.description && (
                  <div style={{ fontSize: '0.75rem', color: colors.secondary.main }}>
                    {card.description}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: cardType === 'B' ? colors.info.text : colors.primary.text
              }}>
                {/* Try to extract funding amount from card name or description */}
                {(() => {
                  // First try card name
                  const nameMatch = card.card_name?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
                  if (nameMatch) {
                    return FormatUtils.formatMoney(FormatUtils.parseMoney(nameMatch[1]));
                  }

                  // Then try description
                  const descMatch = card.description?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
                  if (descMatch) {
                    return FormatUtils.formatMoney(FormatUtils.parseMoney(descMatch[1]));
                  }

                  // If no specific amount found, show as variable
                  return 'Variable amount';
                })()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
