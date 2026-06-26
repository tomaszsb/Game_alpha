// PlayerPanelV2 — the redesigned player panel (see docs/design/player-panel-redesign.md).
//
// Increment 2: playable. Renders the locked 5-zone layout from REAL player +
// space data AND wires the real turn actions — manual effects, movement choice,
// dice, end turn, and negotiate (Try Again). It deliberately REUSES the same
// service handlers and the `gameRulesService.canEndTurn` RULE that the classic
// panel uses (no re-derivation — the codebase has been burned by parallel-systems
// drift on exactly this logic). The action *list* is recomputed from the same
// data via the shared helpers (buttonFormatting / pendingActionsCollapse).
//
// Behind the classic/new toggle (off by default). Optional E-card play and the
// detailed-card/modal restyle are later increments.

import React, { useEffect, useRef, useState } from 'react';
import { ActionCenterPanelProps } from './ActionCenterPanel';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';
import { PanelMode, panelPalettes } from './panelTheme';
import { shortName } from '../../utils/boardCommon';
import { colors } from '../../styles/theme';
import { formatManualEffectButton } from '../../utils/buttonFormatting';
import { collapsePairedDiceActions, shouldShowMovementDiceButton } from './pendingActionsCollapse';
import { PlayerCardDetailV2 } from './PlayerCardDetailV2';
import { PlayerNumbersV2 } from './PlayerNumbersV2';
import { PlayerChronicleV2 } from './PlayerChronicleV2';
import { ModalBase } from '../modals/shared/ModalBase';
import { getCardTypeName } from '../../utils/cardTypeNames';

export interface PlayerPanelV2Props extends ActionCenterPanelProps {
  mode: PanelMode;
}

type ApprovalView = { label: string; dot: string; mark: string };

function approvalView(status: string | undefined): ApprovalView | null {
  if (!status || status === 'none') return null; // only when relevant
  switch (status) {
    case 'approved':
      return { label: 'approved', dot: '#22c55e', mark: '✓' };
    case 'minor-objection':
      return { label: 'objection', dot: '#f59e0b', mark: '!' };
    case 'denied':
      return { label: 'denied', dot: '#ef4444', mark: '✗' };
    default:
      return { label: status, dot: '#94a3b8', mark: '·' };
  }
}

