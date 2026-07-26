// src/components/game/ProjectProgress.tsx

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { IDataService, IGameRulesService } from '../../types/ServiceContracts';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { getBackendURL, getCurrentGameId } from '../../utils/networkDetection';
import { FormatUtils } from '../../utils/FormatUtils';
import { designFeeIndicator, timelineIndicator } from '../../utils/progressIndicators';
import { playerLifecyclePosition } from '../../utils/lifecycleProgress';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { friendlySpaceName } from '../../utils/logFormatting';

interface ProjectProgressProps {
  /** An array of Player objects participating in the game. */
  players: Player[];
  /** The ID of the current player. */
  currentPlayerId: string | null;
  /** The DataService instance for accessing game data. */
  dataService: IDataService;
  /** The GameRulesService instance for calculating project timeline. */
  gameRulesService: IGameRulesService;
  /** Callback function to toggle the visibility of the game log. */
  onToggleGameLog: () => void;
  /** Callback function to open the game rules modal. */
  onOpenRulesModal: () => void;
  /** Callback function to open the display settings modal. */
  onOpenDisplaySettings?: () => void;
  /** Hide action buttons (for TV display mode). */
  hideButtons?: boolean;
  /** Compact mode for TV display - reduced padding, hidden goal banner. */
  compact?: boolean;
  /** Whether the progress overview is collapsed to a slim summary bar. */
  collapsed?: boolean;
  /** Callback to toggle collapsed state. */
  onToggleCollapsed?: () => void;
  /** Whether the rules modal is currently open. */
  isRulesOpen?: boolean;
  /** Whether the game log is currently visible. */
  isGameLogOpen?: boolean;
  /** Whether the display settings modal is currently open. */
  isDisplaySettingsOpen?: boolean;
  /** Callback to toggle the glossary panel. */
  onToggleGlossary?: () => void;
  /** Whether the glossary panel is currently open. */
  isGlossaryOpen?: boolean;
  /** Current shared TV-display theme (GameState.tvDarkMode). Unlike this
   *  device's own dark/light preference, this is ONE value shared by every
   *  connected device — flipping it here updates the TV for everyone. The
   *  TV is a group display, not a personal preference (same reasoning as
   *  G160's board-edges toggle), so the parent (GameLayout) only ever
   *  passes this when the current device is admin or a logged-in teacher.
   *  Omit to hide the button (regular players, TVDisplay's own compact
   *  toolbar via hideButtons, etc.). */
  tvDarkMode?: boolean;
  /** Callback to flip the shared TV theme. Provided by the parent, which
   *  owns the stateService.setTVDarkMode() call and the admin/teacher gate. */
  onToggleTVDarkMode?: () => void;
}

/**
 * ProjectProgress component displays global project progress for all players.
 * Shows current phase, overall progress, and player positions in the project lifecycle.
 */
