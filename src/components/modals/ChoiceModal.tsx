// src/components/modals/ChoiceModal.tsx

import React, { useState, useEffect } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { theme } from '../../styles/theme';
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
import { getStoredPanelMode, panelPalettes } from '../player/panelTheme';

export interface ChoiceModalProps {
  // v3.0.17 — set in TV-mode-with-phones (each phone passes its player ID).
  // When set AND the awaiting choice targets a different player, this view
  // suppresses the interactive modal and shows a brief "Waiting for X to
  // choose" status banner instead — so only the targeted player's device
  // can resolve the choice. PC mode + TV host leave this undefined and see
  // the modal as before. See isCardChoiceOnSharedViewWithOwnDevice below
  // for the separate gate that keeps THIS (viewerId-undefined) view from
  // leaking a private card-hand choice when the acting player has their
  // own phone (fb:44751a06).
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

  // Light/dark shell, mirroring DiceResultModal (fb:feedback-1783924131895-ffec84f4).
  // ChoiceModal is mounted in GameLayout as a sibling of PlayerPanelWrapper (the
  // component that owns the `usePanelMode` hook + toggle button), not inside its
  // tree, so it can't consume that hook directly. It reads the same persisted
  // flag PlayerPanelWrapper writes to localStorage instead — same non-hook
  // reader DiceResultModal already uses for the same reason.
  const panelMode = getStoredPanelMode();
  const p = panelPalettes[panelMode];

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

      // v3.0.19 — surface choice-resolution failures visibly. resolveChoice
      // returns false when it can't reconcile the click (no pending promise,
      // id mismatch, invalid selection). Previously these failures went to
      // console.error only, so on a phone with no DevTools they manifested
      // as "pressing yes/no did nothing" (fb:068a66f2). Now: if the click
      // didn't resolve, raise an error notification with the choice id +
      // type so the next reproducer can tell us exactly which check failed.
      const resolved = choiceService.resolveChoice(awaitingChoice.id, selectedOptionId);
      if (resolved === false) {
        notificationService.notify(
          NotificationUtils.createErrorNotification(
            'Choice did not register',
            `Selection: ${optionLabel} — choiceId=${awaitingChoice.id} type=${awaitingChoice.type}. Check console for details.`,
            currentPlayerName
          ),
          {
            playerId: awaitingChoice.playerId,
            playerName: currentPlayerName,
            actionType: `choice_resolve_fail_${awaitingChoice.id}`,
            notificationDuration: 8000,
          }
        );
      }
    } catch (error) {
      console.error('Error resolving choice:', error);
      notificationService.notify(
        NotificationUtils.createErrorNotification(
          'Choice threw an error',
          `Selection: ${selectedOptionId} — ${error instanceof Error ? error.message : String(error)}`,
          currentPlayerName
        ),
        {
          playerId: awaitingChoice.playerId,
          playerName: currentPlayerName,
          actionType: `choice_resolve_throw_${awaitingChoice.id}`,
          notificationDuration: 8000,
        }
      );
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

  // fb:44751a06 — card-choice types (CARD_REPLACEMENT/CARD_SELECTION/
  // CARD_GIVE) show the acting player's exact hand contents, which is
  // private information. isOtherPlayerChoice above only protects OTHER
  // phones from a choice that isn't theirs — it never fires on a shared/
  // host view (viewerId undefined: a separate PC browser tab acting as the
  // group's shared board, or the TV host route), so that view kept showing
  // the private card picker for whoever's turn it was, even when that
  // player had their own phone open to the same choice. Suppress it there
  // — but ONLY when the acting player has an independent device to answer
  // on instead (deviceType 'mobile', set once they connect via their own
  // ?p= link). Pass-and-play players with no separate device (deviceType
  // undefined or 'desktop') have no other screen to use, so this shared
  // view must keep showing it for them or that mode becomes unplayable.
  const awaitingPlayer = awaitingChoice
    ? stateService.getGameState().players.find(p => p.id === awaitingChoice.playerId)
    : undefined;
  const isCardChoiceOnSharedViewWithOwnDevice =
    isCardChoiceType && !viewerId && awaitingPlayer?.deviceType === 'mobile';

  // Card choice types get their own modal (separate AnimatePresence lifecycle)
  if (awaitingChoice && isCardChoiceType && !isOtherPlayerChoice && !isCardChoiceOnSharedViewWithOwnDevice) {
    const cardType = awaitingChoice.options[0]?.id?.charAt(0) as CardType || 'E';
    const mode = awaitingChoice.type === 'CARD_REPLACEMENT' ? 'replace'
      : awaitingChoice.type === 'CARD_SELECTION' ? 'return'
      : 'give';

    const maxReplacements = (awaitingChoice.metadata?.replaceCount as number) || 1;
    const newCardType = awaitingChoice.type === 'CARD_REPLACEMENT'
      ? awaitingChoice.metadata?.newCardType as CardType | undefined
      : undefined;
    const targetPlayerName = awaitingChoice.metadata?.targetPlayerName as string | undefined;

    return (
      <CardReplacementModal
        isOpen={true}
        player={awaitingPlayer || null}
        cardType={cardType}
        maxReplacements={maxReplacements}
        newCardType={newCardType}
        mode={mode}
        targetPlayerName={targetPlayerName}
        onReplace={(selectedCardIds, _replacementType) => {
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

  // Button background follows the panel accent (mirrors DiceResultModal's
  // primaryBtnStyle) instead of the shared, mode-fixed modalButtonStyles —
  // those stay light-only, which would leave a stray light button sitting in
  // a dark-mode body. Hover swaps to opacity (not a hardcoded darker blue) so
  // it stays correct in both modes without a second dark-mode color.
  const choiceButtonStyle: React.CSSProperties = {
    ...modalButtonStyles.primary,
    backgroundColor: p.accent,
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
      mode={panelMode}
    >
      {/* Character Badge */}
      {currentSpace && <CharacterBadge spaceName={currentSpace} portraitSrc={getPortraitForSpace(currentSpace)} mode={panelMode} />}

      {/* Per-action narrative (if available for the choice's source effect) */}
      {currentSpace && awaitingChoice?.metadata?.effectAction && (() => {
        const narrative = dataService.getEffectNarrative(
          currentSpace, currentVisitType, awaitingChoice.metadata.effectAction as string
        );
        if (!narrative) return null;
        return <NarrativeBlock text={narrative} spaceName={currentSpace} portraitSrc={getPortraitForSpace(currentSpace)} mode={panelMode} />;
      })()}

      {/* Prompt */}
      {awaitingChoice && (
        <p style={{
          margin: '0 0 20px 0',
          color: p.muted,
          fontSize: '16px',
          textAlign: 'center',
        }}>
          <strong style={{ color: p.text }}>{currentPlayerName}:</strong> {awaitingChoice.prompt}
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
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
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
        backgroundColor: p.surf,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${p.border}`
      }}>
        <p style={{
          margin: '0',
          fontSize: '14px',
          color: p.muted,
          textAlign: 'center'
        }}>
          {theme.emoji.info} {customDescription || logicDescription || 'Make your selection to continue.'}
        </p>
      </div>
    </ModalBase>
  );
}
