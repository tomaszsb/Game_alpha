import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { GameSpace } from './GameSpace';
import { SpaceInfoModal } from '../modals/SpaceInfoModal';
import { useGameContext } from '../../context/GameContext';
import { Space, Player } from '../../types/DataTypes';

/**
 * GameBoard component with enhanced smooth transitions and animations.
 * All state changes now have visual transitions for better user experience.
 */
export function GameBoard(): JSX.Element {
  const { dataService, stateService, movementService } = useGameContext();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [highlightedMoves, setHighlightedMoves] = useState<string[]>([]);
  const [gamePhase, setGamePhase] = useState<string>('SETUP');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedSpaceForInfo, setSelectedSpaceForInfo] = useState<string | null>(null);
  const [isSpaceInfoModalOpen, setIsSpaceInfoModalOpen] = useState(false);

  // Subscribe to only board-relevant state changes
  // This prevents re-renders when unrelated state changes (money, cards, etc.)
  useEffect(() => {
    // Type for the extracted state slice
    type BoardStateSlice = {
      playerPositions: Array<{ id: string; space: string; color: string; name: string }>;
      currentPlayerId: string | null;
      gamePhase: string;
      isMoving: boolean;
      hasPlayerMovedThisTurn: boolean;
      awaitingChoiceType: string | null;
    };

    // Selector extracts only values needed for the game board
    const selector = (state: ReturnType<typeof stateService.getGameState>): BoardStateSlice => ({
      // Only track player positions and identity, not money/cards/etc
      playerPositions: state.players.map(p => ({ id: p.id, space: p.currentSpace, color: p.color || '#888', name: p.name })),
      currentPlayerId: state.currentPlayerId,
      gamePhase: state.gamePhase,
      isMoving: state.isMoving,
      hasPlayerMovedThisTurn: state.hasPlayerMovedThisTurn,
      awaitingChoiceType: state.awaitingChoice?.type || null
    });

    // Custom equality - deep compare player positions
    const equalityFn = (a: ReturnType<typeof selector>, b: ReturnType<typeof selector>) => {
      if (a.currentPlayerId !== b.currentPlayerId ||
          a.gamePhase !== b.gamePhase ||
          a.isMoving !== b.isMoving ||
          a.hasPlayerMovedThisTurn !== b.hasPlayerMovedThisTurn ||
          a.awaitingChoiceType !== b.awaitingChoiceType ||
          a.playerPositions.length !== b.playerPositions.length) {
        return false;
      }
      // Compare player positions
      return a.playerPositions.every((p, i) =>
        p.id === b.playerPositions[i].id && p.space === b.playerPositions[i].space
      );
    };

    const unsubscribe = stateService.subscribeWithSelector(
      selector,
      (selected, gameState) => {
        // Track transition state for smooth animations
        setIsTransitioning(selected.isMoving);
        setPlayers(gameState.players);
        setCurrentPlayerId(selected.currentPlayerId);
        setGamePhase(selected.gamePhase);

        // REFINED GUARD: Only block this specific state update during a move
        if (!selected.isMoving) {
          if (selected.gamePhase === 'PLAY' && selected.currentPlayerId && !selected.hasPlayerMovedThisTurn) {
            try {
              const moves = movementService.getValidMoves(selected.currentPlayerId);
              setValidMoves(moves);
              console.log(`🎯 BOARD: Player ${selected.currentPlayerId} has ${moves.length} valid moves:`, moves);
            } catch (error) {
              console.log(`🎯 BOARD: No valid moves for player ${selected.currentPlayerId}:`, error);
              setValidMoves([]);
            }
          } else {
            setValidMoves([]);
          }
        }

        // Cache movement choices to prevent them from disappearing during animation
        if (selected.awaitingChoiceType === 'MOVEMENT' && !selected.isMoving && selected.currentPlayerId) {
          const moves = movementService.getValidMoves(selected.currentPlayerId);
          setHighlightedMoves(moves);
        } else if (!selected.awaitingChoiceType && !selected.isMoving) {
          setHighlightedMoves([]);
        }
      },
      equalityFn
    );

    // Initialize with current state
    const gameState = stateService.getGameState();
    setPlayers(gameState.players);
    setCurrentPlayerId(gameState.currentPlayerId);
    setGamePhase(gameState.gamePhase);

    if (gameState.gamePhase === 'PLAY' && gameState.currentPlayerId && !gameState.hasPlayerMovedThisTurn) {
      try {
        const moves = movementService.getValidMoves(gameState.currentPlayerId);
        setValidMoves(moves);
      } catch (error) {
        setValidMoves([]);
      }
    }

    return unsubscribe;
  }, [stateService, movementService]);

  // Load all spaces on mount (excluding tutorial/instruction spaces)
  useEffect(() => {
    const allSpaces = dataService.getAllSpaces();
    // Filter out tutorial and instruction spaces that shouldn't appear on the game board
    const gameSpaces = allSpaces.filter(space => {
      const config = dataService.getGameConfigBySpace(space.name);
      // Exclude Tutorial spaces and instruction spaces (path_type === 'none')
      return config?.path_type !== 'Tutorial' && config?.path_type !== 'none';
    });
    setSpaces(gameSpaces);
  }, [dataService]);

  // Helper function to get players on a specific space
  const getPlayersOnSpace = (spaceName: string): Player[] => {
    return players.filter(player => player.currentSpace === spaceName);
  };

  // Helper function to check if a space is a valid move destination
  const isValidMoveDestination = (spaceName: string): boolean => {
    return highlightedMoves.includes(spaceName);
  };

  // Helper function to check if current player is on this space
  const isCurrentPlayerSpace = (spaceName: string): boolean => {
    if (!currentPlayerId) return false;
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    return currentPlayer?.currentSpace === spaceName;
  };

  // Handler for space info icon click
  const handleSpaceInfoClick = (spaceName: string) => {
    setSelectedSpaceForInfo(spaceName);
    setIsSpaceInfoModalOpen(true);
  };

  // Get space details for modal
  const getSpaceDetails = () => {
    if (!selectedSpaceForInfo) {
      return {
        space: null,
        content: null,
        effects: [],
        diceEffects: [],
        connections: []
      };
    }

    const space = spaces.find(s => s.name === selectedSpaceForInfo);
    const content = dataService.getSpaceContent(selectedSpaceForInfo, 'First');
    const effects = dataService.getSpaceEffects(selectedSpaceForInfo, 'First');
    const diceEffects = dataService.getDiceEffects(selectedSpaceForInfo, 'First');

    // Calculate incoming connections by checking which spaces can move to this space
    const connections: string[] = [];
    try {
      spaces.forEach(otherSpace => {
        const movement = dataService.getMovement(otherSpace.name, 'First');
        if (movement) {
          const destinations = [
            movement.destination_1,
            movement.destination_2,
            movement.destination_3,
            movement.destination_4,
            movement.destination_5
          ].filter(dest => dest && dest === selectedSpaceForInfo);

          if (destinations.length > 0 && !connections.includes(otherSpace.name)) {
            connections.push(otherSpace.name);
          }
        }
      });
    } catch (error) {
      console.warn('Error loading space connections:', error);
    }

    return {
      space: space || null,
      content,
      effects,
      diceEffects,
      connections
    };
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '20px',
        transition: 'opacity 0.2s ease-in-out',
        opacity: isTransitioning ? 0.95 : 1
      }}
    >
      <h2 style={{
        color: colors.game.boardTitle,
        marginBottom: '20px',
        textAlign: 'center',
        transition: 'all 0.3s ease-in-out'
      }}>
        🎯 Game Board {isTransitioning && <span style={{ fontSize: '14px', color: colors.info.main }}>⏳ Moving...</span>}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          width: '100%',
          transition: 'transform 0.15s ease-in-out',
          transform: isTransitioning ? 'scale(0.99)' : 'scale(1)'
        }}
      >
        {spaces.map((space) => {
          const playersOnSpace = getPlayersOnSpace(space.name);
          const isValidMove = isValidMoveDestination(space.name);
          const isCurrentPlayer = isCurrentPlayerSpace(space.name);

          return (
            <GameSpace
              key={space.name}
              space={space}
              playersOnSpace={playersOnSpace}
              isValidMoveDestination={isValidMove}
              isCurrentPlayerSpace={isCurrentPlayer}
              showMovementIndicators={highlightedMoves.length > 0}
              onInfoClick={handleSpaceInfoClick}
            />
          );
        })}
      </div>
      
      {spaces.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            color: colors.text.secondary,
            fontSize: '16px',
            marginTop: '40px'
          }}
        >
          Loading game spaces...
        </div>
      )}

      {/* Space Info Modal */}
      <SpaceInfoModal
        isOpen={isSpaceInfoModalOpen}
        onClose={() => {
          setIsSpaceInfoModalOpen(false);
          setSelectedSpaceForInfo(null);
        }}
        spaceName={selectedSpaceForInfo || ''}
        {...getSpaceDetails()}
        playersOnSpace={selectedSpaceForInfo ? getPlayersOnSpace(selectedSpaceForInfo) : []}
      />
    </div>
  );
}