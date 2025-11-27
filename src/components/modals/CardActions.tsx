// src/components/modals/CardActions.tsx

import React from 'react';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';

interface CardActionsProps {
  playerId?: string;
  cardId?: string;
  onPlay?: () => void;
  onClose?: () => void;
  onFlip?: () => void;
  canPlay?: boolean;
  isFlipped?: boolean;
  playButtonText?: string;
}

/**
 * CardActions component displays the action buttons for the card modal
 * Extracted from the legacy modal's action handling patterns
 */
export function CardActions({
  playerId,
  cardId,
  onPlay = () => {},
  onClose = () => {},
  onFlip = () => {},
  canPlay = true,
  isFlipped = false,
  playButtonText = "Play Card"
}: CardActionsProps): JSX.Element {
  
  // Access the PlayerActionService via context
  const { playerActionService, stateService } = useGameContext();

  /**
   * Handle playing a card using the PlayerActionService
   * This creates the end-to-end connection from UI to service layer
   */
  const handlePlayCard = async () => {
    try {
      // If playerId and cardId are provided as props, use them
      if (playerId && cardId) {
        await playerActionService.playCard(playerId, cardId);
        
        // Call the original onPlay callback for any additional UI updates (like closing modal)
        onPlay();
      } else {
        // Fallback: Get current player from state if not provided as props
        const gameState = stateService.getGameState();
        const currentPlayerId = gameState.currentPlayerId;
        
        if (!currentPlayerId) {
          throw new Error('No current player found');
        }
        
        if (!cardId) {
          throw new Error('No card ID provided');
        }
        
        await playerActionService.playCard(currentPlayerId, cardId);
        onPlay();
      }
      
    } catch (error) {
      // Display error to user with descriptive message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to play card: ${errorMessage}`);
      console.error('Card play error:', error);
    }
  };

  /**
   * Base button styles
   */
  const buttonBaseStyle: React.CSSProperties = {
    padding: theme.button.padding.lg,
    borderRadius: theme.button.borderRadius,
    border: 'none',
    fontWeight: 'bold',
    fontSize: theme.button.fontSize.sm,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    margin: `0 ${theme.spacing.sm}`
  };

  /**
   * Primary button style (Play Card)
   */
  const primaryButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: canPlay ? colors.primary.main : colors.secondary.main,
    color: colors.white,
    boxShadow: theme.shadows.sm
  };

  /**
   * Secondary button style (Close, Flip)
   */
  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: colors.secondary.main,
    color: colors.white,
    opacity: 0.8
  };

  /**
   * Flip button style
   */
  const flipButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: colors.success.main,
    color: colors.white,
    opacity: 0.9
  };

  /**
   * Handle button hover effects
   */
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const currentBg = button.style.backgroundColor;
    
    if (currentBg.includes('007bff')) {
      button.style.backgroundColor = colors.primary.dark;
    } else if (currentBg.includes('28a745')) {
      button.style.backgroundColor = colors.success.dark;
    } else if (currentBg.includes('6c757d')) {
      button.style.backgroundColor = colors.secondary.dark;
    }
    
    button.style.transform = 'translateY(-1px)';
    button.style.boxShadow = theme.shadows.md;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const currentBg = button.style.backgroundColor;

    if (currentBg.includes('0056b3')) {
      button.style.backgroundColor = canPlay ? colors.primary.main : colors.secondary.main;
    } else if (currentBg.includes('218838')) {
      button.style.backgroundColor = colors.success.main;
    } else if (currentBg.includes('545b62')) {
      button.style.backgroundColor = colors.secondary.main;
    }

    button.style.transform = 'translateY(0)';
    button.style.boxShadow = theme.shadows.sm;
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.modal.footer.padding,
      backgroundColor: colors.secondary.bg,
      borderTop: `1px solid ${colors.secondary.border}`,
      borderRadius: `0 0 ${theme.borderRadius.md} ${theme.borderRadius.md}`,
      gap: theme.modal.footer.gap
    }}>
      {/* Play Card button - only show when not flipped and card can be played */}
      {!isFlipped && (
        <button
          onClick={handlePlayCard}
          disabled={!canPlay}
          style={{
            ...primaryButtonStyle,
            cursor: canPlay ? 'pointer' : 'not-allowed'
          }}
          onMouseEnter={canPlay ? handleMouseEnter : undefined}
          onMouseLeave={canPlay ? handleMouseLeave : undefined}
          title={canPlay ? `Click to ${playButtonText.toLowerCase()}` : "This card cannot be played right now"}
        >
          🎴 {playButtonText}
        </button>
      )}

      {/* Flip Card button */}
      <button
        onClick={onFlip}
        style={flipButtonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={isFlipped ? "View card details" : "View card back"}
      >
        🔄 {isFlipped ? "View Front" : "View Back"}
      </button>

      {/* Close button */}
      <button
        onClick={onClose}
        style={secondaryButtonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title="Close this modal"
      >
        ✕ Close
      </button>
    </div>
  );
}