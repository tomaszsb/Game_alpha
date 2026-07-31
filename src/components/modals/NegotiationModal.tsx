import React, { useState, useEffect, useMemo } from 'react';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { useSyncedGameState } from '../../hooks/useSyncedGameState';
import { Player, CardType, VisitType } from '../../types/DataTypes';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';
import { interpolateTemplate } from '../../utils/templateInterpolation';
import { AvatarIcon } from '../icons/AvatarIcons';

// Types for negotiation state management
interface NegotiationOffer {
  money: number;
  cards: { [key in CardType]: string[] };
}

interface ActiveNegotiation {
  initiatorId: string;
  partnerId: string;
  currentOffer?: NegotiationOffer;
  status: 'selecting_partner' | 'making_offer' | 'awaiting_response';
}

// Props interface for the NegotiationModal
interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Pre-selects a partner (e.g. from a card that already had the player
  // choose one) so the modal opens straight into "making_offer" instead of
  // the partner-selection screen.
  initialPartnerId?: string;
}

/**
 * NegotiationModal provides a comprehensive interface for player-to-player negotiations.
 * Supports partner selection, offer creation, and offer response handling.
 * Uses ModalBase for consistent styling and mobile-friendly design.
 */
export function NegotiationModal({ isOpen, onClose, initialPartnerId }: NegotiationModalProps): JSX.Element | null {
  const { stateService, dataService, negotiationService, cardService, notificationService } = useGameContext();
  const gameState = useSyncedGameState(stateService);
  const { currentPlayerId, players } = gameState;
  const currentPlayerForSpace = players.find(p => p.id === currentPlayerId);
  const currentSpace = currentPlayerForSpace?.currentSpace || '';
  const currentVisitType: VisitType = currentPlayerForSpace?.visitType || 'First';
  const availableCards = useMemo(() => dataService.getCards(), [dataService]);

  // Negotiation state
  const [negotiation, setNegotiation] = useState<ActiveNegotiation | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [offer, setOffer] = useState<NegotiationOffer>({
    money: 0,
    cards: { W: [], B: [], E: [], L: [], I: [] }
  });

  // Get current player and available partners
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const availablePartners = players.filter(p => p.id !== currentPlayerId);

  const handleStartNegotiation = () => {
    if (!currentPlayerId) return;

    const preselectedPartner = initialPartnerId
      ? availablePartners.find(p => p.id === initialPartnerId)
      : undefined;

    if (preselectedPartner) {
      setSelectedPartnerId(preselectedPartner.id);
      setNegotiation({
        initiatorId: currentPlayerId,
        partnerId: preselectedPartner.id,
        status: 'making_offer'
      });
      negotiationService.initiateNegotiation(currentPlayerId, preselectedPartner.id);
      return;
    }

    setNegotiation({
      initiatorId: currentPlayerId,
      partnerId: '',
      status: 'selecting_partner'
    });
  };

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setNegotiation(prev => prev ? {
      ...prev,
      partnerId,
      status: 'making_offer'
    } : null);

    if (currentPlayerId) {
      negotiationService.initiateNegotiation(currentPlayerId, partnerId);
    }
  };

  const handleOfferChange = (type: 'money' | 'cards', value: number, cardType?: CardType, cardId?: string) => {
    setOffer(prev => {
      if (type === 'money') {
        return { ...prev, money: Math.max(0, value) };
      } else if (type === 'cards' && cardType && cardId) {
        const newCards = { ...prev.cards };
        const cardList = [...newCards[cardType]];
        const existingIndex = cardList.indexOf(cardId);

        if (existingIndex >= 0) {
          cardList.splice(existingIndex, 1);
        } else {
          cardList.push(cardId);
        }

        newCards[cardType] = cardList;
        return { ...prev, cards: newCards };
      }
      return prev;
    });
  };

  // Sends the offer, then waits for the partner's real accept/decline
  // response (handled via ChoiceService/ChoiceModal on their own device —
  // see NegotiationService.makeOffer) and resolves the trade before closing.
  const handleMakeOffer = async () => {
    if (!negotiation || !currentPlayerId) return;

    setNegotiation(prev => prev ? {
      ...prev,
      currentOffer: offer,
      status: 'awaiting_response'
    } : null);

    const flatCardIds = Object.values(offer.cards).flat();
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentPlayerName = currentPlayer?.name || 'Unknown Player';

    const result = await negotiationService.makeOffer(negotiation.initiatorId, {
      money: offer.money,
      cards: flatCardIds
    });

    if (result.data?.accepted) {
      notificationService.notify(
        NotificationUtils.createSuccessNotification(
          'Offer Accepted',
          'Trade completed successfully',
          currentPlayerName
        ),
        {
          playerId: currentPlayerId,
          playerName: currentPlayerName,
          actionType: 'negotiation_accept'
        }
      );
    } else if (result.data && result.data.accepted === false) {
      notificationService.notify(
        {
          short: '❌ Declined',
          medium: '❌ Offer declined',
          detailed: `${players.find(p => p.id === negotiation.partnerId)?.name || 'They'} declined the trade offer`
        },
        {
          playerId: currentPlayerId,
          playerName: currentPlayerName,
          actionType: 'negotiation_decline'
        }
      );
    } else if (!result.success) {
      notificationService.notify(
        NotificationUtils.createErrorNotification('Trade', result.message, currentPlayerName),
        {
          playerId: currentPlayerId,
          playerName: currentPlayerName,
          actionType: 'negotiation_error'
        }
      );
    }

    handleCloseModal();
  };

  const handleCloseModal = () => {
    // Closing before an offer was ever made (partner-selection or
    // making-offer screens) leaves a real negotiation open server-side,
    // which would permanently block starting a new one — clean it up.
    // Closing AFTER makeOffer has resolved (status already 'awaiting_response'
    // by then) is a no-op here: the service already cleared it.
    if (negotiation && negotiation.status !== 'awaiting_response') {
      const active = negotiationService.getActiveNegotiation();
      if (active) {
        negotiationService.cancelNegotiation(active.negotiationId);
      }
    }
    setNegotiation(null);
    setSelectedPartnerId('');
    setOffer({ money: 0, cards: { W: [], B: [], E: [], L: [], I: [] } });
    onClose();
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

  // Initialize negotiation when modal opens. Depends on currentPlayerId so the
  // effect re-runs once the subscribe callback has populated it — otherwise the
  // first run closes over a null id and bails out via the early return in
  // handleStartNegotiation, leaving the modal stuck in its loading state.
  useEffect(() => {
    if (isOpen && !negotiation && currentPlayerId) {
      handleStartNegotiation();
    }
    // `handleStartNegotiation` is deliberately omitted: it is rebuilt on every
    // render, so listing it would re-run this effect on every render until
    // `negotiation` is set — firing repeated starts during that window. The
    // three conditions above are the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, negotiation, currentPlayerId]);

  // When player is unavailable, render closed ModalBase for exit animation
  if (!currentPlayer) {
    return (
      <ModalBase isOpen={false} onClose={onClose} title="" emoji="" testId="negotiation-modal">
        {null}
      </ModalBase>
    );
  }

  // Show loading state if negotiation hasn't been initialized yet
  if (!negotiation) {
    return (
      <ModalBase
        isOpen={isOpen}
        onClose={handleCloseModal}
        title="Negotiation"
        emoji={theme.emoji.negotiation}
        maxWidth="800px"
        testId="negotiation-modal"
      >
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: colors.text.primary
        }}>
          {theme.emoji.negotiation} Initializing negotiation...
        </div>
      </ModalBase>
    );
  }

  // Per-space ModalConfig overrides keyed by `${space}|${visit}|negotiate`.
  // When set, modal_title replaces the status-specific title, modal_description
  // replaces the partner-selection prompt, and modal_button_label replaces the
  // "Make Offer" CTA on the making_offer step.
  const negotiationModalConfig = currentSpace
    ? dataService.getModalConfig(currentSpace, currentVisitType, 'negotiate')
    : undefined;

  const partnerName = players.find(p => p.id === negotiation.partnerId)?.name || '';
  const templateContext: Record<string, string | number | undefined> = {
    spaceName: currentSpace,
    playerName: currentPlayer.name,
    partnerName,
  };
  const customTitle = negotiationModalConfig?.modal_title
    ? interpolateTemplate(negotiationModalConfig.modal_title, templateContext)
    : undefined;
  const customDescription = negotiationModalConfig?.modal_description
    ? interpolateTemplate(negotiationModalConfig.modal_description, templateContext)
    : undefined;
  const customButtonLabel = negotiationModalConfig?.modal_button_label
    ? interpolateTemplate(negotiationModalConfig.modal_button_label, templateContext)
    : undefined;

  // Determine title based on negotiation status
  const getTitle = () => {
    if (customTitle) return customTitle;
    switch (negotiation.status) {
      case 'selecting_partner':
        return 'Select Partner';
      case 'making_offer':
        return 'Create Offer';
      case 'awaiting_response':
        return 'Awaiting Response';
      default:
        return 'Negotiation';
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={getTitle()}
      emoji={theme.emoji.negotiation}
      maxWidth="800px"
      testId="negotiation-modal"
    >
      {/* Partner Selection */}
      {negotiation.status === 'selecting_partner' && (
        <div>
          <h3 style={{ marginTop: 0, color: colors.text.primary, marginBottom: '16px' }}>
            {customDescription || 'Select a player to negotiate with:'}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {availablePartners.map(partner => (
              <div
                key={partner.id}
                onClick={() => handleSelectPartner(partner.id)}
                style={{
                  padding: '16px',
                  border: `2px solid ${selectedPartnerId === partner.id ? colors.primary.main : colors.secondary.border}`,
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: theme.transitions.fast,
                  backgroundColor: selectedPartnerId === partner.id ? colors.primary.light : colors.white,
                  minHeight: theme.mobile.minTapTarget
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
                  {AvatarIcon({ avatar: partner.avatar, size: '1em' }) || partner.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.text.primary }}>
                    {partner.name}
                  </div>
                  <div style={{ fontSize: '14px', color: colors.text.secondary }}>
                    {theme.emoji.money} ${partner.money} | {theme.emoji.time} {partner.timeSpent} minutes
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
              {theme.emoji.money} Money Offer:
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
                  padding: '10px 12px',
                  border: `2px solid ${colors.secondary.border}`,
                  borderRadius: theme.borderRadius.sm,
                  fontSize: '16px',
                  width: '120px',
                  minHeight: theme.mobile.minTapTarget
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
              {theme.emoji.cards} Resources Offered:
            </label>
            {(['W', 'B', 'E', 'L', 'I'] as CardType[]).map(cardType => {
              const playerCards = getPlayerCardsByType(currentPlayer, cardType);
              if (playerCards.length === 0) return null;

              const typeColors = getCardTypeColors(cardType);
              const typeEmoji = getCardTypeEmoji(cardType);

              return (
                <div key={cardType} style={{ marginBottom: '16px' }}>
                  <h4 style={{ marginBottom: '8px', color: typeColors.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {typeEmoji} {typeColors.label} Cards ({playerCards.length} available):
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {playerCards.map(cardId => {
                      const isSelected = offer.cards[cardType].includes(cardId);
                      return (
                        <button
                          key={cardId}
                          onClick={() => handleOfferChange('cards', 0, cardType, cardId)}
                          style={{
                            padding: '8px 12px',
                            border: `2px solid ${isSelected ? colors.success.main : colors.secondary.border}`,
                            borderRadius: theme.borderRadius.sm,
                            backgroundColor: isSelected ? colors.success.light : colors.white,
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: theme.transitions.fast,
                            minHeight: theme.mobile.minTapTarget
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
            borderRadius: theme.borderRadius.md,
            marginBottom: '24px'
          }}>
            <h4 style={{ marginTop: 0, color: colors.text.primary }}>Offer Summary:</h4>
            <div style={{ color: colors.text.secondary }}>
              {theme.emoji.money} Money: ${offer.money}
            </div>
            {Object.entries(offer.cards).map(([cardType, cardIds]) => {
              if (cardIds.length === 0) return null;
              return (
                <div key={cardType} style={{ color: colors.text.secondary }}>
                  {getCardTypeEmoji(cardType as CardType)} {cardType} Cards: {cardIds.map(getCardName).join(', ')}
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
              style={modalButtonStyles.secondary}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.secondary.bg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.secondary.light;
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleMakeOffer}
              disabled={getTotalOfferValue() === 0}
              style={{
                ...modalButtonStyles.primary,
                opacity: getTotalOfferValue() > 0 ? 1 : 0.6,
                cursor: getTotalOfferValue() > 0 ? 'pointer' : 'not-allowed'
              }}
              onMouseEnter={(e) => {
                if (getTotalOfferValue() > 0) {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (getTotalOfferValue() > 0) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {customButtonLabel || `Make Offer ${theme.emoji.celebration}`}
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
            borderRadius: theme.borderRadius.md,
            marginBottom: '24px',
            border: `2px solid ${colors.warning.main}`
          }}>
            <div style={{ fontSize: '18px', marginBottom: '12px' }}>{theme.emoji.time} Waiting for response...</div>
            <div style={{ color: colors.warning.text }}>
              Your offer: ${negotiation.currentOffer.money} + items worth ~${getTotalOfferValue() - negotiation.currentOffer.money}
            </div>
          </div>
          <button
            onClick={handleCloseModal}
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
        </div>
      )}
    </ModalBase>
  );
}
