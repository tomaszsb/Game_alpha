// src/components/game/PlayerStatusItem.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { FinancialStatusDisplay } from './FinancialStatusDisplay';
import { CardPortfolioDashboard } from './CardPortfolioDashboard';
import { TurnControlsWithActions } from './TurnControlsWithActions';
import { useGameContext } from '../../context/GameContext';
import { FormatUtils } from '../../utils/FormatUtils';
import { DiscardedCardsModal } from '../modals/DiscardedCardsModal';
import { ResponsiveSheet } from '../modals/ResponsiveSheet';
import { SpaceExplorerPanel } from './SpaceExplorerPanel';
import { MovementPathVisualization } from './MovementPathVisualization';

interface PlayerStatusItemProps {
  player: Player;
  isCurrentPlayer: boolean;
  onOpenNegotiationModal: () => void;
  onOpenRulesModal: () => void;
  onOpenCardDetailsModal: (cardId: string) => void;
  onToggleSpaceExplorer: () => void;
  onToggleMovementPath: () => void;
  isSpaceExplorerVisible: boolean;
  isMovementPathVisible: boolean;
  playerNotification?: string; // New notification area
  // TurnControlsWithActions props (passed from GameLayout via PlayerStatusPanel)
  currentPlayer: Player;
  gamePhase: import('../../types/StateTypes').GamePhase;
  isProcessingTurn: boolean;
  isProcessingArrival: boolean;
  hasPlayerMovedThisTurn: boolean;
  hasPlayerRolledDice: boolean;
  hasCompletedManualActions: boolean;
  awaitingChoice: boolean;
  actionCounts: { required: number; completed: number };
  completedActions: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
  feedbackMessage: string;
  buttonFeedback: { [actionType: string]: string };
  onRollDice: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onManualEffect: (effectType: string) => Promise<void>;
  onNegotiate: () => Promise<void>;
  onAutomaticFunding?: () => Promise<void>;
  playerId: string;
  playerName: string;
}

/**
 * PlayerStatusItem displays the status information for a single player
 * Shows avatar, name, money, and time with visual indicator for current player
 */
