import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';

interface DiceRollResult {
  roll1: number;
  roll2: number;
  total: number;
}

/**
 * DiceRoller component handles dice rolling functionality
 * Demonstrates the established UI-to-service integration pattern
 */
export function DiceRoller(): JSX.Element {
  const { playerActionService, stateService } = useGameContext();
  const [lastRollResult, setLastRollResult] = useState<DiceRollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  /**
   * Handle dice roll action using PlayerActionService
   * Follows the established async error handling pattern
   */
  const handleRollDice = async () => {
    try {
      setIsRolling(true);
      
      // Get current player from state
      const gameState = stateService.getGameState();
      const currentPlayerId = gameState.currentPlayerId;
      
      if (!currentPlayerId) {
        throw new Error('No current player found');
      }
      
      // Call service to roll dice
      const result = await playerActionService.rollDice(currentPlayerId);
      
      // Update local state to display result
      setLastRollResult(result);
      
    } catch (error) {
      // Display error to user with descriptive message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to roll dice: ${errorMessage}`);
      console.error('Dice roll error:', error);
    } finally {
      setIsRolling(false);
    }
  };

  /**
   * Button styling following established component patterns
   */
  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: isRolling ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: isRolling ? colors.secondary.main : colors.primary.main,
    color: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    opacity: isRolling ? 0.7 : 1
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    border: `1px solid ${colors.secondary.border}`,
    borderRadius: '8px',
    backgroundColor: colors.secondary.bg,
    minWidth: '200px'
  };

  const resultStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: colors.success.light,
    border: `1px solid ${colors.success.border}`,
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: colors.success.darker
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: colors.secondary.dark }}>
        🎲 Dice Roller
      </h3>
      
      <button
        onClick={handleRollDice}
        disabled={isRolling}
        style={buttonStyle}
        title={isRolling ? 'Rolling dice...' : 'Click to roll dice'}
      >
        {isRolling ? '🎲 Rolling...' : '🎲 Roll Dice'}
      </button>
      
      {lastRollResult && (
        <div style={resultStyle}>
          <div>Dice 1: {lastRollResult.roll1}</div>
          <div>Dice 2: {lastRollResult.roll2}</div>
          <div style={{ marginTop: '8px', fontSize: '16px' }}>
            Total: {lastRollResult.total}
          </div>
        </div>
      )}
    </div>
  );
}