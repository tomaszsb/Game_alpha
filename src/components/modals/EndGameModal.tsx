// src/components/modals/EndGameModal.tsx

import React, { useState, useEffect } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { VisitType } from '../../types/DataTypes';
import { interpolateTemplate } from '../../utils/templateInterpolation';

interface EndGamePenaltyView {
  dobMissing: boolean;
  days: number;
  fee: number;
}

export function EndGameModal(): JSX.Element {
  const { stateService, dataService } = useGameContext();
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string>('');
  const [winnerSpace, setWinnerSpace] = useState<string>('');
  const [winnerVisitType, setWinnerVisitType] = useState<VisitType>('First');
  const [gameEndTime, setGameEndTime] = useState<Date | undefined>();
  const [penalty, setPenalty] = useState<EndGamePenaltyView | null>(null);

  // Subscribe to state changes to show/hide modal
  useEffect(() => {
    const syncFromState = (gameState: ReturnType<typeof stateService.getGameState>) => {
      setIsGameOver(gameState.isGameOver);

      if (gameState.isGameOver && gameState.winner) {
        const winnerPlayer = gameState.players.find(p => p.id === gameState.winner);
        setWinnerName(winnerPlayer?.name || 'Unknown Player');
        setWinnerSpace(winnerPlayer?.currentSpace || '');
        setWinnerVisitType(winnerPlayer?.visitType || 'First');
        setGameEndTime(gameState.gameEndTime);
        // Workstream 7 Phase 7.4 — render the missing-DOB penalty section
        // when present. Only set if the penalty belongs to this winner (it
        // always should, but defensive in case future phases credit other
        // players).
        if (gameState.endGamePenalty && gameState.endGamePenalty.playerId === gameState.winner) {
          setPenalty({
            dobMissing: gameState.endGamePenalty.dobMissing,
            days: gameState.endGamePenalty.days,
            fee: gameState.endGamePenalty.fee,
          });
        } else {
          setPenalty(null);
        }
      }
    };

    const unsubscribe = stateService.subscribe(syncFromState);
    syncFromState(stateService.getGameState());

    return unsubscribe;
  }, [stateService]);

  const handlePlayAgain = () => {
    // Navigate to root landing page instead of resetting in-place
    window.location.href = window.location.origin + window.location.pathname;
  };

  // Per-space ModalConfig overrides keyed by `${winnerSpace}|${winnerVisitType}|end_game`.
  // Lets creators theme the end-of-game celebration per FINISH space (e.g., different
  // victory flavor at CON-END vs REG-END vs PM-END).
  const endGameModalConfig = winnerSpace
    ? dataService.getModalConfig(winnerSpace, winnerVisitType, 'end_game')
    : undefined;

  const templateContext: Record<string, string | number | undefined> = {
    spaceName: winnerSpace,
    winnerName,
    playerName: winnerName,
  };
  const customTitle = endGameModalConfig?.modal_title
    ? interpolateTemplate(endGameModalConfig.modal_title, templateContext)
    : undefined;
  const customDescription = endGameModalConfig?.modal_description
    ? interpolateTemplate(endGameModalConfig.modal_description, templateContext)
    : undefined;
  const customButtonLabel = endGameModalConfig?.modal_button_label
    ? interpolateTemplate(endGameModalConfig.modal_button_label, templateContext)
    : undefined;
  const customSummary = endGameModalConfig?.modal_summary
    ? interpolateTemplate(endGameModalConfig.modal_summary, templateContext)
    : undefined;

  const footer = (
    <button
      onClick={handlePlayAgain}
      style={{
        ...modalButtonStyles.primary,
        backgroundColor: colors.primary.main,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.dark;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.main;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {customButtonLabel || `${theme.emoji.dice} Play Again`}
    </button>
  );

  return (
    <ModalBase
      isOpen={isGameOver && !!winnerName}
      onClose={handlePlayAgain}
      title={customTitle || 'Game Complete!'}
      emoji={theme.emoji.celebration}
      maxWidth="600px"
      headerColor={colors.success.light}
      headerBorderColor={colors.success.main}
      footer={footer}
      testId="end-game-modal"
    >
      <div style={{ textAlign: 'center' }}>
        {/* Celebration Icon */}
        <div style={{ fontSize: '80px', marginBottom: '20px' }}>
          {theme.emoji.celebration}
        </div>

        {/* Winner Announcement */}
        <h2 style={{
          margin: '0 0 10px 0',
          color: colors.success.main,
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          {theme.emoji.trophy} Congratulations {winnerName}!
        </h2>
        <p style={{
          margin: '0 0 24px 0',
          color: colors.text.secondary,
          fontSize: '18px'
        }}>
          {customDescription || 'You have successfully reached an ending space and won the game!'}
        </p>

        {/* Game Statistics */}
        {gameEndTime && (
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            backgroundColor: colors.secondary.bg,
            borderRadius: theme.borderRadius.lg,
            border: `2px solid ${colors.secondary.light}`
          }}>
            <h3 style={{
              margin: '0 0 10px 0',
              color: colors.secondary.dark,
              fontSize: '18px'
            }}>
              {theme.emoji.info} Game Statistics
            </h3>
            <p style={{
              margin: '0',
              fontSize: '16px',
              color: colors.secondary.main
            }}>
              Game completed at: {gameEndTime.toLocaleString()}
            </p>
          </div>
        )}

        {/* Workstream 7 Phase 7.4 — Missing-DOB penalty section.
            Rendered above the celebration banner so the player sees the cost
            before being congratulated. Plain-language framing ("emergency
            processing fee", "your CO came late") aligned with the NPC voice. */}
        {penalty && penalty.dobMissing && (
          <div
            data-testid="end-game-penalty"
            style={{
              marginBottom: '20px',
              padding: '16px 20px',
              backgroundColor: '#fff3cd',
              borderRadius: theme.borderRadius.lg,
              border: '2px solid #ffc107',
              textAlign: 'left',
            }}
          >
            <h3 style={{
              margin: '0 0 8px 0',
              color: '#856404',
              fontSize: '16px',
              fontWeight: 'bold',
            }}>
              ⚠️ DOB never signed off
            </h3>
            <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#856404' }}>
              Your CO came late and cost the owner. Emergency processing added <strong>+{penalty.days} days</strong> and a <strong>${penalty.fee.toLocaleString()}</strong> fee to your final stats.
            </p>
            <p style={{ margin: '0', fontSize: '12px', color: '#856404', fontStyle: 'italic' }}>
              Next game: secure DOB plan-exam approval before pushing for CO.
            </p>
          </div>
        )}

        {/* Celebration Message */}
        <div style={{
          padding: '20px',
          backgroundColor: colors.success.light,
          borderRadius: theme.borderRadius.lg,
          border: `2px solid ${colors.success.border}`
        }}>
          <p style={{
            margin: '0',
            fontSize: '16px',
            color: colors.success.darker,
            fontWeight: '500'
          }}>
            {theme.emoji.celebration} {customSummary || "Well played! You've mastered the game and reached your destination successfully!"}
          </p>
        </div>
      </div>
    </ModalBase>
  );
}