export function PlayerStatusItem({ 
  player, 
  isCurrentPlayer, 
  onOpenNegotiationModal, 
  onOpenRulesModal, 
  onOpenCardDetailsModal, 
  onToggleSpaceExplorer, 
  onToggleMovementPath, 
  isSpaceExplorerVisible,
  isMovementPathVisible,
  playerNotification,
  // TurnControlsWithActions props
  currentPlayer,
  gamePhase,
  isProcessingTurn,
  isProcessingArrival,
  hasPlayerMovedThisTurn,
  hasPlayerRolledDice,
  hasCompletedManualActions,
  awaitingChoice,
  actionCounts,
  completedActions,
  feedbackMessage,
  buttonFeedback,
  onRollDice,
  onEndTurn,
  onManualEffect,
  onNegotiate,
  onAutomaticFunding,
  playerId,
  playerName
}: PlayerStatusItemProps): JSX.Element {
  const { stateService, dataService, cardService, gameRulesService } = useGameContext();
  const [showFinancialStatus, setShowFinancialStatus] = useState(false);
  const [showCardPortfolio, setShowCardPortfolio] = useState(false);
  const [showDiscardedCards, setShowDiscardedCards] = useState(false);

  // Calculate financial status for display
  const calculateFinancialStatus = () => {
    const hand = player.hand || [];
    const wCards = hand.filter(cardId => cardService.getCardType(cardId) === 'W');
    const totalScopeCost = gameRulesService.calculateProjectScope(player.id);
    const surplus = player.money - totalScopeCost;
    
    return {
      playerMoney: player.money,
      totalScopeCost,
      surplus,
      isDeficit: surplus < 0
    };
  };

  const financialStatus = calculateFinancialStatus();

  // Helper function to evaluate effect conditions
  const evaluateEffectCondition = (condition: string | undefined): boolean => {
    if (!condition || condition === 'always') return true;

    const conditionLower = condition.toLowerCase();

    // Project scope conditions
    const projectScope = gameRulesService.calculateProjectScope(player.id);
    if (conditionLower === 'scope_le_4m') {
      return projectScope <= 4000000;
    }
    if (conditionLower === 'scope_gt_4m') {
      return projectScope > 4000000;
    }

    // Add other conditions as needed
    // For now, default to true for unknown conditions
    return true;
  };

  // Calculate space time cost that will be spent when taking actions
  const getSpaceTimeCost = (): number => {
    const spaceEffects = dataService.getSpaceEffects(player.currentSpace, player.visitType);
    return spaceEffects
      .filter(effect => effect.effect_type === 'time' && effect.effect_action === 'add' && evaluateEffectCondition(effect.condition))
      .reduce((total, effect) => total + Number(effect.effect_value || 0), 0);
  };

  const spaceTimeCost = getSpaceTimeCost();


  // Add CSS animation styles to document head if not already present
  React.useEffect(() => {
    const styleId = 'player-status-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes positionUpdate {
          0% {
            transform: translateX(0) scale(1);
            background-color: rgba(33, 150, 243, 0.1);
          }
          25% {
            transform: translateX(3px) scale(1.02);
            background-color: rgba(76, 175, 80, 0.2);
          }
          50% {
            transform: translateX(-3px) scale(1.02);
            background-color: rgba(255, 193, 7, 0.2);
          }
          75% {
            transform: translateX(1px) scale(1.01);
            background-color: rgba(76, 175, 80, 0.2);
          }
          100% {
            transform: translateX(0) scale(1);
            background-color: rgba(33, 150, 243, 0.1);
          }
        }
        
        @keyframes currentPlayerPulse {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(33, 150, 243, 0.4);
          }
          50% {
            box-shadow: 0 8px 32px rgba(33, 150, 243, 0.6);
          }
        }
        
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const baseStyle = {
    background: isCurrentPlayer ? `linear-gradient(135deg, ${colors.primary.light}, ${colors.primary.lighter})` : colors.white,
    border: isCurrentPlayer ? `3px solid ${colors.primary.main}` : `2px solid ${colors.secondary.border}`,
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '12px',
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease', // Only animate visual properties
    position: 'relative' as const,
    boxShadow: isCurrentPlayer
      ? '0 8px 24px rgba(33, 150, 243, 0.4)'
      : '0 4px 12px rgba(0, 0, 0, 0.12)',
    // True 16:9 landscape aspect ratio enforced
    width: '100%',
    maxWidth: '100%',
    aspectRatio: '16 / 9', // 16:9 landscape (wider than tall)
    margin: '0 0 12px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    overflow: 'hidden', // Hide overflow - internal sections will scroll
    boxSizing: 'border-box' as const
  };


  const avatarStyle = {
    fontSize: '2.5rem',
    marginBottom: '4px',
    display: 'block'
  };

  const nameStyle = {
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    color: isCurrentPlayer ? colors.primary.text : colors.success.text,
    textAlign: 'center' as const,
    lineHeight: '1.1',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  };

  // Middle section styles (Stats and space info) - SCROLLABLE for variable content
  const middleSectionStyle = {
    flex: 1, // Take up remaining space
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-start',
    overflow: 'auto', // Enable scrolling for variable location story content
    minHeight: 0, // Allow shrinking below content size
    paddingRight: '4px' // Space for scrollbar
  };

  const statsRowStyle = {
    display: 'flex',
    gap: '6px',
    marginBottom: '6px'
  };

  const statItemStyle = {
    background: 'rgba(248, 249, 250, 0.9)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '6px',
    padding: '4px 6px',
    textAlign: 'center' as const,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    flex: '1 1 0'
  };

  const statLabelStyle = {
    fontSize: '0.8rem',
    color: colors.secondary.main,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    marginBottom: '2px',
    letterSpacing: '0.5px'
  };

  const statValueStyle = {
    fontSize: '0.9rem',
    fontWeight: 'bold' as const,
    color: colors.text.primary
  };

  // Right section styles - Avatar, Buttons & Turn Controls
  const rightSectionStyle = {
    flex: '0 0 auto',
    minWidth: isCurrentPlayer ? '140px' : '100px',
    maxWidth: isCurrentPlayer ? '140px' : '100px',
    borderLeft: '2px solid rgba(0, 0, 0, 0.1)',
    paddingLeft: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'visible'
  };

  // Main content container style - optimized for 16:9 landscape
  const mainContentStyle = {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    gap: '6px' // Add spacing between sections
  };


  return (
    <div style={baseStyle}>


      {/* Main Content Container */}
      <div style={mainContentStyle}>
        {/* Left Section: Stats and Space Info (expanded) */}
        <div style={middleSectionStyle}>
          {/* Top row: Money and Time stats */}
          <div style={statsRowStyle}>
            {/* Clickable Money Display */}
            <button
              style={{
                ...statItemStyle,
                cursor: 'pointer',
                border: `1px solid ${financialStatus.isDeficit ? 'rgba(220, 53, 69, 0.3)' : 'rgba(40, 167, 69, 0.3)'}`,
                background: showFinancialStatus 
                  ? (financialStatus.isDeficit ? 'rgba(220, 53, 69, 0.1)' : 'rgba(40, 167, 69, 0.1)') 
                  : 'rgba(248, 249, 250, 0.8)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setShowFinancialStatus(!showFinancialStatus)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = financialStatus.isDeficit ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = showFinancialStatus 
                  ? (financialStatus.isDeficit ? 'rgba(220, 53, 69, 0.1)' : 'rgba(40, 167, 69, 0.1)') 
                  : 'rgba(248, 249, 250, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={`${showFinancialStatus ? 'Hide' : 'Show'} consolidated financial report - ${financialStatus.isDeficit ? 'Funding Shortage' : 'Fully Funded'}: ${FormatUtils.formatMoney(Math.abs(financialStatus.surplus))}`}
            >
              <div style={statLabelStyle}>
                Finances {showFinancialStatus ? '▲' : '▼'} 
                {financialStatus.isDeficit ? ' ⚠️' : ' ✅'}
              </div>
              <div style={{
                ...statValueStyle,
                color: financialStatus.isDeficit ? colors.danger.main : colors.success.main
              }}>
                📊 {FormatUtils.formatMoney(player.money)}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: financialStatus.isDeficit ? colors.danger.main : colors.success.main,
                fontWeight: 'bold',
                marginTop: '2px'
              }}>
                {financialStatus.isDeficit ? 'Shortage' : 'Surplus'}: {FormatUtils.formatMoney(Math.abs(financialStatus.surplus))}
              </div>
            </button>

            <div style={statItemStyle}>
              <div style={statLabelStyle}>Time</div>

              {/* Time Cost Warning - appears above current time when current player has time cost */}
              {isCurrentPlayer && spaceTimeCost > 0 && (
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: colors.warning.dark,
                  backgroundColor: colors.warning.light,
                  border: `1px solid ${colors.warning.main}`,
                  borderRadius: '4px',
                  padding: '4px 6px',
                  marginBottom: '4px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px'
                }}>
                  <span>⚠️</span>
                  <span>Cost: {spaceTimeCost}d</span>
                </div>
              )}

              <div style={statValueStyle}>⏱️ {FormatUtils.formatTime(player.timeSpent || 0)}</div>
            </div>

            {/* Card Portfolio Toggle Button */}
            <button
              style={{
                ...statItemStyle,
                cursor: 'pointer',
                border: '1px solid rgba(33, 150, 243, 0.3)',
                background: showCardPortfolio ? 'rgba(33, 150, 243, 0.1)' : 'rgba(248, 249, 250, 0.8)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setShowCardPortfolio(!showCardPortfolio)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(33, 150, 243, 0.2)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = showCardPortfolio ? 'rgba(33, 150, 243, 0.1)' : 'rgba(248, 249, 250, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={`${showCardPortfolio ? 'Hide' : 'Show'} card portfolio`}
            >
              <div style={statLabelStyle}>Cards {showCardPortfolio ? '▲' : '▼'}</div>
              <div style={statValueStyle}>🃏 Portfolio</div>
            </button>
          </div>

          {/* Player Notification Area */}
          {playerNotification && (
            <div style={{
              background: `linear-gradient(135deg, ${colors.primary.light}, ${colors.primary.lighter})`,
              border: `2px solid ${colors.primary.main}`,
              borderRadius: '8px',
              padding: '10px',
              marginTop: '8px',
              boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
              animation: 'fadeIn 0.3s ease-in-out'
            }}>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: colors.primary.dark,
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>📢</span>
                <span>Action Notification</span>
              </div>
              <div style={{
                fontSize: '0.9rem',
                color: colors.primary.text,
                lineHeight: '1.4',
                fontWeight: '500'
              }}>
                {playerNotification}
              </div>
            </div>
          )}

          {/* Location Story Section */}
          {(() => {
            const spaceContent = dataService.getSpaceContent(player.currentSpace, 'First');
            const locationName = spaceContent?.title || player.currentSpace;
            const story = spaceContent?.story || 'No story available for this space.';
            const actionDescription = spaceContent?.action_description;
            const outcomeDescription = spaceContent?.outcome_description;

            return (
              <div style={{
                background: `linear-gradient(135deg, ${colors.warning.bg}, ${colors.warning.light})`,
                border: `2px solid ${colors.warning.main}`,
                borderRadius: '8px',
                padding: '12px',
                marginTop: '8px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                {/* Location Header */}
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: colors.brown.main,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  📍 {locationName}
                </div>

                {/* Story Content */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: colors.warning.text,
                    marginBottom: '4px'
                  }}>
                    Story:
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: colors.brown.dark,
                    lineHeight: '1.4',
                    fontStyle: story === 'No story available for this space.' ? 'italic' : 'normal'
                  }}>
                    {story}
                  </div>
                </div>

                {/* Action Required */}
                {actionDescription && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      color: colors.danger.text,
                      marginBottom: '4px'
                    }}>
                      Action Required:
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: colors.brown.dark,
                      lineHeight: '1.4'
                    }}>
                      {actionDescription}
                    </div>
                  </div>
                )}

                {/* Potential Outcomes */}
                {outcomeDescription && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      color: colors.success.text,
                      marginBottom: '4px'
                    }}>
                      Potential Outcomes:
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: colors.brown.dark,
                      lineHeight: '1.4'
                    }}>
                      {outcomeDescription}
                    </div>
                  </div>
                )}

                {/* Current Location Footer */}
                <div style={{
                  fontSize: '0.8rem',
                  color: colors.brown.text,
                  fontStyle: 'italic',
                  borderTop: '1px solid rgba(139, 69, 19, 0.2)',
                  paddingTop: '6px',
                  marginTop: outcomeDescription || actionDescription ? '0' : '6px'
                }}>
                  Current location: {player.currentSpace}
                </div>
              </div>
            );
          })()}


        </div>

        {/* Right Section: Avatar, Buttons & Turn Controls */}
        <div style={rightSectionStyle}>
          {/* Avatar and Name at top */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <div style={avatarStyle}>
              {player.avatar}
            </div>
            <div style={nameStyle}>
              {player.name}
            </div>
          </div>

          {/* Action Buttons - show for current player */}
          {isCurrentPlayer && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginBottom: '8px',
              width: '100%'
            }}>
              <button onClick={onToggleSpaceExplorer} style={{
                padding: '6px 10px', fontSize: '0.75rem', fontWeight: 'bold',
                color: colors.white, backgroundColor: isSpaceExplorerVisible ? colors.success.main : colors.secondary.main,
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}>
                <span>🔍</span><span>Explorer</span>
              </button>
              <button onClick={onToggleMovementPath} style={{
                padding: '6px 10px', fontSize: '0.75rem', fontWeight: 'bold',
                color: colors.white, backgroundColor: isMovementPathVisible ? colors.primary.main : colors.secondary.main,
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}>
                <span>🧭</span><span>Paths</span>
              </button>
              <button onClick={() => setShowDiscardedCards(true)} style={{
                padding: '6px 10px', fontSize: '0.75rem', fontWeight: 'bold',
                color: colors.white, backgroundColor: colors.warning.main,
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}>
                <span>🗂️</span><span>Discarded</span>
              </button>
            </div>
          )}

          {/* Turn Controls */}
          {isCurrentPlayer ? (
            <div style={{
              background: colors.white,
              border: `1px solid ${colors.secondary.border}`,
              borderRadius: '4px',
              padding: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              fontSize: '0.75rem',
              overflow: 'visible'
            }}>
              <TurnControlsWithActions
                onOpenNegotiationModal={onOpenNegotiationModal}
                playerId={player.id}
                playerName={player.name}
                currentPlayer={currentPlayer}
                gamePhase={gamePhase}
                isProcessingTurn={isProcessingTurn}
                isProcessingArrival={isProcessingArrival}
                hasPlayerMovedThisTurn={hasPlayerMovedThisTurn}
                hasPlayerRolledDice={hasPlayerRolledDice}
                hasCompletedManualActions={hasCompletedManualActions}
                awaitingChoice={awaitingChoice}
                actionCounts={actionCounts}
                completedActions={completedActions}
                feedbackMessage={feedbackMessage}
                buttonFeedback={buttonFeedback}
                onRollDice={onRollDice}
                onEndTurn={onEndTurn}
                onManualEffect={onManualEffect}
                onNegotiate={onNegotiate}
                onAutomaticFunding={onAutomaticFunding}
              />
            </div>
          ) : (
            <div style={{
              background: colors.danger.light,
              border: `1px solid ${colors.danger.border}`,
              borderRadius: '6px',
              padding: '6px',
              textAlign: 'center',
              color: colors.danger.text,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>
              Not your turn
            </div>
          )}
        </div>
      </div>

      {/* Financial Status - Responsive Sheet */}
      <ResponsiveSheet
        isOpen={showFinancialStatus}
        onClose={() => setShowFinancialStatus(false)}
        title="Financial Status"
      >
        <FinancialStatusDisplay player={player} />
      </ResponsiveSheet>

      {/* Card Portfolio - Responsive Sheet */}
      <ResponsiveSheet
        isOpen={showCardPortfolio}
        onClose={() => setShowCardPortfolio(false)}
        title="Card Portfolio"
      >
        <CardPortfolioDashboard
          player={player}
          isCurrentPlayer={isCurrentPlayer}
          onOpenCardDetailsModal={onOpenCardDetailsModal}
        />
      </ResponsiveSheet>

      {/* Discarded Cards Modal */}
      <DiscardedCardsModal
        player={player}
        isVisible={showDiscardedCards}
        onClose={() => setShowDiscardedCards(false)}
        onOpenCardDetailsModal={onOpenCardDetailsModal}
      />

      {/* Space Explorer - Responsive Sheet */}
      <ResponsiveSheet
        isOpen={isSpaceExplorerVisible}
        onClose={onToggleSpaceExplorer}
        title="Space Explorer"
      >
        <SpaceExplorerPanel
          isVisible={true}
          onToggle={onToggleSpaceExplorer}
        />
      </ResponsiveSheet>

      {/* Movement Path - Responsive Sheet */}
      <ResponsiveSheet
        isOpen={isMovementPathVisible}
        onClose={onToggleMovementPath}
        title="Available Movement Paths"
      >
        <MovementPathVisualization
          isVisible={true}
          onToggle={onToggleMovementPath}
        />
      </ResponsiveSheet>
    </div>
  );
}