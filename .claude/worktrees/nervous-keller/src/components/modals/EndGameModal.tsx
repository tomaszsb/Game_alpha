// src/components/modals/EndGameModal.tsx

import React, { useState, useEffect } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';

export function EndGameModal(): JSX.Element {
  const { stateService } = useGameContext();
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string>('');
  const [gameEndTime, setGameEndTime] = useState<Date | undefined>();

  // Subscribe to state changes to show/hide modal
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setIsGameOver(gameState.isGameOver);

      if (gameState.isGameOver && gameState.winner) {
        const winnerPlayer = gameState.players.find(p => p.id === gameState.winner);
        setWinnerName(winnerPlayer?.name || 'Unknown Player');
        setGameEndTime(gameState.gameEndTime);
      }
    });

    // Initialize with current state
    const gameState = stateService.getGameState();
    setIsGameOver(gameState.isGameOver);
    if (gameState.isGameOver && gameState.winner) {
      const winnerPlayer = gameState.players.find(p => p.id === gameState.winner);
      setWinnerName(winnerPlayer?.name || 'Unknown Player');
      setGameEndTime(gameState.gameEndTime);
    }

    return unsubscribe;
  }, [stateService]);

  const handlePlayAgain = () => {
    // Navigate to root landing page instead of resetting in-place
    window.location.href = window.location.origin + window.location.pathname;
  };

  // Don't render if game is not over or there's no winner
  if (!isGameOver || !winnerName) {
    return <></>;
  }

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
      {theme.emoji.dice} Play Again
    </button>
  );

  return (
    <ModalBase
      isOpen={true}
      onClose={handlePlayAgain}
      title="Game Complete!"
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
          You have successfully reached an ending space and won the game!
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
            {theme.emoji.celebration} Well played! You've mastered the game and reached your destination successfully!
          </p>
        </div>
      </div>
    </ModalBase>
  );
}
