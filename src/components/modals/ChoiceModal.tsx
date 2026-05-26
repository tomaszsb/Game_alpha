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
import { interpolateTemplate } from '../../utils/templateInterpolation';
import { VisitType } from '../../types/DataTypes';

export interface ChoiceModalProps {
  // v3.0.17 — set in TV-mode-with-phones (each phone passes its player ID).
  // When set AND the awaiting choice targets a different player, this view
  // suppresses the interactive modal and shows a brief "Waiting for X to
  // choose" status banner instead — so only the targeted player's device
  // can resolve the choice. PC mode + TV host leave this undefined and see
  // the modal as before.
  viewerId?: string;
}

export function ChoiceModal({ viewerId }: ChoiceModalProps = {}): JSX.Element {
  const { stateService, choiceService, notificationService, dataService } = useGameContext();
  const [awaitingChoice, setAwaitingChoice] = useState<Choice | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('');
  const [currentSpace, setCurrentSpace] = useState<string>('');
  const [currentVisitType, setCurrentVisitType] = useState<VisitType>('First');
  useEffect(() => {
    const syncFromState = (player: { name?: string; currentSpace?: string; visitType?: VisitType } | undefined) => {
      setCurrentPlayerName(player?.name || 'Unknown Player');
      setCurrentSpace(player?.currentSpace || '');
      setCurrentVisitType(player?.visitType || 'First');
    };

    const unsubscribe = stateService.subscribe((gameState) => {
      setAwaitingChoice(gameState.awaitingChoice);

      if (gameState.awaitingChoice) {
        const player = gameState.players.find(p => p.id === gameState.awaitingChoice?.playerId);
        syncFromState(player);
      }
    });

    const gameState = stateService.getGameState();
    setAwaitingChoice(gameState.awaitingChoice);
    if (gameState.awaitingChoice) {
      const player = gameState.players.find(p => p.id === gameState.awaitingChoice?.playerId);
      syncFromState(player);
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

  // v3.0.17 — viewer gate for L003/L048 global-discard fan-out. When this
  // device's view is anchored to a specific player (TV-mode-with-phones,
  // viewerId set) and the awaiting choice targets a DIFFERENT player, hide
  // the interactive modal so only the targeted player's device can resolve.
  // PC mode and the TV host view leave viewerId undefined and continue to
  // see the modal as before.
  const isOtherPlayerChoice =
    !!viewerId && !!awaitingChoice && awaitingChoice.playerId !== viewerId;

  // Card choice types get their own modal (separate AnimatePresence lifecycle)
  if (awaitingChoice && isCardChoiceType && !isOtherPlayerChoice) {
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

  // Compute isOpen — always render ModalBase so AnimatePresence can play exit animations.
  // isOtherPlayerChoice (v3.0.17) closes the modal on non-target views so a
  // L003/L048 fan-out only prompts the player whose hand is being touched.
  const isRegularChoice = !!awaitingChoice && awaitingChoice.type !== 'MOVEMENT' && !isCardChoiceType && !isOtherPlayerChoice;

  // Per-space ModalConfig overrides for the choice action. Keyed by
  // `${spaceName}|${visitType}|choice` in ModalConfig.csv. When a row exists,
  // its fields override the hardcoded title / help text / button labels.
  const choiceModalConfig = currentSpace
    ? dataService.getModalConfig(currentSpace, currentVisitType, 'choice')
    : undefined;

  const templateContext: Record<string, string | number | undefined> = {
    spaceName: currentSpace,
    playerName: currentPlayerName,
  };
  const customTitle = choiceModalConfig?.modal_title
    ? interpolateTemplate(choiceModalConfig.modal_title, templateContext)
    : undefined;
  const customDescription = choiceModalConfig?.modal_description
    ? interpolateTemplate(choiceModalConfig.modal_description, templateContext)
    : undefined;
  const customButtonLabel = choiceModalConfig?.modal_button_label
    ? interpolateTemplate(choiceModalConfig.modal_button_label, templateContext)
    : undefined;

  // LOGIC_QUESTION type: show step progress in the title and domain-appropriate
  // help text. Falls through to the generic choice flow for the two yes/no
  // option buttons, which are already rendered below.
  const isLogicQuestion = awaitingChoice?.type === 'LOGIC_QUESTION';
  const logicStepIndex = awaitingChoice?.metadata?.logicStepIndex as number | undefined;
  const logicStepTotal = awaitingChoice?.metadata?.logicStepTotal as number | undefined;
  const logicTitle = isLogicQuestion && logicStepIndex && logicStepTotal
    ? `Question ${logicStepIndex} of ${logicStepTotal}`
    : undefined;
  const logicDescription = isLogicQuestion
    ? 'The clerk needs an answer before routing your application.'
    : undefined;

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
      title={customTitle || logicTitle || 'Make Your Choice'}
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
          currentSpace, currentVisitType, awaitingChoice.metadata.effectAction as string
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
        {awaitingChoice?.options.map((option, index) => {
          const choiceTooltip = awaitingChoice.type === 'MOVEMENT'
            ? getMovementChoiceTooltip(option.id)
            : { tooltip: option.label, context: '' };
          // Only the first button honors a custom button label — later options
          // keep their server-provided labels so each choice stays distinct.
          const buttonLabel = index === 0 && customButtonLabel ? customButtonLabel : option.label;

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
                {buttonLabel}
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
          {theme.emoji.info} {customDescription || logicDescription || 'Make your selection to continue.'}
        </p>
      </div>
    </ModalBase>
  );
}