export const PlayerPanelV2: React.FC<PlayerPanelV2Props> = ({
  gameServices,
  playerId,
  mode,
  onTryAgain,
  onRollDice,
  onManualEffectResult,
  completedActions = { manualActions: {} },
}) => {
  const p = panelPalettes[mode];
  const { openWithTerm } = useDictionaryPanel();
  const [, force] = useState(0);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  // When a count chip with several cards is tapped, list them so the player can
  // pick which one to view (a "×3" tag can't open three different cards).
  const [listType, setListType] = useState<string | null>(null);
  // Between-turns "you moved" moment (fb:15499d9b) — re-adds the classic panel's
  // movement overlay to the new panel, which had dropped it. Track the player's
  // space across renders; when it changes, briefly show where they came from.
  const prevSpaceRef = useRef<string | null>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  // "Recall my numbers" reference (fb:f028e262, fb:cea108fb) — openable any time.
  const [showNumbers, setShowNumbers] = useState(false);
  // "What's happened" history (Pile 3 Chronicle, first slice).
  const [showChronicle, setShowChronicle] = useState(false);
  const currentSpaceForPopup = gameServices.stateService.getPlayer(playerId)?.currentSpace ?? null;

  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe(() => force((n) => n + 1));
    return () => unsubscribe();
  }, [gameServices.stateService]);

  useEffect(() => {
    const prev = prevSpaceRef.current;
    prevSpaceRef.current = currentSpaceForPopup;
    // Skip the first resolve (prev null) so a freshly-loaded game doesn't flash
    // the overlay. Auto-dismiss after 5s; tappable to dismiss sooner.
    if (prev && currentSpaceForPopup && prev !== currentSpaceForPopup) {
      setMoveFrom(prev);
      const t = setTimeout(() => setMoveFrom(null), 5000);
      return () => clearTimeout(t);
    }
  }, [currentSpaceForPopup]);

  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  const gameState = gameServices.stateService.getGameState();
  const isMyTurn = gameState.currentPlayerId === playerId;
  const currentPlayerName = gameState.players.find((pl) => pl.id === gameState.currentPlayerId)?.name || '';

  const content = gameServices.dataService.getSpaceContent(player.currentSpace, player.visitType);
  const config = gameServices.dataService.getGameConfigBySpace(player.currentSpace);
  const spaceLabel = config?.display_label_override || (content && content.title) || shortName(player.currentSpace);
  const phaseLabel = config?.phase || '';

  const dob = approvalView(player.dobApprovalStatus);
  const fdny = approvalView(player.fdnyApprovalStatus);

  // Card counts by player-facing type, with a representative card id per type so
  // each chip can be tapped to open its details (user call 2026-06-23).
  const counts: Record<string, number> = {};
  const firstIdByType: Record<string, string> = {};
  player.hand.forEach((id) => {
    const card = gameServices.dataService.getCardById(id);
    if (card && card.card_type) {
      counts[card.card_type] = (counts[card.card_type] ?? 0) + 1;
      if (!firstIdByType[card.card_type]) firstIdByType[card.card_type] = id;
    }
  });
  const cardChips = Object.keys(counts).map((type) => {
    const meta = colors.game.cardTypes[type];
    return {
      type,
      cardId: firstIdByType[type],
      label: meta ? meta.label : type,
      emoji: meta ? meta.emoji : '🃏',
      n: counts[type],
      // Life Events are past occurrences, not live influences — show them grayed
      // (still tappable to review what happened). User call 2026-06-23 (fb:3aad5f84).
      inactive: type === 'L',
    };
  });
  const activeEffects = player.activeEffects ?? [];
  // Replace/return/give expeditor all act on the player's E cards
  // (CardEffectService.handleReplace/Return/GiveCards → getPlayerCards) and no-op
  // SILENTLY when there are none — the button fired but no modal appeared
  // (fb:3accbe92). Hide them when there's nothing to act on; they're skippable, so
  // hiding can't soft-lock the turn.
  const hasExpeditorCards = (counts['E'] ?? 0) > 0;

  // Playable Expeditor (E) cards — the influence zone lets the player deploy them.
  // The gate AND the play both go through the canonical SERVICE rule
  // (`gameRulesService.canPlayCard` via cardService) — the same rule the engine
  // enforces. We deliberately do NOT re-derive playability here (the classic
  // CardsSection keeps its own component-local copy; forking it again is exactly
  // the parallel-systems drift CLAUDE.md warns about).
  const expeditorCards = player.hand
    .map((id) => ({ id, card: gameServices.dataService.getCardById(id) }))
    .filter((x): x is { id: string; card: NonNullable<typeof x.card> } =>
      !!x.card && x.card.card_type === 'E');
  const playableExpeditors = isMyTurn
    ? expeditorCards.filter((x) => gameServices.cardService.canPlayCard(playerId, x.id))
    : [];

  // --- actions (recomputed from the same data via shared helpers) ----------
  const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const conditionFiltered = gameServices.turnService.filterSpaceEffectsByCondition(allSpaceEffects, player) || [];
  const manualEffects = conditionFiltered.filter((e) => e.trigger_type === 'manual');
  const mapped = manualEffects.map((effect) => {
    const effectKey = effect.effect_action ? `${effect.effect_type}:${effect.effect_action}` : effect.effect_type;
    const isDiceEffect = effect.effect_type === 'dice';
    const isDiceCompleted = completedActions.diceRoll !== undefined;
    const completedKeys = Object.keys(completedActions.manualActions);
    const isCompleted = isDiceEffect
      ? isDiceCompleted
      : completedKeys.some(
          (key) =>
            key === effectKey ||
            (effect.effect_action && key === effect.effect_action) ||
            key.toLowerCase() === effectKey.toLowerCase() ||
            (effect.effect_action && key.toLowerCase() === effect.effect_action.toLowerCase()),
        );
    const formatted = formatManualEffectButton(effect);
    return {
      effectKey,
      label: formatted.text || effect.effect_type,
      // Per-type icon so movement / expeditor / work-package / money / dice
      // actions are tellable apart at a glance (fb:40cc3674 — "buttons look too
      // alike"). The formatter already derives an icon by card type; dice rolls
      // get 🎲 (the collapsed-dice label carries its own, stripped at render).
      icon: isDiceEffect ? '🎲' : formatted.icon,
      isCompleted,
      isDiceEffect,
    };
  });
  const pendingActions = collapsePairedDiceActions(mapped);
  const expeditorTargetAction = /(replace|return|give)_e\b/i;
  const visiblePendingActions = pendingActions
    .filter((a) => !a.isCompleted)
    .filter((a) => hasExpeditorCards || !expeditorTargetAction.test(a.effectKey));
  // Completed draw/roll actions stay on screen as a grayed ✓ trace instead of
  // vanishing, so the player can see what they already did this turn (fb:d2070ed1
  // — "every button vanishes on press, I want a leftover hint"). Movement keeps
  // its own reversible checkmark below; these one-shot actions can't be undone.
  const doneActionTraces = pendingActions.filter((a) => a.isCompleted);

  const movement = gameServices.dataService.getMovement(player.currentSpace, player.visitType);
  const isDiceMovementSpace = movement?.movement_type === 'dice';
  const hasPlayerRolledDice = gameState.hasPlayerRolledDice;
  const movementChoiceUnlocked = gameState.movementChoiceUnlocked ?? true;
  const movementChoice =
    isMyTurn && gameState.awaitingChoice?.type === 'MOVEMENT' ? gameState.awaitingChoice : null;
  const selectedDestination = player.moveIntent || null;
  const needsMovementChoice = !!movementChoice && !selectedDestination && movementChoiceUnlocked;
  // Keep the destination options on screen even AFTER one is picked, so the
  // player can check/uncheck/switch freely until End Turn or Negotiate locks the
  // turn in (fb:c2e489dc — "the other spaces disappeared, I wanted to change my
  // mind"). The move is only an intent (setPlayerMoveIntent) until endTurn.
  const showMovementOptions = !!movementChoice && movementChoiceUnlocked;
  const showMovementDiceButton = shouldShowMovementDiceButton(visiblePendingActions, {
    isDiceMovementSpace,
    hasPlayerRolledDice,
  });

  const canEndTurn = gameServices.gameRulesService.canEndTurn(playerId);
  const remaining = Math.max(0, gameState.requiredActions - gameState.completedActionCount);

  // --- handlers (same service calls as the classic panel) ------------------
  const handleManualEffect = async (effectKey: string) => {
    try {
      const result = await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectKey);
      if (onManualEffectResult && result) onManualEffectResult(result);
    } catch (err) {
      console.error(`Manual effect error (${effectKey}):`, err);
    }
  };
  const handleMovementChoice = (destinationId: string) => {
    // Toggle: tapping the chosen destination again unchecks it; tapping a
    // different one switches. Reversible until End Turn / Negotiate commits the
    // move (engine treats this as intent only — setPlayerMoveIntent(null) clears
    // it and updateActionCounts keeps the End Turn gate correct).
    const next = selectedDestination === destinationId ? null : destinationId;
    gameServices.stateService.setPlayerMoveIntent(playerId, next);
  };
  const handleEndTurn = async () => {
    setIsEndingTurn(true);
    try {
      await gameServices.turnService.endTurnWithMovement();
    } catch (err) {
      console.error('End turn error:', err);
    } finally {
      setIsEndingTurn(false);
    }
  };
  const handleDiceRoll = async () => {
    if (!onRollDice) return;
    setIsRollingDice(true);
    try {
      await onRollDice();
    } catch (err) {
      console.error('Dice roll error:', err);
    } finally {
      setIsRollingDice(false);
    }
  };
  const handlePlayExpeditor = async (cardId: string) => {
    setPlayingCardId(cardId);
    try {
      await gameServices.cardService.playCard(playerId, cardId);
    } catch (err) {
      console.error('Expeditor play error:', err);
    } finally {
      setPlayingCardId(null);
    }
  };

  // --- commit (single spine button) ---------------------------------------
  let commit: { label: string; ready: boolean; onClick?: () => void };
  if (!isMyTurn) {
    commit = { label: `Waiting for ${currentPlayerName || 'the other player'}`, ready: false };
  } else if (showMovementDiceButton) {
    commit = {
      label: isRollingDice ? 'Working…' : content?.end_turn_label || 'Take your next step',
      ready: true,
      onClick: handleDiceRoll,
    };
  } else if (canEndTurn) {
    commit = { label: isEndingTurn ? 'Ending…' : content?.end_turn_label || 'End turn', ready: true, onClick: handleEndTurn };
  } else {
    commit = { label: `${remaining} action${remaining === 1 ? '' : 's'} left`, ready: false };
  }
  const showGreenDot = isMyTurn && commit.ready && player.visitType === 'First';
  // First-visit nudge: the action buttons themselves glow so a new player's eye
  // lands on what to press (fb:e84e4d11 — expected the green hint ON the action
  // buttons, not only the commit spine). Same green as the commit dot. Once an
  // action is used it drops to a ✓ trace and stops glowing.
  const firstVisitHint = isMyTurn && player.visitType === 'First';

  // --- styles -------------------------------------------------------------
  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 360,
    margin: '0 auto',
    background: p.bg,
    color: p.text,
    border: `0.5px solid ${p.border}`,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative', // anchors the between-turns move overlay
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  const pad: React.CSSProperties = { padding: '11px 13px', borderBottom: `0.5px solid ${p.border}` };
  const zlbl: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.05em',
    color: p.muted,
    textTransform: 'uppercase',
    margin: '0 0 6px',
  };
  const stat: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500 };
  const actionBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: p.surf,
    border: `1px solid ${p.borderStrong}`,
    color: p.text,
    borderRadius: 9,
    padding: '10px 11px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: 7,
    textAlign: 'left',
  };
  // A picked destination: highlighted + ✓, still a button (tap to uncheck/switch).
  const selectedActionBtn: React.CSSProperties = {
    ...actionBtn,
    background: p.surf2,
    border: `1.5px solid ${p.accent}`,
    color: p.text,
    fontWeight: 600,
  };
  // Small recall affordances (My numbers / History) in the status zone.
  const recallBtn: React.CSSProperties = {
    flex: 1,
    border: `1px solid ${p.borderStrong}`,
    background: p.surf,
    color: p.text,
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  };
  // A finished one-shot action: grayed, checked, not interactive.
  const doneActionRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: p.surf2,
    border: `1px solid ${p.border}`,
    color: p.muted,
    borderRadius: 9,
    padding: '10px 11px',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 7,
    textAlign: 'left',
  };

  return (
    <div style={cardStyle}>
      {/* First-visit hint glow for the action buttons (fb:e84e4d11). Pulses gently
          to draw a new player's eye; static ring under reduced-motion. */}
      <style>{`
        @keyframes uc-hint-glow-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
          50% { box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.45); }
        }
        .uc-hint-glow { animation: uc-hint-glow-kf 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .uc-hint-glow { animation: none; box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.5); }
        }
      `}</style>

      {/* Between-turns move overlay (fb:15499d9b) — "you moved from X to Y". */}
      {moveFrom && (
        <div
          onClick={() => setMoveFrom(null)}
          role="button"
          tabIndex={0}
          aria-label={`You moved from ${gameServices.dataService.getGameConfigBySpace(moveFrom)?.display_label_override || shortName(moveFrom)} to ${spaceLabel}. Tap to continue.`}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            background: mode === 'dark' ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 22,
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: 18,
          }}
        >
          <div style={{ fontSize: 22 }} aria-hidden>📍</div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: p.muted, textTransform: 'uppercase' }}>
            You moved
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: p.text }}>
            from <strong>{gameServices.dataService.getGameConfigBySpace(moveFrom)?.display_label_override || shortName(moveFrom)}</strong>
            <br />to <strong>{spaceLabel}</strong>
          </div>
          <div style={{ fontSize: 11, color: p.muted, marginTop: 10 }}>Tap to continue</div>
        </div>
      )}

      {/* Header */}
      <div style={{ ...pad, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: player.color || p.accent }} />
          {player.name}
        </div>
        {phaseLabel && <div style={{ fontSize: 11, color: p.muted, textAlign: 'right' }}>{phaseLabel}</div>}
      </div>

      {/* Status */}
      <div style={pad}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={stat} title="Cash on hand">
            <span aria-hidden>💰</span>${player.money.toLocaleString()}
          </span>
          <span style={stat} title="Days spent">
            <span aria-hidden>🕐</span>{player.timeSpent}
          </span>
          {(dob || fdny) && (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 9, fontSize: 11, color: p.muted }}>
              {dob && (
                <span title={`DOB ${dob.label}`}>
                  DOB <span style={{ color: dob.dot, fontWeight: 500 }}>{dob.mark}</span>
                </span>
              )}
              {fdny && (
                <span title={`FDNY ${fdny.label}`}>
                  FDNY <span style={{ color: fdny.dot, fontWeight: 500 }}>{fdny.mark}</span>
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => setShowNumbers(true)}
            aria-label="See your numbers — scope, work packages, money and time"
            style={recallBtn}
          >
            📋 My numbers
          </button>
          <button
            onClick={() => setShowChronicle(true)}
            aria-label="See what's happened — your move and change history"
            style={recallBtn}
          >
            📜 History
          </button>
        </div>
      </div>

      {/* Purpose */}
      <div style={pad}>
        <p style={zlbl}>Where you are &amp; why</p>
        <div style={{ background: p.surf, borderLeft: `3px solid ${p.accent}`, padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>📍 {spaceLabel}</div>
          {content && content.story && (
            <div style={{ fontSize: 12, color: p.muted, marginTop: 4, lineHeight: 1.5 }}>
              <TextWithTerms text={content.story} onTermClick={(term) => openWithTerm(term.id)} />
            </div>
          )}
        </div>
      </div>

      {/* Things you can do */}
      {isMyTurn &&
        (visiblePendingActions.length > 0 || doneActionTraces.length > 0 || showMovementOptions) && (
        <div style={pad}>
          <p style={zlbl}>Things you can do</p>
          {visiblePendingActions.map((a) => (
            <button
              key={a.effectKey}
              className={firstVisitHint ? 'uc-hint-glow' : undefined}
              style={actionBtn}
              disabled={a.isDiceEffect && isRollingDice}
              onClick={() =>
                a.isDiceEffect && onRollDice ? handleDiceRoll() : handleManualEffect(a.effectKey)
              }
            >
              {a.isDiceEffect && isRollingDice
                ? '🎲 Deciding…'
                : `${a.icon ? a.icon + ' ' : ''}${a.label.replace(/^🎲\s*/, '')}`}
            </button>
          ))}
          {showMovementOptions &&
            movementChoice!.options.map((opt) => {
              const oc = gameServices.dataService.getGameConfigBySpace(opt.id);
              const label = oc?.display_label_override || opt.label || shortName(opt.id);
              const isSelected = selectedDestination === opt.id;
              return (
                <button
                  key={opt.id}
                  className={firstVisitHint && !selectedDestination ? 'uc-hint-glow' : undefined}
                  style={isSelected ? selectedActionBtn : actionBtn}
                  aria-pressed={isSelected}
                  title={isSelected ? 'Tap again to unpick — you can still change your mind' : undefined}
                  onClick={() => handleMovementChoice(opt.id)}
                >
                  {isSelected ? '✅' : '➡️'} {label}
                </button>
              );
            })}
          {showMovementOptions && selectedDestination && (
            <p style={{ fontSize: 10, color: p.muted, margin: '1px 0 6px' }}>
              You can switch until you end your turn.
            </p>
          )}
          {doneActionTraces.map((a) => (
            <div key={`done-${a.effectKey}`} style={doneActionRow} aria-label={`Done: ${a.label}`}>
              ✓ {a.label.replace(/^🎲\s*/, '')}
            </div>
          ))}
        </div>
      )}

      {/* Influence */}
      <div style={pad}>
        <p style={zlbl}>What&apos;s affecting you</p>
        {activeEffects.length === 0 && cardChips.length === 0 && playableExpeditors.length === 0 ? (
          <div style={{ fontSize: 12, color: p.muted, background: p.surf, borderRadius: 9, padding: '8px 10px' }}>
            Nothing affecting you yet
          </div>
        ) : (
          <>
            {/* Expeditors you can deploy right now (optional E-card play) */}
            {playableExpeditors.map(({ id, card }) => (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: p.surf,
                  borderRadius: 9,
                  padding: '8px 10px',
                  marginBottom: 6,
                }}
              >
                <button
                  onClick={() => setDetailCardId(id)}
                  aria-label={`Details for ${card.card_name}`}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    color: p.text,
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ⚡ {card.card_name} <span aria-hidden style={{ color: p.muted }}>ⓘ</span>
                  {card.phase_restriction && card.phase_restriction !== 'Any' && (
                    <span style={{ color: p.muted, marginLeft: 6 }}>· {card.phase_restriction} phase</span>
                  )}
                </button>
                <button
                  onClick={() => handlePlayExpeditor(id)}
                  disabled={playingCardId !== null}
                  aria-label={`Activate ${card.card_name}`}
                  style={{
                    flex: '0 0 auto',
                    border: `1px solid ${p.accent}`,
                    background: p.accent,
                    color: '#fff',
                    borderRadius: 8,
                    padding: '5px 11px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: playingCardId !== null ? 'default' : 'pointer',
                    opacity: playingCardId !== null && playingCardId !== id ? 0.5 : 1,
                  }}
                >
                  {playingCardId === id ? 'Working…' : 'Activate'}
                </button>
              </div>
            ))}
            {activeEffects.map((eff, i) => {
              // Tap an ongoing effect to open the card that created it (when that
              // card resolves) — same intuitive "tap for details" as the chips.
              const src = eff.sourceCardId && gameServices.dataService.getCardById(eff.sourceCardId) ? eff.sourceCardId : null;
              return (
                <button
                  key={eff.effectId || i}
                  onClick={() => src && setDetailCardId(src)}
                  disabled={!src}
                  title={src ? 'Tap to see details' : undefined}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: 12,
                    background: p.surf,
                    border: `1px solid ${p.border}`,
                    color: p.text,
                    borderRadius: 9,
                    padding: '8px 10px',
                    marginBottom: 6,
                    cursor: src ? 'pointer' : 'default',
                  }}
                >
                  ⚡ {eff.description}
                </button>
              );
            })}
            {cardChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cardChips.map((c) => (
                  <button
                    key={c.type}
                    // One card → open its detail; several → open a list to pick
                    // which (user call 2026-06-23, fb:88a88773 — a "×3" tag must
                    // be able to reveal all three cards, not just the first).
                    onClick={() => {
                      if (!c.cardId) return;
                      if (c.n > 1) setListType(c.type);
                      else setDetailCardId(c.cardId);
                    }}
                    disabled={!c.cardId}
                    title={c.inactive ? 'Already happened — tap to see what it did' : 'Tap to see details'}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: p.surf2,
                      border: `1px solid ${p.border}`,
                      // Grayed = finished/not currently affecting you (Life Events);
                      // full color = a resource you hold. Both tappable.
                      color: c.inactive ? p.muted : p.text,
                      opacity: c.inactive ? 0.55 : 1,
                      cursor: c.cardId ? 'pointer' : 'default',
                    }}
                  >
                    {c.emoji} {c.label} ×{c.n}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer: negotiate + commit spine */}
      <div style={{ padding: '11px 13px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {isMyTurn && content && content.can_negotiate && onTryAgain && (
            <button
              onClick={() => onTryAgain(playerId)}
              style={{
                flex: '0 0 auto',
                border: `1px solid ${p.borderStrong}`,
                background: p.surf,
                color: p.text,
                borderRadius: 11,
                padding: '8px 11px',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                lineHeight: 1.2,
                textAlign: 'left',
              }}
            >
              {content.try_again_label || 'Negotiate again'}
              <small style={{ display: 'block', fontSize: 9, color: p.muted }}>costs 🕐 + 💰</small>
            </button>
          )}
          <button
            onClick={commit.onClick}
            disabled={!commit.ready}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 11,
              padding: 13,
              fontSize: 15,
              fontWeight: 500,
              color: commit.ready ? '#fff' : p.muted,
              background: commit.ready ? p.accent : p.surf2,
              cursor: commit.ready ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {showGreenDot && (
              <span
                style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 0 3px rgba(52,211,153,.3)' }}
              />
            )}
            {commit.label}
          </button>
        </div>
      </div>

      {/* "Recall my numbers" reference — scope, work packages, money, time. */}
      <PlayerNumbersV2
        isOpen={showNumbers}
        onClose={() => setShowNumbers(false)}
        playerId={playerId}
        gameServices={gameServices}
        mode={mode}
      />

      {/* "What's happened" history — the Chronicle (first slice). */}
      <PlayerChronicleV2
        isOpen={showChronicle}
        onClose={() => setShowChronicle(false)}
        playerId={playerId}
        gameServices={gameServices}
        mode={mode}
      />

      {/* Detailed-card view (redesign §5) — opened from the influence zone. */}
      <PlayerCardDetailV2
        isOpen={detailCardId !== null}
        onClose={() => setDetailCardId(null)}
        card={detailCardId ? gameServices.dataService.getCardById(detailCardId) ?? null : null}
        playerId={playerId}
        gameServices={gameServices}
        mode={mode}
      />

      {/* Pick-a-card list — a count chip holding several cards opens this so the
          player can choose which one to view, then taps through to its detail
          (fb:88a88773 — "×3" must reveal all three, not just the first). */}
      <ModalBase
        isOpen={listType !== null}
        onClose={() => setListType(null)}
        title={listType ? `Your ${getCardTypeName(listType, 2)}` : ''}
        emoji={listType ? colors.game.cardTypes[listType]?.emoji || '🃏' : ''}
        testId="affecting-card-list"
        maxWidth="360px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {player.hand
            .map((id) => ({ id, card: gameServices.dataService.getCardById(id) }))
            .filter((x) => x.card && x.card.card_type === listType)
            .map(({ id, card }) => (
              <button
                key={id}
                onClick={() => {
                  setListType(null);
                  setDetailCardId(id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#1e293b',
                  borderRadius: 9,
                  padding: '10px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <span>{card!.card_name}</span>
                <span aria-hidden style={{ opacity: 0.45 }}>›</span>
              </button>
            ))}
        </div>
      </ModalBase>
    </div>
  );
};
