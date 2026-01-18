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

export function ChoiceModal(): JSX.Element {
  const { stateService, choiceService, notificationService } = useGameContext();
  const [awaitingChoice, setAwaitingChoice] = useState<Choice | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('');

  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setAwaitingChoice(gameState.awaitingChoice);

      if (gameState.awaitingChoice) {
        const player = gameState.players.find(p => p.id === gameState.awaitingChoice?.playerId);
        setCurrentPlayerName(player?.name || 'Unknown Player');
      }
    });

    const gameState = stateService.getGameState();
    setAwaitingChoice(gameState.awaitingChoice);
    if (gameState.awaitingChoice) {
      const player = gameState.players.find(p => p.id === gameState.awaitingChoice?.playerId);
      setCurrentPlayerName(player?.name || 'Unknown Player');
    }

    return unsubscribe;
  }, [stateService]);

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
          console.log('Card replacement skipped by user');
          choiceService.skipChoice(awaitingChoice.id);
          notificationService.notify(
            NotificationUtils.createSuccessNotification(
              'Card Action Complete',
              'E card replacement skipped - continuing with your turn',
              currentPlayerName
            ),
            {
              playerId: awaitingChoice.playerId,
              playerName: currentPlayerName,
              actionType: 'skip_card_replacement'
            }
          );
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
    >
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
