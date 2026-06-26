// src/components/modals/CardDetailsModal.tsx

import React, { useState } from 'react';
import { colors, theme } from '../../styles/theme';
import { Card } from '../../types/DataTypes';
import { Player } from '../../types/StateTypes';
import { ICardService } from '../../types/ServiceContracts';
import { useGameContext } from '../../context/GameContext';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';
import { openInDictionary } from '../../utils/dictionaryBridge';
import { CARD_DETAILS } from '../../constants/uiStrings';
import { PlayerAvatar } from '../common/PlayerAvatar';

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
 * Uses ModalBase for consistent styling and mobile-friendly design.
 */
export function CardDetailsModal({ isOpen, onClose, card, currentPlayer, otherPlayers, cardService }: CardDetailsModalProps): JSX.Element | null {
  const { notificationService } = useGameContext();
  const { openWithTerm } = useDictionaryPanel();
  const [showTransferUI, setShowTransferUI] = useState(false);
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<string>('');

  // Check if current player owns this card and it's transferable
  const canTransferCard = (): boolean => {
    if (!currentPlayer || !card) return false;
    if (!card.is_transferable) return false;
    return currentPlayer.hand?.includes(card.card_id) || false;
  };

  // Handle transfer card
  const handleTransferCard = async () => {
    if (!currentPlayer || !selectedTargetPlayer || !card) return;

    try {
      cardService.transferCard(currentPlayer.id, selectedTargetPlayer, card.card_id);

      const targetPlayer = otherPlayers.find(p => p.id === selectedTargetPlayer);
      const targetPlayerName = targetPlayer?.name || 'Unknown Player';

      notificationService.notify(
        NotificationUtils.createSuccessNotification(
          'Transferred',
          `${card.card_name} transferred to ${targetPlayerName}`,
          currentPlayer.name
        ),
        {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          actionType: `transfer_${card.card_id}`
        }
      );

      setShowTransferUI(false);
      setSelectedTargetPlayer('');
      onClose();

    } catch (error: any) {
      notificationService.notify(
        NotificationUtils.createErrorNotification(
          'Transfer Failed',
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

  // Show loading state if card data is not available
  if (!card) {
    return (
      <ModalBase
        isOpen={isOpen}
        onClose={onClose}
        title="Loading..."
        emoji={theme.emoji.cards}
        maxWidth="600px"
        testId="card-details-modal"
      >
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: colors.secondary.main
        }}>
          Loading details...
        </div>
      </ModalBase>
    );
  }

  // Get card type colors from theme
  const cardType = cardService.getCardType(card.card_id);
  const cardColors = getCardTypeColors(cardType || '');
  const cardEmoji = getCardTypeEmoji(cardType || '');

  // Footer content
  const footer = (
    <>
      {canTransferCard() && !showTransferUI && (
        <button
          onClick={() => setShowTransferUI(true)}
          style={modalButtonStyles.primary}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {CARD_DETAILS.TRANSFER_TOGGLE}
        </button>
      )}
      <button
        onClick={() => openInDictionary('card', card.card_id)}
        style={modalButtonStyles.secondary}
        title="Open in Dictionary Dashboard"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.secondary.bg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.secondary.light;
        }}
      >
        📖 View Intelligence
      </button>
      <button
        onClick={onClose}
        style={modalButtonStyles.secondary}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.secondary.bg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.secondary.light;
        }}
      >
        Close
      </button>
    </>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={card.card_name}
      emoji={cardEmoji}
      maxWidth="600px"
      headerColor={cardColors.bg}
      headerBorderColor={cardColors.primary}
      footer={footer}
      testId="card-details-modal"
    >
      {/* Card Type Badge and ID */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: theme.borderRadius.sm,
          fontSize: '0.85rem',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: cardColors.primary
        }}>
          {cardEmoji} {cardType}
        </span>
        <span style={{
          fontSize: '0.75rem',
          color: colors.secondary.main,
          fontFamily: 'monospace'
        }}>
          {card.card_id}
        </span>
      </div>

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
          <TextWithTerms
            text={card.description || 'No description available.'}
            onTermClick={(term) => openWithTerm(term.id)}
          />
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
            {theme.emoji.effects} Effects When Activated
          </h3>
          <div style={{
            background: colors.special.cardEffects.positive,
            border: `2px solid ${colors.success.border}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px',
            fontSize: '0.9rem',
            color: colors.success.text,
            fontStyle: 'italic'
          }}>
            <TextWithTerms
              text={card.effects_on_play}
              onTermClick={(term) => openWithTerm(term.id)}
            />
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
          <div style={{
            background: colors.special.cardEffects.negative,
            border: `2px solid ${colors.danger.border}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px 16px'
          }}>
            <h4 style={{
              fontSize: '0.85rem',
              fontWeight: 'bold',
              color: colors.danger.text,
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: 0
            }}>
              {theme.emoji.money} Cost
            </h4>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: card.cost === 0 ? colors.success.main : colors.danger.main,
              marginTop: '4px'
            }}>
              ${card.cost}
            </div>
          </div>
        )}

        {/* Duration */}
        {card.duration !== undefined && (
          <div style={{
            background: colors.special.cardEffects.neutral,
            border: `2px solid ${colors.info.main}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px 16px'
          }}>
            <h4 style={{
              fontSize: '0.85rem',
              fontWeight: 'bold',
              color: colors.info.dark,
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: 0
            }}>
              {theme.emoji.time} Duration
            </h4>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: colors.secondary.dark,
              marginTop: '4px'
            }}>
              {card.duration} turn{Number(card.duration) !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Phase Restriction */}
        {card.phase_restriction && card.phase_restriction !== 'Any' && (
          <div style={{
            background: colors.purple.lighter,
            border: `2px solid ${colors.purple.main}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px 16px'
          }}>
            <h4 style={{
              fontSize: '0.85rem',
              fontWeight: 'bold',
              color: colors.purple.dark,
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: 0
            }}>
              {theme.emoji.target} Phase Restriction
            </h4>
            <div style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: colors.purple.main,
              marginTop: '4px'
            }}>
              {card.phase_restriction}
            </div>
          </div>
        )}
      </div>

      {/* Transfer UI */}
      {showTransferUI && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: colors.warning.bg,
          borderRadius: theme.borderRadius.md,
          border: `2px solid ${colors.warning.main}`
        }}>
          <h4 style={{
            fontSize: '0.9rem',
            fontWeight: 'bold',
            color: colors.warning.text,
            margin: 0,
            marginBottom: '12px'
          }}>
            {CARD_DETAILS.TRANSFER_HEADING}
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
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
                  borderRadius: theme.borderRadius.sm,
                  backgroundColor: selectedTargetPlayer === player.id ? colors.primary.light : 'transparent',
                  minHeight: theme.mobile.minTapTarget
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
                <span style={{ marginRight: '8px', display: 'inline-flex' }}>
                  <PlayerAvatar avatar={player.avatar} color={player.color} size={22} title={player.name} />
                </span>
                <span style={{ fontWeight: 'bold', color: colors.secondary.dark }}>
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
              style={modalButtonStyles.secondary}
            >
              Cancel
            </button>
            <button
              onClick={handleTransferCard}
              disabled={!selectedTargetPlayer}
              style={{
                ...modalButtonStyles.danger,
                opacity: selectedTargetPlayer ? 1 : 0.6,
                cursor: selectedTargetPlayer ? 'pointer' : 'not-allowed'
              }}
            >
              {CARD_DETAILS.TRANSFER_CONFIRM}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  );
}
