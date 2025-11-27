// src/components/modals/CardModal.tsx

import React, { useState, useEffect } from 'react';
import { colors, theme } from '../../styles/theme';
import { CardContent } from './CardContent';
import { CardActions } from './CardActions';
import { useGameContext } from '../../context/GameContext';
import { ActiveModal } from '../../types/StateTypes';
import { Card } from '../../types/DataTypes';

/**
 * CardModal is the main container component that composes CardContent and CardActions
 * Now connected to services for real data and state management
 */
export function CardModal(): JSX.Element | null {
  const { stateService, dataService, cardService, gameRulesService } = useGameContext();
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [cardData, setCardData] = useState<Card | null>(null);
  const [canPlay, setCanPlay] = useState(false);
  
  // Subscribe to state changes for modal visibility
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setActiveModal(gameState.activeModal);
      
      // Fetch card data when modal becomes active
      if (gameState.activeModal?.type === 'CARD') {
        const requestedCardId = gameState.activeModal.cardId;
        console.log('🃏 CardModal Debug - Requested card ID:', requestedCardId);
        
        // Ensure DataService is loaded before trying to get cards
        if (!dataService.isLoaded()) {
          console.log('🃏 CardModal Debug - DataService not loaded yet');
          setCardData(null);
          return;
        }

        const cards = dataService.getCards();
        console.log('🃏 CardModal Debug - Available cards:', cards.length);
        console.log('🃏 CardModal Debug - First few card IDs:', cards.slice(0, 5).map(c => c.card_id));
        
        const card = cards.find(c => c.card_id === requestedCardId);
        console.log('🃏 CardModal Debug - Found card:', card);
        setCardData(card || null);
        
        // Check if card can be played
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
    
    // Also handle initial card data if modal is already active
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

  /**
   * Handle card flip action
   */
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  /**
   * Handle play card action
   */
  const handlePlay = () => {
    if (canPlay && cardData) {
      const currentPlayer = stateService.getGameState().currentPlayerId;
      if (currentPlayer) {
        try {
          cardService.playCard(currentPlayer, cardData.card_id);
          
          // Mark card play as an action taken (increment action counter)
          console.log('🃏 CardModal.handlePlay - Marking card play action taken');
          stateService.setPlayerHasMoved();
          
          // Close modal after successful play
          handleClose();
        } catch (error: any) {
          console.error('Failed to play card:', error);
          alert(`Cannot play card: ${error.message}`);
        }
      }
    }
  };

  /**
   * Handle close modal action
   */
  const handleClose = () => {
    // Reset flip state when closing
    setIsFlipped(false);
    stateService.dismissModal();
  };

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  /**
   * Handle escape key to close modal
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: scale(0.9) translateY(-20px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
        `}
      </style>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.modal.overlay.backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: theme.modal.overlay.zIndex,
          padding: theme.modal.overlay.padding,
          animation: `fadeIn ${theme.transitions.normal}`
        }}
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: theme.modal.container.borderRadius,
          boxShadow: theme.shadows.lg,
          maxWidth: '600px',
          width: '100%',
          maxHeight: theme.modal.container.maxHeight,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          animation: `slideIn ${theme.transitions.modal}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: theme.modal.header.padding,
          borderBottom: theme.modal.header.borderBottom,
          backgroundColor: colors.secondary.bg,
          borderRadius: `${theme.borderRadius.xl} ${theme.borderRadius.xl} 0 0`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: theme.typography.heading.h3.fontSize,
              fontWeight: theme.typography.heading.h3.fontWeight,
              color: colors.secondary.dark
            }}>
              {isFlipped ? "Card Back" : (cardData?.card_name || "Card Details")}
            </h3>

            {/* Close button in header */}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: theme.typography.heading.h2.fontSize,
                color: colors.secondary.main,
                cursor: 'pointer',
                padding: theme.spacing.xs,
                borderRadius: theme.borderRadius.sm,
                lineHeight: 1,
                transition: theme.transitions.fast
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.secondary.light;
                e.currentTarget.style.color = colors.secondary.dark;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = colors.secondary.main;
              }}
              title="Close modal"
            >
              ×
            </button>
          </div>

          {/* Card type subtitle when available */}
          {cardData?.card_type && !isFlipped && (
            <p style={{
              margin: `${theme.spacing.sm} 0 0`,
              fontSize: theme.typography.body.small,
              color: colors.secondary.main,
              fontStyle: 'italic'
            }}>
              {cardData.card_type} Card
            </p>
          )}
        </div>

        {/* Modal Body - CardContent */}
        <div style={{
          flex: 1,
          overflow: 'auto'
        }}>
          <CardContent 
            card={cardData} 
            isFlipped={isFlipped}
          />
        </div>

        {/* Modal Footer - CardActions */}
        <CardActions
          playerId={stateService.getGameState().currentPlayerId || undefined}
          cardId={cardData?.card_id}
          onPlay={handlePlay}
          onClose={handleClose}
          onFlip={handleFlip}
          canPlay={canPlay && !isFlipped}
          isFlipped={isFlipped}
          playButtonText={cardData?.effects_on_play ? "Activate Effect" : "Play Card"}
        />
      </div>
    </div>
    </>
  );
}