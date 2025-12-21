// src/components/game/ProjectProgress.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { IDataService, IGameRulesService } from '../../types/ServiceContracts';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { getBackendURL } from '../../utils/networkDetection';

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
  /** Callback function to open the data editor. */
  onOpenDataEditor?: () => void;
}

/**
 * ProjectProgress component displays global project progress for all players.
 * Shows current phase, overall progress, and player positions in the project lifecycle.
 */
export function ProjectProgress({ players, currentPlayerId, dataService, gameRulesService, onToggleGameLog, onOpenRulesModal, onOpenDisplaySettings, onOpenDataEditor }: ProjectProgressProps): JSX.Element {
  const currentPlayer = players.find(p => p.id === currentPlayerId);

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

  const containerStyle = {
    background: `linear-gradient(135deg, ${colors.secondary.bg}, ${colors.primary.light})`,
    borderRadius: '12px',
    padding: '16px',
    margin: '16px 0',
    border: `2px solid ${colors.primary.main}`,
    boxShadow: '0 4px 16px rgba(33, 150, 243, 0.2)'
  };

  const titleStyle = {
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    color: colors.primary.text,
    marginBottom: '12px',
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px'
  };

  const progressBarContainerStyle = {
    background: colors.secondary.light,
    borderRadius: '8px',
    height: '12px',
    marginBottom: '12px',
    overflow: 'hidden',
    position: 'relative' as const
  };

  const progressBarFillStyle = {
    background: `linear-gradient(90deg, ${colors.success.main}, ${colors.game.teal}, ${colors.info.main})`,
    height: '100%',
    width: `${overallProgress.averageProgress}%`,
    transition: 'width 0.3s ease',
    borderRadius: '8px'
  };

  const phaseIndicatorsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
    padding: '0 8px'
  };

  const phaseIndicatorStyle = (phase: string, index: number) => ({
    fontSize: '0.7rem',
    fontWeight: 'bold' as const,
    color: overallProgress.averageProgress >= ((index + 1) / phases.length) * 100 ? colors.success.main : colors.secondary.main,
    textAlign: 'center' as const,
    minWidth: '60px'
  });

  const playersGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px',
    marginTop: '8px'
  };

  const playerItemStyle = {
    background: colors.white,
    borderRadius: '8px',
    padding: '8px 12px',
    border: `1px solid ${colors.secondary.border}`,
    fontSize: '0.8rem'
  };

  const playerNameStyle = {
    fontWeight: 'bold' as const,
    color: colors.secondary.dark,
    marginBottom: '4px'
  };

  const playerPhaseStyle = {
    color: colors.secondary.main,
    fontSize: '0.75rem'
  };

  const playerProgressBarStyle = {
    background: colors.secondary.light,
    borderRadius: '4px',
    height: '4px',
    marginTop: '4px',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={titleStyle}>
            🚀 Project Progress Overview
          </div>
          <ConnectionStatus serverUrl={getBackendURL()} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onOpenRulesModal} style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: colors.purple.main,
            color: colors.white,
            border: `2px solid ${colors.white}`,
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>📋</span>
            <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>Rules</span>
          </button>
          <button onClick={onToggleGameLog} style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: colors.primary.main,
            color: colors.white,
            border: `2px solid ${colors.white}`,
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>📜</span>
            <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>Log</span>
          </button>
          {onOpenDisplaySettings && (
            <button onClick={onOpenDisplaySettings} style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              backgroundColor: colors.success.main,
              color: colors.white,
              border: `2px solid ${colors.white}`,
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>👁️</span>
              <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>View</span>
            </button>
          )}
          {onOpenDataEditor && (
            <button onClick={onOpenDataEditor} style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              backgroundColor: colors.secondary.main,
              color: colors.white,
              border: `2px solid ${colors.white}`,
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>⚙️</span>
              <span style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}>Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div style={{ ...progressBarContainerStyle, marginBottom: '12px' }}>
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

      {/* Overall Progress Info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '16px',
        fontSize: '0.85rem',
        color: colors.secondary.dark
      }}>
        <span>
          <strong>Overall Progress:</strong> {Math.round(overallProgress.averageProgress)}% | 
          <strong> Leading Phase:</strong> {overallProgress.leadingPhase}
        </span>
        <div style={{
          background: colors.primary.light,
          color: colors.primary.text,
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: 'bold'
        }}>
          {players.length} {players.length === 1 ? 'Player' : 'Players'}
        </div>
        {currentPlayer && (
          <div style={{
            background: colors.success.bg,
            color: colors.text.success,
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            Current Turn: {currentPlayer.name}
          </div>
        )}
        {currentPlayer && (
          <div style={{
            background: colors.warning.bg,
            color: colors.warning.text,
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            📍 {currentPlayer.currentSpace} ({currentPlayer.visitType} Visit)
          </div>
        )}
      </div>

      {/* Individual Player Progress */}
      {players.length > 0 && (
        <div style={playersGridStyle}>
          {players.map((player) => {
            const playerProgress = calculatePlayerProgress(player);

            // Calculate design fee ratio for this player
            const designFees = player.expenditures?.design || 0;
            const projectScope = gameRulesService.calculateProjectScope(player.id);
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
                <div style={{
                  fontSize: '0.7rem',
                  color: colors.secondary.main,
                  marginTop: '2px'
                }}>
                  {Math.round(playerProgress.progress)}% complete
                </div>

                {/* Design Fee Cap Bar */}
                <div style={{
                  marginTop: '8px',
                  padding: '6px',
                  backgroundColor: '#fafafa',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 'bold' }}>
                      📐 Design Fees
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      color: designFeeColor,
                      fontWeight: 'bold'
                    }}>
                      {designFeeRatio.toFixed(1)}% / 20%
                    </span>
                  </div>
                  <div style={{
                    position: 'relative',
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    overflow: 'visible'
                  }}>
                    {/* Design fee bar */}
                    <div style={{
                      width: `${Math.min(designFeeRatio * 5, 100)}%`, // Scale: 20% = 100% of bar
                      height: '100%',
                      backgroundColor: designFeeColor,
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }} />
                    {/* 20% threshold marker */}
                    <div style={{
                      position: 'absolute',
                      left: '100%', // 20% threshold = end of bar
                      top: '-2px',
                      height: '12px',
                      width: '2px',
                      backgroundColor: '#d32f2f',
                      borderRadius: '1px'
                    }} />
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '2px',
                    fontSize: '0.6rem',
                    color: '#999'
                  }}>
                    <span>${(designFees / 1000).toFixed(0)}k</span>
                    <span>Cap: ${(projectScope * 0.2 / 1000).toFixed(0)}k</span>
                  </div>
                </div>

                {/* Project Timeline Bar */}
                {(() => {
                  const timeline = getPlayerTimeline(player);
                  if (!timeline) return null;
                  const timelineColor = timeline.progressPercent >= 100 ? '#f44336' :
                                        timeline.progressPercent >= 75 ? '#ff9800' : '#4caf50';
                  return (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px',
                      backgroundColor: '#fafafa',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 'bold' }}>
                          ⏱️ Project Timeline
                        </span>
                        <span style={{
                          fontSize: '0.65rem',
                          color: timelineColor,
                          fontWeight: 'bold'
                        }}>
                          {timeline.totalDays} / {timeline.estimatedDays} days
                        </span>
                      </div>
                      <div style={{
                        position: 'relative',
                        height: '8px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        {/* Timeline progress bar */}
                        <div style={{
                          width: `${Math.min(timeline.progressPercent, 100)}%`,
                          height: '100%',
                          backgroundColor: timelineColor,
                          borderRadius: '4px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '2px',
                        fontSize: '0.6rem',
                        color: '#999'
                      }}>
                        <span>{Math.round(timeline.progressPercent)}% elapsed</span>
                        <span>{timeline.uniqueWorkTypes} work types</span>
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