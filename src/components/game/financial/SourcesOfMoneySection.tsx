// src/components/game/financial/SourcesOfMoneySection.tsx

import React, { useState, CSSProperties } from 'react';
import { FormatUtils } from '../../../utils/FormatUtils';
import { FundingCardSection } from './FundingCardSection';
import { FinancialStatus, FundingTransaction } from './types';

interface MoneySources {
  ownerFunding: number;
  bankLoans: number;
  investmentDeals: number;
  other: number;
}

interface SourcesOfMoneySectionProps {
  player: {
    currentSpace: string;
    moneySources?: MoneySources;
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
 * Shows three separate categories:
 * 1. Owner Seed Money - from moneySources.ownerFunding (calculated at OWNER-FUND-INITIATION)
 * 2. Bank Funding - from B cards in discard pile (actual bank loans)
 * 3. Investor Funding - from I cards in discard pile (actual investor deals)
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

  // Get money sources from player state
  const moneySources = player.moneySources || {
    ownerFunding: 0,
    bankLoans: 0,
    investmentDeals: 0,
    other: 0
  };

  // Get funding transactions from all sources
  const getFundingBreakdown = (): FundingTransaction[] => {
    const transactions: FundingTransaction[] = [];

    // 1. Owner Seed Money (from moneySources.ownerFunding)
    if (moneySources.ownerFunding > 0) {
      transactions.push({
        type: 'Owner',
        description: "Owner's personal seed money investment",
        amount: moneySources.ownerFunding,
        icon: '👤'
      });
    }

    // 2. Bank Funding (from B cards in discard pile)
    try {
      const gameState = stateService.getGameState();
      const discardPiles = gameState.discardPiles || {};
      const bDiscarded = discardPiles.B || [];

      bDiscarded.forEach((cardId: string) => {
        const card = dataService.getCardById(cardId);
        if (card) {
          const amount = card.loan_amount ? parseInt(String(card.loan_amount), 10) : 0;
          if (amount > 0) {
            transactions.push({
              type: 'Bank',
              description: card.card_name,
              amount: amount,
              icon: '🏦'
            });
          }
        }
      });

      // 3. Investor Funding (from I cards in discard pile)
      const iDiscarded = discardPiles.I || [];

      iDiscarded.forEach((cardId: string) => {
        const card = dataService.getCardById(cardId);
        if (card) {
          const amount = card.investment_amount ? parseInt(String(card.investment_amount), 10) : 0;
          if (amount > 0) {
            transactions.push({
              type: 'Investor',
              description: card.card_name,
              amount: amount,
              icon: '💼'
            });
          }
        }
      });
    } catch (error) {
      console.error('Error getting funding breakdown:', error);
    }

    return transactions;
  };

  // Calculate totals for ratio display
  const ownerTotal = moneySources.ownerFunding;
  const lenderTotal = moneySources.bankLoans + moneySources.investmentDeals;
  const totalFunding = ownerTotal + lenderTotal;
  const ownerPercent = totalFunding > 0 ? Math.round((ownerTotal / totalFunding) * 100) : 0;
  const lenderPercent = totalFunding > 0 ? 100 - ownerPercent : 0;

  const transactions = getFundingBreakdown();

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
              {(bCards.length > 0 || iCards.length > 0) && (
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

        {/* Expanded Funding Sources */}
        {expandedSources && (
          <div style={{ marginLeft: '16px' }}>
            {/* Funding Breakdown by Category */}
            {transactions.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {/* Show individual funding transactions grouped by type */}
                {transactions.map((transaction, index) => (
                  <div key={index} style={{
                    padding: '6px 12px',
                    backgroundColor: transaction.type === 'Owner'
                      ? colors.primary.bg
                      : transaction.type === 'Bank'
                        ? colors.info.bg
                        : colors.warning.bg,
                    borderRadius: '4px',
                    border: `1px solid ${
                      transaction.type === 'Owner'
                        ? colors.primary.border
                        : transaction.type === 'Bank'
                          ? colors.info.border
                          : colors.warning.border
                    }`,
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

                {/* Owner vs Lender Ratio */}
                {totalFunding > 0 && lenderTotal > 0 && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: colors.secondary.lighter,
                    borderRadius: '4px',
                    border: `1px solid ${colors.secondary.border}`
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: colors.secondary.dark,
                      marginBottom: '4px'
                    }}>
                      📊 Funding Ratio
                    </div>
                    <div style={{
                      display: 'flex',
                      height: '8px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '4px'
                    }}>
                      <div style={{
                        width: `${ownerPercent}%`,
                        backgroundColor: colors.primary.main,
                        transition: 'width 0.3s ease'
                      }} />
                      <div style={{
                        width: `${lenderPercent}%`,
                        backgroundColor: colors.info.main,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.7rem',
                      color: colors.secondary.main
                    }}>
                      <span>👤 Owner: {ownerPercent}%</span>
                      <span>🏦💼 Lenders: {lenderPercent}%</span>
                    </div>
                  </div>
                )}

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

            {/* No funding yet message */}
            {transactions.length === 0 && financialStatus.playerMoney === 0 && (
              <div style={{
                padding: '12px',
                backgroundColor: colors.secondary.lighter,
                borderRadius: '4px',
                textAlign: 'center',
                color: colors.secondary.main,
                fontSize: '0.8rem'
              }}>
                No funding received yet. Complete OWNER-FUND-INITIATION to receive seed money.
              </div>
            )}

            {/* Available Funding Options in Hand */}
            {(bCards.length > 0 || iCards.length > 0) && (
              <div style={{ marginTop: '12px' }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: colors.info.dark,
                  marginBottom: '6px'
                }}>
                  💼 Available Funding Options (in hand):
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
      </div>
    </>
  );
}
