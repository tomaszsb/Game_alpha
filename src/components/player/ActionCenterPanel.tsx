import React, { useState, useEffect, useMemo } from 'react';
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
import { ConnectionStatus } from '../common/ConnectionStatus';
import { getBackendURL } from '../../utils/networkDetection';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import './ActionCenterPanel.css';

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
}

type ReferenceTab = 'money' | 'time' | 'expeditors' | 'events' | 'scope' | 'log' | null;

// Helper to format effect action for display
function formatEffectAction(effectType: string, effectAction?: string): string {
  if (effectType === 'cards' && effectAction) {
    const cardTypeMap: { [key: string]: string } = {
      'draw_b': 'Get Bank Loan',
      'draw_i': 'Get Investment',
      'draw_w': 'Add Work Package',
      'draw_l': 'Life Event',
      'draw_e': 'Hire Expeditor',
      'draw_n': 'Draw N Card (Negotiation)'
    };
    return cardTypeMap[effectAction] || effectAction.replace('draw_', '').toUpperCase();
  }
  const typeMap: { [key: string]: string } = {
    'dice': 'Roll Dice',
    'cards': 'Pick Up',
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
  completedActions = { manualActions: {} }
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
  const [showMovementTransition, setShowMovementTransition] = useState(false);
  const [movementTransition, setMovementTransition] = useState<{ from: string; to: string } | null>(null);

  // Subscribe to game state
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      const player = gameState.players.find(p => p.id === playerId);
      const newCurrentPlayerId = gameState.currentPlayerId;
      const currentPlayer = gameState.players.find(p => p.id === newCurrentPlayerId);
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
    setCurrentPlayerId(gameState.currentPlayerId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
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

  // Subscribe to movement events
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribeToAutoActions((event: AutoActionEvent) => {
      if (event.type === 'movement' && event.playerId === playerId) {
        setMovementTransition({
          from: event.fromSpace || event.spaceName,
          to: event.toSpace || ''
        });
        setShowMovementTransition(true);
        setTimeout(() => setShowMovementTransition(false), 5000);
      }
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

  // Quick stats calculations
  const projectScope = gameServices.gameRulesService.calculateProjectScope(playerId);
  const designFees = player.expenditures?.design || 0;
  const designFeeRatio = projectScope > 0 ? (designFees / projectScope) * 100 : 0;

  // Playable E cards
  const playableECards = useMemo(() => {
    return (player.hand || []).filter(cardId => {
      const card = gameServices.dataService.getCardById(cardId);
      if (!card || card.card_type !== 'E') return false;
      if (!card.phase_restriction || card.phase_restriction === 'Any') return true;
      return currentPhase?.toUpperCase() === card.phase_restriction.toUpperCase();
    });
  }, [player.hand, currentPhase, gameServices.dataService]);

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
      const isCompleted = isDiceEffect ? isDiceCompleted : completedKeys.some(
        key => key === effectKey ||
               key === effect.effect_type ||
               key.startsWith(effect.effect_type + ':') ||
               key.toLowerCase() === effectKey.toLowerCase() ||
               key.toLowerCase().startsWith(effect.effect_type.toLowerCase() + ':')
      );

      return {
        effectKey,
        effect,
        label: effect.description || formatEffectAction(effect.effect_type, effect.effect_action),
        isCompleted,
        isDiceEffect
      };
    });
  }, [player.currentSpace, player.visitType, completedActions, gameServices]);

  const pendingCount = pendingActions.filter(a => !a.isCompleted).length +
    (isDiceMovementSpace && !hasPlayerRolledDice ? 1 : 0);

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

  const tabConfig: { key: ReferenceTab; icon: string; label: string; hasBadge: boolean }[] = [
    { key: 'money', icon: '💰', label: 'Money', hasBadge: hasMoneyActions },
    { key: 'scope', icon: '📐', label: 'Scope', hasBadge: false },
    { key: 'expeditors', icon: '⚡', label: 'Expeditors', hasBadge: hasECardActions || playableECards.length > 0 },
    { key: 'events', icon: '🎲', label: 'Events', hasBadge: hasLCardActions },
    { key: 'time', icon: '⏱', label: 'Time', hasBadge: false },
    { key: 'log', icon: '📜', label: 'Log', hasBadge: false },
  ];

  return (
    <div className="action-center">
      {/* Movement Transition Overlay */}
      {showMovementTransition && movementTransition && (
        <div
          className="action-center__movement-overlay"
          onClick={() => setShowMovementTransition(false)}
          style={{ backgroundColor: player.color ? `${player.color}ee` : 'rgba(33, 150, 243, 0.95)' }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '20px', animation: 'bounce 1s infinite' }}>🚶</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>You have moved!</div>
          <div style={{ fontSize: '1.1rem', color: 'white' }}>
            <div style={{ marginBottom: '10px' }}><strong>From:</strong> {movementTransition.from}</div>
            <div><strong>To:</strong> {movementTransition.to}</div>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', marginTop: '30px' }}>Tap anywhere to continue</div>
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
          </div>
          {currentPhase && (
            <span className="action-center__phase-badge">{currentPhase}</span>
          )}
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
                  marginRight: '10px',
                  marginBottom: '4px',
                  textAlign: 'center',
                }}>
                  <img
                    src={portraitSrc}
                    alt={npcInfo.name}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${npcInfo.color}`,
                      display: 'block',
                    }}
                  />
                  <span style={{
                    fontSize: '10px',
                    fontStyle: 'normal',
                    fontWeight: 600,
                    color: npcInfo.color,
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

        {/* Notification — between story and PM action */}
        {playerNotification && (
          <div className="action-center__notification">
            <span>📢</span>
            <span>{playerNotification}</span>
          </div>
        )}

        {/* PM Action Instructions */}
        {spaceAction && (
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

        {/* Outcome */}
        {spaceOutcome && (
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

        {/* Quick Stats */}
        <div className="action-center__stats">
          <div className={`action-center__stat ${player.money < projectScope && projectScope > 0 ? 'action-center__stat--warning' : ''}`}>
            <span className="action-center__stat-icon">💰</span>
            <span className="action-center__stat-value">${(player.money || 0).toLocaleString()}</span>
          </div>
          <div className="action-center__stat">
            <span className="action-center__stat-icon">⏱</span>
            <span className="action-center__stat-value">{player.timeSpent || 0}d</span>
          </div>
          <div className={`action-center__stat ${playableECards.length > 0 ? 'action-center__stat--spark' : ''}`}>
            <span className="action-center__stat-icon">⚡</span>
            <span className="action-center__stat-value">
              {playableECards.length}/{(player.hand || []).filter(id => { const c = gameServices.dataService.getCardById(id); return c && c.card_type === 'E'; }).length}
            </span>
          </div>
          <div className="action-center__stat">
            <span className="action-center__stat-icon">📐</span>
            <span className="action-center__stat-value">${projectScope.toLocaleString()}</span>
          </div>
          {designFeeRatio >= 10 && projectScope > 0 && (
            <div className="action-center__stat" style={{
              borderColor: designFeeRatio >= 20 ? '#f44336' : designFeeRatio >= 15 ? '#ff5722' : '#ff9800'
            }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 'bold',
                color: designFeeRatio >= 20 ? '#f44336' : designFeeRatio >= 15 ? '#ff5722' : '#ff9800'
              }}>
                {designFeeRatio >= 20 ? '🚨' : '⚠️'} {designFeeRatio.toFixed(0)}%/20%
              </span>
            </div>
          )}
        </div>
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
                    <div className="action-center__e-card-name">{card.card_name}</div>
                    {card.description && <div className="action-center__e-card-desc">{card.description}</div>}
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
            {isRollingDice ? '🎲 Rolling...' : '🎲 Roll Dice for Movement'}
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
                {action.isCompleted ? '✅ ' : ''}{action.isDiceEffect && isRollingDice ? '🎲 Rolling...' : action.label}
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
          {onTryAgain && gameState.completedActionCount > 0 && (
            <button
              className="action-center__try-again-btn"
              onClick={() => onTryAgain(playerId)}
              title="Restore to snapshot saved when you arrived at this space"
            >
              {spaceContent?.try_again_label || '🔄 Try Again'}
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
            {activeTab === 'money' && (
              <FinancesSection
                gameServices={gameServices}
                playerId={playerId}
                onRollDice={onRollDice}
                onAutomaticFunding={onAutomaticFunding}
                onManualEffectResult={onManualEffectResult}
                completedActions={completedActions}
                isMyTurn={isMyTurn}
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
            {activeTab === 'scope' && (
              <ProjectScopeSection
                gameServices={gameServices}
                playerId={playerId}
                onRollDice={onRollDice}
                completedActions={completedActions}
                isMyTurn={isMyTurn}
                renderMode="content"
              />
            )}
            {activeTab === 'log' && (
              <PlayerLogSection
                gameServices={gameServices}
                playerId={playerId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
