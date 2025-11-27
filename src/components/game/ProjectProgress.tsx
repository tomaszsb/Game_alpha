// src/components/game/ProjectProgress.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { IDataService } from '../../types/ServiceContracts';

interface ProjectProgressProps {
  players: Player[];
  currentPlayerId: string | null;
  dataService: IDataService;
  onToggleGameLog: () => void;
  onOpenRulesModal: () => void;
}

/**
 * ProjectProgress component displays global project progress for all players.
 * Shows current phase, overall progress, and player positions in the project lifecycle.
 */
export function ProjectProgress({ players, currentPlayerId, dataService, onToggleGameLog, onOpenRulesModal }: ProjectProgressProps): JSX.Element {
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  
  // Get dynamic phase order from data service
  const phases = dataService.getPhaseOrder();

  // Calculate project progress for a single player
  const calculatePlayerProgress = (player: Player) => {
    const spaceConfig = dataService.getGameConfigBySpace(player.currentSpace);
    
    if (!spaceConfig) {
      return { phase: 'UNKNOWN', progress: 0, phaseIndex: -1 };
    }

    const currentPhaseIndex = phases.findIndex(phase => 
      spaceConfig.phase.toUpperCase().includes(phase)
    );
    
    if (currentPhaseIndex === -1) {
      return { phase: spaceConfig.phase, progress: 0, phaseIndex: -1 };
    }

    const progress = ((currentPhaseIndex + 1) / phases.length) * 100;
    return { 
      phase: phases[currentPhaseIndex], 
      progress, 
      phaseIndex: currentPhaseIndex 
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
      <div style={titleStyle}>
        🚀 Project Progress Overview
      </div>

      {/* Overall Progress Bar with Action Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <div style={{ ...progressBarContainerStyle, flex: 1, marginBottom: 0 }}>
          <div style={progressBarFillStyle}></div>
        </div>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}