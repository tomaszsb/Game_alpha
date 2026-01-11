// src/components/game/financial/OwnerSeedMoneySection.tsx

import React, { useState } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';
import { OwnerSeedMoneySectionProps } from './types';

/**
 * OwnerSeedMoneySection displays seed money information in a compact, expandable format
 * when player is on OWNER-FUND-INITIATION space
 */
export function OwnerSeedMoneySection({ bCards, iCards, totalFunding, dataService, colors }: OwnerSeedMoneySectionProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalCards = bCards.length + iCards.length;

  return (
    <div style={{ marginBottom: '8px' }}>
      {/* Compact Header - Click to expand */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: colors.success.bg,
          borderRadius: '6px',
          border: `2px solid ${colors.success.main}`,
          cursor: 'pointer',
          marginBottom: isExpanded ? '4px' : '0'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            color: colors.success.text,
            marginBottom: '2px'
          }}>
            Owner Seed Money ({totalCards} card{totalCards > 1 ? 's' : ''})
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: colors.success.main
          }}>
            {isExpanded ? 'Click to collapse details' : 'Click to expand details'}
          </div>
        </div>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 'bold',
          color: colors.success.dark
        }}>
          {FormatUtils.formatMoney(totalFunding)}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{
          padding: '12px',
          backgroundColor: colors.success.lighter,
          borderRadius: '4px',
          border: `1px solid ${colors.success.border}`
        }}>
          <div style={{
            fontSize: '0.8rem',
            color: colors.success.text,
            lineHeight: '1.4',
            marginBottom: '8px'
          }}>
            The building owner has provided initial seed money to fund project startup costs.
            This funding comes with <strong>no fees or interest charges</strong>.
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: colors.success.main,
            fontStyle: 'italic'
          }}>
            Cards in hand: Repurposed as seed money documentation
          </div>

          {/* Show individual cards if needed */}
          <div style={{ marginTop: '8px' }}>
            {[...bCards, ...iCards].map(cardId => {
              const card = dataService.getCardById(cardId);
              if (!card) return null;

              // Try to get amount from card name first, then fall back to a default based on card type
              const fundingMatch = card.card_name?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
              let amount;
              if (fundingMatch) {
                amount = FormatUtils.formatMoney(FormatUtils.parseMoney(fundingMatch[1]));
              } else {
                // If no amount in name, try to extract from description, or use a reasonable default
                if (card.description?.includes('$')) {
                  const descMatch = card.description.match(/\$([\d,]+(?:\.\d+)?[KMB]?)/);
                  amount = descMatch ? FormatUtils.formatMoney(FormatUtils.parseMoney(descMatch[1])) : 'Variable amount';
                } else {
                  // For cards without explicit amounts, show as variable
                  amount = 'Variable amount';
                }
              }

              return (
                <div key={cardId} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  backgroundColor: colors.success.bg,
                  borderRadius: '4px',
                  marginBottom: '2px',
                  fontSize: '0.75rem'
                }}>
                  <span style={{ color: colors.success.text }}>
                    {card.card_name}
                  </span>
                  <span style={{ color: colors.success.dark, fontWeight: 'bold' }}>
                    {amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
