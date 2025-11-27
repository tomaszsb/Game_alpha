// Debug component to check player data rendering

import React from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';

export function PlayerDebug(): JSX.Element {
  const { stateService } = useGameContext();
  const gameState = stateService.getGameState();
  
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
      <h4 style={{ margin: '0 0 8px 0', color: colors.primary.main }}>🐛 Player Debug Info</h4>
      
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