// src/components/setup/PlayerSetup.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { PlayerForm } from './PlayerForm';
import { PlayerList } from './PlayerList';
import { usePlayerValidation, GameSettings } from './usePlayerValidation';
import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/StateTypes';

interface PlayerSetupProps {
  onStartGame?: (players: Player[], settings: GameSettings) => void;
}

/**
 * PlayerSetup is the main container component that orchestrates player management
 * This replaces the legacy EnhancedPlayerSetup with a clean, composable structure
 */
export function PlayerSetup({ 
  onStartGame = (players, settings) => console.log('Start game:', players, settings) 
}: PlayerSetupProps): JSX.Element {
  
  // Get services from context
  const { stateService, gameRulesService } = useGameContext();
  
  // Get players from StateService instead of local state
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setPlayers(gameState.players);
    });
    
    // Initialize with current state
    setPlayers(stateService.getGameState().players);
    
    return unsubscribe;
  }, [stateService]);

  // Game settings state
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    maxPlayers: 4,
    winCondition: 'FIRST_TO_FINISH',
    difficulty: 'normal'
  });

  const [isStarting, setIsStarting] = useState(false);

  // Use validation hook with services
  const validation = usePlayerValidation(players, gameSettings, stateService, gameRulesService);

  /**
   * Add a new player
   */
  const handleAddPlayer = () => {
    const addValidation = validation.validateAddPlayer();
    if (!addValidation.isValid) {
      if (addValidation.errorMessage) {
        alert(addValidation.errorMessage);
      }
      return;
    }

    try {
      const playerName = `Player ${players.length + 1}`;
      stateService.addPlayer(playerName);
    } catch (error: any) {
      alert(`Failed to add player: ${error.message}`);
    }
  };

  /**
   * Remove a player
   */
  const handleRemovePlayer = (playerId: string) => {
    if (!validation.canRemovePlayer) {
      alert('Cannot remove player: Must have at least one player');
      return;
    }

    try {
      stateService.removePlayer(playerId);
    } catch (error: any) {
      alert(`Failed to remove player: ${error.message}`);
    }
  };

  /**
   * Update a player property
   */
  const handleUpdatePlayer = (playerId: string, property: string, value: string) => {
    // Remove validation - let StateService handle conflicts gracefully
    // Users should be able to select any color/avatar without getting errors
    
    try {
      stateService.updatePlayer({ id: playerId, [property]: value });
    } catch (error: any) {
      alert(`Failed to update player: ${error.message}`);
    }
  };

  /**
   * Cycle through avatars for a player
   */
  const handleCycleAvatar = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const nextAvatar = validation.getNextAvatar(player.avatar || '', playerId);
    handleUpdatePlayer(playerId, 'avatar', nextAvatar);
  };

  /**
   * Start the game
   */
  const handleStartGame = async () => {
    const gameStartValidation = validation.validateGameStart();
    if (!gameStartValidation.isValid && gameStartValidation.errorMessage) {
      alert(gameStartValidation.errorMessage);
      return;
    }

    setIsStarting(true);
    
    try {
      // Filter out players with empty names for the callback
      const validPlayers = players.filter(p => p.name.trim());
      await onStartGame(validPlayers, gameSettings);
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * Handle button hover effects for start game button
   */
  const handleStartGameMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isStarting) {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 8px 25px rgba(44, 85, 48, 0.5)';
    }
  };

  const handleStartGameMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isStarting) {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 6px 20px rgba(44, 85, 48, 0.4)';
    }
  };

  const addPlayerValidation = validation.validateAddPlayer();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.purple.main} 100%)`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '2rem',
      paddingTop: 'max(2rem, env(safe-area-inset-top))',
      zIndex: 1000,
      overflow: 'auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        maxWidth: '800px',
        width: '100%',
        margin: '2rem 0',
        minHeight: 'fit-content'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>
            🏗️
          </div>
          
          <h1 style={{
            color: colors.success.text,
            fontSize: '2.5rem',
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            Project Management
          </h1>
          
          <h2 style={{
            color: colors.secondary.main,
            fontSize: '1.5rem',
            fontWeight: 'normal',
            margin: 0
          }}>
            Board Game
          </h2>
          
          <p style={{
            color: colors.secondary.main,
            fontSize: '1.1rem',
            margin: '1rem 0 0 0'
          }}>
            Navigate from project initiation to completion!
          </p>
        </div>

        {/* Players section */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{
            color: colors.success.text,
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            👥 Players
          </h3>
          
          {/* Player count summary */}
          <p style={{
            color: colors.secondary.main,
            fontSize: '1rem',
            margin: '0 0 1.5rem 0',
            fontStyle: 'italic'
          }}>
            {validation.getPlayerCountSummary()}
          </p>

          {/* Player list */}
          <div style={{ marginBottom: '1.5rem' }}>
            <PlayerList
              players={players}
              onUpdatePlayer={handleUpdatePlayer}
              onRemovePlayer={handleRemovePlayer}
              onCycleAvatar={handleCycleAvatar}
              canRemovePlayer={validation.canRemovePlayer}
            />
          </div>

          {/* Add player form */}
          {validation.canAddPlayer && (
            <PlayerForm
              onAddPlayer={handleAddPlayer}
              canAddPlayer={validation.canAddPlayer}
              validationResult={addPlayerValidation}
            />
          )}
        </div>

        {/* Game settings section */}
        <div style={{
          background: colors.secondary.bg,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            color: colors.success.text,
            fontSize: '1.2rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚙️ Game Settings
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                color: colors.secondary.dark
              }}>
                Win Condition
              </label>
              <select
                value={gameSettings.winCondition}
                onChange={(e) => setGameSettings({
                  ...gameSettings,
                  winCondition: e.target.value
                })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `2px solid ${colors.secondary.light}`,
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="FIRST_TO_FINISH">First to Finish</option>
                <option value="HIGHEST_SCORE">Highest Score</option>
              </select>
            </div>
          </div>
        </div>

        {/* Start game button */}
        <button
          type="button"
          onClick={handleStartGame}
          disabled={isStarting}
          style={{
            background: isStarting ? colors.secondary.main : `linear-gradient(45deg, ${colors.success.text}, ${colors.success.main})`,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '1.5rem 3rem',
            fontSize: '1.3rem',
            fontWeight: 'bold',
            cursor: isStarting ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'all 0.3s ease',
            boxShadow: '0 6px 20px rgba(44, 85, 48, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={handleStartGameMouseEnter}
          onMouseLeave={handleStartGameMouseLeave}
        >
          {isStarting ? '🎲 Starting Game...' : '🚀 Start Game'}
        </button>
      </div>
    </div>
  );
}