// src/components/modals/CardModal.tsx

import React, { useState, useEffect } from 'react';
import { ModalBase } from './shared/ModalBase';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';
import { colors, theme } from '../../styles/theme';
import { CardContent } from './CardContent';
import { CardActions } from './CardActions';
import { useGameContext } from '../../context/GameContext';
import { ActiveModal } from '../../types/StateTypes';
import { Card } from '../../types/DataTypes';
import { shouldShake } from '../../utils/modalConfig';
import { NarrativeBlock } from './shared/NarrativeBlock';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';

/**
 * CardModal is the main container component that composes CardContent and CardActions
 * Uses ModalBase for consistent styling across the app
 */
export function CardModal(): JSX.Element | null {
  const { stateService, dataService, cardService, gameRulesService } = useGameContext();
  const { getPortraitForSpace } = useNpcPortrait();
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [cardData, setCardData] = useState<Card | null>(null);
  const [canPlay, setCanPlay] = useState(false);

  // Subscribe to state changes for modal visibility
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setActiveModal(gameState.activeModal);

      if (gameState.activeModal?.type === 'CARD') {
        const requestedCardId = gameState.activeModal.cardId;

        if (!dataService.isLoaded()) {
          setCardData(null);
          return;
        }

        const cards = dataService.getCards();
        const card = cards.find(c => c.card_id === requestedCardId);
        setCardData(card || null);

        const currentPlayer = gameState.currentPlayerId;
        if (currentPlayer && card) {
          setCanPlay(gameRulesService.canPlayCard(currentPlayer, card.card_id));
        } else {
          setCanPlay(false);
        }
      } else {
        setCardData(null);
        setCanPlay(false);
      }
    });

    // Initialize with current state
    const currentState = stateService.getGameState();
    setActiveModal(currentState.activeModal);

    if (currentState.activeModal?.type === 'CARD') {
      if (dataService.isLoaded() && currentState.activeModal) {
        const cards = dataService.getCards();
        const card = cards.find(c => c.card_id === currentState.activeModal!.cardId);
        setCardData(card || null);
      }
    }

    return unsubscribe;
  }, [stateService, dataService, gameRulesService]);

  // Don't render if modal is not active
  if (!activeModal || activeModal.type !== 'CARD') {
    return null;
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handlePlay = async () => {
    if (canPlay && cardData) {
      const currentPlayer = stateService.getGameState().currentPlayerId;
      if (currentPlayer) {
        try {
          await cardService.playCard(currentPlayer, cardData.card_id);
          stateService.setPlayerHasMoved();
          handleClose();
        } catch (error: any) {
          console.error('Failed to play card:', error);
          alert(`Cannot activate: ${error.message}`);
        }
      }
    }
  };

  const handleClose = () => {
    setIsFlipped(false);
    stateService.dismissModal();
  };

  // Get card type colors for header
  const cardColors = cardData ? getCardTypeColors(cardData.card_type) : null;
  const cardEmoji = cardData ? getCardTypeEmoji(cardData.card_type) : theme.emoji.cards;

  // Data-driven shake: uses shake_on config from current space
  const currentPlayer = stateService.getGameState().players.find(
    p => p.id === stateService.getGameState().currentPlayerId
  );
  const spaceContent = currentPlayer
    ? dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType)
    : undefined;
  const isNegativeCard = shouldShake(spaceContent?.shake_on, { cardType: cardData?.card_type });

  // Custom footer with CardActions
  const footer = (
    <CardActions
      playerId={stateService.getGameState().currentPlayerId || undefined}
      cardId={cardData?.card_id}
      onPlay={handlePlay}
      onClose={handleClose}
      onFlip={handleFlip}
      canPlay={canPlay && !isFlipped}
      isFlipped={isFlipped}
      playButtonText={cardData?.effects_on_play ? "Activate Effect" : "Activate"}
    />
  );

  return (
    <ModalBase
      isOpen={true}
      onClose={handleClose}
      title={isFlipped ? "Back" : (cardData?.card_name || "Details")}
      emoji={isFlipped ? theme.emoji.cards : cardEmoji}
      maxWidth="600px"
      headerColor={cardColors?.bg}
      headerBorderColor={cardColors?.primary}
      testId="card-modal"
      shake={isNegativeCard && !isFlipped}
    >
      {/* Card type subtitle when available */}
      {cardData?.card_type && !isFlipped && (
        <div style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            padding: '4px 10px',
            backgroundColor: cardColors?.primary,
            color: colors.white,
            borderRadius: theme.borderRadius.sm,
            fontSize: '12px',
            fontWeight: 'bold',
          }}>
            {cardEmoji} {cardData.card_type}
          </span>
        </div>
      )}

      {/* Per-action narrative (from SPACE_EFFECTS narrative column) */}
      {!isFlipped && currentPlayer && cardData?.card_type && (() => {
        const narrative = dataService.getEffectNarrative(
          currentPlayer.currentSpace, currentPlayer.visitType, `draw_${cardData.card_type}`
        );
        if (!narrative) return null;
        return <NarrativeBlock text={narrative} spaceName={currentPlayer.currentSpace} portraitSrc={getPortraitForSpace(currentPlayer.currentSpace)} />;
      })()}

      {/* CardContent handles the actual card display */}
      <CardContent
        card={cardData}
        isFlipped={isFlipped}
      />

      {/* Footer with actions */}
      <div style={{
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: `1px solid ${colors.secondary.light}`,
      }}>
        {footer}
      </div>
    </ModalBase>
  );
}
