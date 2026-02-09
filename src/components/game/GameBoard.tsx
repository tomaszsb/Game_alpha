import React, { useState, useEffect, useRef, useCallback } from 'react';
import { colors } from '../../styles/theme';
import { GameSpace } from './GameSpace';
import { SpaceInfoModal } from '../modals/SpaceInfoModal';
import { useGameContext } from '../../context/GameContext';
import { Space, Player } from '../../types/DataTypes';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

interface GameBoardProps {
  /** Disable zoom/pan controls (e.g. for TV display mode) */
  disableZoom?: boolean;
}

/**
 * GameBoard component with enhanced smooth transitions and animations.
 * All state changes now have visual transitions for better user experience.
 */
export function GameBoard({ disableZoom = false }: GameBoardProps = {}): JSX.Element {
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

  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Touch tracking refs
  const touchStartDistance = useRef(0);
  const touchStartZoom = useRef(1);
  const touchStartPan = useRef({ x: 0, y: 0 });
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isTouchPanning = useRef(false);
  const lastTapTime = useRef(0);

  // Mouse drag refs
  const isMouseDragging = useRef(false);
  const mouseStartPos = useRef({ x: 0, y: 0 });
  const mouseStartPan = useRef({ x: 0, y: 0 });

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const clampPan = useCallback((x: number, y: number, z: number) => {
    if (z <= 1) return { x: 0, y: 0 };
    const container = boardContainerRef.current;
    if (!container) return { x, y };
    // Clamp pan to half the container size in each direction
    const maxPanX = container.offsetWidth * 0.5;
    const maxPanY = container.scrollHeight * 0.5;
    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, y))
    };
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const next = clampZoom(prev + delta);
      if (next <= 1) {
        setPanX(0);
        setPanY(0);
      }
      return next;
    });
  }, []);

  // Touch handlers for pinch-zoom and pan
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistance.current = Math.hypot(dx, dy);
      touchStartZoom.current = zoom;
      isTouchPanning.current = false;
    } else if (e.touches.length === 1 && zoom > 1) {
      // Pan start (only when zoomed)
      isTouchPanning.current = true;
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStartPan.current = { x: panX, y: panY };

      // Double-tap detection
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        resetZoom();
        isTouchPanning.current = false;
      }
      lastTapTime.current = now;
    } else if (e.touches.length === 1 && zoom <= 1) {
      // Double-tap detection at default zoom (to zoom in)
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        setZoom(1.5);
      }
      lastTapTime.current = now;
    }
  }, [zoom, panX, panY, resetZoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / touchStartDistance.current;
      const newZoom = clampZoom(touchStartZoom.current * scale);
      setZoom(newZoom);
      if (newZoom <= 1) {
        setPanX(0);
        setPanY(0);
      }
      e.preventDefault();
    } else if (e.touches.length === 1 && isTouchPanning.current && zoom > 1) {
      // Pan
      const dx = e.touches[0].clientX - touchStartPos.current.x;
      const dy = e.touches[0].clientY - touchStartPos.current.y;
      const clamped = clampPan(touchStartPan.current.x + dx, touchStartPan.current.y + dy, zoom);
      setPanX(clamped.x);
      setPanY(clamped.y);
      e.preventDefault();
    }
  }, [zoom, clampPan]);

  const handleTouchEnd = useCallback(() => {
    isTouchPanning.current = false;
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (zoom <= 1 && e.deltaY > 0) return; // Don't interfere with page scroll when not zoomed
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom(prev => {
      const next = clampZoom(prev + delta);
      if (next <= 1) {
        setPanX(0);
        setPanY(0);
      }
      return next;
    });
  }, [zoom]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isMouseDragging.current = true;
    mouseStartPos.current = { x: e.clientX, y: e.clientY };
    mouseStartPan.current = { x: panX, y: panY };
    e.preventDefault();
  }, [zoom, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isMouseDragging.current || zoom <= 1) return;
    const dx = e.clientX - mouseStartPos.current.x;
    const dy = e.clientY - mouseStartPos.current.y;
    const clamped = clampPan(mouseStartPan.current.x + dx, mouseStartPan.current.y + dy, zoom);
    setPanX(clamped.x);
    setPanY(clamped.y);
  }, [zoom, clampPan]);

  const handleMouseUp = useCallback(() => {
    isMouseDragging.current = false;
  }, []);

  // Double-click to reset
  const handleDoubleClick = useCallback(() => {
    resetZoom();
  }, [resetZoom]);

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
      ref={boardContainerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '20px',
        transition: 'opacity 0.2s ease-in-out',
        opacity: isTransitioning ? 0.95 : 1,
        position: 'relative',
        overflow: zoom > 1 && !disableZoom ? 'hidden' : 'auto',
        cursor: !disableZoom && zoom > 1 ? (isMouseDragging.current ? 'grabbing' : 'grab') : 'default',
        touchAction: !disableZoom && zoom > 1 ? 'none' : 'auto'
      }}
      {...(!disableZoom ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onWheel: handleWheel,
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        onDoubleClick: handleDoubleClick
      } : {})}
    >
      {/* Zoom controls overlay */}
      {!disableZoom && <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 10,
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.9)',
        borderRadius: '6px',
        padding: '4px 6px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        fontSize: '12px'
      }}>
        <span style={{ color: '#495057', fontWeight: 'bold', minWidth: '36px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={(e) => { e.stopPropagation(); adjustZoom(-ZOOM_STEP); }} style={{
          width: '26px', height: '26px', border: '1px solid #ccc', borderRadius: '4px',
          background: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: '1',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>−</button>
        <button onClick={(e) => { e.stopPropagation(); adjustZoom(ZOOM_STEP); }} style={{
          width: '26px', height: '26px', border: '1px solid #ccc', borderRadius: '4px',
          background: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: '1',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>+</button>
        <button onClick={(e) => { e.stopPropagation(); resetZoom(); }} style={{
          width: '26px', height: '26px', border: '1px solid #ccc', borderRadius: '4px',
          background: zoom !== 1 ? '#e3f2fd' : '#fff', cursor: 'pointer', fontSize: '13px', lineHeight: '1',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>↺</button>
      </div>}

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
          gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(140 * zoom)}px, 1fr))`,
          gap: `${Math.round(12 * zoom)}px`,
          width: '100%',
          transition: 'transform 0.15s ease-in-out',
          transform: disableZoom
            ? (isTransitioning ? 'scale(0.99)' : 'scale(1)')
            : `translate(${panX}px, ${panY}px)${isTransitioning ? ' scale(0.99)' : ''}`,
          fontSize: `${zoom}em`
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