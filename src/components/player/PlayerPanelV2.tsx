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
import { getCardTypeName, getCardEffectSummary } from '../../utils/cardTypeNames';
import { computeProjectFinances } from '../../utils/projectFinances';
import { FormatUtils } from '../../utils/FormatUtils';
import { interpolateTemplate } from '../../utils/templateInterpolation';
import { getNpcCharacterInfo, getNpcImagePath } from '../../constants/characters';

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
  playerNotification,
  onRollDice,
  onManualEffectResult,
  completedActions = { manualActions: {} },
}) => {
  const p = panelPalettes[mode];
  const { openWithTerm } = useDictionaryPanel();
  const [, force] = useState(0);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  // Surface end-turn guard failures instead of swallowing them (matches the
  // classic panel's fb:56d0282c fix — TurnService.endTurnWithMovement throws
  // user-readable messages from guards like the scope gate, but this panel
  // never showed them, so a blocked End Turn looked like it "did nothing"
  // (fb:e0694a57). Auto-clears after 6s, same as classic.
  const [endTurnError, setEndTurnError] = useState<string | null>(null);
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
  // "What to do & why" — collapsed by default (supporting info, not the
  // headline), so it doesn't eat phone screen space (fb:f6e100b7).
  const [showWhy, setShowWhy] = useState(false);
  // "What's affecting you" — same reasoning: collapsed by default so the
  // panel doesn't read as overwhelming; the toggle glows instead when an
  // Expeditor is ready to activate, so nothing actionable hides silently.
  const [showEffects, setShowEffects] = useState(false);
  // Movement destinations — collapsed behind one "Move" row instead of N
  // separate buttons, so a choice space doesn't visually inflate the action
  // count (fb:feedback-1782843206015-8edd02b4). Once expanded, every option
  // stays visible/switchable per fb:c2e489dc — this only collapses the FIRST
  // look, it never hides options again after you've opened the picker.
  const [showMoveOptions, setShowMoveOptions] = useState(false);
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

  useEffect(() => {
    setShowWhy(false);
    setShowMoveOptions(false);
  }, [currentSpaceForPopup]);

  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  const gameState = gameServices.stateService.getGameState();
  const isMyTurn = gameState.currentPlayerId === playerId;
  const currentPlayerName = gameState.players.find((pl) => pl.id === gameState.currentPlayerId)?.name || '';

  const content = gameServices.dataService.getSpaceContent(player.currentSpace, player.visitType);
  const config = gameServices.dataService.getGameConfigBySpace(player.currentSpace);
  const spaceLabel = config?.display_label_override || (content && content.title) || shortName(player.currentSpace);

  // Resolve {fundingAmount} token so the NPC dialogue can quote the actual
  // dollar figure inline (fb:61a85444, mirrors ActionCenterPanel's fix —
  // this panel never got it, so funding spaces showed the raw "{fundingAmount}"
  // token unrendered).
  const fundingSource = gameServices.dataService.getFundingSource(player.currentSpace);
  const moneySources = player.moneySources || { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
  let fundingSourceAmount = 0;
  if (fundingSource === 'owner') fundingSourceAmount = moneySources.ownerFunding;
  else if (fundingSource === 'bank') fundingSourceAmount = moneySources.bankLoans;
  else if (fundingSource === 'investor') fundingSourceAmount = moneySources.investmentDeals;
  const fundingAmount = fundingSourceAmount > 0 ? `$${fundingSourceAmount.toLocaleString()}` : '';
  const renderedStory = content?.story ? interpolateTemplate(content.story, { fundingAmount }) : '';

  // Who's speaking — restores the classic panel's NPC identity cue (this
  // panel never had it). PM-voiced spaces (fb:7065e8df) resolve to
  // undefined, so no badge/portrait shows for the PM's own first-person
  // narration. Smaller than classic's version by design (fb:f6e100b7 follow-up).
  const npcInfo = getNpcCharacterInfo(player.currentSpace);
  const npcAppearances = gameState.npcAppearances;
  const npcAppearance = npcInfo && npcAppearances ? npcAppearances[npcInfo.imageRoles[0]] : undefined;
  const portraitSrc = npcInfo && npcAppearance ? getNpcImagePath(npcInfo.imageRoles[0], npcAppearance) : null;
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
      emoji: meta ? meta.emoji : '📄', // voice rule: no 🃏 deck icon
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
      // Per-type icon so movement / expeditor / work-package / money / outcome
      // actions are tellable apart at a glance (fb:40cc3674 — "buttons look too
      // alike"). Voice rule (no game language): outcome ("dice") actions get 🎯,
      // not a 🎲 die.
      icon: isDiceEffect ? '🎯' : formatted.icon,
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
  //
  // Render the destination options as soon as a movement choice exists — even
  // before movementChoiceUnlocked flips true — and gray them out (disabled)
  // until then, rather than not rendering them at all. The "show last" gate
  // (v3.0.62, fb:55b6626f) was built so players finish other required actions
  // first, but hiding the section entirely made it look like the Move option
  // had vanished (fb:bf8bf19a — "Move button disappeared").
  const showMovementOptions = !!movementChoice;
  const selectedMovementOption = selectedDestination
    ? movementChoice?.options.find((o) => o.id === selectedDestination)
    : null;
  const selectedMovementLabel = selectedMovementOption
    ? gameServices.dataService.getGameConfigBySpace(selectedMovementOption.id)?.display_label_override
      || selectedMovementOption.label
      || shortName(selectedMovementOption.id)
    : null;
  const showMovementDiceButton = shouldShowMovementDiceButton(visiblePendingActions, {
    isDiceMovementSpace,
    hasPlayerRolledDice,
  });

  const canEndTurn = gameServices.gameRulesService.canEndTurn(playerId);
  const remaining = Math.max(0, gameState.requiredActions - gameState.completedActionCount);

  // This turn's tab so far (fb:06f7da3b / b53864af) — the money paid and the
  // days added by this visit, echoed under the commit spine so ending the turn
  // isn't a mystery total. Three sources: (1) the space's own unconditional
  // auto time cost ("Spend 50 days" rows — applied on arrival BEFORE the REAL
  // turn-start snapshot is captured, so a snapshot diff alone misses it);
  // (2) time added DURING the turn (dice outcomes, negotiate penalties) via
  // the REAL-snapshot diff; (3) money from the turn cost ledger (every
  // spendMoney this turn, sticks across Try Again). Dice-conditional time rows
  // are excluded from (1) — when they land they show up in (2).
  const spaceVisitDays = allSpaceEffects
    .filter((e) => e.effect_type === 'time' && e.effect_action === 'add' && e.trigger_type === 'auto' && !e.condition)
    .reduce((s, e) => s + (parseInt(String(e.effect_value), 10) || 0), 0);
  const turnOutflow = isMyTurn ? gameServices.stateService.getTurnOutflow(playerId) : null;
  const turnStartState = isMyTurn ? gameServices.stateService.getRealPlayerState(playerId) : null;
  const turnMoneySpent = turnOutflow?.moneySpent ?? 0;
  const turnDaysAdded =
    spaceVisitDays + (turnStartState ? Math.max(0, player.timeSpent - turnStartState.timeSpent) : 0);
  const turnCostParts: string[] = [];
  if (turnDaysAdded > 0) turnCostParts.push(`🕐 +${turnDaysAdded} day${turnDaysAdded === 1 ? '' : 's'}`);
  if (turnMoneySpent > 0) turnCostParts.push(`💰 −${FormatUtils.formatMoney(turnMoneySpent)}`);
  const turnCostLine = isMyTurn && turnCostParts.length > 0 ? `this turn: ${turnCostParts.join(' · ')}` : null;

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
    setEndTurnError(null);
    try {
      await gameServices.turnService.endTurnWithMovement();
    } catch (err) {
      // Surface the failure instead of silently swallowing it (fb:56d0282c,
      // fb:e0694a57) — TurnService throws user-readable messages from its
      // validation guards (e.g. the scope gate), with a `step` property for
      // where it failed, matching the classic panel's diagnostic contract.
      const message = err instanceof Error ? err.message : String(err);
      const step = (err as { step?: string } | null)?.step;
      const display = step ? `${message} (step: ${step})` : message;
      console.error('End turn error:', err);
      setEndTurnError(display);
      window.setTimeout(() => setEndTurnError((prev) => (prev === display ? null : prev)), 6000);
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

  // Money runway cue (fb:0aae9865) — a running-out-of-money signal so students
  // manage cash before a bill bankrupts them (bills now go through in full and
  // can end the game). Redundant coding: colour AND a word, never colour alone
  // (a11y). Red = in the red (a bill has pushed cash below zero — bankruptcy
  // territory); orange "running low" = <20% of the money raised is left
  // (matching the reporter's "20%"); orange "$X deficit" = the project's
  // full budget exceeds the funding secured, so a green cash figure would lie
  // (post-deploy playtest: "$70K green while scope grew to millions"; maintainer
  // chose "deficit" over "still to raise" for the tight cue slot — the "My
  // numbers" ledger keeps the fuller "Still to raise" row). Green only when
  // cash is healthy AND the project is fully funded. Same
  // computeProjectFinances as "My numbers", so the two can't disagree.
  const fin = computeProjectFinances(player, (id) => gameServices.dataService.getCardById(id));
  const moneyCue: { color: string; word?: string } =
    player.money < 0
      ? { color: '#dc2626', word: 'in the red' }
      : fin.totalCapital > 0 && player.money < fin.totalCapital * 0.2
        ? { color: '#d97706', word: 'running low' }
        : fin.fundingGap > 0
          ? { color: '#d97706', word: `${FormatUtils.formatMoney(fin.fundingGap)} deficit` }
          : { color: mode === 'dark' ? '#4ade80' : '#1e7e34' };

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
    // border-box so the selected/done states (which change border width) can't
    // resize the control — fb:44df6d5d, "the button became longer once pressed".
    boxSizing: 'border-box',
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
  // "My numbers" is the recall players actually reach for — keep it the primary
  // affordance, filling the row.
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
  // History is rarely opened (fb:341475d7 — "very prominent, can almost be
  // hidden"); demote it to a quiet, borderless, muted text link beside it.
  const historyBtn: React.CSSProperties = {
    flex: '0 0 auto',
    border: 'none',
    background: 'transparent',
    color: p.muted,
    borderRadius: 8,
    padding: '5px 8px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    opacity: 0.7,
  };
  // A finished one-shot action: grayed, checked, not interactive. Shares
  // actionBtn's geometry so a used action keeps the exact same footprint as the
  // live button it replaced (fb:44df6d5d) — only the colors/cursor differ.
  const doneActionRow: React.CSSProperties = {
    ...actionBtn,
    background: p.surf2,
    border: `1px solid ${p.border}`,
    color: p.muted,
    cursor: 'default',
  };

  // Nested/smaller variants for options revealed under the "Move" toggle —
  // same actionBtn family, scaled down so they read as children of the
  // toggle rather than four equal-weight top-level actions (user feedback
  // 2026-07-07: "they look exactly the same and it looks confusing").
  const subActionBtn: React.CSSProperties = { ...actionBtn, padding: '7px 10px', fontSize: 12, marginBottom: 5 };
  const selectedSubActionBtn: React.CSSProperties = { ...selectedActionBtn, padding: '7px 10px', fontSize: 12, marginBottom: 5 };
  const doneSubActionRow: React.CSSProperties = { ...doneActionRow, padding: '7px 10px', fontSize: 12, marginBottom: 5 };

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
            <span aria-hidden>💰</span>
            <span style={{ color: moneyCue.color, fontWeight: 600 }}>${player.money.toLocaleString()}</span>
            {moneyCue.word && (
              <span style={{ fontSize: 10, fontWeight: 700, color: moneyCue.color, marginLeft: 2 }}>
                {moneyCue.word}
              </span>
            )}
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
            style={historyBtn}
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
          {content && renderedStory && (
            <div style={{ fontSize: 12, color: p.muted, marginTop: 4, lineHeight: 1.5 }}>
              {portraitSrc && npcInfo && (
                <span style={{ float: 'left', width: 36, marginRight: 6, marginBottom: 2, textAlign: 'center' }}>
                  <img
                    src={portraitSrc}
                    alt={npcInfo.name}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `1.5px solid ${npcInfo.color}`,
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                  <span style={{
                    fontSize: 8,
                    fontWeight: 600,
                    color: npcInfo.color,
                    lineHeight: 1.15,
                    display: 'block',
                    whiteSpace: 'normal',
                  }}>
                    {npcInfo.name}
                  </span>
                </span>
              )}
              <TextWithTerms text={renderedStory} onTermClick={(term) => openWithTerm(term.id)} />
            </div>
          )}
        </div>
        {content && (content.action_description || content.outcome_description) && (
          <>
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
                padding: '4px 2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: p.accent,
              }}
            >
              <span aria-hidden>{showWhy ? '▾' : '▸'}</span> What to do &amp; why
            </button>
            {showWhy && (
              <div style={{ marginTop: 4 }}>
                {content.action_description && (
                  <div style={{ background: p.surf2, borderLeft: `3px solid ${p.accent}`, padding: '8px 10px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <strong>What to do:</strong>{' '}
                      <TextWithTerms text={content.action_description} onTermClick={(term) => openWithTerm(term.id)} />
                    </div>
                  </div>
                )}
                {content.outcome_description && (
                  <div style={{ background: p.surf2, borderLeft: `3px solid ${p.muted}`, padding: '8px 10px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <strong>Why:</strong>{' '}
                      <TextWithTerms text={content.outcome_description} onTermClick={(term) => openWithTerm(term.id)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {/* Ported from the classic panel (fb: playerNotification prop existed
            on ActionCenterPanelProps/GameLayout all along — this panel never
            rendered it, so every notificationService.notify() call (movement
            errors, approval revokes, etc.) has been silently swallowed since
            the new panel became default in v3.0.97, v3.0.99). */}
        {playerNotification && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
            padding: '6px 10px',
            background: p.warnSurf,
            border: '1px solid #f59e0b',
            borderRadius: 8,
            fontSize: 12,
            color: p.text,
          }}>
            <span aria-hidden>📢</span>
            <span>{playerNotification}</span>
          </div>
        )}
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
                ? 'Deciding…'
                : `${a.icon ? a.icon + ' ' : ''}${a.label.replace(/^🎲\s*/, '')}`}
            </button>
          ))}
          {showMovementOptions && (
            <>
              {/* One row instead of N destination buttons, so a choice space
                  doesn't visually inflate the action count (fb:feedback-
                  1782843206015-8edd02b4). Expanding never hides options again
                  once open — that's the part fb:c2e489dc protects. */}
              <button
                type="button"
                onClick={() => setShowMoveOptions((v) => !v)}
                aria-expanded={showMoveOptions}
                // Distinct accessible name from any individual destination's own
                // label — the visible text below can echo a destination name
                // ("Moving to: Fee Review"), which would otherwise collide with
                // that destination's own button in accessible-name lookups.
                aria-label="Move — where to go next"
                className={
                  firstVisitHint && !selectedDestination && movementChoiceUnlocked && !showMoveOptions
                    ? 'uc-hint-glow'
                    : undefined
                }
                style={selectedDestination ? selectedActionBtn : actionBtn}
              >
                <span aria-hidden>{showMoveOptions ? '▾' : '▸'}</span>{' '}
                {selectedDestination
                  ? `✅ Moving to: ${selectedMovementLabel}`
                  : `➡️ Move — ${movementChoice!.options.length} options`}
              </button>
              {showMoveOptions && (
                // Indented + connector line so the options read as sliding out
                // from under the toggle, not as four more equal-weight actions.
                <div style={{ marginLeft: 12, paddingLeft: 10, borderLeft: `2px solid ${p.border}`, marginTop: 2 }}>
                  {movementChoice!.options.map((opt) => {
                    const oc = gameServices.dataService.getGameConfigBySpace(opt.id);
                    const label = oc?.display_label_override || opt.label || shortName(opt.id);
                    const isSelected = selectedDestination === opt.id;
                    return (
                      <button
                        key={opt.id}
                        style={!movementChoiceUnlocked ? doneSubActionRow : isSelected ? selectedSubActionBtn : subActionBtn}
                        disabled={!movementChoiceUnlocked}
                        aria-pressed={isSelected}
                        aria-disabled={!movementChoiceUnlocked}
                        title={
                          !movementChoiceUnlocked
                            ? 'Finish your other actions first'
                            : isSelected
                            ? 'Tap again to unpick — you can still change your mind'
                            : undefined
                        }
                        onClick={() => movementChoiceUnlocked && handleMovementChoice(opt.id)}
                      >
                        {!movementChoiceUnlocked ? '➡️' : isSelected ? '✅' : '➡️'} {label}
                      </button>
                    );
                  })}
                  {!movementChoiceUnlocked && (
                    <p style={{ fontSize: 10, color: p.muted, margin: '1px 0 6px' }}>
                      Finish your other actions first, then pick where to go.
                    </p>
                  )}
                  {movementChoiceUnlocked && selectedDestination && (
                    <p style={{ fontSize: 10, color: p.muted, margin: '1px 0 6px' }}>
                      You can switch until you end your turn.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {doneActionTraces.map((a) => (
            // Outcome actions carry the resolved result as a hover/long-press
            // tooltip (fb:b53864af — "show the fee once it's determined"); the
            // exact amounts also land on the commit spine's this-turn line.
            <div
              key={`done-${a.effectKey}`}
              style={doneActionRow}
              aria-label={`Done: ${a.label}`}
              title={a.isDiceEffect && completedActions.diceRoll ? completedActions.diceRoll : undefined}
            >
              ✓ {a.label.replace(/^🎲\s*/, '')}
            </div>
          ))}
        </div>
      )}

      {/* Influence */}
      <div style={pad}>
        {activeEffects.length === 0 && cardChips.length === 0 && playableExpeditors.length === 0 ? (
          <>
            <p style={zlbl}>What&apos;s affecting you</p>
            <div style={{ fontSize: 12, color: p.muted, background: p.surf, borderRadius: 9, padding: '8px 10px' }}>
              Nothing affecting you yet
            </div>
          </>
        ) : (
          <>
            {/* Collapsed by default — this list grows noisy fast, and it's
                supporting detail, not the headline (fb:f6e100b7 follow-up).
                The toggle glows the same way action buttons do (fb:e84e4d11)
                when there's an Expeditor ready to activate, so collapsing it
                can't hide something actionable. */}
            <button
              type="button"
              onClick={() => setShowEffects((v) => !v)}
              aria-expanded={showEffects}
              className={playableExpeditors.length > 0 ? 'uc-hint-glow' : undefined}
              style={{
                ...zlbl,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                width: '100%',
                padding: '4px 2px',
                margin: '0 0 4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 6,
                textAlign: 'left',
              }}
            >
              <span aria-hidden>{showEffects ? '▾' : '▸'}</span> What&apos;s affecting you
              {playableExpeditors.length > 0 && (
                <span style={{ color: p.accent, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                  · {playableExpeditors.length} to activate
                </span>
              )}
            </button>
            {showEffects && (
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
                  {playingCardId === id
                    ? 'Working…'
                    // fb:17cc481c — state the effect instead of a bare "Activate".
                    : (() => {
                        const summary = getCardEffectSummary(card, player.timeSpent);
                        return summary ? `Activate (${summary})` : 'Activate';
                      })()}
                </button>
              </div>
            ))}
            {activeEffects.map((eff, i) => {
              // Tap an ongoing effect to open the card that created it (when that
              // card resolves) — same intuitive "tap for details" as the chips.
              const srcCard = eff.sourceCardId ? gameServices.dataService.getCardById(eff.sourceCardId) : null;
              const src = srcCard ? eff.sourceCardId : null;
              // Icon reflects WHAT created the effect, not a generic ⚡ (the ⚡ is
              // the Expeditor mark, so a Life Event carrying it read as an
              // expeditor — fb:308653b9). Use the source card type's emoji
              // (Life Event → 📰, Expeditor → ⚡); fall back to a neutral
              // "ongoing" hourglass when the source can't be resolved.
              const effEmoji = srcCard ? (colors.game.cardTypes[srcCard.card_type]?.emoji ?? '⏳') : '⏳';
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
                  {effEmoji} {eff.description}
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
          </>
        )}
      </div>

      {/* Footer: negotiate + commit spine */}
      <div style={{ padding: '11px 13px' }}>
        {endTurnError && (
          <div
            role="alert"
            style={{
              background: p.badSurf,
              color: p.bad,
              border: `1px solid ${p.badBorder}`,
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 8,
              lineHeight: 1.35,
            }}
          >
            {endTurnError}
          </div>
        )}
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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {showGreenDot && (
                <span
                  style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 0 3px rgba(52,211,153,.3)' }}
                />
              )}
              {commit.label}
            </span>
            {turnCostLine && (
              <small
                data-testid="turn-cost-line"
                style={{
                  display: 'block',
                  fontSize: 9,
                  fontWeight: 400,
                  color: commit.ready ? 'rgba(255,255,255,.85)' : p.muted,
                }}
              >
                {turnCostLine}
              </small>
            )}
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
        emoji={listType ? colors.game.cardTypes[listType]?.emoji || '📄' : ''}
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
