// src/components/modals/DiceResultModal.tsx

import React, { useState } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { PlayerCardDetailV2 } from '../player/PlayerCardDetailV2';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';
import { colors, theme } from '../../styles/theme';
import { FormatUtils } from '../../utils/FormatUtils';
import { DiceResultEffect, TurnEffectResult } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';
import { useModalSpeech } from '../../hooks/useModalSpeech';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { CharacterBadge } from './shared/CharacterBadge';
import { shouldShake, getTtsText } from '../../utils/modalConfig';
import { NarrativeBlock } from './shared/NarrativeBlock';
import { BeforeAfterBlock } from './shared/BeforeAfterBlock';
import { OutcomeChangesV2 } from '../player/OutcomeChangesV2';
import { getStoredPanelVersion, getStoredPanelMode } from '../player/panelTheme';
import { interpolateTemplate } from '../../utils/templateInterpolation';
import { getCardTypeName } from '../../utils/cardTypeNames';

// Re-export for convenience
export type DiceRollResult = TurnEffectResult;

interface DiceResultModalProps {
  isOpen: boolean;
  result: DiceRollResult | null;
  onClose: () => void;
  onConfirm?: () => void;
  /** Fires when the exit animation fully finishes — see ModalBase (fb:ac29b623). */
  onExitComplete?: () => void;
}

/**
 * DiceResultModal displays detailed feedback about dice roll effects
 * Shows the dice value, applied effects, and summarizes the outcome
 */