export function ProjectProgress({ players, currentPlayerId, dataService, gameRulesService, onToggleGameLog, onOpenRulesModal, onOpenDisplaySettings, hideButtons, compact, collapsed, onToggleCollapsed, isRulesOpen, isGameLogOpen, isDisplaySettingsOpen, onToggleGlossary, isGlossaryOpen, tvDarkMode, onToggleTVDarkMode }: ProjectProgressProps): JSX.Element {
  const currentPlayer = players.find(p => p.id === currentPlayerId);

  // Active indicator helpers
  const ActiveDot = ({ show }: { show?: boolean }) => show ? (
    <span style={{
      position: 'absolute',
      top: '-2px',
      right: '-2px',
      width: '8px',
      height: '8px',
      background: '#4caf50',
      borderRadius: '50%',
      border: '1px solid white',
    }} />
  ) : null;

  const activeGlow = (isActive?: boolean): React.CSSProperties => isActive ? {
    boxShadow: '0 0 0 2px #4caf50, 0 2px 4px rgba(0,0,0,0.1)',
  } : {};

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Memoize project scope calculations for all players - only recalculates when cards change
  // Using a stable key based on card contents, not array references
  const playersCardKey = players.map(p =>
    `${p.id}:${JSON.stringify(p.hand || [])}:${JSON.stringify((p.activeCards || []).map(ac => ac.cardId))}`
  ).join('|');
  const playerProjectScopes = useMemo(() => {
    const scopes: { [playerId: string]: number } = {};
    for (const player of players) {
      scopes[player.id] = gameRulesService.calculateProjectScope(player.id);
    }
    return scopes;
  }, [playersCardKey]);

  // Calculate project timeline for any player
  const getPlayerTimeline = (player: Player) => {
    try {
      const projectLengthInfo = gameRulesService.calculateEstimatedProjectLength(player.id);
      const totalDays = player.timeSpent || 0;
      const progressPercent = projectLengthInfo.estimatedDays > 0
        ? (totalDays / projectLengthInfo.estimatedDays) * 100
        : 0;

      return {
        totalDays,
        estimatedDays: projectLengthInfo.estimatedDays,
        contingencyDays: projectLengthInfo.contingencyDays,
        progressPercent,
        uniqueWorkTypes: projectLengthInfo.uniqueWorkTypes.length
      };
    } catch (error) {
      console.error('Error calculating project timeline:', error);
      return null;
    }
  };
  
  // Get dynamic phase order from data service
  const phases = dataService.getPhaseOrder();

  // Calculate project progress for a single player. Delegates to the shared
  // playerLifecyclePosition helper (max phase reached, never regresses) so this
  // observer panel and ScoreboardV2 ("who" screen) compute the furthest-phase
  // number identically — no parallel re-derivation to drift.
  const calculatePlayerProgress = (player: Player) => playerLifecyclePosition(player, dataService);

  // Calculate overall project progress
  const calculateOverallProgress = () => {
    const firstPhase = phases.length > 0 ? phases[0] : 'UNKNOWN';
    if (players.length === 0) return { averageProgress: 0, leadingPhase: firstPhase };

    const playerProgresses = players.map(player => calculatePlayerProgress(player));
    const averageProgress = playerProgresses.reduce((sum, p) => sum + p.progress, 0) / players.length;
    
    // Find the most advanced phase
    const maxPhaseIndex = Math.max(...playerProgresses.map(p => p.phaseIndex));
    const leadingPhase = maxPhaseIndex >= 0 ? phases[maxPhaseIndex] : firstPhase;

    return { averageProgress, leadingPhase };
  };

  const overallProgress = calculateOverallProgress();

  // Collapsed mode: slim single-line summary bar
  if (collapsed) {
    return (
      <div style={{
        background: `linear-gradient(135deg, ${colors.secondary.bg}, ${colors.primary.light})`,
        borderRadius: '12px',
        padding: '6px 16px',
        margin: '4px 0',
        border: `2px solid ${colors.primary.main}`,
        boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: colors.primary.text }}>
          📊 {overallProgress.leadingPhase}
        </span>
        {currentPlayer && (
          <span style={{ fontSize: '0.8rem', color: colors.secondary.dark }}>
            ▶ {currentPlayer.name}'s Turn
          </span>
        )}
        {currentPlayer && (() => {
          const scope = playerProjectScopes[currentPlayer.id] || 0;
          if (scope === 0) return null;
          const funded = (currentPlayer.moneySources?.ownerFunding || 0) + (currentPlayer.moneySources?.bankLoans || 0) + (currentPlayer.moneySources?.investmentDeals || 0);
          const spent = (currentPlayer.expenditures?.design || 0) + (currentPlayer.expenditures?.fees || 0) + (currentPlayer.expenditures?.construction || 0);
          const gap = scope - funded;
          return (
            <span style={{ fontSize: '0.75rem', color: colors.secondary.dark }}>
              💰 {FormatUtils.formatMoney(funded)}/{FormatUtils.formatMoney(scope)}
              {spent > 0 && <span style={{ color: '#f44336' }}> (-{FormatUtils.formatMoney(spent)})</span>}
              {gap > 0 && <span style={{ color: '#f44336', fontWeight: 'bold' }}> Gap {FormatUtils.formatMoney(gap)}</span>}
            </span>
          );
        })()}
        <span style={{ fontSize: '0.8rem', color: colors.secondary.dark }}>
          {Math.round(overallProgress.averageProgress)}%
        </span>
        <span style={{
          background: colors.primary.light,
          color: colors.primary.text,
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '0.75rem',
          fontWeight: 'bold'
        }}>
          {players.length} {players.length === 1 ? 'Player' : 'Players'}
        </span>
        {/* Progress mini-bar */}
        <div style={{
          flex: '1 1 60px',
          minWidth: '60px',
          maxWidth: '150px',
          height: '6px',
          background: colors.secondary.light,
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${overallProgress.averageProgress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.success.main}, ${colors.game.teal})`,
            borderRadius: '3px',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!hideButtons && (
            <>
              <button onClick={onOpenRulesModal} style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                backgroundColor: colors.purple.main, color: colors.white,
                border: `2px solid ${colors.white}`, borderRadius: '8px',
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                position: 'relative', ...activeGlow(isRulesOpen)
              }}>
                <span>📋</span>
                <ActiveDot show={isRulesOpen} />
              </button>
              <button onClick={onToggleGameLog} style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                backgroundColor: colors.primary.main, color: colors.white,
                border: `2px solid ${colors.white}`, borderRadius: '8px',
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                position: 'relative', ...activeGlow(isGameLogOpen)
              }}>
                {/* Distinct from PlayerPanelV2's "📜 History" (that one is
                    this player only; this is every player's activity). */}
                <span>🗒️</span>
                <ActiveDot show={isGameLogOpen} />
              </button>
              {onOpenDisplaySettings && (
                <button onClick={onOpenDisplaySettings} style={{
                  padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                  backgroundColor: colors.success.main, color: colors.white,
                  border: `2px solid ${colors.white}`, borderRadius: '8px',
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                  position: 'relative', ...activeGlow(isDisplaySettingsOpen)
                }}>
                  <span>👁️</span>
                  <ActiveDot show={isDisplaySettingsOpen} />
                </button>
              )}
              {onToggleGlossary && (
                <button onClick={onToggleGlossary} style={{
                  padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                  backgroundColor: '#ff9800', color: colors.white,
                  border: `2px solid ${colors.white}`, borderRadius: '8px',
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                  position: 'relative', ...activeGlow(isGlossaryOpen)
                }}>
                  <span>📖</span>
                  <ActiveDot show={isGlossaryOpen} />
                </button>
              )}
              {onToggleTVDarkMode && (
                <button
                  onClick={onToggleTVDarkMode}
                  title="Switch the shared TV screen between light and dark"
                  style={{
                    padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                    backgroundColor: '#607d8b', color: colors.white,
                    border: `2px solid ${colors.white}`, borderRadius: '8px',
                    cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                    position: 'relative', ...activeGlow(tvDarkMode)
                  }}>
                  <span>🌗</span>
                  <ActiveDot show={tvDarkMode} />
                </button>
              )}
              <button onClick={() => {
                const url = new URL(window.location.href);
                if (url.searchParams.get('mode') === 'tv') {
                  url.searchParams.delete('mode');
                } else {
                  url.searchParams.set('mode', 'tv');
                }
                window.location.href = url.toString();
              }} style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                backgroundColor: '#9c27b0', color: colors.white,
                border: `2px solid ${colors.white}`, borderRadius: '8px',
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px'
              }}>
                <span>📺</span>
              </button>
            </>
          )}
          {onToggleCollapsed && (
            <button onClick={onToggleCollapsed} style={{
              padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
              backgroundColor: colors.info.main, color: colors.white,
              border: `2px solid ${colors.white}`, borderRadius: '8px',
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <span>▼</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const containerStyle = {
    background: `linear-gradient(135deg, ${colors.secondary.bg}, ${colors.primary.light})`,
    borderRadius: '8px',
    padding: compact ? '4px 6px' : '6px 10px',
    margin: compact ? '2px 0' : '4px 0',
    border: `2px solid ${colors.primary.main}`,
    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)'
  };

  const titleStyle = {
    fontSize: '0.75rem',
    fontWeight: 'bold' as const,
    color: colors.primary.text,
    marginBottom: '0',
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px'
  };

  const progressBarContainerStyle = {
    background: '#e0e0e0',
    borderRadius: '2px',
    height: compact ? '4px' : '5px',
    marginBottom: compact ? '2px' : '4px',
    overflow: 'hidden',
    position: 'relative' as const
  };

  const progressBarFillStyle = {
    background: `linear-gradient(90deg, ${colors.success.main}, ${colors.game.teal}, ${colors.info.main})`,
    height: '100%',
    width: `${overallProgress.averageProgress}%`,
    transition: 'width 0.3s ease',
    borderRadius: '2px'
  };

  const phaseIndicatorsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: compact ? '2px' : '4px',
    padding: '0 4px'
  };

  const phaseIndicatorStyle = (phase: string, index: number) => ({
    fontSize: compact ? '0.5rem' : '0.55rem',
    fontWeight: 'bold' as const,
    color: overallProgress.averageProgress >= ((index + 1) / phases.length) * 100 ? colors.success.main : colors.secondary.main,
    textAlign: 'center' as const,
    minWidth: compact ? '30px' : '40px'
  });

  const playersGridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? '140px' : '180px'}, 1fr))`,
    gap: compact ? '2px' : '4px',
    marginTop: compact ? '2px' : '4px'
  };

  const playerItemStyle = {
    background: colors.white,
    borderRadius: '6px',
    padding: compact ? '3px 6px' : '4px 8px',
    border: `1px solid ${colors.secondary.border}`,
    fontSize: compact ? '0.65rem' : '0.7rem'
  };

  const playerNameStyle = {
    fontWeight: 'bold' as const,
    color: colors.secondary.dark,
    marginBottom: '1px'
  };

  const playerPhaseStyle = {
    color: colors.secondary.main,
    fontSize: '0.6rem'
  };

  const playerProgressBarStyle = {
    background: '#e0e0e0',
    borderRadius: '2px',
    height: '4px',
    marginTop: '2px',
    overflow: 'hidden'
  };

  const getPlayerProgressBarFill = (progress: number) => ({
    background: `linear-gradient(90deg, ${colors.success.main}, ${colors.game.teal})`,
    height: '100%',
    width: `${progress}%`,
    transition: 'width 0.3s ease',
    borderRadius: '2px'
  });

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={titleStyle}>
            🚀 Progress
          </div>
          {getCurrentGameId() && (
            <div style={{
              padding: '2px 6px',
              backgroundColor: colors.primary.main,
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.6rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              letterSpacing: '1px'
            }}>
              #{getCurrentGameId()}
            </div>
          )}
          <ConnectionStatus serverUrl={getBackendURL()} />
        </div>
        {!hideButtons && <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[
            { onClick: onOpenRulesModal, icon: '📋', label: 'Rules', bg: colors.purple.main, active: isRulesOpen },
            { onClick: onToggleGameLog, icon: '🗒️', label: 'Log', bg: colors.primary.main, active: isGameLogOpen },
            ...(onOpenDisplaySettings ? [{ onClick: onOpenDisplaySettings, icon: '👁️', label: 'View', bg: colors.success.main, active: isDisplaySettingsOpen }] : []),
            ...(onToggleGlossary ? [{ onClick: onToggleGlossary, icon: '📖', label: 'Glossary', bg: '#ff9800', active: isGlossaryOpen }] : []),
            // Remote control for the shared TV screen's theme (GameState.tvDarkMode).
            // Only rendered for admin/teacher (GameLayout gates the props); a
            // regular player never sees this button. Harmless no-op if no TV
            // is currently connected to this game.
            ...(onToggleTVDarkMode ? [{ onClick: onToggleTVDarkMode, icon: '🌗', label: 'TV theme', bg: '#607d8b', active: tvDarkMode, title: 'Switch the shared TV screen between light and dark' }] : []),
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} title={(btn as { title?: string }).title} style={{
              padding: '3px 6px', fontSize: '10px', fontWeight: 'bold',
              backgroundColor: btn.bg, color: colors.white,
              border: `1px solid ${colors.white}`, borderRadius: '6px',
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex',
              alignItems: 'center', gap: '2px', position: 'relative',
              ...activeGlow(btn.active)
            }}>
              <span>{btn.icon}</span>
              <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>{btn.label}</span>
              <ActiveDot show={btn.active} />
            </button>
          ))}
          <button onClick={() => {
            const url = new URL(window.location.href);
            if (url.searchParams.get('mode') === 'tv') {
              url.searchParams.delete('mode');
            } else {
              url.searchParams.set('mode', 'tv');
            }
            window.location.href = url.toString();
          }} style={{
            padding: '3px 6px', fontSize: '10px', fontWeight: 'bold',
            backgroundColor: '#9c27b0', color: colors.white,
            border: `1px solid ${colors.white}`, borderRadius: '6px',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex',
            alignItems: 'center', gap: '2px'
          }}>
            <span>📺</span>
            <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>TV</span>
          </button>
          <button onClick={toggleFullscreen} style={{
            padding: '3px 6px', fontSize: '10px', fontWeight: 'bold',
            backgroundColor: isFullscreen ? '#e65100' : '#1565c0', color: colors.white,
            border: `1px solid ${colors.white}`, borderRadius: '6px',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex',
            alignItems: 'center', gap: '2px'
          }}>
            <span>⛶</span>
            <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>
          {onToggleCollapsed && (
            <button onClick={onToggleCollapsed} style={{
              padding: '3px 6px', fontSize: '10px', fontWeight: 'bold',
              backgroundColor: '#ff5722', color: colors.white,
              border: `1px solid ${colors.white}`, borderRadius: '6px',
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex',
              alignItems: 'center', gap: '2px'
            }}>
              <span>▲</span>
            </button>
          )}
        </div>}
      </div>

      {/* Overall Progress Bar */}
      <div style={{ ...progressBarContainerStyle, marginBottom: '4px' }}>
        <div style={progressBarFillStyle}></div>
      </div>

      {/* Phase Indicators */}
      <div style={phaseIndicatorsStyle}>
        {phases.map((phase, index) => (
          <div key={phase} style={phaseIndicatorStyle(phase, index)}>
            {phase}
          </div>
        ))}
      </div>

      {/* Goal Banner - hidden in compact mode */}
      {!compact && (
        <div style={{
          padding: '3px 8px',
          backgroundColor: colors.success.bg,
          borderRadius: '4px',
          border: `1px solid ${colors.success.main}`,
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '0.7rem' }}>🎯</span>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 'bold',
            color: colors.text.success
          }}>
            Goal: Complete construction and reach the FINISH space
          </span>
        </div>
      )}

      {/* Overall Progress Info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '4px' : '6px',
        marginBottom: compact ? '2px' : '4px',
        fontSize: compact ? '0.6rem' : '0.65rem',
        color: colors.secondary.dark,
        flexWrap: 'wrap'
      }}>
        <span>
          <strong>{Math.round(overallProgress.averageProgress)}%</strong> | {overallProgress.leadingPhase}
        </span>
        <div style={{
          background: colors.primary.light,
          color: colors.primary.text,
          padding: '1px 6px',
          borderRadius: '8px',
          fontSize: '0.6rem',
          fontWeight: 'bold'
        }}>
          {players.length} {players.length === 1 ? 'Player' : 'Players'}
        </div>
        {currentPlayer && (
          <div style={{
            background: colors.success.bg,
            color: colors.text.success,
            padding: '1px 6px',
            borderRadius: '8px',
            fontSize: '0.6rem',
            fontWeight: 'bold'
          }}>
            ▶ {currentPlayer.name}
          </div>
        )}
        {currentPlayer && (() => {
          const spaceContent = dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
          const spaceTitle = spaceContent?.title || '';
          return (
            <div
              style={{
                background: colors.warning.bg,
                color: colors.warning.text,
                padding: '1px 6px',
                borderRadius: '8px',
                fontSize: '0.6rem',
                fontWeight: 'bold'
              }}
              title={spaceTitle}
            >
              📍 {friendlySpaceName(dataService, currentPlayer.currentSpace)}
              {spaceTitle && <span style={{ fontWeight: 'normal', fontSize: '0.55rem' }}> — {spaceTitle}</span>}
            </div>
          );
        })()}
      </div>

      {/* Individual Player Progress */}
      {players.length > 0 && (
        <div style={playersGridStyle}>
          {players.map((player) => {
            const playerProgress = calculatePlayerProgress(player);

            // Calculate design fee ratio for this player - uses memoized project scope
            const designFees = player.expenditures?.design || 0;
            const projectScope = playerProjectScopes[player.id] || 0;
            const designFeeRatio = projectScope > 0 ? (designFees / projectScope) * 100 : 0;
            // fb:f8491e74 — color + hover tooltip come from the shared, tested
            // helper so the green→orange→red meaning is explained on hover.
            const designFee = designFeeIndicator(designFeeRatio);
            const designFeeColor = designFee.color;

            return (
              <div key={player.id} style={playerItemStyle}>
                <div style={{ ...playerNameStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <PlayerAvatar avatar={player.avatar} color={player.color} size={20} title={player.name} /> {player.name}
                </div>
                <div style={{ marginTop: '2px', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.55rem', color: '#666' }} title={`Project completion: ${Math.round(playerProgress.progress)}% — how far through all phases you've progressed (Funding → Design → Regulatory → Construction). Advances each time you reach a new phase.`}>
                  <span style={{ whiteSpace: 'nowrap' }}>🚀 <span style={{ fontWeight: 'bold', color: colors.secondary.dark }}>{Math.round(playerProgress.progress)}% done</span></span>
                  <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={getPlayerProgressBarFill(playerProgress.progress)}></div>
                  </div>
                  <span style={{ whiteSpace: 'nowrap', fontSize: '0.5rem', color: '#888' }}>{playerProgress.phase}</span>
                </div>
                {/* Financial Overview — stacked funding vs scope bar */}
                {projectScope > 0 && (() => {
                  const owner = player.moneySources?.ownerFunding || 0;
                  const bank = player.moneySources?.bankLoans || 0;
                  const investor = player.moneySources?.investmentDeals || 0;
                  const totalFunded = owner + bank + investor;
                  const totalSpent = (player.expenditures?.design || 0) + (player.expenditures?.fees || 0) + (player.expenditures?.construction || 0);
                  const fundingGap = projectScope - totalFunded;
                  const pctOf = (v: number) => Math.min((v / projectScope) * 100, 100);
                  const fmt = (n: number) => FormatUtils.formatMoney(n);

                  return (
                    <div style={{ marginTop: '2px', fontSize: '0.55rem', color: '#666' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title={fundingGap > 0
                        ? `Funding raised vs. project scope: ${fmt(totalFunded)} of ${fmt(projectScope)} — a ${fmt(fundingGap)} gap still to raise (red). Bar segments: green = Owner, blue = Bank, orange = Investor; striped overlay = already spent.`
                        : `Funding raised vs. project scope: ${fmt(totalFunded)} of ${fmt(projectScope)} — fully funded (green). Bar segments: green = Owner, blue = Bank, orange = Investor; striped overlay = already spent.`}>
                        <span style={{ whiteSpace: 'nowrap' }}>💰 <span style={{ color: fundingGap > 0 ? '#f44336' : '#4caf50', fontWeight: 'bold' }}>{fmt(totalFunded)}/{fmt(projectScope)}</span></span>
                        {/* Stacked funding bar */}
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                          {/* Owner (green) */}
                          <div style={{ position: 'absolute', left: 0, top: 0, width: `${pctOf(owner)}%`, height: '100%', backgroundColor: '#4caf50' }} title={`Owner: ${fmt(owner)}`} />
                          {/* Bank (blue) */}
                          <div style={{ position: 'absolute', left: `${pctOf(owner)}%`, top: 0, width: `${pctOf(bank)}%`, height: '100%', backgroundColor: '#2196f3' }} title={`Bank: ${fmt(bank)}`} />
                          {/* Investor (orange) */}
                          <div style={{ position: 'absolute', left: `${pctOf(owner + bank)}%`, top: 0, width: `${pctOf(investor)}%`, height: '100%', backgroundColor: '#ff9800' }} title={`Investor: ${fmt(investor)}`} />
                          {/* Spent overlay (dark stripe from left) */}
                          {totalSpent > 0 && (
                            <div style={{
                              position: 'absolute', left: 0, top: 0,
                              width: `${pctOf(totalSpent)}%`, height: '100%',
                              background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
                            }} title={`Spent: ${fmt(totalSpent)}`} />
                          )}
                        </div>
                        {/* Inline legend */}
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.5rem', color: '#888' }}>
                          <span style={{ color: '#4caf50' }}>■</span>O <span style={{ color: '#2196f3' }}>■</span>B <span style={{ color: '#ff9800' }}>■</span>I
                          {totalSpent > 0 && <> ▓{fmt(totalSpent)}</>}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {/* Design Fee + Timeline — compact inline bars */}
                <div style={{ marginTop: '2px', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.55rem', color: '#666' }} title={designFee.tooltip}>
                  <span style={{ whiteSpace: 'nowrap' }}>📐 <span style={{ color: designFeeColor, fontWeight: 'bold' }}>{designFeeRatio.toFixed(1)}%/20%</span></span>
                  <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${Math.min(designFeeRatio * 5, 100)}%`, height: '100%', backgroundColor: designFeeColor, borderRadius: '2px' }} />
                  </div>
                </div>
                {(() => {
                  const timeline = getPlayerTimeline(player);
                  if (!timeline) return null;
                  // fb:f8491e74 — color + hover tooltip from the shared helper.
                  const timelineInd = timelineIndicator(timeline.progressPercent);
                  const timelineColor = timelineInd.color;
                  // Show contingency boundary on the bar (contingency is last 10% of estimated)
                  const contingencyStart = timeline.estimatedDays > 0
                    ? ((timeline.estimatedDays - timeline.contingencyDays) / timeline.estimatedDays) * 100
                    : 90;
                  return (
                    <div style={{ marginTop: '1px', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.55rem', color: '#666' }} title={timelineInd.tooltip}>
                      <span style={{ whiteSpace: 'nowrap' }}>⏱️ <span style={{ color: timelineColor, fontWeight: 'bold' }}>{timeline.totalDays}d / {timeline.estimatedDays}d est.</span></span>
                      <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${Math.min(timeline.progressPercent, 100)}%`, height: '100%', backgroundColor: timelineColor, borderRadius: '2px' }} />
                        {/* Contingency boundary marker */}
                        <div style={{ position: 'absolute', left: `${contingencyStart}%`, top: 0, width: '1px', height: '100%', backgroundColor: '#ff9800' }} title="Contingency (10%)" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}