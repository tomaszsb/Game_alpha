import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { Player, Card, CardType } from '../../types/DataTypes';
import { NotificationUtils } from '../../utils/NotificationUtils';

// Types for negotiation state management
interface NegotiationOffer {
  money: number;
  cards: { [key in CardType]: string[] };
}

interface ActiveNegotiation {
  initiatorId: string;
  partnerId: string;
  currentOffer?: NegotiationOffer;
  status: 'selecting_partner' | 'making_offer' | 'awaiting_response' | 'reviewing_offer';
}

// Props interface for the NegotiationModal
interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * NegotiationModal provides a comprehensive interface for player-to-player negotiations.
 * Supports partner selection, offer creation, and offer response handling.
 */
export function NegotiationModal({ isOpen, onClose }: NegotiationModalProps): JSX.Element | null {
  const { stateService, dataService, negotiationService, cardService, notificationService } = useGameContext();
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [availableCards, setAvailableCards] = useState<Card[]>([]);
  
  // Negotiation state
  const [negotiation, setNegotiation] = useState<ActiveNegotiation | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [offer, setOffer] = useState<NegotiationOffer>({
    money: 0,
    cards: { W: [], B: [], E: [], L: [], I: [] }
  });

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setCurrentPlayerId(gameState.currentPlayerId);
      setPlayers(gameState.players);
      
      // For demo purposes, show modal when negotiation button is clicked
      // In future, this would be based on gameState.activeModal or similar
    });
    
    // Initialize with current state
    const gameState = stateService.getGameState();
    setCurrentPlayerId(gameState.currentPlayerId);
    setPlayers(gameState.players);
    
    // Load available cards
    const cards = dataService.getCards();
    setAvailableCards(cards);
    
    return unsubscribe;
  }, [stateService, dataService]);

  // Get current player and available partners
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const availablePartners = players.filter(p => p.id !== currentPlayerId);

  const handleStartNegotiation = () => {
    if (!currentPlayerId) return;
    
    setNegotiation({
      initiatorId: currentPlayerId,
      partnerId: '',
      status: 'selecting_partner'
    });
    // No need to set visibility - controlled by parent props
  };

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setNegotiation(prev => prev ? {
      ...prev,
      partnerId,
      status: 'making_offer'
    } : null);
    
    // Initialize negotiation with service
    if (currentPlayerId) {
      negotiationService.initiateNegotiation(currentPlayerId, partnerId);
    }
  };

  const handleOfferChange = (type: 'money' | 'cards', value: any, cardType?: CardType, cardId?: string) => {
    setOffer(prev => {
      if (type === 'money') {
        return { ...prev, money: Math.max(0, value) };
      } else if (type === 'cards' && cardType && cardId) {
        const newCards = { ...prev.cards };
        const cardList = [...newCards[cardType]];
        const existingIndex = cardList.indexOf(cardId);
        
        if (existingIndex >= 0) {
          // Remove card if already selected
          cardList.splice(existingIndex, 1);
        } else {
          // Add card if not selected
          cardList.push(cardId);
        }
        
        newCards[cardType] = cardList;
        return { ...prev, cards: newCards };
      }
      return prev;
    });
  };

  const handleMakeOffer = () => {
    if (!negotiation || !currentPlayerId) return;

    setNegotiation(prev => prev ? {
      ...prev,
      currentOffer: offer,
      status: 'awaiting_response'
    } : null);

    negotiationService.makeOffer(negotiation.initiatorId, offer);

    // Get current player for notification
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentPlayerName = currentPlayer?.name || 'Unknown Player';

    // Calculate offer summary for notification
    const cardCount = Object.values(offer.cards).flat().length;
    const offerSummary = `Offered $${offer.money}${cardCount > 0 ? ` and ${cardCount} card(s)` : ''}`;

    // Provide success notification
    notificationService.notify(
      NotificationUtils.createSuccessNotification(
        'Offer Made',
        offerSummary,
        currentPlayerName
      ),
      {
        playerId: currentPlayerId,
        playerName: currentPlayerName,
        actionType: 'negotiation_make_offer'
      }
    );
  };

  const handleAcceptOffer = () => {
    if (!negotiation || !currentPlayerId) return;

    negotiationService.acceptOffer(currentPlayerId);

    // Get current player for notification
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentPlayerName = currentPlayer?.name || 'Unknown Player';

    // Provide success notification
    notificationService.notify(
      NotificationUtils.createSuccessNotification(
        'Offer Accepted',
        'Negotiation completed successfully',
        currentPlayerName
      ),
      {
        playerId: currentPlayerId,
        playerName: currentPlayerName,
        actionType: 'negotiation_accept'
      }
    );

    handleCloseModal();
  };

  const handleDeclineOffer = () => {
    if (!negotiation || !currentPlayerId) return;

    negotiationService.declineOffer(currentPlayerId);

    // Get current player for notification
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentPlayerName = currentPlayer?.name || 'Unknown Player';

    // Provide notification for declining offer
    notificationService.notify(
      {
        short: '❌ Declined',
        medium: '❌ Offer declined',
        detailed: `${currentPlayerName} declined the negotiation offer`
      },
      {
        playerId: currentPlayerId,
        playerName: currentPlayerName,
        actionType: 'negotiation_decline'
      }
    );

    setNegotiation(prev => prev ? {
      ...prev,
      currentOffer: undefined,
      status: 'making_offer'
    } : null);
  };

  const handleCloseModal = () => {
    setNegotiation(null);
    setSelectedPartnerId('');
    setOffer({ money: 0, cards: { W: [], B: [], E: [], L: [], I: [] } });
    onClose(); // Call parent's close handler
  };

  const getPlayerCardsByType = (player: Player, cardType: CardType): string[] => {
    const hand = player.hand || [];
    return hand.filter(cardId => cardService.getCardType(cardId) === cardType);
  };

  const getCardName = (cardId: string): string => {
    const card = availableCards.find(c => c.card_id === cardId);
    return card?.card_name || cardId;
  };

  const getTotalOfferValue = (): number => {
    let total = offer.money;
    Object.values(offer.cards).forEach(cardList => {
      cardList.forEach(cardId => {
        const card = availableCards.find(c => c.card_id === cardId);
        total += card?.cost || 0;
      });
    });
    return total;
  };

  // Initialize negotiation when modal opens
  useEffect(() => {
    if (isOpen && !negotiation) {
      handleStartNegotiation();
    }
  }, [isOpen, negotiation]);

  // Don't render if not open or if required data is missing
  if (!isOpen || !currentPlayer) {
    return null;
  }

  // Show loading state if negotiation hasn't been initialized yet
  if (!negotiation) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: colors.white,
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          fontSize: '18px',
          color: colors.text.primary
        }}>
          🤝 Initializing negotiation...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: colors.white,
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90%',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `2px solid ${colors.secondary.light}`,
          backgroundColor: colors.secondary.bg,
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: colors.text.primary, fontSize: '24px' }}>
            🤝 Negotiation
          </h2>
          <button
            onClick={handleCloseModal}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: colors.secondary.main,
              padding: '0',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Partner Selection */}
          {negotiation.status === 'selecting_partner' && (
            <div>
              <h3 style={{ marginTop: 0, color: colors.text.primary }}>Select a player to negotiate with:</h3>
              <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                {availablePartners.map(partner => (
                  <div
                    key={partner.id}
                    onClick={() => handleSelectPartner(partner.id)}
                    style={{
                      padding: '16px',
                      border: `2px solid ${colors.secondary.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                      backgroundColor: selectedPartnerId === partner.id ? colors.primary.light : colors.white
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.primary.main;
                      e.currentTarget.style.backgroundColor = colors.special.hoverBlue;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = selectedPartnerId === partner.id ? colors.primary.main : colors.secondary.border;
                      e.currentTarget.style.backgroundColor = selectedPartnerId === partner.id ? colors.primary.light : colors.white;
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: partner.color || colors.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.white,
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}>
                      {partner.avatar || partner.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text.primary }}>
                        {partner.name}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.text.secondary }}>
                        💰 ${partner.money} | ⏰ {partner.timeSpent} minutes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Making Offer */}
          {negotiation.status === 'making_offer' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, color: colors.text.primary }}>
                  Making offer to: {players.find(p => p.id === negotiation.partnerId)?.name}
                </h3>
              </div>

              {/* Money Offer */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: colors.text.primary }}>
                  💰 Money Offer:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>$</span>
                  <input
                    type="number"
                    min="0"
                    max={currentPlayer.money}
                    value={offer.money}
                    onChange={(e) => handleOfferChange('money', parseInt(e.target.value) || 0)}
                    style={{
                      padding: '8px 12px',
                      border: `2px solid ${colors.secondary.border}`,
                      borderRadius: '6px',
                      fontSize: '16px',
                      width: '120px'
                    }}
                  />
                  <span style={{ color: colors.text.secondary }}>
                    (Available: ${currentPlayer.money})
                  </span>
                </div>
              </div>

              {/* Card Offer */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: colors.text.primary }}>
                  🃏 Card Offer:
                </label>
                {(['W', 'B', 'E', 'L', 'I'] as CardType[]).map(cardType => {
                  const playerCards = getPlayerCardsByType(currentPlayer, cardType);
                  if (playerCards.length === 0) return null;

                  return (
                    <div key={cardType} style={{ marginBottom: '16px' }}>
                      <h4 style={{ marginBottom: '8px', color: colors.text.lightGray }}>
                        {cardType} Cards ({playerCards.length} available):
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {playerCards.map(cardId => {
                          const isSelected = offer.cards[cardType].includes(cardId);
                          return (
                            <button
                              key={cardId}
                              onClick={() => handleOfferChange('cards', null, cardType, cardId)}
                              style={{
                                padding: '4px 12px',
                                border: `2px solid ${isSelected ? colors.success.main : colors.secondary.border}`,
                                borderRadius: '6px',
                                backgroundColor: isSelected ? colors.success.light : colors.white,
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              {getCardName(cardId)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Offer Summary */}
              <div style={{
                padding: '16px',
                backgroundColor: colors.secondary.bg,
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <h4 style={{ marginTop: 0, color: colors.text.primary }}>Offer Summary:</h4>
                <div style={{ color: colors.text.secondary }}>
                  💰 Money: ${offer.money}
                </div>
                {Object.entries(offer.cards).map(([cardType, cardIds]) => {
                  if (cardIds.length === 0) return null;
                  return (
                    <div key={cardType} style={{ color: colors.text.secondary }}>
                      🃏 {cardType} Cards: {cardIds.map(getCardName).join(', ')}
                    </div>
                  );
                })}
                <div style={{ marginTop: '8px', fontWeight: 'bold', color: colors.text.primary }}>
                  Estimated Total Value: ${getTotalOfferValue()}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setNegotiation(prev => prev ? { ...prev, status: 'selecting_partner' } : null)}
                  style={{
                    padding: '10px 16px',
                    border: `2px solid ${colors.secondary.main}`,
                    backgroundColor: colors.white,
                    color: colors.secondary.main,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.secondary.bg;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.white;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleMakeOffer}
                  disabled={getTotalOfferValue() === 0}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    backgroundColor: getTotalOfferValue() > 0 ? colors.success.main : colors.secondary.light,
                    color: getTotalOfferValue() > 0 ? colors.white : colors.secondary.main,
                    borderRadius: '6px',
                    cursor: getTotalOfferValue() > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    opacity: getTotalOfferValue() > 0 ? 1 : 0.6
                  }}
                  onMouseEnter={(e) => {
                    if (getTotalOfferValue() > 0) {
                      e.currentTarget.style.opacity = '0.9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (getTotalOfferValue() > 0) {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  Make Offer 💫
                </button>
              </div>
            </div>
          )}

          {/* Awaiting Response */}
          {negotiation.status === 'awaiting_response' && negotiation.currentOffer && (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: colors.text.primary }}>
                Offer sent to {players.find(p => p.id === negotiation.partnerId)?.name}
              </h3>
              <div style={{
                padding: '20px',
                backgroundColor: colors.warning.bg,
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '18px', marginBottom: '12px' }}>⏳ Waiting for response...</div>
                <div style={{ color: colors.warning.text }}>
                  Your offer: ${negotiation.currentOffer.money} + cards worth ~${getTotalOfferValue() - negotiation.currentOffer.money}
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                style={{
                  padding: '10px 16px',
                  border: `2px solid ${colors.secondary.main}`,
                  backgroundColor: colors.white,
                  color: colors.secondary.main,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.secondary.bg;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.white;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Close
              </button>
            </div>
          )}

          {/* Reviewing Incoming Offer */}
          {negotiation.status === 'reviewing_offer' && negotiation.currentOffer && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, color: colors.text.primary }}>
                  📨 Incoming offer from: {players.find(p => p.id === negotiation.initiatorId)?.name}
                </h3>
              </div>

              {/* Offer Details */}
              <div style={{
                padding: '20px',
                backgroundColor: colors.primary.light,
                borderRadius: '8px',
                marginBottom: '24px',
                border: `2px solid ${colors.primary.main}`
              }}>
                <h4 style={{ marginTop: 0, color: colors.text.primary, marginBottom: '16px' }}>
                  🎁 They are offering:
                </h4>
                
                {/* Money Offer */}
                {negotiation.currentOffer.money > 0 && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: colors.white,
                    borderRadius: '6px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '24px' }}>💰</span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px', color: colors.text.primary }}>
                        ${negotiation.currentOffer.money}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.text.secondary }}>Cash payment</div>
                    </div>
                  </div>
                )}

                {/* Card Offers */}
                {Object.entries(negotiation.currentOffer.cards).map(([cardType, cardIds]) => {
                  if (cardIds.length === 0) return null;
                  return (
                    <div
                      key={cardType}
                      style={{
                        padding: '12px',
                        backgroundColor: colors.white,
                        borderRadius: '6px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <span style={{ fontSize: '24px' }}>🃏</span>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '16px', color: colors.text.primary }}>
                            {cardType} Cards ({cardIds.length})
                          </div>
                        </div>
                      </div>
                      <div style={{ paddingLeft: '36px' }}>
                        {cardIds.map(cardId => (
                          <div
                            key={cardId}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: colors.secondary.bg,
                              borderRadius: '4px',
                              marginBottom: '4px',
                              fontSize: '14px',
                              color: colors.text.lightGray
                            }}
                          >
                            {getCardName(cardId)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Total Value */}
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: colors.background.focus,
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px', color: colors.text.primary }}>
                    Total Estimated Value: ${getTotalOfferValue()}
                  </div>
                </div>
              </div>

              {/* Your Current Resources */}
              <div style={{
                padding: '16px',
                backgroundColor: colors.secondary.bg,
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <h4 style={{ marginTop: 0, color: colors.text.primary }}>📊 Your Current Resources:</h4>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ color: colors.text.secondary }}>
                    💰 Money: ${currentPlayer.money}
                  </div>
                  <div style={{ color: colors.text.secondary }}>
                    ⏰ Time: {currentPlayer.timeSpent} minutes
                  </div>
                  {(['W', 'B', 'E', 'L', 'I'] as CardType[]).map(cardType => {
                    const cardCount = getPlayerCardsByType(currentPlayer, cardType).length;
                    if (cardCount === 0) return null;
                    return (
                      <div key={cardType} style={{ color: colors.text.secondary }}>
                        🃏 {cardType}: {cardCount} cards
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Decision Prompt */}
              <div style={{
                padding: '20px',
                backgroundColor: colors.warning.bg,
                borderRadius: '8px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.warning.text, marginBottom: '8px' }}>
                  🤔 What's your decision?
                </div>
                <div style={{ color: colors.warning.text }}>
                  This offer will be added to your resources if you accept.
                </div>
              </div>

              {/* Response Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleDeclineOffer}
                  style={{
                    padding: '10px 16px',
                    border: `2px solid ${colors.danger.main}`,
                    backgroundColor: colors.white,
                    color: colors.danger.main,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.danger.main;
                    e.currentTarget.style.color = colors.white;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.white;
                    e.currentTarget.style.color = colors.danger.main;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ❌ Decline Offer
                </button>
                <button
                  onClick={handleAcceptOffer}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    backgroundColor: colors.success.main,
                    color: colors.white,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ✅ Accept Offer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}