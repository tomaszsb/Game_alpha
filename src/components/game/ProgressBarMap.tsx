// src/components/game/ProgressBarMap.tsx
//
// Force-graph mini map of all game spaces below the board.
// Uses react-force-graph-2d (same library as the glossary dashboard).
// Nodes are colored by phase/NPC, connected by movement links.
// Current player's space highlights. Other players shown as avatars on nodes.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useGameContext } from '../../context/GameContext';
import { GameSpace } from './GameSpace';
import { PlayerPanelWrapper } from '../player/PlayerPanelWrapper';
import { Space, Player } from '../../types/DataTypes';
import { IServiceContainer } from '../../types/ServiceContracts';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import './ProgressBarMap.css';

// Phase colors for node fills — aligned with NPC CHARACTER_MAP
const PHASE_NODE_COLORS: Record<string, string> = {
  'SETUP':        '#2196F3', // blue (Owner phase color)
  'OWNER':        '#2196F3',
  'PM':           '#673AB7', // deep purple for PM
  'FUNDING':      '#FF9800', // orange/amber
  'DESIGN':       '#9C27B0', // purple (Architect)
  'DOB':          '#f44336', // red (DOB)
  'FDNY':         '#ff5722', // deep orange (FDNY)
  'CONSTRUCTION': '#4CAF50', // green (Contractor)
  'END':          '#009688', // teal
};

// Map config phase + space name to our display groups
function getDisplayPhase(configPhase: string, spaceName: string): string {
  if (spaceName === 'PM-DECISION-CHECK') return 'PM';
  if (configPhase === 'REGULATORY') {
    if (spaceName.startsWith('REG-FDNY')) return 'FDNY';
    return 'DOB';
  }
  return configPhase;
}

