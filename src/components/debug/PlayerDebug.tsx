// Debug component to check player data rendering
// Only renders when debug mode is enabled (toggle via window.__debug.enable())

import React, { useState, useEffect, useCallback } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { DebugMode } from '../../utils/debug';

export function PlayerDebug(): JSX.Element | null {
  const { stateService } = useGameContext();
  const gameState = stateService.getGameState();

  const [debugEnabled, setDebugEnabled] = useState(() => DebugMode.isEnabled());

  const handleStorageChange = useCallback((e: StorageEvent) => {
    if (e.key === 'game_debug_mode') {
      setDebugEnabled(DebugMode.isEnabled());
    }
  }, []);

  useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [handleStorageChange]);

  if (!debugEnabled) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: colors.white,
      border: `2px solid ${colors.primary.main}`,
      borderRadius: '8px',
      padding: '12px',
      maxWidth: '300px',
      fontSize: '12px',
      zIndex: 9999,
      maxHeight: '400px',
      overflow: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 8px 0' }}>
        <h4 style={{ margin: 0, color: colors.primary.main }}>Player Debug Info</h4>
        <button
          onClick={() => DebugMode.disable()}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '2px 6px',
            color: colors.text.secondary,
          }}
        >
          Close
        </button>
      </div>

      <div><strong>Game Phase:</strong> {gameState.gamePhase}</div>
      <div><strong>Current Player ID:</strong> {gameState.currentPlayerId || 'None'}</div>
      <div><strong>Players Count:</strong> {gameState.players.length}</div>

      {gameState.players.map((player, index) => (
        <div key={player.id} style={{
          border: `1px solid ${colors.secondary.border}`,
          borderRadius: '4px',
          padding: '8px',
          margin: '4px 0',
          background: player.id === gameState.currentPlayerId ? colors.primary.light : colors.secondary.light
        }}>
          <div><strong>Player {index + 1}:</strong> {player.name}</div>
          <div><strong>ID:</strong> {player.id}</div>
          <div><strong>Space:</strong> {player.currentSpace}</div>
          <div><strong>Visit Type:</strong> {player.visitType}</div>
          <div><strong>Money:</strong> ${player.money}</div>
          <div><strong>Time:</strong> {player.timeSpent} days</div>
          <div><strong>Color:</strong> {player.color}</div>
          <div><strong>Avatar:</strong> {player.avatar}</div>

          <div><strong>Hand:</strong> {player.hand?.length || 0} cards</div>
          <div style={{ marginLeft: '10px', fontSize: '10px' }}>
            {player.hand?.join(', ') || 'No cards'}
          </div>
        </div>
      ))}
    </div>
  );
}
