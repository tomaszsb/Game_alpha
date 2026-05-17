import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { Choice } from '../../types/CommonTypes';
import { AutoActionEvent } from '../../services/StateService';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';
import { FinancesSection } from './sections/FinancesSection';
import { TimeSection } from './sections/TimeSection';
import { CardsSection } from './sections/CardsSection';
import { ProjectScopeSection } from './sections/ProjectScopeSection';
import { EventsSection } from './sections/EventsSection';
import { PlayerLogSection } from './sections/PlayerLogSection';
import { ProjectLedger } from './sections/ProjectLedger';
import { StoryAccordion } from './sections/StoryAccordion';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { ApprovalBadges } from './ApprovalBadges';
import { getBackendURL } from '../../utils/networkDetection';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import { formatManualEffectButton } from '../../utils/buttonFormatting';
import './ActionCenterPanel.css';

export type ReferenceTab = 'ledger' | 'money' | 'time' | 'expeditors' | 'events' | 'scope' | 'log' | null;

/**
 * One-shot request from a parent component to switch this panel's active
 * reference tab. Used to auto-open the related tab (Ledger / Expeditors /
 * Events) when a result modal appears, so when the player dismisses the
 * modal the panel is already showing the updated state. `id` is the
 * one-shot key — each new request must increment it. `playerId` scopes
 * the request to a single panel in multi-player layouts.
 */
export interface TabRequest {
  tab: NonNullable<ReferenceTab>;
  playerId: string;
  id: number;
}

export interface ActionCenterPanelProps {
  gameServices: IServiceContainer;
  playerId: string;
  onTryAgain?: (playerId: string) => Promise<void>;
  playerNotification?: string;
  onRollDice?: () => Promise<void>;
  onAutomaticFunding?: () => Promise<void>;
  onManualEffectResult?: (result: import('../../types/StateTypes').TurnEffectResult) => void;
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
  /** Parent-initiated one-shot tab switch (see TabRequest doc). */
  tabRequest?: TabRequest | null;
}

// Helper to format effect action for display
function formatEffectAction(effectType: string, effectAction?: string): string {
  if (effectType === 'cards' && effectAction) {
    const cardTypeMap: { [key: string]: string } = {
      'draw_b': 'Get Bank Loan',
      'draw_i': 'Get Investment',
      'draw_w': 'Add Work Package',
      'draw_l': 'Life Event',
      'draw_e': 'Hire Expeditor',
      'draw_n': 'Negotiate'
    };
    return cardTypeMap[effectAction] || effectAction.replace('draw_', '').toUpperCase();
  }
  const typeMap: { [key: string]: string } = {
    'dice': 'Determine Outcome',
    'cards': 'Get Resource',
    'money': 'Get Funding',
    'time': 'Time Action',
    'movement': 'Select Destination'
  };
  return typeMap[effectType] || effectType.replace('_', ' ');
}