interface GraphNode {
  id: string;
  name: string;
  phase: string;
  color: string;
  space: Space;
  // Force graph positioning
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface ProgressBarMapProps {
  gameServices: IServiceContainer;
  currentPlayerId: string | null;
  players: Player[];
  onTryAgain: () => Promise<void>;
  playerNotifications: Record<string, string>;
  onRollDice: () => Promise<void>;
  onAutomaticFunding: () => Promise<void>;
  onManualEffectResult: (result: any) => void;
  completedActions: { diceRoll: string | undefined; manualActions: Record<string, string> };
  onToggleSpaceExplorer: () => void;
  onToggleMovementPath: () => void;
  isSpaceExplorerVisible: boolean;
  isMovementPathVisible: boolean;
}

export function ProgressBarMap({
  gameServices,
  currentPlayerId,
  players,
  onTryAgain,
  playerNotifications,
  onRollDice,
  onAutomaticFunding,
  onManualEffectResult,
  completedActions,
  onToggleSpaceExplorer,
  onToggleMovementPath,
  isSpaceExplorerVisible,
  isMovementPathVisible,
}: ProgressBarMapProps): JSX.Element {
  const { dataService, stateService, movementService } = useGameContext();

  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 180 });
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 180,
        });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Build graph data from game spaces and movement connections
  const graphData = useMemo(() => {
    const allSpaces = dataService.getAllSpaces();
    const gameSpaces = allSpaces.filter(space => {
      const config = dataService.getGameConfigBySpace(space.name);
      return config?.path_type !== 'Tutorial' && config?.path_type !== 'none';
    });

    const nodes: GraphNode[] = gameSpaces.map(space => {
      const config = dataService.getGameConfigBySpace(space.name);
      const configPhase = config?.phase || 'UNKNOWN';
      const displayPhase = getDisplayPhase(configPhase, space.name);

      // Get NPC color or fall back to phase color
      const npcPrefix = extractPrefix(space.name);
      const npcInfo = CHARACTER_MAP[npcPrefix];
      const color = npcInfo?.color || PHASE_NODE_COLORS[displayPhase] || '#6b7280';

      return {
        id: space.name,
        name: space.name,
        phase: displayPhase,
        color,
        space,
      };
    });

    // Build links from movement data
    const nodeIds = new Set(nodes.map(n => n.id));
    const links: GraphLink[] = [];
    const linkSet = new Set<string>();

    for (const space of gameSpaces) {
      for (const visitType of ['First', 'Subsequent'] as const) {
        const movement = dataService.getMovement(space.name, visitType);
        if (!movement) continue;
        const dests = [
          movement.destination_1,
          movement.destination_2,
          movement.destination_3,
          movement.destination_4,
          movement.destination_5,
        ].filter((d): d is string => !!d && nodeIds.has(d));

        for (const dest of dests) {
          const key = `${space.name}->${dest}`;
          if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({ source: space.name, target: dest });
          }
        }
      }
    }

    return { nodes, links };
  }, [dataService]);

  // Configure forces after graph mounts
  useEffect(() => {
    if (!fgRef.current || !graphData.nodes.length) return;

    // Gentle forces for a wide, shallow layout
    fgRef.current.d3Force('link')?.distance(60);
    fgRef.current.d3Force('charge')?.strength(-200);

    fgRef.current.d3ReheatSimulation();

    // Zoom to fit after initial stabilization
    setTimeout(() => {
      fgRef.current?.zoomToFit(400, 20);
    }, 1000);
  }, [graphData]);

  // Subscribe to state changes for valid moves
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      if (gameState.gamePhase === 'PLAY' && gameState.currentPlayerId && !gameState.hasPlayerMovedThisTurn && !gameState.isMoving) {
        try {
          setValidMoves(movementService.getValidMoves(gameState.currentPlayerId));
        } catch {
          setValidMoves([]);
        }
      } else {
        setValidMoves([]);
      }
    });

    const state = stateService.getGameState();
    if (state.gamePhase === 'PLAY' && state.currentPlayerId && !state.hasPlayerMovedThisTurn) {
      try { setValidMoves(movementService.getValidMoves(state.currentPlayerId)); }
      catch { setValidMoves([]); }
    }

    return unsubscribe;
  }, [stateService, movementService]);

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isVisited = useCallback((spaceName: string) =>
    currentPlayer?.visitedSpaces?.includes(spaceName) ?? false,
  [currentPlayer]);

  const getPlayersOnSpace = useCallback((spaceName: string): Player[] =>
    players.filter(p => p.currentSpace === spaceName),
  [players]);

  // Unique phase list for legend
  const phases = useMemo(() => {
    const seen = new Set<string>();
    const result: { phase: string; color: string }[] = [];
    for (const node of graphData.nodes) {
      if (!seen.has(node.phase)) {
        seen.add(node.phase);
        result.push({ phase: node.phase, color: PHASE_NODE_COLORS[node.phase] || node.color });
      }
    }
    return result;
  }, [graphData.nodes]);

  // Canvas node renderer
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;

    const isCurrentSpace = currentPlayer?.currentSpace === node.id;
    const isValidMove = validMoves.includes(node.id);
    const isHovered = hoveredNode === node.id;
    const playersHere = getPlayersOnSpace(node.id);
    const visited = isVisited(node.id);

    // Differentiated sizing: current space is largest, valid moves medium, rest default
    let fontScale = 1;
    let paddingScale = 1;
    let borderWidth = 1;
    if (isCurrentSpace) {
      fontScale = 1.4;
      paddingScale = 1.8;
      borderWidth = 2.5;
    } else if (isValidMove) {
      fontScale = 1.15;
      paddingScale = 1.4;
      borderWidth = 2;
    } else if (isHovered) {
      fontScale = 1.15;
      paddingScale = 1.4;
      borderWidth = 1.5;
    } else if (playersHere.length > 0) {
      fontScale = 1.1;
      paddingScale = 1.2;
      borderWidth = 1.5;
    }

    const fontSize = Math.max(12 * fontScale / globalScale, 3);
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const paddingH = 8 * paddingScale / globalScale;
    const paddingV = 6 * paddingScale / globalScale;
    const boxWidth = textWidth + paddingH * 2;
    const boxHeight = fontSize + paddingV * 2;

    // Node background - rounded rect
    const radius = 4 / globalScale;
    const x = node.x - boxWidth / 2;
    const y = node.y - boxHeight / 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + boxWidth - radius, y);
    ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
    ctx.lineTo(x + boxWidth, y + boxHeight - radius);
    ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
    ctx.lineTo(x + radius, y + boxHeight);
    ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (isCurrentSpace) {
      ctx.fillStyle = node.color;
      ctx.fill();
      // Pulse glow
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 8 + Math.sin(Date.now() / 400) * 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (isValidMove) {
      ctx.fillStyle = '#fff8e1';
      ctx.fill();
      ctx.strokeStyle = '#ffc107';
      ctx.lineWidth = borderWidth / globalScale;
      ctx.stroke();
    } else if (visited) {
      ctx.fillStyle = '#e3f2fd';
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = borderWidth / globalScale;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#dee2e6';
      ctx.lineWidth = borderWidth / globalScale;
      ctx.stroke();
    }

    // Left accent bar (NPC color)
    const accentWidth = 3 / globalScale;
    ctx.fillStyle = node.color;
    ctx.fillRect(x, y + radius, accentWidth, boxHeight - radius * 2);

    // Label text
    ctx.fillStyle = isCurrentSpace ? '#ffffff' : (visited ? '#1565c0' : '#495057');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, node.x, node.y);

    // Player avatars below the node
    if (playersHere.length > 0) {
      const avatarSize = Math.max(8 / globalScale, 3);
      const totalWidth = playersHere.length * (avatarSize + 2 / globalScale);
      let ax = node.x - totalWidth / 2 + avatarSize / 2;
      const ay = node.y + boxHeight / 2 + avatarSize * 0.8;

      for (const player of playersHere) {
        // Avatar circle
        ctx.beginPath();
        ctx.arc(ax, ay, avatarSize / 2, 0, 2 * Math.PI);
        ctx.fillStyle = player.color || '#007bff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();

        // Avatar text (emoji or initial)
        const avatarText = player.avatar || player.name.charAt(0);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${avatarSize * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(avatarText, ax, ay);

        ax += avatarSize + 2 / globalScale;
      }
    }
  }, [currentPlayer, validMoves, hoveredNode, getPlayersOnSpace, isVisited]);

  // Link styling
  const linkColor = useCallback((link: any) => {
    const sourceId = link.source?.id || link.source;
    const targetId = link.target?.id || link.target;
    const sourceVisited = isVisited(sourceId);
    const targetVisited = isVisited(targetId);
    const isCurrentLink = currentPlayer?.currentSpace === sourceId || currentPlayer?.currentSpace === targetId;

    if (isCurrentLink) return '#007bff';
    if (sourceVisited && targetVisited) return '#90caf9';
    return '#dee2e6';
  }, [currentPlayer, isVisited]);

  const linkWidth = useCallback((link: any) => {
    const sourceId = link.source?.id || link.source;
    const targetId = link.target?.id || link.target;
    const isCurrentLink = currentPlayer?.currentSpace === sourceId || currentPlayer?.currentSpace === targetId;
    return isCurrentLink ? 2.5 : 1;
  }, [currentPlayer]);

  // Handle node click — show expanded panel/tile
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(prev => prev === node.id ? null : node.id);
  }, []);

  // Find the space object for the selected node
  const selectedSpace = useMemo(() => {
    if (!selectedNode) return null;
    return graphData.nodes.find(n => n.id === selectedNode)?.space || null;
  }, [selectedNode, graphData.nodes]);

  const isSelectedCurrent = currentPlayer?.currentSpace === selectedNode;
  const isSelectedValidMove = selectedNode ? validMoves.includes(selectedNode) : false;

  return (
    <div className="progress-bar-map">
      <div className="pbm-graph-container" ref={containerRef}>
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const fontSize = Math.max(12 / globalScale, 3);
            ctx.font = `600 ${fontSize}px sans-serif`;
            const textWidth = ctx.measureText(node.name).width;
            const paddingH = 8 / globalScale;
            const paddingV = 6 / globalScale;
            const boxWidth = textWidth + paddingH * 2;
            const boxHeight = fontSize + paddingV * 2;
            ctx.fillStyle = color;
            ctx.fillRect(node.x - boxWidth / 2, node.y - boxHeight / 2, boxWidth, boxHeight);
          }}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={0.85}
          linkCurvature={0.1}
          backgroundColor="transparent"
          onNodeClick={handleNodeClick}
          onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
          onBackgroundClick={() => setSelectedNode(null)}
          cooldownTicks={100}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={false}
        />

        {/* Expanded panel overlay for selected node */}
        {selectedNode && selectedSpace && isSelectedCurrent && currentPlayerId && (
          <div className="pbm-expanded-overlay">
            <PlayerPanelWrapper
              gameServices={gameServices}
              playerId={currentPlayerId}
              onTryAgain={onTryAgain}
              playerNotification={currentPlayerId ? playerNotifications[currentPlayerId] : undefined}
              onRollDice={onRollDice}
              onAutomaticFunding={onAutomaticFunding}
              onManualEffectResult={onManualEffectResult}
              completedActions={completedActions}
              onToggleSpaceExplorer={onToggleSpaceExplorer}
              onToggleMovementPath={onToggleMovementPath}
              isSpaceExplorerVisible={isSpaceExplorerVisible}
              isMovementPathVisible={isMovementPathVisible}
            />
          </div>
        )}

        {/* Expanded GameSpace tile for selected non-current node */}
        {selectedNode && selectedSpace && !isSelectedCurrent && (
          <div className="pbm-expanded-tile-overlay">
            <GameSpace
              space={selectedSpace}
              playersOnSpace={getPlayersOnSpace(selectedNode)}
              isValidMoveDestination={isSelectedValidMove}
              isCurrentPlayerSpace={false}
              showMovementIndicators={isSelectedValidMove}
            />
          </div>
        )}
      </div>

      {/* Phase legend */}
      <div className="pbm-legend">
        {phases.map(p => (
          <div key={p.phase} className="pbm-legend-item">
            <div className="pbm-legend-dot" style={{ background: p.color }} />
            <span>{p.phase}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