export function DiceResultModal({ isOpen, result, onClose, onConfirm, onExitComplete }: DiceResultModalProps): JSX.Element | null {
  const gameServices = useGameContext();
  const { dataService } = gameServices;
  const { getPortraitForSpace } = useNpcPortrait();

  // Tap a drawn/affected card to open its detail. It opens for REFERENCE, and
  // surfaces Activate only when the shared canPlayCard rule allows (budget +
  // phase) — so at the setup space (no budget yet, E cards out of phase) it's
  // effectively info-only, but at later spaces a just-hired expeditor can be
  // used right away. That mirrors real life: the moment you hire a rep you can
  // put them to work, and once used the cost is committed even if you later
  // renegotiate (playCard records the consumed card in the turn ledger, so Try
  // Again won't refund it). fb:0c523a17 / fb:b413cc2e.
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const currentPlayerId = gameServices.stateService.getGameState().currentPlayerId;

  // The outcome modal is SHARED between classic + new panels. In the new view we
  // render the "My numbers"-styled OutcomeChangesV2 (before→after that reads like
  // the ledger + names the exact card gained/lost); classic keeps the untouched
  // BeforeAfterBlock. Read the flags once at render — this modal is short-lived.
  const isNewView = getStoredPanelVersion() === 'new';
  const panelMode = getStoredPanelMode();

  // Look up space content early (needed for data-driven shake/TTS config)
  const spaceContent = result?.spaceName
    ? dataService.getSpaceContent(result.spaceName, 'First')
    : undefined;

  const speechControls = useModalSpeech(
    getTtsText(spaceContent?.tts_field, spaceContent, result?.summary),
    result?.spaceName,
    isOpen && !!result
  );

  // When result is unavailable, render a closed ModalBase so AnimatePresence
  // can play the exit animation (same component instance via React reconciliation).
  if (!result || !Array.isArray(result.effects)) {
    if (result && !Array.isArray(result.effects)) {
      console.error('DiceResultModal: result.effects is not a valid array', result);
    }
    return (
      <ModalBase isOpen={false} onClose={onClose} onExitComplete={onExitComplete} title="" emoji="" testId="dice-result-modal">
        {null}
      </ModalBase>
    );
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const getEffectIcon = (effectType: string, outcomeKind?: 'quality' | 'multiplier'): string => {
    switch (effectType) {
      case 'money': return theme.emoji.money;
      case 'time': return theme.emoji.time;
      case 'cards': return theme.emoji.cards;
      case 'movement': return theme.emoji.movement;
      case 'choice': return theme.emoji.target;
      case 'qualitative_outcome': return outcomeKind === 'multiplier' ? '💲' : '🏗️';
      default: return theme.emoji.effects;
    }
  };

  const getEffectColor = (effectType: string): string => {
    switch (effectType) {
      case 'money': return colors.success.main;
      case 'time': return colors.game.orange;
      case 'cards': return colors.purple.main;
      case 'movement': return colors.primary.main;
      case 'choice': return colors.warning.main;
      case 'qualitative_outcome': return colors.primary.main;
      default: return colors.secondary.main;
    }
  };

  // Visit-indicator part 2 (2026-05-29, fb:0cdd59ba) — "results 2x once
  // in red and once in green". Root cause: each money/time/card-count
  // effect renders a bold colored value AND the same delta appears in the
  // BeforeAfterBlock table below. Two visual representations of one fact.
  // When the snapshot is present (so BeforeAfterBlock will render), the
  // Effects row drops the bold colored value and shows only the icon +
  // description + any card-identity chips. The numeric delta lives in one
  // place (the table). Without snapshots (legacy / partial results), keep
  // the old behavior so nothing is silently dropped.
  const hasSnapshot = !!(result.before && result.after);

  const renderEffect = (effect: DiceResultEffect, index: number) => {
    // Suppress 'choice' effects ("🎯 Choose your next destination"). The
    // destination picker is already prominent in the player panel below
    // the modal, and the modal copy should stay focused on what just
    // happened (the card draw / money / time), not on what's next.
    // Playtest 2026-05-15: feedback-1778872922892-6ec5c01f — "why does it
    // talk about next destination? it should be all about work not place?"
    if (effect.type === 'choice') return null;
    const icon = getEffectIcon(effect.type, effect.outcomeKind);
    let effectColor = getEffectColor(effect.type);

    // Use warning color for card removals
    if (effect.type === 'cards' && effect.cardAction === 'remove') {
      effectColor = colors.warning.main;
    }

    // Whether this effect's numeric delta is already covered by the
    // BeforeAfterBlock table — i.e. money / time / card count. Movement,
    // qualitative_outcome, etc. are NOT in the table and always show their
    // formatted value here.
    const isDuplicatedByTable = hasSnapshot && (
      effect.type === 'money'
      || effect.type === 'time'
      || (effect.type === 'cards' && (effect.cardAction === 'draw' || effect.cardAction === 'remove' || effect.cardAction === 'replace'))
    );

    let formattedValue = '';
    if (effect.type === 'qualitative_outcome' && effect.outcomeLabel && effect.outcomeValue) {
      // "Quality: HIGH" / "Multiplier: 3×" — the value reads as the headline,
      // the description (set in DiceRollProcessor) carries the explanation.
      formattedValue = `${effect.outcomeLabel}: ${effect.outcomeValue}`;
    } else if (effect.type === 'money' && effect.value !== undefined) {
      const formatted = FormatUtils.formatResourceChange(effect.value, 'money');
      formattedValue = formatted.text;
    } else if (effect.type === 'time' && effect.value !== undefined) {
      const formatted = FormatUtils.formatResourceChange(effect.value, 'time');
      formattedValue = formatted.text;
    } else if (effect.type === 'cards' && effect.cardCount && effect.cardType) {
      const friendlyName = getCardTypeName(effect.cardType, effect.cardCount);
      const action = effect.cardAction || 'draw';
      if (action === 'draw') {
        formattedValue = `+${effect.cardCount} ${friendlyName}`;
      } else if (action === 'remove') {
        formattedValue = `-${effect.cardCount} ${friendlyName}`;
      } else if (action === 'replace') {
        formattedValue = `↔ ${effect.cardCount} ${friendlyName}`;
      }
    }

    // Get card details if card IDs are available
    let cardDetails: Array<{ id: string; name: string; type: string }> = [];
    if (effect.type === 'cards' && effect.cardIds && effect.cardIds.length > 0) {
      cardDetails = effect.cardIds.map(cardId => {
        const card = dataService.getCardById(cardId);
        return {
          id: cardId,
          name: card ? card.card_name : cardId,
          type: card ? card.card_type : ''
        };
      });
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: '8px',
          paddingLeft: '8px'
        }}
      >
        <span style={{ fontSize: '18px', marginRight: '10px', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          {/* Suppress the bold colored value when the BeforeAfterBlock table
              below will show the same delta — see hasSnapshot/isDuplicatedByTable
              comment above. Movement and qualitative_outcome still surface their
              value here because the table doesn't cover them. */}
          {!isDuplicatedByTable && formattedValue && (
            <span style={{ fontWeight: 'bold', color: effectColor }}>
              {formattedValue}
            </span>
          )}
          <span style={{
            color: colors.text.secondary,
            fontSize: '14px',
            marginLeft: !isDuplicatedByTable && formattedValue ? '6px' : '0',
          }}>
            {effect.description}
          </span>
          {/* Display each card on its own line with type icon and colors */}
          {cardDetails.length > 0 && (
            <div style={{ marginTop: '6px', marginLeft: '4px' }}>
              {cardDetails.map((card, cardIndex) => {
                const cardColors = getCardTypeColors(card.type);
                return (
                  <button
                    key={cardIndex}
                    onClick={() => setDetailCardId(card.id)}
                    aria-label={`Details for ${card.name}`}
                    title="Tap to see details"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      marginBottom: '4px',
                      backgroundColor: cardColors.bg,
                      borderRadius: theme.borderRadius.sm,
                      border: `1px solid ${cardColors.border}`,
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{getCardTypeEmoji(card.type)}</span>
                    <span style={{ fontStyle: 'italic', color: cardColors.text, fontSize: '13px', flex: 1 }}>
                      {card.name}
                    </span>
                    <span aria-hidden style={{ color: cardColors.text, opacity: 0.5, fontSize: '13px' }}>ⓘ</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Determine title and emoji based on dice value
  const isDiceRoll = result.diceValue > 0;
  const narrativeTitle = spaceContent?.title || '';
  // Modal config from first effect (set by TurnService from SPACE_EFFECTS data)
  const firstEffectModalConfig = result.effects[0]?.modalConfig;

  // Phase 4: Per-dice-value modal config override (dice-specific wins over generic)
  const diceModalConfig = result.spaceName
    ? dataService.getModalConfig(
        result.spaceName,
        'First',
        'dice',
        isDiceRoll ? result.diceValue : undefined
      )
    : undefined;
  const templateContext = {
    diceValue: result.diceValue,
    spaceName: result.spaceName || '',
    count: result.diceValue,
  };
  const overrideTitle = diceModalConfig?.modal_title
    ? interpolateTemplate(diceModalConfig.modal_title, templateContext)
    : undefined;
  const overrideSummary = diceModalConfig?.modal_description
    ? interpolateTemplate(diceModalConfig.modal_description, templateContext)
    : undefined;
  const overrideButtonLabel = diceModalConfig?.modal_button_label
    ? interpolateTemplate(diceModalConfig.modal_button_label, templateContext)
    : undefined;
  const overrideFooterSummary = diceModalConfig?.modal_summary
    ? interpolateTemplate(diceModalConfig.modal_summary, templateContext)
    : undefined;

  // Voice rule (no game language): never title or icon the modal with the raw
  // die number / a dice face — it's an outcome, so fall back to a neutral title
  // and the "what happened" icon.
  const title = overrideTitle
    || firstEffectModalConfig?.title
    || narrativeTitle
    || (isDiceRoll ? 'Outcome' : 'Action Result');
  const headerEmoji = theme.emoji.effects;
  const customButtonLabel = overrideButtonLabel || firstEffectModalConfig?.buttonLabel;
  // Visual Summary block prefers the narrative-only `visualSummary` (NPC story
  // prose) over the full assembled `summary` (which includes auto-generated
  // tone + per-effect recap). The recap duplicates the Effects Applied list
  // and the Before/After block, so the visual stays focused on story flavor.
  // TTS / accessibility still reads `summary` via getTtsText below.
  // Playtest 2026-05-15: "lots of repetition in the wording".
  const summaryText = overrideSummary || result.visualSummary || result.summary;

  // Data-driven shake: uses shake_on config from space content
  const hasNegativeEffect = shouldShake(spaceContent?.shake_on, { effects: result.effects });

  // 'choice' effects are suppressed in renderEffect (the destination picker
  // lives in the player panel, not the modal — fb:6ec5c01f). So count only the
  // DISPLAYABLE effects when deciding whether to show the "Effects Applied:"
  // header — otherwise a routing-only roll renders the header above an empty
  // body, which a playtester read as "says effect applied but no effect was
  // applied" (fb:31e5c4b8). When nothing displayable applied but the roll DID
  // determine a routing choice, we report that instead of a bare header.
  const displayableEffects = result.effects.filter(e => e.type !== 'choice');
  const hasPendingChoice = result.effects.some(e => e.type === 'choice');

  const footer = (
    <>
      {result.hasChoices && onConfirm ? (
        <>
          <button
            style={modalButtonStyles.secondary}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.bg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.light;
            }}
          >
            Review
          </button>
          <button
            style={modalButtonStyles.primary}
            onClick={handleConfirm}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            autoFocus
          >
            {customButtonLabel || 'Make Choice'}
          </button>
        </>
      ) : (
        <button
          style={modalButtonStyles.primary}
          onClick={handleConfirm}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          autoFocus
        >
          {customButtonLabel || 'Continue'}
        </button>
      )}
    </>
  );

  return (
    <>
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      onExitComplete={onExitComplete}
      title={title}
      emoji={headerEmoji}
      maxWidth="500px"
      footer={footer}
      testId="dice-result-modal"
      shake={hasNegativeEffect}
      speechControls={speechControls}
    >
      {/* Voice rule (no game language): the old "🎲 Result: N" subtitle surfaced
          the raw die number — removed. The outcome is told by the Summary +
          effects below, never by the die value. */}

      {/* Character Badge */}
      {result.spaceName && <CharacterBadge spaceName={result.spaceName} portraitSrc={getPortraitForSpace(result.spaceName)} />}

      {/* Per-action narrative (from SPACE_EFFECTS narrative column) */}
      {(() => {
        if (!result.spaceName) return null;
        // Find the first card effect's narrative for this dice result
        const cardEffect = result.effects.find(e => e.type === 'cards' && e.cardType);
        if (!cardEffect?.cardType) return null;
        const narrative = dataService.getEffectNarrative(
          result.spaceName, 'First', `draw_${cardEffect.cardType}`
        );
        if (!narrative) return null;
        return <NarrativeBlock text={narrative} spaceName={result.spaceName} portraitSrc={getPortraitForSpace(result.spaceName)} />;
      })()}

      {/* Summary */}
      {summaryText && (
        <div style={{
          backgroundColor: colors.primary.light,
          border: `2px solid ${colors.primary.main}`,
          borderRadius: theme.borderRadius.md,
          padding: '12px 14px',
          marginBottom: '16px'
        }}>
          <h4 style={{
            fontSize: '15px',
            fontWeight: 'bold',
            color: colors.primary.text,
            margin: 0,
            marginBottom: '4px'
          }}>
            {theme.emoji.info} Summary:
          </h4>
          <p style={{
            margin: 0,
            color: colors.primary.text,
            fontSize: '14px'
          }}>
            {summaryText}
          </p>
        </div>
      )}

      {/* Effects — gated on displayableEffects (see comment above) so a
          routing-only roll never shows the header with an empty body. */}
      {displayableEffects.length > 0 ? (
        <>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: colors.text.primary,
            marginTop: 0,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            {theme.emoji.effects} What happened:
          </h3>

          {displayableEffects.map((effect, index) => renderEffect(effect, index))}
        </>
      ) : hasPendingChoice ? (
        // Nothing changed on the books, but the outcome decided which paths are
        // open — say that in plain real-world language (NOT "you rolled a N":
        // the dice are a game mechanic, and the player asked what was DETERMINED,
        // not the number). The actual narrative outcome lives in the Summary
        // above; the destinations live in the panel picker (fb:6ec5c01f).
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: '15px',
          padding: '16px'
        }}>
          {isDiceRoll
            ? 'Based on how that turned out, choose your next step below.'
            : 'Choose your next step below.'}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: '16px',
          padding: '20px'
        }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>😐</span>
          Nothing changed this time
        </div>
      )}

      {/* Before / after snapshot — the exact resource deltas (money, scope,
       * time, hand) so playtesters don't dismiss the modal and hunt through
       * tabs. New view: the "My numbers"-styled OutcomeChangesV2 that also names
       * the specific card gained/lost (fb:dc7652ec / 0001f5df / 0fc63fc1 /
       * 3aad5f84). Classic: the original block, untouched. Both render nothing
       * if no field changed. */}
      {isNewView ? (
        <OutcomeChangesV2
          before={result.before}
          after={result.after}
          effects={result.effects}
          mode={panelMode}
          resolveCard={(id) => {
            const c = dataService.getCardById(id);
            return c ? { name: c.card_name, type: c.card_type } : null;
          }}
        />
      ) : (
        <BeforeAfterBlock before={result.before} after={result.after} effects={result.effects} />
      )}

      {/* Phase 4: Optional footer summary from ModalConfig.modal_summary */}
      {overrideFooterSummary && (
        <div style={{
          marginTop: '16px',
          padding: '10px 12px',
          backgroundColor: colors.secondary.light,
          borderRadius: theme.borderRadius.sm,
          color: colors.text.primary,
          fontSize: '14px',
          fontStyle: 'italic'
        }}>
          {overrideFooterSummary}
        </div>
      )}
    </ModalBase>

    {/* Tap-through card detail — opened from a drawn/affected card row above.
        Sibling of the result ModalBase so it paints on top (same z-index, later
        in DOM) with its own independent backdrop-grace. Reference by default;
        Activate self-gates on budget + phase via the shared canPlayCard rule. */}
    <PlayerCardDetailV2
      isOpen={detailCardId !== null}
      onClose={() => setDetailCardId(null)}
      card={detailCardId ? dataService.getCardById(detailCardId) ?? null : null}
      playerId={currentPlayerId || ''}
      gameServices={gameServices}
    />
    </>
  );
}
