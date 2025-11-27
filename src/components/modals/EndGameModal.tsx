import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
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
        // Get the winner's name for display
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
    try {
      // Reset the game to start over
      stateService.resetGame();
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };

  // Don't render if game is not over or there's no winner
  if (!isGameOver || !winnerName) {
    return <></>;
  }

  return (
    <>
      {/* Modal Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
      >
        {/* Modal Content */}
        <div
          style={{
            backgroundColor: colors.white,
            padding: '40px',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            border: `4px solid ${colors.success.main}`,
            textAlign: 'center'
          }}
        >
          {/* Celebration Icon */}
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>
            🎉
          </div>

          {/* Modal Header */}
          <div style={{ marginBottom: '30px' }}>
            <h1 style={{ 
              margin: '0 0 15px 0', 
              color: colors.success.main,
              fontSize: '36px',
              fontWeight: 'bold'
            }}>
              Game Complete!
            </h1>
            <h2 style={{ 
              margin: '0 0 10px 0',
              color: colors.text.primary,
              fontSize: '24px',
              fontWeight: 'normal'
            }}>
              🏆 Congratulations {winnerName}!
            </h2>
            <p style={{ 
              margin: '0',
              color: colors.text.secondary,
              fontSize: '18px'
            }}>
              You have successfully reached an ending space and won the game!
            </p>
          </div>

          {/* Game Statistics */}
          {gameEndTime && (
            <div style={{ 
              marginBottom: '30px',
              padding: '20px',
              backgroundColor: colors.secondary.bg,
              borderRadius: '12px',
              border: `2px solid ${colors.secondary.light}`
            }}>
              <h3 style={{ 
                margin: '0 0 10px 0',
                color: colors.secondary.dark,
                fontSize: '18px'
              }}>
                📊 Game Statistics
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

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handlePlayAgain}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: colors.primary.main,
                color: colors.white,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.primary.dark;
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.primary.main;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
            >
              🎮 Play Again
            </button>
          </div>

          {/* Celebration Message */}
          <div style={{ 
            marginTop: '30px', 
            padding: '20px',
            backgroundColor: colors.success.light,
            borderRadius: '12px',
            border: `2px solid ${colors.success.border}`
          }}>
            <p style={{ 
              margin: '0',
              fontSize: '16px',
              color: colors.success.darker,
              fontWeight: '500'
            }}>
              🌟 Well played! You've mastered the game and reached your destination successfully!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}