// src/components/game/FinancialStatusDisplay.tsx

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';
import { FormatUtils } from '../../utils/FormatUtils';

interface FinancialStatusDisplayProps {
  player: Player;
}

interface FundingCardSectionProps {
  title: string;
  cards: string[];
  cardType: string;
  dataService: any;
  colors: any;
}

/**
 * FundingCardSection displays detailed information about B or I cards
 * with expandable card details like the Project Scope section
 */
function FundingCardSection({ title, cards, cardType, dataService, colors }: FundingCardSectionProps): JSX.Element {
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

interface OwnerSeedMoneySectionProps {
  bCards: string[];
  iCards: string[];
  totalFunding: number;
  dataService: any;
  colors: any;
}

/**
 * OwnerSeedMoneySection displays seed money information in a compact, expandable format
 * when player is on OWNER-FUND-INITIATION space
 */
function OwnerSeedMoneySection({ bCards, iCards, totalFunding, dataService, colors }: OwnerSeedMoneySectionProps): JSX.Element {
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
            👤 Owner Seed Money ({totalCards} card{totalCards > 1 ? 's' : ''})
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
                    📄 {card.card_name}
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

interface FundingHistorySectionProps {
  playerMoney: number;
  dataService: any;
  stateService: any;
  colors: any;
  currentPlayerSpace?: string;
}

/**
 * FundingHistorySection displays details about recently played funding cards
 * by looking up B/I cards that were recently discarded
 */
function FundingHistorySection({ playerMoney, dataService, stateService, colors, currentPlayerSpace }: FundingHistorySectionProps): JSX.Element {
  // Get funding source info for one-line display
  const getFundingInfo = () => {
    try {
      // Special case: If player is on OWNER-FUND-INITIATION space, always show owner seed money
      if (currentPlayerSpace === 'OWNER-FUND-INITIATION') {
        return {
          type: 'Owner',
          description: 'Seed money'
        };
      }

      // Get current game state to access discard piles
      const gameState = stateService.getGameState();
      const discardPiles = gameState.discardPiles || {};

      // Get recently discarded B and I cards
      const bDiscarded = discardPiles.B || [];
      const iDiscarded = discardPiles.I || [];

      // Get the most recent one (assuming they're in chronological order)
      const recentB = bDiscarded.length > 0 ? bDiscarded[bDiscarded.length - 1] : null;
      const recentI = iDiscarded.length > 0 ? iDiscarded[iDiscarded.length - 1] : null;

      // Determine funding source and description
      if (playerMoney >= 5000000 && recentI) {
        const card = dataService.getCardById(recentI);
        return {
          type: 'Investor',
          description: card?.title || 'Investment funding'
        };
      } else if (recentB) {
        const card = dataService.getCardById(recentB);
        return {
          type: 'Bank',
          description: card?.title || 'Bank loan'
        };
      } else {
        // Fallback for when no cards are found (likely owner seed money)
        return {
          type: 'Owner',
          description: 'Seed money'
        };
      }
    } catch (error) {
      // Fallback for any errors
      return {
        type: 'Owner',
        description: 'Seed money'
      };
    }
  };

  const fundingInfo = getFundingInfo();

  return (
    <div style={{
      padding: '8px 12px',
      backgroundColor: colors.success.bg,
      borderRadius: '6px',
      border: `1px solid ${colors.success.main}`,
      fontSize: '0.8rem',
      color: colors.success.dark
    }}>
      💰 Funding source: {fundingInfo.type} - {fundingInfo.description}
    </div>
  );
}

/**
 * FinancialStatusDisplay provides detailed financial metrics including money,
 * scope cost calculations, and surplus/deficit analysis.
 */
export function FinancialStatusDisplay({ player }: FinancialStatusDisplayProps): JSX.Element {
  const { dataService, cardService, stateService, gameRulesService } = useGameContext();

  // Get cards from player's hand and filter by type
  const hand = player.hand || [];
  const wCards = hand.filter(cardId => cardService.getCardType(cardId) === 'W');
  const bCards = hand.filter(cardId => cardService.getCardType(cardId) === 'B');
  const iCards = hand.filter(cardId => cardService.getCardType(cardId) === 'I');


  // Calculate financial status
  const calculateFinancialStatus = () => {
    // wCards is already filtered from player.hand above

    // Calculate project scope from W cards (single source of truth)
    const totalScopeCost = gameRulesService.calculateProjectScope(player.id);

    const surplus = player.money - totalScopeCost;
    
    // Debug logging
    console.log(`💰 Financial Status Debug for ${player.name}:`, {
      playerMoney: player.money,
      totalScopeCost,
      surplus,
      isDeficit: surplus < 0,
      wCards: wCards.length
    });
    
    return {
      playerMoney: player.money,
      totalScopeCost,
      surplus,
      isDeficit: surplus < 0
    };
  };

  const financialStatus = calculateFinancialStatus();

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

  // Card arrays are already defined above from player.hand filtering

  // Group W cards by work type
  const groupedWCards = wCards.reduce((groups, cardId) => {
    // Use the full cardId since player.hand contains the complete card IDs
    const card = dataService.getCardById(cardId);
    if (!card) return groups;
    
    const workType = card.work_type_restriction || 'General Construction';
    if (!groups[workType]) {
      groups[workType] = [];
    }
    groups[workType].push({ cardId, card });
    return groups;
  }, {} as Record<string, Array<{ cardId: string; card: any }>>);

  // State for expanded work types
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

  // State for expandable sections in ledger layout
  const [expandedSources, setExpandedSources] = useState(false);
  const [expandedFees, setExpandedFees] = useState(false);

  // Calculate total fees
  const calculateFees = () => {
    // This would typically come from game state, but for now we'll estimate based on loans
    let totalFees = 0;

    // Add bank loan fees if any B cards were played
    // Add investor fees if any I cards were played
    // This is a simplified calculation - actual fees would be tracked in game state

    return totalFees;
  };

  const totalFees = calculateFees();

  return (
    <div style={containerStyle}>
      {/* LEDGER LAYOUT */}

      {/* 1. SOURCES OF MONEY (Top) - Expandable one-liner */}
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
              marginBottom: '2px'
            }}>
              💰 Sources of Money
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

        {/* Expanded Funding Sources - Only show when NOT on OWNER-FUND-INITIATION and has actual funding history */}
        {expandedSources && player.currentSpace !== 'OWNER-FUND-INITIATION' && (
          <div style={{ marginLeft: '16px' }}>
            {/* Detailed Funding Breakdown */}
            {financialStatus.playerMoney > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {/* Show individual funding transactions */}
                {(() => {
                  try {
                    const gameState = stateService.getGameState();
                    const discardPiles = gameState.discardPiles || {};
                    const fundingTransactions = [];

                    // Get recently discarded B and I cards for funding history
                    const bDiscarded = discardPiles.B || [];
                    const iDiscarded = discardPiles.I || [];

                    // Add Bank funding transactions
                    bDiscarded.forEach(cardId => {
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
                      iDiscarded.forEach(cardId => {
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

                      // If no transactions found but player has money (and not on OWNER-FUND-INITIATION), show as owner seed money
                      if (fundingTransactions.length === 0 && player.currentSpace !== 'OWNER-FUND-INITIATION') {
                        fundingTransactions.push({
                          type: 'Owner',
                          description: 'Seed money',
                          amount: financialStatus.playerMoney,
                          icon: '👤'
                        });
                      }

                    return fundingTransactions.map((transaction, index) => (
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
                    ));
                  } catch (error) {
                    // Fallback if funding breakdown fails
                    return (
                      <div style={{
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
                            flex: 1
                          }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                              👤 Owner Funding
                            </div>
                            <div style={{ fontSize: '0.75rem', color: colors.secondary.main }}>
                              Seed money
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            color: colors.success.text
                          }}>
                            +{FormatUtils.formatMoney(financialStatus.playerMoney)}
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}

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

            {/* Available Funding Options in Hand - Only show when NOT on OWNER-FUND-INITIATION */}
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

        {/* Owner Seed Money Section - Show when ON OWNER-FUND-INITIATION instead of the Sources breakdown */}
        {player.currentSpace === 'OWNER-FUND-INITIATION' && (bCards.length > 0 || iCards.length > 0) && (
          <OwnerSeedMoneySection
            bCards={bCards}
            iCards={iCards}
            totalFunding={(() => {
              const allCards = [...bCards, ...iCards];
              return allCards.reduce((sum, cardId) => {
                const card = dataService.getCardById(cardId);
                if (!card) return sum;
                const fundingMatch = card.card_name?.match(/\$?([\d,]+(?:\.\d+)?[KMB]?)/);
                return fundingMatch ? sum + FormatUtils.parseMoney(fundingMatch[1]) : sum;
              }, 0);
            })()}
            dataService={dataService}
            colors={colors}
          />
        )}
      </div>

      {/* Only show expandable sources section when NOT on OWNER-FUND-INITIATION */}
      {expandedSources && player.currentSpace !== 'OWNER-FUND-INITIATION' && (
        <div style={sectionStyle}>
          <div style={{ marginLeft: '16px' }}>
            {/* Available Funding Options in Hand */}
            {(bCards.length > 0 || iCards.length > 0) && (
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
        </div>
      )}

      {/* 2. PROJECT SCOPE (Middle) - As is */}
      {Object.keys(groupedWCards).length > 0 && (
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
              {FormatUtils.formatMoney(financialStatus.totalScopeCost)}
            </span>
          </div>
        </div>
      )}

      {/* 3. FEES (Third) - Expandable one-liner */}
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

      {/* 4. SURPLUS/DEFICIT (Bottom) - Final calculation */}
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

    </div>
  );
}