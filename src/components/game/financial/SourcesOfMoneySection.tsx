// src/components/game/financial/SourcesOfMoneySection.tsx

import React, { useState, CSSProperties } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';
import { FundingCardSection } from './FundingCardSection';
import { OwnerSeedMoneySection } from './OwnerSeedMoneySection';
import { FinancialStatus, FundingTransaction } from './types';

interface SourcesOfMoneySectionProps {
  player: {
    currentSpace: string;
  };
  bCards: string[];
  iCards: string[];
  financialStatus: FinancialStatus;
  dataService: any;
  stateService: any;
  colors: any;
  sectionStyle: CSSProperties;
}

/**
 * SourcesOfMoneySection displays all funding sources in an expandable format
 */
export function SourcesOfMoneySection({
  player,
  bCards,
  iCards,
  financialStatus,
  dataService,
  stateService,
  colors,
  sectionStyle
}: SourcesOfMoneySectionProps): JSX.Element {
  const [expandedSources, setExpandedSources] = useState(false);

  // Calculate owner funding total
  const calculateOwnerFundingTotal = () => {
    const allCards = [...bCards, ...iCards];
    return allCards.reduce((sum, cardId) => {
      const card = dataService.getCardById(cardId);
      if (!card) return sum;
      const fundingMatch = card.card_name?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
      return fundingMatch ? sum + FormatUtils.parseMoney(fundingMatch[1]) : sum;
    }, 0);
  };

  // Get funding transactions from discard piles
  const getFundingTransactions = (): FundingTransaction[] => {
    try {
      const gameState = stateService.getGameState();
      const discardPiles = gameState.discardPiles || {};
      const fundingTransactions: FundingTransaction[] = [];

      const bDiscarded = discardPiles.B || [];
      const iDiscarded = discardPiles.I || [];

      // Add Bank funding transactions
      bDiscarded.forEach((cardId: string) => {
        const card = dataService.getCardById(cardId);
        if (card) {
          const fundingMatch = card.card_name.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
          const amount = fundingMatch ? FormatUtils.parseMoney(fundingMatch[1]) : 0;
          if (amount > 0) {
            fundingTransactions.push({
              type: 'Bank',
              description: card.card_name,
              amount: amount,
              icon: '🏦'
            });
          }
        }
      });

      // Add Investor funding transactions
      iDiscarded.forEach((cardId: string) => {
        const card = dataService.getCardById(cardId);
        if (card) {
          const fundingMatch = card.card_name.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
          const amount = fundingMatch ? FormatUtils.parseMoney(fundingMatch[1]) : 0;
          if (amount > 0) {
            fundingTransactions.push({
              type: 'Investor',
              description: card.card_name,
              amount: amount,
              icon: '💼'
            });
          }
        }
      });

      // If no transactions found but player has money, show as owner seed money
      if (fundingTransactions.length === 0 && player.currentSpace !== 'OWNER-FUND-INITIATION') {
        fundingTransactions.push({
          type: 'Owner',
          description: 'Seed money',
          amount: financialStatus.playerMoney,
          icon: '👤'
        });
      }

      return fundingTransactions;
    } catch (error) {
      return [{
        type: 'Owner',
        description: 'Seed money',
        amount: financialStatus.playerMoney,
        icon: '👤'
      }];
    }
  };

  return (
    <>
      <div style={sectionStyle}>
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
            marginBottom: expandedSources ? '8px' : '0'
          }}
          onClick={() => setExpandedSources(!expandedSources)}
        >
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: colors.success.text,
              marginBottom: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              💰 Sources of Money
              {/* Show badge for B/I cards in hand */}
              {(bCards.length > 0 || iCards.length > 0) && player.currentSpace !== 'OWNER-FUND-INITIATION' && (
                <span style={{
                  padding: '2px 6px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  animation: 'pulse 2s infinite'
                }}>
                  {bCards.length > 0 && `${bCards.length} B`}
                  {bCards.length > 0 && iCards.length > 0 && ' + '}
                  {iCards.length > 0 && `${iCards.length} I`}
                  {' card'}{(bCards.length + iCards.length) > 1 ? 's' : ''} available
                </span>
              )}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: colors.secondary.main
            }}>
              {expandedSources ? 'Click to collapse details' : 'Click to expand funding sources'}
            </div>
          </div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: colors.success.text,
            marginLeft: '12px'
          }}>
            {FormatUtils.formatMoney(financialStatus.playerMoney)}
          </div>
        </div>

        {/* Expanded Funding Sources - Only show when NOT on OWNER-FUND-INITIATION */}
        {expandedSources && player.currentSpace !== 'OWNER-FUND-INITIATION' && (
          <div style={{ marginLeft: '16px' }}>
            {/* Detailed Funding Breakdown */}
            {financialStatus.playerMoney > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {/* Show individual funding transactions */}
                {getFundingTransactions().map((transaction, index) => (
                  <div key={index} style={{
                    padding: '6px 12px',
                    backgroundColor: colors.secondary.bg,
                    borderRadius: '4px',
                    border: `1px solid ${colors.secondary.border}`,
                    marginBottom: '4px'
                  }}>
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
                          {transaction.icon} {transaction.type} Funding
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.secondary.main }}>
                          {transaction.description}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        color: colors.success.text
                      }}>
                        +{FormatUtils.formatMoney(transaction.amount)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total Funding */}
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: `2px solid ${colors.success.main}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 'bold'
                }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: colors.secondary.main
                  }}>
                    Total Funding:
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    color: colors.success.text
                  }}>
                    {FormatUtils.formatMoney(financialStatus.playerMoney)}
                  </span>
                </div>
              </div>
            )}

            {/* Available Funding Options in Hand */}
            {(bCards.length > 0 || iCards.length > 0) && player.currentSpace !== 'OWNER-FUND-INITIATION' && (
              <div style={{ marginTop: '8px' }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: colors.info.dark,
                  marginBottom: '6px'
                }}>
                  💼 Available Options:
                </div>

                {/* Bank Loans (B Cards) */}
                {bCards.length > 0 && (
                  <FundingCardSection
                    title="🏦 Bank Loans"
                    cards={bCards}
                    cardType="B"
                    dataService={dataService}
                    colors={colors}
                  />
                )}

                {/* Investment Deals (I Cards) */}
                {iCards.length > 0 && (
                  <FundingCardSection
                    title="💼 Investment Deals"
                    cards={iCards}
                    cardType="I"
                    dataService={dataService}
                    colors={colors}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Owner Seed Money Section - Show when ON OWNER-FUND-INITIATION */}
        {player.currentSpace === 'OWNER-FUND-INITIATION' && (bCards.length > 0 || iCards.length > 0) && (
          <OwnerSeedMoneySection
            bCards={bCards}
            iCards={iCards}
            totalFunding={calculateOwnerFundingTotal()}
            dataService={dataService}
            colors={colors}
          />
        )}
      </div>

      {/* Duplicate expandable section - showing available options */}
      {expandedSources && player.currentSpace !== 'OWNER-FUND-INITIATION' && (bCards.length > 0 || iCards.length > 0) && (
        <div style={sectionStyle}>
          <div style={{ marginLeft: '16px' }}>
            <div style={{ marginTop: '8px' }}>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: colors.info.dark,
                marginBottom: '6px'
              }}>
                💼 Available Options:
              </div>

              {bCards.length > 0 && (
                <FundingCardSection
                  title="🏦 Bank Loans"
                  cards={bCards}
                  cardType="B"
                  dataService={dataService}
                  colors={colors}
                />
              )}

              {iCards.length > 0 && (
                <FundingCardSection
                  title="💼 Investment Deals"
                  cards={iCards}
                  cardType="I"
                  dataService={dataService}
                  colors={colors}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
