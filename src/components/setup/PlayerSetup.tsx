// src/components/setup/PlayerSetup.tsx

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { PlayerForm } from './PlayerForm';
import { PlayerList } from './PlayerList';
import { usePlayerValidation, GameSettings } from './usePlayerValidation';
import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/StateTypes';
import { getCurrentGameId } from '../../utils/networkDetection';
import { DataEditor } from '../editor/DataEditor';
import { EducationalCardSelectionModal } from '../modals/EducationalCardSelectionModal';

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
  const { stateService, gameRulesService, dataService } = useGameContext();
  
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
    difficulty: 'normal',
    sameStartingPoint: false,
    startingMode: 'QUICK_START'
  });

  const [isStarting, setIsStarting] = useState(false);
  const [isDataEditorOpen, setIsDataEditorOpen] = useState(false);
  const [showCardSelection, setShowCardSelection] = useState(false);

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
          <img
            src="/images/logo.png"
            alt="Unravel Codes"
            style={{
              width: '120px',
              height: 'auto',
              marginBottom: '1rem'
            }}
          />

          <h1 style={{
            color: colors.success.text,
            fontSize: '2rem',
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            Unravel Codes: The Game
          </h1>

          <p style={{
            color: colors.secondary.main,
            fontSize: '1.1rem',
            margin: '1rem 0 0 0'
          }}>
            Navigate from project initiation to completion!
          </p>

          {/* Game Code Display (Dec 29, 2025) */}
          {getCurrentGameId() && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: colors.primary.light,
              border: `2px solid ${colors.primary.main}`,
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              <span style={{ color: colors.secondary.main, fontSize: '0.9rem' }}>Game Code: </span>
              <span style={{
                color: colors.primary.main,
                fontSize: '1.2rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                letterSpacing: '2px'
              }}>
                {getCurrentGameId()}
              </span>
            </div>
          )}
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
            color: colors.text.primary,
            fontSize: '1.1rem',
            fontWeight: '500',
            margin: '0 0 1.5rem 0'
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

          {/* Same Starting Point Mode (January 2026) */}
          <div style={{ marginTop: '1.5rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={gameSettings.sameStartingPoint}
                onChange={(e) => setGameSettings({
                  ...gameSettings,
                  sameStartingPoint: e.target.checked
                })}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontWeight: 'bold',
                color: colors.secondary.dark
              }}>
                Same Starting Point
              </span>
              <span style={{
                color: colors.text.secondary,
                fontSize: '0.9rem'
              }}>
                All players start with identical cards
              </span>
            </label>

            {/* Sub-mode options (only shown when Same Starting Point is checked) */}
            {gameSettings.sameStartingPoint && (
              <div style={{
                marginTop: '1rem',
                marginLeft: '2rem',
                padding: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '8px',
                border: `1px solid ${colors.secondary.light}`
              }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                  }}>
                    <input
                      type="radio"
                      name="startingMode"
                      value="QUICK_START"
                      checked={gameSettings.startingMode === 'QUICK_START'}
                      onChange={() => setGameSettings({
                        ...gameSettings,
                        startingMode: 'QUICK_START'
                      })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>Quick Start</span>
                    <span style={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                      - P1's natural draws become starting hand for all
                    </span>
                  </label>
                </div>
                <div>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="startingMode"
                      value="EDUCATIONAL"
                      checked={gameSettings.startingMode === 'EDUCATIONAL'}
                      onChange={() => setGameSettings({
                        ...gameSettings,
                        startingMode: 'EDUCATIONAL'
                      })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>Educational</span>
                    <span style={{ color: colors.text.secondary, fontSize: '0.85rem' }}>
                      - Select specific starting cards
                    </span>
                  </label>

                  {/* Educational mode: Select Cards button */}
                  {gameSettings.startingMode === 'EDUCATIONAL' && (
                    <div style={{ marginTop: '0.75rem', marginLeft: '1.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowCardSelection(true)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: colors.primary.main,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        Select Starting Cards...
                      </button>
                      {/* Show selection summary */}
                      {gameSettings.preSelectedHand && gameSettings.preSelectedHand.length > 0 && (
                        <div style={{
                          marginTop: '0.5rem',
                          fontSize: '0.85rem',
                          color: colors.success.text
                        }}>
                          {gameSettings.preSelectedHand.length} card{gameSettings.preSelectedHand.length !== 1 ? 's' : ''} selected:
                          {' '}
                          <span style={{ color: colors.text.secondary }}>
                            {gameSettings.preSelectedHand.filter(id => id.startsWith('W')).length} W,
                            {' '}
                            {gameSettings.preSelectedHand.filter(id => id.startsWith('E')).length} E
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Tools section */}
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
            🛠️ Admin Tools
          </h3>

          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={() => setIsDataEditorOpen(true)}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: colors.secondary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ⚙️ Space Data Editor
            </button>
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

        {/* Alpha notice */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: colors.primary.light,
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: colors.text.secondary,
          lineHeight: '1.5',
          textAlign: 'center'
        }}>
          <strong>Alpha Version</strong> - We're improving daily.
          {' '}Feedback? <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
        </div>
      </div>

      {/* Data Editor Modal */}
      {isDataEditorOpen && <DataEditor onClose={() => setIsDataEditorOpen(false)} />}

      {/* Educational Card Selection Modal */}
      <EducationalCardSelectionModal
        isOpen={showCardSelection}
        onClose={() => setShowCardSelection(false)}
        onConfirm={(selectedCardIds) => {
          setGameSettings({
            ...gameSettings,
            preSelectedHand: selectedCardIds
          });
          setShowCardSelection(false);
        }}
        initialSelection={gameSettings.preSelectedHand}
        dataService={dataService}
      />
    </div>
  );
}