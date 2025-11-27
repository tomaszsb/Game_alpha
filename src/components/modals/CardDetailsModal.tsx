// src/components/modals/CardDetailsModal.tsx

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { Card } from '../../types/DataTypes';
import { Player } from '../../types/StateTypes';
import { ICardService } from '../../types/ServiceContracts';
import { useGameContext } from '../../context/GameContext';
import { NotificationUtils } from '../../utils/NotificationUtils';

interface CardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  currentPlayer: Player | null;
  otherPlayers: Player[];
  cardService: ICardService;
}

/**
 * CardDetailsModal displays comprehensive information about a specific card
 * including name, description, effects, cost, and other properties.
 */
export function CardDetailsModal({ isOpen, onClose, card, currentPlayer, otherPlayers, cardService }: CardDetailsModalProps): JSX.Element | null {
  const { notificationService } = useGameContext();
  const [showTransferUI, setShowTransferUI] = useState(false);
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<string>('');

  // Handle escape key to close modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };


  // Check if current player owns this card and it's transferable
  const canTransferCard = (): boolean => {
    if (!currentPlayer || !card) return false;

    // Check if card has is_transferable property set to true
    if (!card.is_transferable) return false;

    // Check if the card is in the player's hand
    return currentPlayer.hand?.includes(card.card_id) || false;
  };

  // Handle transfer card
  const handleTransferCard = async () => {
    if (!currentPlayer || !selectedTargetPlayer || !card) return;

    try {
      cardService.transferCard(currentPlayer.id, selectedTargetPlayer, card.card_id);

      // Get target player name for notification
      const targetPlayer = otherPlayers.find(p => p.id === selectedTargetPlayer);
      const targetPlayerName = targetPlayer?.name || 'Unknown Player';

      // Provide success notification
      notificationService.notify(
        NotificationUtils.createSuccessNotification(
          'Card Transferred',
          `${card.card_name} transferred to ${targetPlayerName}`,
          currentPlayer.name
        ),
        {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          actionType: `transfer_${card.card_id}`
        }
      );

      // Close modal and transfer UI on success
      setShowTransferUI(false);
      setSelectedTargetPlayer('');
      onClose();

    } catch (error: any) {
      // Provide error notification instead of alert
      notificationService.notify(
        NotificationUtils.createErrorNotification(
          'Card Transfer',
          error.message,
          currentPlayer.name
        ),
        {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          actionType: `transfer_${card.card_id}_error`
        }
      );
    }
  };

  // Don't render if modal is not open
  if (!isOpen) {
    return null;
  }

  // Show loading state if card data is not available
  if (!card) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
            padding: '40px',
            textAlign: 'center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '1.1rem', color: colors.secondary.main }}>
            Loading card details...
          </div>
        </div>
      </div>
    );
  }

  // Get card type for color coding
  const cardType = cardService.getCardType(card.card_id);
  
  // Card type colors
  const cardTypeColors = {
    W: colors.danger.main, // Red for Work cards
    B: colors.primary.main, // Blue for Bank Loan cards
    I: colors.success.main, // Green for Investor Loan cards
    L: colors.warning.main, // Yellow for Life Events cards
    E: colors.purple.main  // Purple for Expeditor cards
  };

  const cardTypeColor = cardType ? cardTypeColors[cardType] : colors.secondary.main;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${colors.secondary.border}`,
          backgroundColor: colors.secondary.bg,
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              {/* Card Type Badge */}
              <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: cardTypeColor
              }}>
                {cardType} Card
              </span>
              
              {/* Card ID */}
              <span style={{
                fontSize: '0.75rem',
                color: colors.secondary.main,
                fontFamily: 'monospace'
              }}>
                {card.card_id}
              </span>
            </div>
            
            <h2 style={{
              margin: 0,
              fontSize: '1.4rem',
              fontWeight: 'bold',
              color: colors.text.primary,
              lineHeight: '1.3'
            }}>
              {card.card_name}
            </h2>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              color: colors.secondary.main,
              borderRadius: '4px',
              marginLeft: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.light;
              e.currentTarget.style.color = colors.secondary.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = colors.secondary.main;
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto'
        }}>
          {/* Card Description */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: colors.secondary.dark,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Description
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: colors.text.primary,
              lineHeight: '1.5',
              margin: 0
            }}>
              {card.description || 'No description available.'}
            </p>
          </div>

          {/* Card Effects */}
          {card.effects_on_play && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 'bold',
                color: colors.secondary.dark,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Effects When Played
              </h3>
              <div style={{
                background: colors.secondary.bg,
                border: `1px solid ${colors.secondary.border}`,
                borderRadius: '8px',
                padding: '12px',
                fontSize: '0.9rem',
                color: colors.secondary.dark,
                fontStyle: 'italic'
              }}>
                {card.effects_on_play}
              </div>
            </div>
          )}

          {/* Card Properties */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {/* Cost */}
            {card.cost !== undefined && (
              <div>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: colors.secondary.main,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Cost
                </h4>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: card.cost === 0 ? colors.success.main : colors.danger.main
                }}>
                  ${card.cost}
                </div>
              </div>
            )}

            {/* Duration */}
            {card.duration !== undefined && (
              <div>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: colors.secondary.main,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Duration
                </h4>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: colors.secondary.dark
                }}>
                  {card.duration} turn{Number(card.duration) !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Phase Restriction */}
            {card.phase_restriction && card.phase_restriction !== 'Any' && (
              <div>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: colors.secondary.main,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Phase Restriction
                </h4>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: colors.purple.main,
                  background: colors.purple.lighter,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}>
                  {card.phase_restriction}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transfer UI */}
        {showTransferUI && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.secondary.border}`,
            backgroundColor: colors.warning.bg
          }}>
            <h4 style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: colors.warning.text,
              marginBottom: '12px',
              margin: 0
            }}>
              Select player to transfer card to:
            </h4>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '12px'
            }}>
              {otherPlayers.map((player) => (
                <label
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px',
                    backgroundColor: selectedTargetPlayer === player.id ? colors.primary.light : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="targetPlayer"
                    value={player.id}
                    checked={selectedTargetPlayer === player.id}
                    onChange={(e) => setSelectedTargetPlayer(e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <span style={{
                    fontSize: '1rem',
                    marginRight: '8px'
                  }}>
                    {player.avatar}
                  </span>
                  <span style={{
                    fontWeight: 'bold',
                    color: colors.secondary.dark
                  }}>
                    {player.name}
                  </span>
                </label>
              ))}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '16px'
            }}>
              <button
                onClick={() => {
                  setShowTransferUI(false);
                  setSelectedTargetPlayer('');
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  color: colors.secondary.main,
                  backgroundColor: colors.secondary.light,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransferCard}
                disabled={!selectedTargetPlayer}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  color: selectedTargetPlayer ? colors.white : colors.secondary.main,
                  backgroundColor: selectedTargetPlayer ? colors.danger.main : colors.secondary.light,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: selectedTargetPlayer ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
                }}
              >
                Transfer Card
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${colors.secondary.border}`,
          backgroundColor: colors.secondary.bg,
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {canTransferCard() && !showTransferUI && (
              <button
                onClick={() => setShowTransferUI(true)}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  color: colors.white,
                  backgroundColor: colors.success.main,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.special.button.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.success.main;
                }}
              >
                🔄 Transfer Card
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: colors.secondary.main,
              backgroundColor: colors.secondary.light,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.border;
              e.currentTarget.style.color = colors.secondary.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.light;
              e.currentTarget.style.color = colors.secondary.main;
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}