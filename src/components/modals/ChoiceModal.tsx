// src/components/modals/ChoiceModal.tsx

import React, { useState, useEffect } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { Choice } from '../../types/CommonTypes';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { CardReplacementModal } from './CardReplacementModal';
import { CardType } from '../../types/DataTypes';
import { Tooltip } from '../common/Tooltip';
import { getMovementChoiceTooltip } from '../../utils/buttonFormatting';
import { useModalSpeech } from '../../hooks/useModalSpeech';
import { CharacterBadge } from './shared/CharacterBadge';

export function ChoiceModal(): JSX.Element {
  const { stateService, choiceService, notificationService } = useGameContext();
  const [awaitingChoice, setAwaitingChoice] = useState<Choice | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('');
  const [currentSpace, setCurrentSpace] = useState<string>('');
  // Track whether the card replacement modal is temporarily hidden
  // The choice remains pending, but user can return to main panel
  const [isCardReplacementHidden, setIsCardReplacementHidden] = useState(false);

  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      // Reset hidden state when a new choice appears
      if (gameState.awaitingChoice?.id !== awaitingChoice?.id) {
        setIsCardReplacementHidden(false);
      }
      setAwaitingChoice(gameState.awaitingChoice);

      if (gameState.awaitingChoice) {
        const player = gameState.players.find(p => p.id === gameState.awaitingChoice?.playerId);
        setCurrentPlayerName(player?.name || 'Unknown Player');
        setCurrentSpace(player?.currentSpace || '');
      }
    });

    const gameState = stateService.getGameState();
    setAwaitingChoice(gameState.awaitingChoice);
    if (gameState.awaitingChoice) {
      const player = gameState.players.find(p => p.id === gameState.awaitingChoice?.playerId);
      setCurrentPlayerName(player?.name || 'Unknown Player');
      setCurrentSpace(player?.currentSpace || '');
    }

    return unsubscribe;
  }, [stateService, awaitingChoice?.id]);

  const speechControls = useModalSpeech(
    awaitingChoice?.prompt,
    currentSpace,
    !!awaitingChoice && awaitingChoice.type !== 'MOVEMENT' && awaitingChoice.type !== 'CARD_REPLACEMENT'
  );

  const handleChoiceClick = (selectedOptionId: string) => {
    if (!awaitingChoice) return;

    try {
      const selectedOption = awaitingChoice.options.find(opt => opt.id === selectedOptionId);
      const optionLabel = selectedOption?.label || selectedOptionId;

      notificationService.notify(
        NotificationUtils.createSuccessNotification(
          'Choice Made',
          `Selected: ${optionLabel}`,
          currentPlayerName
        ),
        {
          playerId: awaitingChoice.playerId,
          playerName: currentPlayerName,
          actionType: `choice_${awaitingChoice.id}`
        }
      );

      choiceService.resolveChoice(awaitingChoice.id, selectedOptionId);
    } catch (error) {
      console.error('Error resolving choice:', error);
    }
  };

  // Don't render if no choice is awaiting or if it's a MOVEMENT choice (handled by TurnControls)
  if (!awaitingChoice || awaitingChoice.type === 'MOVEMENT') {
    return <></>;
  }

  // Handle CARD_REPLACEMENT choice with dedicated modal
  if (awaitingChoice.type === 'CARD_REPLACEMENT') {
    // If user clicked "Return to Main Panel", show a floating indicator to return
    if (isCardReplacementHidden) {
      const cardType = awaitingChoice.options[0]?.id?.charAt(0) as CardType || 'E';
      return (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000
          }}
        >
          <button
            onClick={() => setIsCardReplacementHidden(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: colors.warning.main,
              color: colors.white,
              border: 'none',
              borderRadius: theme.borderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              animation: 'pulse 2s infinite'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.warning.dark || '#d97706';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.warning.main;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span>⚠️</span>
            <span>Complete Card Replacement ({cardType})</span>
          </button>
        </div>
      );
    }

    const gameState = stateService.getGameState();
    const player = gameState.players.find(p => p.id === awaitingChoice.playerId);

    const cardType = awaitingChoice.options[0]?.id?.charAt(0) as CardType || 'E';
    const maxReplacements = (awaitingChoice.metadata?.replaceCount as number) || 1;
    const newCardType = awaitingChoice.metadata?.newCardType as CardType | undefined;

    return (
      <CardReplacementModal
        isOpen={true}
        player={player || null}
        cardType={cardType}
        maxReplacements={maxReplacements}
        newCardType={newCardType}
        onReplace={(selectedCardIds, replacementType) => {
          if (selectedCardIds.length > 0) {
            console.log(`🔄 CardReplacement: Attempting to replace cards: ${selectedCardIds.join(', ')}`);
            selectedCardIds.forEach((cardId, index) => {
              if (index === 0) {
                handleChoiceClick(cardId);
              }
            });
          }
        }}
        onCancel={() => {
          // Hide the modal but keep the choice pending
          // Player can return to complete it via the pending action indicator
          console.log('Card replacement modal hidden - choice remains pending');
          setIsCardReplacementHidden(true);
        }}
      />
    );
  }

  // Get contextual help text based on choice type
  const getHelpText = () => {
    switch (awaitingChoice.type) {
      case 'CARD_SELECTION':
        return 'Select the card you want to use for this action.';
      case 'CARD_GIVE':
        return 'Choose which card to give to your opponent.';
      default:
        return 'Make your selection to continue.';
    }
  };

  const choiceButtonStyle: React.CSSProperties = {
    ...modalButtonStyles.primary,
    backgroundColor: colors.primary.main,
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <ModalBase
      isOpen={true}
      onClose={() => {}}
      title="Make Your Choice"
      emoji={theme.emoji.target}
      maxWidth="500px"
      testId="choice-modal"
      speechControls={speechControls}
    >
      {/* Character Badge */}
      {currentSpace && <CharacterBadge spaceName={currentSpace} />}

      {/* Prompt */}
      <p style={{
        margin: '0 0 20px 0',
        color: colors.text.secondary,
        fontSize: '16px',
        textAlign: 'center',
      }}>
        <strong>{currentPlayerName}:</strong> {awaitingChoice.prompt}
      </p>

      {/* Choice Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {awaitingChoice.options.map((option) => {
          const choiceTooltip = awaitingChoice.type === 'MOVEMENT'
            ? getMovementChoiceTooltip(option.id)
            : { tooltip: option.label, context: '' };

          return (
            <Tooltip key={option.id} content={choiceTooltip.tooltip} context={choiceTooltip.context} position="right">
              <button
                onClick={() => handleChoiceClick(option.id)}
                style={choiceButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary.dark;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary.main;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {option.label}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Help Text */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: colors.secondary.bg,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${colors.secondary.border}`
      }}>
        <p style={{
          margin: '0',
          fontSize: '14px',
          color: colors.secondary.main,
          textAlign: 'center'
        }}>
          {theme.emoji.info} {getHelpText()}
        </p>
      </div>
    </ModalBase>
  );
}
