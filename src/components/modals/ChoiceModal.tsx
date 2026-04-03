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
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { CharacterBadge } from './shared/CharacterBadge';
import { getTtsText } from '../../utils/modalConfig';
import { NarrativeBlock } from './shared/NarrativeBlock';
import { debugLog } from '../../utils/debugLog';

export function ChoiceModal(): JSX.Element {
  const { stateService, choiceService, notificationService, dataService } = useGameContext();
  const [awaitingChoice, setAwaitingChoice] = useState<Choice | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('');
  const [currentSpace, setCurrentSpace] = useState<string>('');
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
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

  const { getPortraitForSpace } = useNpcPortrait();

  const isCardChoiceType = awaitingChoice?.type === 'CARD_REPLACEMENT' || awaitingChoice?.type === 'CARD_SELECTION' || awaitingChoice?.type === 'CARD_GIVE';

  // Data-driven TTS: use tts_field config from space content, fall back to prompt
  const choiceSpaceContent = currentSpace ? dataService.getSpaceContent(currentSpace, 'First') : undefined;
  const ttsText = getTtsText(choiceSpaceContent?.tts_field, choiceSpaceContent, awaitingChoice?.prompt);
  const speechControls = useModalSpeech(
    ttsText,
    currentSpace,
    !!awaitingChoice && awaitingChoice.type !== 'MOVEMENT' && !isCardChoiceType
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

  // Card choice types get their own modal (separate AnimatePresence lifecycle)
  if (awaitingChoice && isCardChoiceType) {
    const cardType = awaitingChoice.options[0]?.id?.charAt(0) as CardType || 'E';
    const mode = awaitingChoice.type === 'CARD_REPLACEMENT' ? 'replace'
      : awaitingChoice.type === 'CARD_SELECTION' ? 'return'
      : 'give';

    const gameState = stateService.getGameState();
    const player = gameState.players.find(p => p.id === awaitingChoice.playerId);

    const maxReplacements = (awaitingChoice.metadata?.replaceCount as number) || 1;
    const newCardType = awaitingChoice.type === 'CARD_REPLACEMENT'
      ? awaitingChoice.metadata?.newCardType as CardType | undefined
      : undefined;
    const targetPlayerName = awaitingChoice.metadata?.targetPlayerName as string | undefined;

    return (
      <CardReplacementModal
        isOpen={true}
        player={player || null}
        cardType={cardType}
        maxReplacements={maxReplacements}
        newCardType={newCardType}
        mode={mode}
        targetPlayerName={targetPlayerName}
        onReplace={(selectedCardIds, replacementType) => {
          if (selectedCardIds.length > 0) {
            debugLog(`🔄 Card ${mode}: Attempting with cards: ${selectedCardIds.join(', ')}`);
            selectedCardIds.forEach((cardId, index) => {
              if (index === 0) {
                handleChoiceClick(cardId);
              }
            });
          }
        }}
        onCancel={() => {
          // Skip the choice — resolve the promise with empty string so the
          // awaiting async function (CardEffectService) can complete and
          // the action button stops spinning.
          debugLog(`Card ${mode} skipped by player`);
          choiceService.skipChoice(awaitingChoice.id);
        }}
      />
    );
  }

  // Compute isOpen — always render ModalBase so AnimatePresence can play exit animations
  const isRegularChoice = !!awaitingChoice && awaitingChoice.type !== 'MOVEMENT' && !isCardChoiceType;

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
      isOpen={isRegularChoice}
      onClose={() => {}}
      title="Make Your Choice"
      emoji={theme.emoji.target}
      maxWidth="500px"
      testId="choice-modal"
      speechControls={speechControls}
    >
      {/* Character Badge */}
      {currentSpace && <CharacterBadge spaceName={currentSpace} portraitSrc={getPortraitForSpace(currentSpace)} />}

      {/* Per-action narrative (if available for the choice's source effect) */}
      {currentSpace && awaitingChoice?.metadata?.effectAction && (() => {
        const narrative = dataService.getEffectNarrative(
          currentSpace, 'First', awaitingChoice.metadata.effectAction as string
        );
        if (!narrative) return null;
        return <NarrativeBlock text={narrative} spaceName={currentSpace} portraitSrc={getPortraitForSpace(currentSpace)} />;
      })()}

      {/* Prompt */}
      {awaitingChoice && (
        <p style={{
          margin: '0 0 20px 0',
          color: colors.text.secondary,
          fontSize: '16px',
          textAlign: 'center',
        }}>
          <strong>{currentPlayerName}:</strong> {awaitingChoice.prompt}
        </p>
      )}

      {/* Choice Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {awaitingChoice?.options.map((option) => {
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
          {theme.emoji.info} Make your selection to continue.
        </p>
      </div>
    </ModalBase>
  );
}
