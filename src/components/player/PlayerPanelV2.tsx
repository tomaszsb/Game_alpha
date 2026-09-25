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
import { PlayerPanelProps } from './panelTypes';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';
import { PanelMode, panelPalettes } from './panelTheme';
import { HelpButton } from '../help/HelpButton';
import { HelpCard } from '../help/HelpCard';
import { shortName } from '../../utils/boardCommon';
import { formatManualEffectButton, getManualEffectTooltip } from '../../utils/buttonFormatting';
import { collapsePairedDiceActions, shouldShowMovementDiceButton } from './pendingActionsCollapse';
import { PlayerCardDetailV2 } from './PlayerCardDetailV2';
import { PlayerNumbersV2, NumbersPage } from './PlayerNumbersV2';
import { PlayerChronicleV2 } from './PlayerChronicleV2';
import { TurnCommitControl } from './TurnCommitControl';
import { getEndTurnCostPreview, getTryAgainCostPreview, getLoanOnTheTable, isManualEffectCompleted, perAmountUnit, timeRowDays } from '../../utils/costPreview';
import { ACTION_ROW, COMMIT, NUMBERS, GLANCE_HELP } from '../../constants/uiStrings';
import { setDestinationPreview } from '../../utils/destinationPreview';
import { computeProjectFinances } from '../../utils/projectFinances';
import { isSkippableEffectAction } from '../../utils/skippableActions';
import { FormatUtils } from '../../utils/FormatUtils';
import { interpolateTemplate } from '../../utils/templateInterpolation';
import { getNpcCharacterInfo, getNpcImagePath } from '../../constants/characters';
import { ActionButton } from './ActionButton';
import { getCurrentGameId } from '../../utils/networkDetection';
import { trackPlaytestEvent } from '../../playtest/playtestAnalytics';

