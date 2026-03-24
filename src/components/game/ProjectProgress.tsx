// src/components/game/ProjectProgress.tsx

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { IDataService, IGameRulesService } from '../../types/ServiceContracts';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { getBackendURL, getCurrentGameId } from '../../utils/networkDetection';

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
}

/**
 * ProjectProgress component displays global project progress for all players.
 * Shows current phase, overall progress, and player positions in the project lifecycle.
 */
export function ProjectProgress({ players, currentPlayerId, dataService, gameRulesService, onToggleGameLog, onOpenRulesModal, onOpenDisplaySettings, hideButtons, compact, collapsed, onToggleCollapsed, isRulesOpen, isGameLogOpen, isDisplaySettingsOpen, onToggleGlossary, isGlossaryOpen }: ProjectProgressProps): JSX.Element {
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

  // Calculate project progress for a single player
  // Uses the MAXIMUM phase reached from all visited spaces (phase never regresses)
  const calculatePlayerProgress = (player: Player) => {
    // Find the maximum phase index from all visited spaces (including current)
    const allSpaces = [...(player.visitedSpaces || []), player.currentSpace];
    let maxPhaseIndex = -1;
    let maxPhase = 'UNKNOWN';

    for (const spaceName of allSpaces) {
      const spaceConfig = dataService.getGameConfigBySpace(spaceName);
      if (spaceConfig) {
        const phaseIndex = phases.findIndex(phase =>
          spaceConfig.phase.toUpperCase().includes(phase)
        );
        if (phaseIndex > maxPhaseIndex) {
          maxPhaseIndex = phaseIndex;
          maxPhase = phases[phaseIndex];
        }
      }
    }

    if (maxPhaseIndex === -1) {
      return { phase: 'UNKNOWN', progress: 0, phaseIndex: -1 };
    }

    const progress = ((maxPhaseIndex + 1) / phases.length) * 100;
    return {
      phase: maxPhase,
      progress,
      phaseIndex: maxPhaseIndex
    };
  };

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
                <span>📜</span>
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
    background: colors.secondary.light,
    borderRadius: '4px',
    height: compact ? '5px' : '6px',
    marginBottom: compact ? '2px' : '4px',
    overflow: 'hidden',
    position: 'relative' as const
  };

  const progressBarFillStyle = {
    background: `linear-gradient(90deg, ${colors.success.main}, ${colors.game.teal}, ${colors.info.main})`,
    height: '100%',
    width: `${overallProgress.averageProgress}%`,
    transition: 'width 0.3s ease',
    borderRadius: '4px'
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
    background: colors.secondary.light,
    borderRadius: '3px',
    height: '3px',
    marginTop: '2px',
    overflow: 'hidden'
  };

  const getPlayerProgressBarFill = (progress: number) => ({
    background: `linear-gradient(90deg, ${colors.success.main}, ${colors.game.teal})`,
    height: '100%',
    width: `${progress}%`,
    transition: 'width 0.3s ease'
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
            { onClick: onToggleGameLog, icon: '📜', label: 'Log', bg: colors.primary.main, active: isGameLogOpen },
            ...(onOpenDisplaySettings ? [{ onClick: onOpenDisplaySettings, icon: '👁️', label: 'View', bg: colors.success.main, active: isDisplaySettingsOpen }] : []),
            ...(onToggleGlossary ? [{ onClick: onToggleGlossary, icon: '📖', label: 'Glossary', bg: '#ff9800', active: isGlossaryOpen }] : []),
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} style={{
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
              📍 {currentPlayer.currentSpace}
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
            // 4-tier color scheme: green (0-10%), yellow (10-15%), orange (15-20%), red (20%+)
            const designFeeColor = designFeeRatio >= 20 ? '#f44336' :
                                   designFeeRatio >= 15 ? '#ff5722' :
                                   designFeeRatio >= 10 ? '#ff9800' : '#4caf50';

            return (
              <div key={player.id} style={playerItemStyle}>
                <div style={playerNameStyle}>
                  {player.avatar} {player.name}
                </div>
                <div style={playerPhaseStyle}>
                  Phase: {playerProgress.phase}
                </div>
                <div style={playerProgressBarStyle}>
                  <div style={getPlayerProgressBarFill(playerProgress.progress)}></div>
                </div>
                {/* Design Fee + Timeline — compact inline bars */}
                <div style={{ marginTop: '2px', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.55rem', color: '#666' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>📐 <span style={{ color: designFeeColor, fontWeight: 'bold' }}>{designFeeRatio.toFixed(1)}%/20%</span></span>
                  <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${Math.min(designFeeRatio * 5, 100)}%`, height: '100%', backgroundColor: designFeeColor, borderRadius: '2px' }} />
                  </div>
                </div>
                {(() => {
                  const timeline = getPlayerTimeline(player);
                  if (!timeline) return null;
                  const timelineColor = timeline.progressPercent >= 100 ? '#f44336' :
                                        timeline.progressPercent >= 75 ? '#ff9800' : '#4caf50';
                  return (
                    <div style={{ marginTop: '1px', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.55rem', color: '#666' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>⏱️ <span style={{ color: timelineColor, fontWeight: 'bold' }}>{timeline.totalDays}/{timeline.estimatedDays}d</span></span>
                      <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(timeline.progressPercent, 100)}%`, height: '100%', backgroundColor: timelineColor, borderRadius: '2px' }} />
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