export const ActionCenterPanel: React.FC<ActionCenterPanelProps> = ({
  gameServices,
  playerId,
  onTryAgain,
  playerNotification,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions = { manualActions: {} },
  tabRequest
}) => {
  const { openWithTerm } = useDictionaryPanel();
  const { getPortraitForSpace } = useNpcPortrait();

  // State
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [spaceStory, setSpaceStory] = useState('');
  const [spaceAction, setSpaceAction] = useState('');
  const [spaceOutcome, setSpaceOutcome] = useState('');
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [movementChoice, setMovementChoice] = useState<Choice | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [hasPlayerRolledDice, setHasPlayerRolledDice] = useState(false);
  const [isDiceMovementSpace, setIsDiceMovementSpace] = useState(false);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [activeTab, setActiveTab] = useState<ReferenceTab>(null);
  // Tracks the last consumed tabRequest.id so a single request fires once
  // regardless of unrelated re-renders.
  const lastConsumedTabRequestRef = useRef<number | null>(null);

  // Honor parent-initiated tab switches (e.g. a result modal opening). The
  // request is scoped by playerId so unrelated panels in multi-player
  // layouts don't all jump tabs at once.
  useEffect(() => {
    if (!tabRequest) return;
    if (tabRequest.playerId !== playerId) return;
    if (tabRequest.id === lastConsumedTabRequestRef.current) return;
    lastConsumedTabRequestRef.current = tabRequest.id;
    setActiveTab(tabRequest.tab);
  }, [tabRequest, playerId]);
  const [showMovementTransition, setShowMovementTransition] = useState(false);
  const [movementTransition, setMovementTransition] = useState<{ from: string; to: string } | null>(null);
  const previousCurrentPlayerIdRef = useRef<string | null>(null);
  const previousSpaceRef = useRef<string | null>(null);
  const showMovementTransitionRef = useRef(false);

  // Subscribe to game state
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      const player = gameState.players.find(p => p.id === playerId);
      const newCurrentPlayerId = gameState.currentPlayerId;
      const currentPlayer = gameState.players.find(p => p.id === newCurrentPlayerId);

      // Detect turn transition TO this player (multi-player scenario)
      const turnJustStartedForThisPlayer =
        previousCurrentPlayerIdRef.current !== null &&
        previousCurrentPlayerIdRef.current !== playerId &&
        newCurrentPlayerId === playerId;

      // Also detect same-player movement (single-player or turn continuation)
      const isCurrentPlayer = newCurrentPlayerId === playerId;
      const spaceChanged = previousSpaceRef.current !== null && previousSpaceRef.current !== player?.currentSpace;

      // Show movement transition overlay on turn change or space change
      const shouldShowTransition =
        !showMovementTransitionRef.current && // Don't trigger if already showing
        (turnJustStartedForThisPlayer || (isCurrentPlayer && spaceChanged)) &&
        previousSpaceRef.current !== null && player?.currentSpace;

      if (shouldShowTransition && player) {
        setMovementTransition({
          from: previousSpaceRef.current!,
          to: player.currentSpace
        });
        setShowMovementTransition(true);
        showMovementTransitionRef.current = true;
        setTimeout(() => {
          setShowMovementTransition(false);
          showMovementTransitionRef.current = false;
        }, 5000);
      }

      // Update tracking refs
      previousCurrentPlayerIdRef.current = newCurrentPlayerId;
      previousSpaceRef.current = player?.currentSpace || null;
      setCurrentPlayerId(newCurrentPlayerId);
      setCurrentPlayerName(currentPlayer?.name || '');

      if (player) {
        // Get space story
        const space = gameServices.dataService.getSpaceByName(player.currentSpace);
        if (space?.content?.length) {
          const visitContent = space.content.find(c => c.visit_type === player.visitType);
          setSpaceStory(visitContent?.story || '');
          setSpaceAction(visitContent?.action_description || '');
          setSpaceOutcome(visitContent?.outcome_description || '');
        } else {
          setSpaceStory('');
          setSpaceAction('');
          setSpaceOutcome('');
        }

        // Dice movement state
        const movement = gameServices.dataService.getMovement(player.currentSpace, player.visitType);
        setIsDiceMovementSpace(movement?.movement_type === 'dice');
        setHasPlayerRolledDice(gameState.hasPlayerRolledDice);

        // Movement choice
        if (gameState.currentPlayerId === playerId && gameState.awaitingChoice?.type === 'MOVEMENT') {
          setMovementChoice(gameState.awaitingChoice);
          if (player.moveIntent) {
            setSelectedDestination(player.moveIntent);
          }
        } else if (gameState.currentPlayerId === playerId && !gameState.awaitingChoice) {
          setMovementChoice(null);
          setSelectedDestination(null);
        }
      }
    });

    // Initialize
    const gameState = gameServices.stateService.getGameState();
    const player = gameServices.stateService.getPlayer(playerId);
    const initialCurrentPlayerId = gameState.currentPlayerId;
    setCurrentPlayerId(initialCurrentPlayerId);
    previousCurrentPlayerIdRef.current = initialCurrentPlayerId; // Initialize to current so first render doesn't trigger transition
    if (player) previousSpaceRef.current = player.currentSpace;
    const currentPlayer = gameState.players.find(p => p.id === initialCurrentPlayerId);
    setCurrentPlayerName(currentPlayer?.name || '');

    if (player) {
      const space = gameServices.dataService.getSpaceByName(player.currentSpace);
      if (space?.content?.length) {
        const visitContent = space.content.find(c => c.visit_type === player.visitType);
        setSpaceStory(visitContent?.story || '');
        setSpaceAction(visitContent?.action_description || '');
        setSpaceOutcome(visitContent?.outcome_description || '');
      }
      const movement = gameServices.dataService.getMovement(player.currentSpace, player.visitType);
      setIsDiceMovementSpace(movement?.movement_type === 'dice');
      setHasPlayerRolledDice(gameState.hasPlayerRolledDice);

      if (gameState.currentPlayerId === playerId && gameState.awaitingChoice?.type === 'MOVEMENT') {
        setMovementChoice(gameState.awaitingChoice);
        if (player.moveIntent) setSelectedDestination(player.moveIntent);
      }
    }

    return unsubscribe;
  }, [gameServices, playerId]);

  // Subscribe to auto-action events (non-movement events like dice rolls, effects)
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribeToAutoActions((event: AutoActionEvent) => {
      // Movement transitions are handled by the state-based subscription above
      // This subscription is kept for other auto-action event types
    });
    return () => { unsubscribe(); };
  }, [gameServices.stateService, playerId]);

  // Get player data
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  const isMyTurn = playerId === currentPlayerId;

  // Space info
  const spaceContent = gameServices.dataService.getSpaceContent(player.currentSpace, player.visitType);
  const spaceTitle = spaceContent?.title || '';
  const spaceConfig = gameServices.dataService.getGameConfigBySpace(player.currentSpace);
  const currentPhase = spaceConfig?.phase;

  // Per-space arrival time cost — sum of non-manual `time` effects defined on
  // this space/visit. Surfaces "5 days here" in the header so the player
  // sees the time delta on arrival without waiting for a modal.
  // Playtest 2026-05-15: "I see nothing about time being added so far anywhere"
  // — they want time visible on the move-to-space banner.
  const arrivalTimeCost = useMemo(() => {
    const effects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType) || [];
    return effects
      .filter(e => e.effect_type === 'time' && e.trigger_type !== 'manual' && e.effect_action !== 'subtract')
      .reduce((sum, e) => sum + (Number(e.effect_value) || 0), 0);
  }, [gameServices.dataService, player.currentSpace, player.visitType]);

  // v2.50.0: When any effect on this space has an authored narrative, the
  // StoryAccordion takes over and the legacy flat PM Action / Outcome blocks
  // are hidden (the per-action narratives replace them). Spaces without any
  // authored narrative fall back to the legacy blocks so content can be
  // rolled out space-by-space.
  const hasAnyActionNarrative = useMemo(() => {
    const effects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType) || [];
    return effects.some((e) => {
      const action = e.effect_action || '';
      if (!action) return false;
      return !!gameServices.dataService.getEffectNarrative(player.currentSpace, player.visitType, action);
    });
  }, [gameServices.dataService, player.currentSpace, player.visitType]);

  // Playable E cards
  const playableECards = useMemo(() => {
    return (player.hand || []).filter(cardId => {
      const card = gameServices.dataService.getCardById(cardId);
      if (!card || card.card_type !== 'E') return false;
      if (card.phase_restriction && card.phase_restriction !== 'Any') {
        if (currentPhase?.toUpperCase() !== card.phase_restriction.toUpperCase()) return false;
      }
      // Block time-reduction-only cards when timeSpent is 0
      if (card.tick_modifier) {
        const tickVal = parseInt(card.tick_modifier, 10);
        if (!isNaN(tickVal) && tickVal < 0 && (player.timeSpent || 0) === 0) {
          const hasMoney = card.money_effect && parseInt(card.money_effect, 10) !== 0;
          const hasDraw = card.draw_cards && parseInt(card.draw_cards, 10) > 0;
          if (!hasMoney && !hasDraw) return false;
        }
      }
      return true;
    });
  }, [player.hand, currentPhase, player.timeSpent, gameServices.dataService]);

  // Required actions
  const pendingActions = useMemo(() => {
    const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
    const conditionFiltered = gameServices.turnService.filterSpaceEffectsByCondition(allSpaceEffects, player) || [];
    const manualEffects = conditionFiltered.filter(e => e.trigger_type === 'manual');

    return manualEffects.map(effect => {
      const effectKey = effect.effect_action
        ? `${effect.effect_type}:${effect.effect_action}`
        : effect.effect_type;

      // Dice-type effects are completed when diceRoll is set, not via manualActions
      const isDiceEffect = effect.effect_type === 'dice';
      const isDiceCompleted = completedActions.diceRoll !== undefined;

      const completedKeys = Object.keys(completedActions.manualActions);
      // Match by exact compound key (e.g., 'dice:dice_outcome') or specific effect_action
      // Do NOT match by bare effect_type — that disables all siblings of the same type
      const isCompleted = isDiceEffect ? isDiceCompleted : completedKeys.some(
        key => key === effectKey ||
               (effect.effect_action && key === effect.effect_action) ||
               key.toLowerCase() === effectKey.toLowerCase() ||
               (effect.effect_action && key.toLowerCase() === effect.effect_action.toLowerCase())
      );

      // Voice rule: button labels use real-life language. effect.description
      // is auto-generated by the pipeline as game-language ("Draw 3 E cards"),
      // so don't use it for the rendered button. formatManualEffectButton
      // emits the canonical real-life label ("Hire 3 Expeditors", etc.).
      // Players reported "buttons still talk about cards" (G159, 2026-05-08).
      const formatted = formatManualEffectButton(effect);
      return {
        effectKey,
        effect,
        label: formatted.text || formatEffectAction(effect.effect_type, effect.effect_action),
        isCompleted,
        isDiceEffect
      };
    });
  }, [player.currentSpace, player.visitType, completedActions, gameServices]);

  const needsMovementChoice = !!movementChoice && !selectedDestination;
  const pendingCount = pendingActions.filter(a => !a.isCompleted).length +
    (isDiceMovementSpace && !hasPlayerRolledDice ? 1 : 0) +
    (needsMovementChoice ? 1 : 0);

  // End turn logic
  const gameState = gameServices.stateService.getGameState();
  const actionsComplete = gameState.requiredActions <= gameState.completedActionCount;
  const awaitingChoice = gameState.awaitingChoice;
  const canEndTurn = isMyTurn && actionsComplete &&
    (!awaitingChoice || (awaitingChoice.type === 'MOVEMENT' && !!player.moveIntent));

  // Check which tabs have actions
  const hasMoneyActions = pendingActions.some(a => !a.isCompleted && a.effect.effect_type === 'money');
  const hasECardActions = pendingActions.some(a => !a.isCompleted && a.effect.effect_type === 'cards' && a.effect.effect_action?.toLowerCase().includes('_e'));
  const hasLCardActions = pendingActions.some(a => !a.isCompleted && a.effect.effect_type === 'cards' && a.effect.effect_action?.toLowerCase().includes('_l'));

  // Handlers
  const handleManualEffect = async (effectKey: string) => {
    try {
      const result = await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectKey);
      if (onManualEffectResult && result) onManualEffectResult(result);
    } catch (err) {
      console.error(`Manual effect error (${effectKey}):`, err);
    }
  };

  const handleMovementChoice = (destinationId: string) => {
    if (selectedDestination === destinationId) return;
    setSelectedDestination(destinationId);
    gameServices.stateService.setPlayerMoveIntent(playerId, destinationId);
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
    try { await onRollDice(); }
    catch (err) { console.error('Dice roll error:', err); }
    finally { setIsRollingDice(false); }
  };

  const handlePlayECard = async (cardId: string) => {
    try {
      await gameServices.cardService.playCard(playerId, cardId);
    } catch (err) {
      console.error('E card play error:', err);
    }
  };

  // Build end turn tooltip
  let endTurnTooltip = '';
  if (!canEndTurn && isMyTurn) {
    const remaining = gameState.requiredActions - gameState.completedActionCount;
    if (awaitingChoice && !(awaitingChoice.type === 'MOVEMENT' && player.moveIntent)) {
      endTurnTooltip = 'Complete current action first';
    } else if (remaining > 0) {
      endTurnTooltip = `${remaining} action${remaining > 1 ? 's' : ''} remaining`;
    }
  }

  // Ledger deficit/surplus for tab coloring
  const ms = player.moneySources || { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
  const totalFunding = ms.ownerFunding + ms.bankLoans + ms.investmentDeals + ms.other;
  const wCards = useMemo(() => {
    const allCardIds = [...(player.hand || []), ...(player.activeCards || []).map(ac => ac.cardId)];
    return allCardIds.map(id => gameServices.dataService.getCardById(id)).filter(c => c && c.card_type === 'W');
  }, [player.hand, player.activeCards, gameServices.dataService]);
  const totalScope = wCards.reduce((sum, c) => sum + parseFloat(String(c!.cost || 0)), 0);
  const hasFundingGap = totalScope > 0 && totalFunding < totalScope;
  const hasFundingSurplus = totalFunding > totalScope && totalScope > 0;

  const tabConfig: { key: ReferenceTab; icon: string; label: string; hasBadge: boolean; color?: string }[] = [
    { key: 'ledger', icon: '📊', label: 'Ledger', hasBadge: hasMoneyActions, color: hasFundingGap ? '#e74c3c' : hasFundingSurplus ? '#27ae60' : undefined },
    { key: 'expeditors', icon: '⚡', label: 'Expeditors', hasBadge: hasECardActions || playableECards.length > 0 },
    { key: 'events', icon: '🎲', label: 'Life Events', hasBadge: hasLCardActions },
    { key: 'time', icon: '⏱', label: `${player.timeSpent || 0}d`, hasBadge: false },
    { key: 'log', icon: '📜', label: 'Log', hasBadge: false },
  ];

  return (
    <div className="action-center">
      {/* Movement Transition Overlay */}
      {showMovementTransition && movementTransition && (
        <div
          className="action-center__movement-overlay"
          onClick={() => { setShowMovementTransition(false); showMovementTransitionRef.current = false; }}
          style={{ backgroundColor: player.color ? `${player.color}ee` : 'rgba(33, 150, 243, 0.95)' }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'bounce 1s infinite' }}>🚶</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            {player.name}, your turn!
          </div>
          <div style={{ fontSize: '1.1rem', color: 'white' }}>
            You moved from <strong>{movementTransition.from}</strong> to <strong>{movementTransition.to}</strong>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '20px' }}>Tap to continue</div>
        </div>
      )}

      {/* ===== ZONE 1: Context ===== */}
      <div className="action-center__context">
        {/* Space Header */}
        <div className="action-center__space-header">
          <div className="action-center__space-info">
            <div className="action-center__player-name">{player.name}</div>
            <div className="action-center__space-name">
              📍 {player.currentSpace}
              {spaceTitle && <span className="action-center__space-title"> - {spaceTitle}</span>}
            </div>
            <div className="action-center__time-line">
              {arrivalTimeCost > 0 && (
                <span className="action-center__time-cost">⏱️ +{arrivalTimeCost} {arrivalTimeCost === 1 ? 'day' : 'days'} here</span>
              )}
              <span className="action-center__time-total">
                {arrivalTimeCost > 0 && ' · '}
                {player.timeSpent} {player.timeSpent === 1 ? 'day' : 'days'} total
              </span>
            </div>
          </div>
          {currentPhase && (
            <span className="action-center__phase-badge">{currentPhase}</span>
          )}
          <ApprovalBadges
            dobStatus={player.dobApprovalStatus}
            fdnyStatus={player.fdnyApprovalStatus}
          />
          <ConnectionStatus serverUrl={getBackendURL()} />
        </div>

        {/* NPC Story */}
        {spaceStory && (
          <div
            className={`action-center__story ${!storyExpanded && spaceStory.length > 200 ? 'action-center__story--truncated' : ''}`}
            onClick={() => spaceStory.length > 200 && setStoryExpanded(!storyExpanded)}
          >
            {(() => {
              const portraitSrc = player ? getPortraitForSpace(player.currentSpace) : null;
              const prefix = player ? extractPrefix(player.currentSpace) : null;
              const npcInfo = prefix ? CHARACTER_MAP[prefix] : null;
              return portraitSrc && npcInfo ? (
                <div style={{
                  float: 'left',
                  width: '56px',
                  marginRight: '10px',
                  marginBottom: '4px',
                  textAlign: 'center',
                }}>
                  <img
                    src={portraitSrc}
                    alt={npcInfo.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${npcInfo.color}`,
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                  <span style={{
                    fontSize: '9px',
                    fontStyle: 'normal',
                    fontWeight: 600,
                    color: npcInfo.color,
                    lineHeight: 1.1,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{npcInfo.name} says:</span>
                </div>
              ) : null;
            })()}
            <TextWithTerms text={spaceStory} onTermClick={(term) => openWithTerm(term.id)} />
            {!storyExpanded && spaceStory.length > 200 && (
              <button className="action-center__story-expand" onClick={(e) => { e.stopPropagation(); setStoryExpanded(true); }}>
                read more...
              </button>
            )}
          </div>
        )}

        {/* v2.50.0 — Per-action story accordion. Renders nothing when no
            effect on this space has an authored narrative; in that case the
            legacy flat PM Action / Outcome blocks below are shown instead. */}
        <StoryAccordion
          dataService={gameServices.dataService}
          spaceName={player.currentSpace}
          visitType={player.visitType}
          completedActions={completedActions}
          portraitSrc={getPortraitForSpace(player.currentSpace)}
        />

        {/* Notification — between story and PM action */}
        {playerNotification && (
          <div className="action-center__notification">
            <span>📢</span>
            <span>{playerNotification}</span>
          </div>
        )}

        {/* PM Action Instructions — legacy block, hidden when accordion is active */}
        {!hasAnyActionNarrative && spaceAction && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#e8f4fd',
            borderRadius: '8px',
            borderLeft: '3px solid #2196F3',
            fontSize: '13px',
            color: '#1565C0',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>{player.avatar}</span>
            <span><strong>PM Action:</strong> {spaceAction}</span>
          </div>
        )}

        {/* Outcome — legacy block, hidden when accordion is active */}
        {!hasAnyActionNarrative && spaceOutcome && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f3e5f5',
            borderRadius: '8px',
            borderLeft: '3px solid #7b1fa2',
            fontSize: '13px',
            color: '#4a148c',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>📋</span>
            <span><strong>Outcome:</strong> {spaceOutcome}</span>
          </div>
        )}

      </div>

      {/* ===== ZONE 2: Actions ===== */}
      <div className="action-center__actions">
        {/* Wait Banner */}
        {!isMyTurn && (
          <div className="action-center__wait-banner">
            ⏳ {currentPlayerName}'s Turn — Waiting...
          </div>
        )}

        {/* E Card Callout */}
        {isMyTurn && playableECards.length > 0 && (
          <div className="action-center__e-card-callout">
            <div className="action-center__e-card-header">⚡ EXPEDITOR READY TO HELP</div>
            {playableECards.map(cardId => {
              const card = gameServices.dataService.getCardById(cardId);
              if (!card) return null;
              return (
                <div key={cardId} className="action-center__e-card-item">
                  <div className="action-center__e-card-info">
                    <div className="action-center__e-card-name"><TextWithTerms text={card.card_name} onTermClick={(term) => openWithTerm(term.id)} /></div>
                    {card.description && <div className="action-center__e-card-desc"><TextWithTerms text={card.description} onTermClick={(term) => openWithTerm(term.id)} /></div>}
                  </div>
                  <button
                    className="action-center__e-card-play"
                    onClick={() => handlePlayECard(cardId)}
                  >
                    PLAY
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Dice Roll for Movement */}
        {isMyTurn && isDiceMovementSpace && !hasPlayerRolledDice && onRollDice && (
          <button
            className="action-center__action-btn action-center__action-btn--dice"
            onClick={handleDiceRoll}
            disabled={isRollingDice}
          >
            {isRollingDice ? '🎲 Deciding...' : '🎲 Determine Next Step'}
          </button>
        )}

        {/* Dice roll result */}
        {isDiceMovementSpace && hasPlayerRolledDice && completedActions.diceRoll && (
          <div className="action-center__dice-result">
            🎲 {completedActions.diceRoll}
          </div>
        )}

        {/* Required Actions */}
        {isMyTurn && pendingActions.length > 0 && (
          <>
            <div className="action-center__required-actions-header">
              📋 YOUR ACTIONS {pendingCount > 0 ? `(${pendingCount} remaining)` : '(all complete ✅)'}
            </div>
            {pendingActions.map((action) => (
              <button
                key={action.effectKey}
                className={`action-center__action-btn ${action.isCompleted ? 'action-center__action-btn--completed' : ''} ${action.isDiceEffect ? 'action-center__action-btn--dice' : ''}`}
                onClick={() => {
                  if (action.isCompleted) return;
                  if (action.isDiceEffect && onRollDice) {
                    handleDiceRoll();
                  } else {
                    handleManualEffect(action.effectKey);
                  }
                }}
                disabled={action.isCompleted || !isMyTurn || (action.isDiceEffect && isRollingDice)}
              >
                {action.isCompleted ? '✅ ' : ''}{action.isDiceEffect && isRollingDice ? '🎲 Deciding...' : action.label}
              </button>
            ))}
          </>
        )}

        {/* Auto effect result (e.g., owner seed money) */}
        {completedActions.diceRoll && !isDiceMovementSpace && pendingActions.length === 0 && (
          <div className="action-center__auto-effect-result">
            💰 {completedActions.diceRoll}
          </div>
        )}

        {/* Movement Choices */}
        {movementChoice && (
          <div className="action-center__movement">
            <div className="action-center__movement-header">🚶 CHOOSE YOUR DESTINATION</div>
            {movementChoice.options.map((option, index) => (
              <button
                key={index}
                className={`action-center__movement-btn ${selectedDestination === option.id ? 'action-center__movement-btn--selected' : ''}`}
                onClick={() => handleMovementChoice(option.id)}
              >
                {selectedDestination === option.id ? '✅ ' : '🎯 '}{option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Turn Controls ===== */}
      {isMyTurn && (
        <div className="action-center__turn-controls">
          <button
            className="action-center__end-turn-btn"
            onClick={handleEndTurn}
            disabled={!canEndTurn || isEndingTurn}
            title={endTurnTooltip || (canEndTurn ? 'All actions complete - click to end your turn' : '')}
          >
            <div>{isEndingTurn ? 'Processing...' : (spaceContent?.end_turn_label || 'End Turn')}</div>
            {endTurnTooltip && (
              <div className="action-center__end-turn-subtitle">{endTurnTooltip}</div>
            )}
          </button>
          {onTryAgain && spaceContent?.can_negotiate && (
            <button
              className="action-center__try-again-btn"
              onClick={() => onTryAgain(playerId)}
              title={spaceContent?.can_negotiate ? 'Negotiate for different terms (costs time)' : 'Restore to snapshot saved when you arrived at this space'}
            >
              {spaceContent?.try_again_label || (spaceContent?.can_negotiate ? '🔄 Negotiate' : '🔄 Try Again')}
            </button>
          )}
        </div>
      )}

      {/* ===== ZONE 3: Reference Tabs ===== */}
      <div className="action-center__reference">
        <div className="action-center__tab-bar">
          {tabConfig.map(tab => (
            <button
              key={tab.key}
              className={`action-center__tab ${activeTab === tab.key ? 'action-center__tab--active' : ''}`}
              onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
              style={tab.color ? { color: tab.color } : undefined}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.hasBadge && <span className="action-center__tab-badge" />}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab && (
          <div className="action-center__tab-content">
            {activeTab === 'ledger' && (
              <ProjectLedger
                gameServices={gameServices}
                playerId={playerId}
                renderMode="content"
              />
            )}
            {activeTab === 'time' && (
              <TimeSection
                gameServices={gameServices}
                playerId={playerId}
                completedActions={completedActions}
                isMyTurn={isMyTurn}
                renderMode="content"
              />
            )}
            {activeTab === 'expeditors' && (
              <CardsSection
                gameServices={gameServices}
                playerId={playerId}
                onRollDice={onRollDice}
                onManualEffectResult={onManualEffectResult}
                completedActions={completedActions}
                isMyTurn={isMyTurn}
                renderMode="content"
              />
            )}
            {activeTab === 'events' && (
              <EventsSection
                gameServices={gameServices}
                playerId={playerId}
                onManualEffectResult={onManualEffectResult}
                completedActions={completedActions}
                isMyTurn={isMyTurn}
                renderMode="content"
              />
            )}
            {/* Money and Scope tabs replaced by Ledger above */}
            {activeTab === 'log' && (
              <PlayerLogSection
                gameServices={gameServices}
                playerId={playerId}
              />
            )}
          </div>
        )}
      </div>

      {/* Ledger side button — quick-access pill on the right edge.
       * Playtest feedback (G163): ledger at bottom is hard to find.
       * Hidden when ledger is already the active tab. */}
      {activeTab !== 'ledger' && (
        <button
          type="button"
          className={`action-center__ledger-side ${hasFundingGap ? 'action-center__ledger-side--gap' : hasFundingSurplus ? 'action-center__ledger-side--surplus' : ''}`}
          onClick={() => setActiveTab('ledger')}
          title={hasFundingGap ? 'Funding gap — open ledger' : hasFundingSurplus ? 'Funded — open ledger' : 'Open ledger'}
        >
          <span className="action-center__ledger-side-icon" aria-hidden>📊</span>
          <span>LEDGER</span>
          <span
            className={`action-center__ledger-side-dot ${hasFundingGap ? 'action-center__ledger-side-dot--gap' : hasFundingSurplus ? 'action-center__ledger-side-dot--surplus' : ''}`}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
};