export interface PlayerPanelV2Props extends PlayerPanelProps {
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

// Separate helper (not approvalView reuse) — violation status is a distinct
// yes/no/resolved shape, not the approved/objection/denied one.
function violationView(status: string | undefined): ApprovalView | null {
  if (!status || status === 'none') return null;
  switch (status) {
    case 'active':
      return { label: 'active', dot: '#ef4444', mark: '!' };
    case 'resolved':
      return { label: 'resolved', dot: '#22c55e', mark: '✓' };
    default:
      return null;
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
  onNavigateToSpace,
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
  // Homeowner Violation mechanic — result banner after filing the Affidavit
  // of Correction (fee charged, on-time vs late). Auto-clears after 6s, same
  // as endTurnError above.
  const [affidavitResult, setAffidavitResult] = useState<{ success: boolean; feeCharged: number; onTime: boolean } | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  // Between-turns "you moved" moment (fb:15499d9b) — re-adds the classic panel's
  // movement overlay to the new panel, which had dropped it. Track the player's
  // space across renders; when it changes, briefly show where they came from.
  const prevSpaceRef = useRef<string | null>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  // "Recall my numbers" reference (fb:f028e262, fb:cea108fb) — openable any time.
  // Since v3.2.62 (fb:adad1561) each glance box opens its own page of it.
  const [numbersPage, setNumbersPage] = useState<NumbersPage | null>(null);
  // "What's happened" history (Pile 3 Chronicle, first slice).
  const [showChronicle, setShowChronicle] = useState(false);
  // Movement destinations — collapsed behind one "Move" row instead of N
  // separate buttons, so a choice space doesn't visually inflate the action
  // count (fb:feedback-1782843206015-8edd02b4). Once expanded, every option
  // stays visible/switchable per fb:c2e489dc — this only collapses the FIRST
  // look, it never hides options again after you've opened the picker. The
  // first look is folded UNLESS choosing where to go is the only thing left, in
  // which case it opens itself (see `pickIsOnlyGate`).
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  // Whether, on the previous render, choosing a destination was the ONLY thing
  // left on this turn. Not shown anywhere — it exists so the picker opens on the
  // moment that becomes true (see `pickIsOnlyGate` below), once, and after that
  // leaves the player free to fold it.
  const [pickWasOnlyGate, setPickWasOnlyGate] = useState(false);
  // Teaching layer (Onboarding Phase C, "one ? everywhere", v3.2.71). Which "?"
  // has its help card open: 'step' for the space's own, `action:<effectKey>` for
  // a row's; null = none. ONE at a time across the WHOLE panel — it is a
  // phone/TV-width column and two open cards push the commit spine off-screen.
  // (This used to be two separate pieces of state — the row "?" and the
  // "What to do & why" fold-out — so both could be open at once, and a row card
  // stayed open on the NEXT space because every dice row shares one key.)
  // Collapsed by default: supporting info, not the headline (fb:f6e100b7).
  const [openHelp, setOpenHelp] = useState<string | null>(null);
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

  // Collapse the toggles when the player's space changes. React's documented
  // "adjusting state when a prop changes" pattern (react.dev/learn/you-
  // might-not-need-an-effect) — comparing during render instead of a
  // useEffect avoids a stray render where the old space's expanded panels
  // are still visible for the new space.
  const [prevSpaceForToggles, setPrevSpaceForToggles] = useState(currentSpaceForPopup);
  if (currentSpaceForPopup !== prevSpaceForToggles) {
    setPrevSpaceForToggles(currentSpaceForPopup);
    setOpenHelp(null);
    setShowMoveOptions(false);
    // A new space is a new situation: forget that the last one was pick-only, so
    // arriving where the pick is ALSO the only thing left opens the list again.
    setPickWasOnlyGate(false);
  }

  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  const gameState = gameServices.stateService.getGameState();
  const isMyTurn = gameState.currentPlayerId === playerId;
  const currentPlayerName = gameState.players.find((pl) => pl.id === gameState.currentPlayerId)?.name || '';

  const content = gameServices.dataService.getSpaceContent(player.currentSpace, player.visitType);
  const config = gameServices.dataService.getGameConfigBySpace(player.currentSpace);
  const spaceLabel = config?.display_label_override || (content && content.title) || shortName(player.currentSpace);

  // A space's own "?" only exists when the space has something authored to say —
  // never an empty card.
  const hasGuidance = !!(content && (content.action_description || content.outcome_description));

  // One toggle for every "?" in the panel (see `openHelp`). Opens are counted
  // through the engagement pipeline that already tracked the old fold-out: only 8
  // of 37 real outside games opened ANY help before v3.2.71, and we need to see
  // whether one gesture changes that. Counts OPENS only, and outside the state
  // updater — an updater can run twice under StrictMode and double-count.
  // (The old fold-out logged `what_to_do_and_why`; the same thing is now
  // `help:step`, so a before/after comparison must add the two.)
  const toggleHelp = (id: string, kind: string) => {
    const next = openHelp === id ? null : id;
    setOpenHelp(next);
    if (next) {
      const gameId = getCurrentGameId();
      if (gameId) trackPlaytestEvent('panel_opened', { gameId, playerId, panel: `help:${kind}` });
    }
  };

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
  // Resolved violations fade to a quiet trace (like DOB/FDNY do) rather than
  // showing forever — only 'active' needs the player's attention.
  const violation = player.violationStatus === 'active' ? violationView(player.violationStatus) : null;
  const violationDaysLeft =
    violation && player.violationDeadlineDay != null ? player.violationDeadlineDay - player.timeSpent : null;

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
  // Glance counts, grouped by where CARD_TYPES.csv's numbers_section puts each
  // family (fb:adad1561) — never by a card-type letter.
  const sectionCardIds = (section: string) =>
    player.hand.filter((id) => {
      const card = gameServices.dataService.getCardById(id);
      return !!card && gameServices.dataService.getNumbersSection(card.card_type) === section;
    });
  const historyCardIds = sectionCardIds('history');
  // Same set the Expeditors page lists: filed under expeditors, or activatable
  // from hand (see PlayerNumbersV2 cardsFor).
  const expeditorPageCount = player.hand.filter((id) => {
    const card = gameServices.dataService.getCardById(id);
    return !!card && (
      gameServices.dataService.getNumbersSection(card.card_type) === 'expeditors' ||
      gameServices.dataService.isCardTypePlayableFromHand(card.card_type)
    );
  }).length;
  // Replace/return/give expeditor all act on the player's E cards
  // (CardEffectService.handleReplace/Return/GiveCards → getPlayerCards) and no-op
  // SILENTLY when there are none — the button fired but no modal appeared
  // (fb:3accbe92). Hide them when there's nothing to act on; they're skippable, so
  // hiding can't soft-lock the turn.
  const hasExpeditorCards = (counts['E'] ?? 0) > 0;

  // Hand-playable cards (Expeditors, on the stock board) — the influence zone
  // lets the player deploy them. Which card FAMILIES qualify is authored data
  // (CARD_TYPES.csv is_playable_from_hand — v3.2.56, audit II B2; this used to
  // hardcode `card_type === 'E'`). The gate AND the play both go through the
  // canonical SERVICE rule (`gameRulesService.canPlayCard` via cardService) —
  // the same rule the engine enforces. We deliberately do NOT re-derive
  // playability here (the classic CardsSection kept its own component-local
  // copy until it was deleted; forking it again is exactly the parallel-systems
  // drift CLAUDE.md warns about).
  const expeditorCards = player.hand
    .map((id) => ({ id, card: gameServices.dataService.getCardById(id) }))
    .filter((x): x is { id: string; card: NonNullable<typeof x.card> } =>
      !!x.card && gameServices.dataService.isCardTypePlayableFromHand(x.card.card_type));
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
    const isCompleted = isManualEffectCompleted(effect, completedActions);
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
      // Kept so the "What's this?" disclosure can ask getManualEffectTooltip for
      // this row's authored teaching copy. collapsePairedDiceActions is generic
      // over CollapsibleAction, so the extra field survives the collapse.
      effect,
    };
  });
  const pendingActions = collapsePairedDiceActions(mapped);
  const expeditorTargetAction = /((replace|return|give)_e|transfer)\b/i;
  // "Pass a team member to your left/right" also needs someone to pass it TO —
  // in a solo game there is no neighbour, so it would be a button that can only
  // say "nobody there".
  const hasNeighbor = gameState.players.length > 1;
  const visiblePendingActions = pendingActions
    .filter((a) => !a.isCompleted)
    .filter((a) => hasExpeditorCards || !expeditorTargetAction.test(a.effectKey))
    .filter((a) => hasNeighbor || !/transfer\b/i.test(a.effectKey));
  // Completed draw/roll actions stay on screen as a grayed ✓ trace instead of
  // vanishing, so the player can see what they already did this turn (fb:d2070ed1
  // — "every button vanishes on press, I want a leftover hint"). Movement keeps
  // its own reversible checkmark below; these one-shot actions can't be undone.
  const doneActionTraces = pendingActions.filter((a) => a.isCompleted);

  // Name the action that is blocking, instead of stating a rule with no subject.
  // 2026-09-05 playtest: "Finish your other actions first, then pick where to go."
  // drew 6 hits — "unclear which specific actions count as 'other'" — and it was
  // the largest cluster's through-line (the game states a RULE without naming its
  // SUBJECT). Names up to two; past that a list would outrun the row.
  //
  // SKIPPABLE actions are excluded, because they are not blocking anything — by
  // construction. StateService leaves replace_/return_/give_ out of
  // `requiredActions`, so naming one here pointed the player at a control that
  // could never clear the gate (see utils/skippableActions.ts for the full
  // account; it stranded 12 of 12 robot playthroughs on PM-DECISION-CHECK).
  const blockingActionLabels = visiblePendingActions
    .filter((a) => !isSkippableEffectAction(a.effectKey))
    .map((a) => a.label.replace(/^\u{1F3B2}\s*/u, ''));
  const blockingActionPhrase =
    blockingActionLabels.length === 1
      ? `“${blockingActionLabels[0]}”`
      : blockingActionLabels.length === 2
      ? `“${blockingActionLabels[0]}” and “${blockingActionLabels[1]}”`
      : blockingActionLabels.length > 2
      ? `the ${blockingActionLabels.length} actions above`
      : 'your other actions';

  const movement = gameServices.dataService.getMovement(player.currentSpace, player.visitType);
  const isDiceMovementSpace = movement?.movement_type === 'dice';
  const hasPlayerRolledDice = gameState.hasPlayerRolledDice;
  const movementChoiceUnlocked = gameState.movementChoiceUnlocked ?? true;
  const movementChoice =
    isMyTurn && gameState.awaitingChoice?.type === 'MOVEMENT' ? gameState.awaitingChoice : null;
  const selectedDestination = player.moveIntent || null;
  // NOTE: a needsMovementChoice flag (choice pending AND nothing picked yet AND
  // unlocked) used to gate this section. It went dead when the rules below
  // changed — options now render whenever a movement choice exists, regardless
  // of pick or unlock state — so it has been removed rather than left to read
  // like a live gate.
  //
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
  // Name the destinations on the collapsed toggle instead of only counting them.
  // 2026-09-05 playtest: "Move — 2 options" drew 8 hits — "states there are two
  // options but does not list what those specific options are". Both names fit at
  // two; past that the row would run long, so it says how many and they open
  // below. MOVEMENT.csv has 8 two-option spaces, 1 three- and 3 four-option.
  const movementOptionLabels = (movementChoice?.options ?? []).map(
    (o) =>
      gameServices.dataService.getGameConfigBySpace(o.id)?.display_label_override
      || o.label
      || shortName(o.id),
  );
  const showMovementDiceButton = shouldShowMovementDiceButton(visiblePendingActions, {
    isDiceMovementSpace,
    hasPlayerRolledDice,
  });

  const canEndTurn = gameServices.gameRulesService.canEndTurn(playerId);
  const remaining = Math.max(0, gameState.requiredActions - gameState.completedActionCount);
  // How much of `remaining` is just "you haven't picked a destination yet".
  // Mirrors StateService.calculateRequiredActions exactly: choice movement adds
  // +1 to required and only counts as completed once moveIntent is set. Split
  // out so the reason line can say which of the two things is actually missing —
  // before this, the "Finish … above first" branch always won on choice spaces
  // (movement_choice keeps `remaining` at ≥1 until a destination is picked), so
  // "Pick where you're going first" was unreachable and the panel asked for the
  // wrong thing at every choice space in the game.
  const movementPickOutstanding = movement?.movement_type === 'choice' && !selectedDestination ? 1 : 0;
  const blockingActionsRemaining = Math.max(0, remaining - movementPickOutstanding);

  // Open the destination list for the player when choosing where to go is the
  // ONLY thing left (Tom, 2026-09-19: "narrow"). The list starts folded so a
  // choice space does not look like N extra actions (fb:feedback-1782843206015-
  // 8edd02b4) — but once every real action is done the commit spine is gated on
  // nothing else, and a folded list means the one thing left to do is hidden.
  // The nightly playtest robot hit exactly that 13 times (09-08, 09-18: "the
  // destination list never unfolded", at PM-DECISION-CHECK).
  //
  // Deliberately NOT "always open": while a real action remains the list stays
  // folded, so the action is what the player sees first. `blockingActionsRemaining`
  // and `movementChoiceUnlocked` are the same fact from two sides (the engine's
  // "everything else is done" flag, which also decides whether the options are
  // pressable), so opening on both can never show a list of disabled rows. A
  // SKIPPABLE action does not count — it is never in requiredActions — so a
  // player looking at "Swap a team member (optional)" still gets the list, which
  // is the PM-DECISION-CHECK case.
  //
  // Edge-triggered, not derived: it opens on the moment this BECOMES true and
  // then leaves the state alone, so a player who folds the list stays folded and
  // picking a destination never closes it (fb:c2e489dc). The "adjust state while
  // rendering" pattern, same as the space-change reset above.
  const pickIsOnlyGate =
    isMyTurn &&
    showMovementOptions &&
    !selectedDestination &&
    movementChoiceUnlocked &&
    blockingActionsRemaining === 0;
  if (pickIsOnlyGate !== pickWasOnlyGate) {
    setPickWasOnlyGate(pickIsOnlyGate);
    if (pickIsOnlyGate) setShowMoveOptions(true);
  }

  // This turn's tab so far (fb:06f7da3b / b53864af) — the money paid and the
  // days added by this visit, echoed under the commit spine so ending the turn
  // isn't a mystery total. Three sources: (1) the space's own unconditional
  // auto time cost ("Spend 50 days" rows — applied on arrival BEFORE the REAL
  // turn-start snapshot is captured, so a snapshot diff alone misses it);
  // (2) time added DURING the turn (dice outcomes, negotiate penalties) via
  // the REAL-snapshot diff; (3) money from the turn cost ledger (every
  // spendMoney this turn, sticks across Try Again). Dice-conditional time rows
  // are excluded from (1) — when they land they show up in (2). A row whose days
  // follow the loan ("1 day per $200K") is NOT dice-conditional: it is counted at
  // the figure the loan on the table comes to (the same one End Turn charges).
  const loanOnTable = getLoanOnTheTable(gameServices.stateService, playerId);
  const spaceVisitDays = allSpaceEffects
    .filter((e) => e.effect_type === 'time' && e.effect_action === 'add' && e.trigger_type === 'auto' && (!e.condition || perAmountUnit(e.condition) !== null))
    .reduce((s, e) => s + (timeRowDays(e, loanOnTable) || 0), 0);
  const turnOutflow = isMyTurn ? gameServices.stateService.getTurnOutflow(playerId) : null;
  const turnStartState = isMyTurn ? gameServices.stateService.getRealPlayerState(playerId) : null;
  const turnMoneySpent = turnOutflow?.moneySpent ?? 0;
  const turnDaysAdded =
    spaceVisitDays + (turnStartState ? Math.max(0, player.timeSpent - turnStartState.timeSpent) : 0);
  const turnCostParts: string[] = [];
  if (turnDaysAdded > 0) turnCostParts.push(`🕐 +${turnDaysAdded} day${turnDaysAdded === 1 ? '' : 's'}`);
  if (turnMoneySpent > 0) turnCostParts.push(`💰 −${FormatUtils.formatMoney(turnMoneySpent)}`);
  const turnCostLine = isMyTurn && turnCostParts.length > 0 ? `this turn: ${turnCostParts.join(' · ')}` : null;

  // Cost-preview rows for the footer's End Turn / Try Again toggle
  // (fb:feedback-1783080349985-a3dc215f) — reuses the same classification
  // logic the data layer already computes; this component only renders it.
  // See src/utils/costPreview.ts for why the two differ (End Turn = the
  // space's declared SPACE_EFFECTS.csv cost; Try Again = the real
  // TurnCostLedger spend plus categories relabeled "will be re-drawn").
  const endTurnCostRows = getEndTurnCostPreview(gameServices, player.currentSpace, player.visitType, playerId, completedActions);
  // getTryAgainCostPreview intentionally does NOT take completedActions — see
  // the comment at its call to getEndTurnCostPreview in costPreview.ts for why.
  const tryAgainCostRows = getTryAgainCostPreview(gameServices, playerId);

  // --- handlers (same service calls as the classic panel) ------------------
  const handleManualEffect = async (effectKey: string) => {
    try {
      const result = await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectKey);
      if (onManualEffectResult && result) onManualEffectResult(result);
    } catch (err) {
      console.error(`Manual effect error (${effectKey}):`, err);
    }
  };
  const handleFileAffidavit = () => {
    const result = gameServices.cardService.fileAffidavitOfCorrection(playerId);
    if (!result) return;
    setAffidavitResult(result);
    window.setTimeout(() => setAffidavitResult((prev) => (prev === result ? null : prev)), 6000);
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
  // The End caption is ALWAYS the space's own forward label ("Lock the scope"),
  // even when the turn isn't endable yet — the reason it's not endable goes on
  // a second line instead of replacing the name. Until 2026-09-02 the caption
  // read "2 actions left" and the forward move had no name on screen, so the
  // only named control was "Push back" (which costs a day and returns you to
  // the same space). A local-model playtest burned 11 of 17 moves alternating
  // between the two action buttons and Push back before it ever discovered
  // "Lock the scope" existed. Also fixes the "0 actions left" caption that
  // showed when the turn was gated on an unpicked destination, not on actions.
  let commit: { label: string; ready: boolean; subLabel?: string; onClick?: () => void };
  if (!isMyTurn) {
    commit = { label: COMMIT.waitingFor(currentPlayerName || 'the other player'), ready: false };
  } else if (showMovementDiceButton) {
    commit = {
      label: isRollingDice ? COMMIT.WORKING : content?.end_turn_label || COMMIT.TAKE_YOUR_NEXT_STEP,
      ready: true,
      onClick: handleDiceRoll,
    };
  } else if (canEndTurn) {
    commit = { label: isEndingTurn ? COMMIT.ENDING : content?.end_turn_label || COMMIT.END_TURN, ready: true, onClick: handleEndTurn };
  } else {
    commit = {
      label: content?.end_turn_label || COMMIT.END_TURN,
      ready: false,
      // Say which of the two gates is actually open, in this order: real
      // outstanding actions first (they must be done before the destination
      // picker even unlocks — the "show last" rule), then the destination pick.
      subLabel:
        blockingActionsRemaining > 0
          ? blockingActionsRemaining === 1 && blockingActionLabels.length === 1
            ? `Finish “${blockingActionLabels[0]}” above first`
            : `Finish ${blockingActionsRemaining} thing${blockingActionsRemaining === 1 ? '' : 's'} above first`
          : movementPickOutstanding || (showMovementOptions && !selectedDestination)
          ? 'Pick where you’re going first'
          : 'Not ready yet',
    };
  }
  // v3.2.60 — name where a picked destination leads, on the control that
  // actually goes there. The 2026-09-12 nightly robot toggled `➡️ Find an
  // Engineer` / `✅ Find an Engineer` ~20 times at ARCH-SCOPE-CHECK and never
  // committed: the commit side was live (`data-actionable=true` the moment a
  // destination was picked) but it reads as an in-fiction act ("Sign off on the
  // design"), while the rows that LOOK like movement only select. The robot
  // logged the same ambiguity a newcomer would (7 hits "'Pick Your Path' could
  // mean selecting a branch or just choosing the option above"; 4 hits "the
  // arrow suggests movement but leads nowhere"). Maintainer's call 2026-09-12:
  // keep the in-fiction verb, add the signpost — NOT relabel the arrow rows.
  // Joined through UI_STRINGS (COMMIT.withDestination) so a reskin owns the
  // connector and word order too; both halves are already data (the space's
  // end_turn_label and the destination's display label).
  const commitLabel =
    isMyTurn && selectedMovementLabel && !isEndingTurn
      ? COMMIT.withDestination(commit.label, selectedMovementLabel)
      : commit.label;
  // v3.2.65 (fb:ae480630): "when actions are completed the negotiate and/or
  // accept buttons should become the highlighted buttons" — previously gated
  // to player.visitType === 'First', so completing the actions on a
  // SUBSEQUENT visit (a common case: Try Again re-enters the same space)
  // never highlighted the control that just became pressable. The dot now
  // tracks commit.ready alone — it lights up the instant there is something
  // to press, on any visit, and goes dark again once the turn ends.
  const showGreenDot = isMyTurn && commit.ready;
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
  // No maxWidth/margin/border/radius here on purpose (maintainer feedback
  // 2026-08-18: a visible frame + capped width wasted real screen space,
  // especially on phone — "there should be no border we need the space").
  // Fills whatever width the parent (GameLayout's grid, or the phone
  // full-bleed layout) actually gives it instead of imposing its own gutter.
  const cardStyle: React.CSSProperties = {
    width: '100%',
    background: p.bg,
    color: p.text,
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
  // At-a-glance boxes (fb:adad1561). The whole box is the button — no separate
  // "details" control (Tom, 2026-09-17: "can't we just press the area?"). The
  // › marks it as tappable.
  const glanceTile: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    minWidth: 0,
    minHeight: 58,
    boxSizing: 'border-box',
    textAlign: 'left',
    background: p.surf,
    border: `1px solid ${p.border}`,
    borderRadius: 9,
    padding: '7px 9px',
    color: p.text,
    font: 'inherit',
    cursor: 'pointer',
  };
  const glanceLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, width: '100%', fontSize: 11, color: p.muted };
  const glanceArrow: React.CSSProperties = { marginLeft: 'auto', fontSize: 13, color: p.muted };
  const glanceValue: React.CSSProperties = { fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' };
  const glanceSub: React.CSSProperties = { fontSize: 10.5, color: p.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' };
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

      {/* Status — at a glance (fb:adad1561, Tom 2026-09-17). Four tappable
          boxes replace the money/time row, the "My numbers" and "History"
          buttons, and the old "What's affecting you" zone. Each box opens its
          own page; Time opens History.

          Onboarding Phase C, Slice 3 (v3.2.72): ONE shared "?" for all four,
          not one each — each tile is itself a <button> (opens its detail
          page), and HelpButton must never nest inside a real <button> (see
          HelpButton.tsx), so a per-tile "?" would need restructuring every
          tile. One "?" above the grid reads "4 short captions" as 4 sections
          of the one card the rest of the panel already uses, instead of 4
          separate cards. Closes the #2 confusion in the 2026-09-21 playtest
          report (12 trips): "deficit" (the Money section below) had no
          explanation anywhere — checked live against the glossary API,
          0 of 274 terms. */}
      <div style={pad}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <HelpButton
            kind="glance"
            label="the numbers at a glance"
            isOpen={openHelp === 'glance'}
            cardId="help-card-glance"
            onToggle={() => toggleHelp('glance', 'glance')}
            palette={p}
            minHeight={26}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 7 }}>
          <button type="button" data-testid="glance-money" onClick={() => setNumbersPage('money')} style={glanceTile}
            aria-label={`${NUMBERS.TILE_MONEY}: $${player.money.toLocaleString()}${moneyCue.word ? `, ${moneyCue.word}` : ''}`}>
            <span style={glanceLabel}><span aria-hidden>💰</span> {NUMBERS.TILE_MONEY}<span aria-hidden style={glanceArrow}>›</span></span>
            <span style={{ ...glanceValue, color: moneyCue.color }}>${player.money.toLocaleString()}</span>
            {moneyCue.word && <span style={{ ...glanceSub, color: moneyCue.color, fontWeight: 700 }}>{moneyCue.word}</span>}
          </button>
          <button type="button" data-testid="glance-time" onClick={() => setShowChronicle(true)} style={glanceTile}
            aria-label={`${NUMBERS.TILE_TIME}: ${NUMBERS.days(player.timeSpent)}`}>
            <span style={glanceLabel}><span aria-hidden>🕐</span> {NUMBERS.TILE_TIME}<span aria-hidden style={glanceArrow}>›</span></span>
            <span style={glanceValue}>{NUMBERS.days(player.timeSpent)}</span>
          </button>
          <button type="button" data-testid="glance-expeditors" onClick={() => setNumbersPage('expeditors')}
            className={playableExpeditors.length > 0 && playingCardId === null ? 'uc-hint-glow' : undefined}
            style={glanceTile}
            aria-label={`${NUMBERS.TILE_EXPEDITORS}: ${expeditorPageCount}${playableExpeditors.length > 0 ? `, ${NUMBERS.ready(playableExpeditors.length)}` : ''}`}>
            <span style={glanceLabel}><span aria-hidden>⚡</span> {NUMBERS.TILE_EXPEDITORS}<span aria-hidden style={glanceArrow}>›</span></span>
            <span style={glanceValue}>{expeditorPageCount > 0 ? expeditorPageCount : NUMBERS.NONE}</span>
            {playableExpeditors.length > 0 && (
              <span style={{ ...glanceSub, color: p.accent, fontWeight: 700 }}>{NUMBERS.ready(playableExpeditors.length)}</span>
            )}
          </button>
          <button type="button" data-testid="glance-scope" onClick={() => setNumbersPage('scope')} style={glanceTile}
            aria-label={`${NUMBERS.TILE_SCOPE}: ${fin.workPackages.length}, ${FormatUtils.formatMoney(fin.scopeTotal)}`}>
            <span style={glanceLabel}><span aria-hidden>🏢</span> {NUMBERS.TILE_SCOPE}<span aria-hidden style={glanceArrow}>›</span></span>
            <span style={glanceValue}>{fin.workPackages.length > 0 ? fin.workPackages.length : NUMBERS.NONE}</span>
            {fin.scopeTotal > 0 && <span style={glanceSub}>{FormatUtils.formatMoney(fin.scopeTotal)}</span>}
          </button>
        </div>
        {openHelp === 'glance' && (
          <HelpCard
            id="help-card-glance"
            kind="glance"
            palette={p}
            onTermClick={(term) => openWithTerm(term.id)}
            sections={[
              { label: 'Money:', text: GLANCE_HELP.money },
              { label: 'Time:', text: GLANCE_HELP.time },
              { label: 'Expeditors:', text: GLANCE_HELP.expeditors },
              { label: 'Scope:', text: GLANCE_HELP.scope },
            ]}
          />
        )}
        {(dob || fdny || violation) && (
          <div style={{ display: 'flex', marginTop: 8 }}>
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
              {violation && (
                <span title={
                  violationDaysLeft != null && violationDaysLeft >= 0
                    ? `Violation — ${violationDaysLeft} day${violationDaysLeft === 1 ? '' : 's'} left to file`
                    : `Violation — filing deadline passed`
                }>
                  VIOLATION <span style={{ color: violation.dot, fontWeight: 500 }}>{violation.mark}</span>
                  {violationDaysLeft != null && (
                    <span style={{ marginLeft: 3 }}>
                      ({violationDaysLeft >= 0 ? `${violationDaysLeft}d left` : `${-violationDaysLeft}d overdue`})
                    </span>
                  )}
                </span>
              )}
            </span>
          </div>
        )}
        {player.violationStatus === 'active' && (
          <div style={{ marginTop: 10 }}>
            <ActionButton
              label="File Affidavit of Correction"
              variant="primary"
              onClick={handleFileAffidavit}
              ariaLabel="File the Affidavit of Correction for your open violation"
            />
          </div>
        )}
        {affidavitResult && (
          <div style={{ marginTop: 8, fontSize: 12, color: affidavitResult.onTime ? '#22c55e' : '#ef4444' }}>
            Affidavit filed {affidavitResult.onTime ? 'on time' : 'late'} — ${affidavitResult.feeCharged.toLocaleString()} civil penalty charged.
          </div>
        )}
      </div>

      {/* Purpose */}
      <div style={pad}>
        <p style={zlbl}>Where you are &amp; why</p>
        <div style={{ background: p.surf, borderLeft: `3px solid ${p.accent}`, padding: '10px 12px' }}>
          {/* The space's own "?" sits at the title's right edge — the same "?"
              the action rows wear, so a newcomer learns ONE gesture. It replaces
              the plain-text "▸ What to do & why" link (same two lines of text,
              now in the shared card below the story). */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>📍 {spaceLabel}</div>
            {hasGuidance && (
              <HelpButton
                kind="step"
                label={spaceLabel}
                isOpen={openHelp === 'step'}
                cardId="help-card-step"
                onToggle={() => toggleHelp('step', 'step')}
                palette={p}
                minHeight={26}
              />
            )}
          </div>
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
        {hasGuidance && openHelp === 'step' && content && (
          <HelpCard
            id="help-card-step"
            kind="step"
            palette={p}
            onTermClick={(term) => openWithTerm(term.id)}
            sections={[
              { label: 'What to do:', text: content.action_description ?? '' },
              { label: 'Why:', text: content.outcome_description ?? '' },
            ]}
          />
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

      {/* This turn — pending actions, done traces, movement */}
      {isMyTurn &&
        (visiblePendingActions.length > 0 || doneActionTraces.length > 0 || showMovementOptions) && (
        <div style={pad}>
          <p style={zlbl}>{ACTION_ROW.HEADER}</p>
          {visiblePendingActions.map((a) => {
            // Teaching layer (Onboarding Phase C, v3.2.54). The explanation is a
            // SIBLING of the action button, never a child, and that is structural
            // rather than stylistic: TextWithTerms renders a glossary term as
            // <span role="button"> with stopPropagation(), so a term nested inside
            // a real <button> swallows the press. That constraint is why v3.2.51
            // put plain words on the buttons — which told a beginner what to press
            // and nothing about what it means. Explaining alongside the button is
            // the only place the two can coexist, so this is where the hard words
            // finally get to define themselves.
            // A merged dice button (two rows sharing one roll) explains BOTH
            // outcomes — `mergedFrom` is what collapsePairedDiceActions folded in.
            const why = getManualEffectTooltip(a.effect, a.mergedFrom?.map((m) => m.effect));
            // Namespaced so an action row and the space's own "?" share the ONE
            // open-at-a-time slot without ever colliding on a key.
            const helpId = `action:${a.effectKey}`;
            const helpCardId = `help-card-${a.effectKey.replace(/[^A-Za-z0-9_-]/g, '-')}`;
            const isOpen = openHelp === helpId;
            return (
              <div key={a.effectKey}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
                  <button
                    // Structural handle for the playtest robot. It finds real
                    // actions two ways, and v3.2.54 broke the second: the
                    // `.uc-hint-glow` class only exists on a FIRST visit, and the
                    // fallback selector is a DIRECT-child match ("… > button"),
                    // which stopped matching the moment this button was wrapped
                    // in the row <div> that carries the "What's this?" sibling.
                    // On a revisit both paths now come back empty, so the robot
                    // would go blind exactly where it had been before — the same
                    // failure that was fixed on 2026-09-03. Latent today only
                    // because no game currently survives to a second visit.
                    data-testid="action-button"
                    data-effect-key={a.effectKey}
                    className={firstVisitHint ? 'uc-hint-glow' : undefined}
                    style={{ ...actionBtn, flex: 1, width: 'auto' }}
                    disabled={a.isDiceEffect && isRollingDice}
                    onClick={() =>
                      a.isDiceEffect && onRollDice ? handleDiceRoll() : handleManualEffect(a.effectKey)
                    }
                  >
                    {a.isDiceEffect && isRollingDice
                      ? 'Deciding…'
                      : `${a.icon ? a.icon + ' ' : ''}${a.label.replace(/^🎲\s*/, '')}`}
                    {/* Skippable actions never gate the move (StateService leaves
                        them out of requiredActions), so say so — a player who
                        skipped one read the open gate as a bug (fb:ba16e596). */}
                    {isSkippableEffectAction(a.effectKey) && !(a.isDiceEffect && isRollingDice) && (
                      <span data-testid="action-optional-tag" style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: p.muted }}>
                        · {ACTION_ROW.OPTIONAL}
                      </span>
                    )}
                  </button>
                  {/* The shared "?" — the 44px touch target and the row-stretch
                      it had here are now HelpButton's own (v3.2.71). */}
                  <HelpButton
                    kind="action"
                    label={a.label.replace(/^🎲\s*/, '')}
                    isOpen={isOpen}
                    cardId={helpCardId}
                    onToggle={() => toggleHelp(helpId, 'action')}
                    palette={p}
                  />
                </div>
                {isOpen && (
                  <HelpCard
                    id={helpCardId}
                    kind="action"
                    palette={p}
                    onTermClick={(term) => openWithTerm(term.id)}
                    sections={[
                      { text: why.tooltip },
                      { text: why.context, muted: true },
                    ]}
                  />
                )}
              </div>
            );
          })}
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
                // Structural handle for the nightly playtest robot. It used to
                // find this row by matching its VISIBLE TEXT against
                // /move\s*[-–—]\s*\d+\s*option/ — so when v3.2.52 renamed the row
                // to "…places to pick from" (an 8-hit playtest complaint: the old
                // wording never said WHICH options), the opener stopped matching,
                // the destination list never unfolded, and the robot could not
                // move at all. Destination clicks went 7 → 0 and stayed 0 for
                // three nights, on three different seeds. Copy on this row is
                // free to change; this attribute is not. Read `aria-expanded`
                // for open/closed rather than the ▸/▾ glyph, same reason.
                data-testid="move-expander"
                // Distinct accessible name from any individual destination's own
                // label — the visible text below can echo a destination name
                // ("you picked Fee Review"), which would otherwise collide with
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
                  ? `➡️ Move — you picked ${selectedMovementLabel}`
                  : movementOptionLabels.length === 2
                  ? `➡️ Move — ${movementOptionLabels[0]} or ${movementOptionLabels[1]}`
                  : `➡️ Move — ${movementChoice!.options.length} places to pick from`}
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
                        // Structural handle + the destination's own space id, so
                        // the playtest robot can both FIND a destination and say
                        // which one it took without parsing the label. The label
                        // is authored copy (display_label_override) and the
                        // leading glyph flips ➡️/✅ with selection, so neither is
                        // safe to match on. Pickability is `disabled` /
                        // `aria-disabled`, already set below — never the glyph,
                        // which is identical when locked and when merely unpicked.
                        data-testid="move-option"
                        data-space-id={opt.id}
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
                        // Light the matching board tile while pointing at a
                        // choice (fb:6416f76e extra, fb:71935ebb). Local only —
                        // the picked one is already shown via moveIntent.
                        onMouseEnter={() => movementChoiceUnlocked && setDestinationPreview(opt.id)}
                        onMouseLeave={() => setDestinationPreview(null)}
                        onFocus={() => movementChoiceUnlocked && setDestinationPreview(opt.id)}
                        onBlur={() => setDestinationPreview(null)}
                      >
                        {!movementChoiceUnlocked ? '➡️' : isSelected ? '✅' : '➡️'} {label}
                      </button>
                    );
                  })}
                  {!movementChoiceUnlocked && (
                    <p style={{ fontSize: 10, color: p.muted, margin: '1px 0 6px' }}>
                      Finish {blockingActionPhrase} first, then pick where to go.
                    </p>
                  )}
                  {movementChoiceUnlocked && selectedDestination && (
                    <p style={{ fontSize: 10, color: p.muted, margin: '1px 0 6px' }}>
                      You can change where you’re going until you end your turn.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {doneActionTraces.length > 0 && (
            // Finished actions used to sit directly under "Things you can do",
            // a header that then listed things you could NOT do — the literal
            // contradiction behind that header's 16 playtest hits ("might not
            // understand that this header lists available actions rather than
            // being a status report") and behind the ✓ rows reading as buttons.
            // The group header is also the a11y "colour AND a word" rule this
            // file already applies to the money cue: done was signalled only by
            // gray + a ✓ glyph, and "Done" existed solely in aria-label.
            <p style={{ ...zlbl, margin: '9px 0 6px' }}>Already done this turn</p>
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
        {/* End Turn / Try Again decision. TurnCommitControl (press-and-hold to
            commit, tap to compare) was A/B tested against a separate-buttons
            design (fb:f453b1f3) gated on light/dark mode; the maintainer
            picked TurnCommitControl as the clear winner after playtesting
            both (2026-07-14), so it's now unconditional — both themes share
            the same control, styled via its own `mode` prop. When there's no
            negotiate option at all (not this player's turn, or the space
            doesn't offer one), fall through to a plain commit button. */}
        {isMyTurn && content && content.can_negotiate && onTryAgain ? (
          <TurnCommitControl
            mode={mode}
            tryAgainLabel={content.try_again_label || 'Negotiate again'}
            endLabel={commitLabel}
            endActionable={commit.ready}
            endSubLabel={commit.subLabel}
            endTurnRows={endTurnCostRows}
            tryAgainRows={tryAgainCostRows}
            onCommitEnd={commit.onClick}
            onCommitTryAgain={(details) => onTryAgain(playerId, details)}
            endCostLine={turnCostLine ?? undefined}
            showGreenDot={showGreenDot}
            isHelpOpen={openHelp === 'commit'}
            onToggleHelp={() => toggleHelp('commit', 'commit')}
            onTermClick={(term) => openWithTerm(term.id)}
          />
        ) : (
          <button
            onClick={commit.onClick}
            disabled={!commit.ready}
            // Structural handle for the playtest robot, which otherwise looks
            // for this button by matching /^(move forward|end turn|confirm move|
            // commit)/ against its caption. That caption is `end_turn_label`
            // from SPACE_CONTENT.csv — authored per-space copy ("Lock the
            // scope", "Take the check", "Move forward"), so the regex matches
            // some spaces and misses others by accident. `data-ready` mirrors
            // `disabled` for the same reason the gate wording cannot be trusted:
            // v3.2.53 rewrote the subLabel and the robot's "is this gated?"
            // check, which keyed on the old wording, silently started offering
            // a disabled button as a live option.
            data-testid="commit-end-turn"
            data-ready={commit.ready}
            // Only reachable here because there's no Try Again option for
            // this space — a single-choice screen, so highlighting End Turn
            // as the next-move hint doesn't carry the "pick this one over
            // that one" ambiguity it would inside TurnCommitControl's two-
            // tab control above (maintainer feedback 2026-08-18: glow End
            // Turn "only when negotiate button is not shown"). v3.2.65
            // (fb:ae480630): dropped the first-visit-only gate to match
            // showGreenDot above — glows whenever it's actually pressable.
            className={showGreenDot ? 'uc-hint-glow' : undefined}
            style={{
              width: '100%',
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
              {commitLabel}
            </span>
            {!commit.ready && commit.subLabel && (
              <small style={{ display: 'block', fontSize: 10, fontWeight: 400, color: p.muted }}>
                {commit.subLabel}
              </small>
            )}
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
        )}
      </div>

      {/* "Recall my numbers" reference — scope, work packages, money, time. */}
      <PlayerNumbersV2
        isOpen={numbersPage !== null}
        onClose={() => setNumbersPage(null)}
        page={numbersPage ?? 'money'}
        onOpenCard={setDetailCardId}
        playableCardIds={playableExpeditors.map((x) => x.id)}
        onActivate={handlePlayExpeditor}
        playingCardId={playingCardId}
        playerId={playerId}
        gameServices={gameServices}
        mode={mode}
      />

      {/* "What's happened" history — the Chronicle (first slice). */}
      <PlayerChronicleV2
        isOpen={showChronicle}
        onClose={() => setShowChronicle(false)}
        historyCards={historyCardIds.map((id) => {
          const card = gameServices.dataService.getCardById(id);
          return { id, name: card?.card_name ?? id, type: card?.card_type ?? '' };
        })}
        onOpenCard={setDetailCardId}
        playerId={playerId}
        gameServices={gameServices}
        mode={mode}
        onNavigateToSpace={onNavigateToSpace}
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

    </div>
  );
};
