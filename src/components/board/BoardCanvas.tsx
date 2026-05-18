// src/components/board/BoardCanvas.tsx
//
// Workstream 3 / Phase B — Living Map.
//
// Coordinate-driven board built on @xyflow/react (React Flow). Replaces
// the snake/zig-zag walker (BoardV3.tsx + boardLayout.ts) by reading
// pos_x / pos_y from Spaces.csv directly. Each space becomes a custom
// React node, edges come from MOVEMENT.csv destinations, and admin
// mode lets coordinates be dragged + saved back.
//
// This component is feature-flagged in GameLayout — only renders when
// `?board=canvas` is on the URL. BoardV3 stays the default until parity
// is verified across all spaces. Once verified, BoardV3 + boardLayout.ts
// (~1,664 lines combined) get deleted.
//
// Phase B scope (this file):
//   - Render nodes from getGameConfig() + getPosition()
//   - Render edges from getAllMovements() destinations (First-visit row)
//   - Phase-colored borders matching BoardV3
//   - Player tokens overlaid on the current space
//   - Highlight valid moves for the current player
//   - nodesDraggable={isAdmin} for admin edit mode
//   - onNodeDragStop logs the new position (Phase D wires this to the
//     existing CSV save pipeline; for now it's a console.log so admins
//     can copy coords manually)
//
// Phase C will polish: smarter edge routing, phase background regions,
// hover/click overlays for space details. Phase D wires drag-save to
// the editor's existing /api/sources POST endpoint.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SmartBezierEdge } from '@jalez/react-flow-smart-edge';

import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/DataTypes';
import { PHASE_COLORS, shortName, truncate } from '../../utils/boardLayout';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';

// ===================================================================
// Custom node — preserves the look of BoardV3 tiles
// ===================================================================

interface BoardNodeData {
  spaceName: string;
  title: string;
  phase: string;
  isCurrent: boolean;       // current player is on this space
  isValidMove: boolean;     // current player can move here
  playerCount: number;      // how many players standing here
  playerColors: string[];   // for overlay tokens
  isExpanded: boolean;      // expanded card view (click)
  // Story content (only used when expanded/hovered)
  story?: string;
  actionDescription?: string;
  npcName?: string;
  // Callbacks back to the parent for hover/click state
  onHover?: (spaceName: string | null) => void;
  onClick?: (spaceName: string) => void;
  hoveredSpace?: string | null;
  isEditMode?: boolean;
  [key: string]: unknown;   // satisfy React Flow's Record<string, unknown> constraint
}

function BoardNode({ data }: NodeProps<Node<BoardNodeData>>) {
  const phaseColors = PHASE_COLORS[data.phase] || { border: '#adb5bd', text: '#495057' };
  const borderColor = data.isValidMove ? '#10b981' : phaseColors.border;

  const isHovered = data.hoveredSpace === data.spaceName;
  // Three sizes:
  //   compact (default) — 150×60, just title + tokens
  //   hover (mid)       — 220×120, +story snippet
  //   expanded (large)  — 280×180, +action description
  // In edit mode, all tiles stay compact so dragging doesn't pop sizes.
  const size: 'compact' | 'hover' | 'expanded' =
    data.isEditMode ? 'compact'
    : data.isExpanded ? 'expanded'
    : (isHovered && !data.isCurrent) ? 'hover'
    : 'compact';

  const isBig = size !== 'compact';
  const width = size === 'compact' ? 150 : size === 'hover' ? 220 : 280;
  const minHeight = size === 'compact' ? 60 : size === 'hover' ? 120 : 180;
  const borderWidth = data.isCurrent ? 3 : data.isValidMove ? 3 : 1.5;

  const ringStyle: React.CSSProperties = data.isCurrent
    ? { boxShadow: `0 0 0 3px ${phaseColors.border}33, 0 4px 12px rgba(0,0,0,0.18)` }
    : data.isValidMove
      ? { boxShadow: '0 0 0 3px #10b98144, 0 4px 12px rgba(16,185,129,0.25)', background: '#ecfdf5' }
      : isBig
        ? { boxShadow: '0 6px 18px rgba(0,0,0,0.20)' }
        : { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

  // Bump z-index for expanded/hovered tiles so they layer over neighbors
  const zIndex = data.isExpanded ? 30 : isHovered ? 20 : 1;

  const storyMax = size === 'hover' ? 60 : 100;

  return (
    <div
      className="board-canvas-node"
      style={{
        width,
        minHeight,
        borderRadius: 8,
        background: '#fff',
        border: `${borderWidth}px solid ${borderColor}`,
        padding: '8px 10px',
        fontFamily: 'system-ui, sans-serif',
        transition: 'width 0.15s ease, min-height 0.15s ease, box-shadow 0.15s ease',
        zIndex,
        ...ringStyle,
        cursor: data.isEditMode ? 'grab' : 'pointer',
      }}
      onMouseEnter={() => { if (!data.isEditMode) data.onHover?.(data.spaceName); }}
      onMouseLeave={() => { if (!data.isEditMode) data.onHover?.(null); }}
      onClick={(e) => {
        if (data.isEditMode) return; // edit mode: clicks belong to React Flow drag
        e.stopPropagation();
        data.onClick?.(data.spaceName);
      }}
    >
      {/* Source/target handles invisible but required for edges */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div style={{ fontSize: 9, color: phaseColors.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {data.phase}
      </div>
      <div style={{
        fontSize: isBig ? 14 : 12,
        fontWeight: 700,
        color: '#212529',
        marginTop: 2,
        lineHeight: 1.2,
      }}>
        {data.title}
      </div>

      {/* Story snippet (hover + expanded) */}
      {isBig && data.story && (
        <div style={{ fontSize: 11, color: '#495057', marginTop: 6, lineHeight: 1.35 }}>
          {data.npcName && <strong style={{ color: phaseColors.text }}>{data.npcName}: </strong>}
          {truncate(data.story, storyMax)}
        </div>
      )}

      {/* Action description (expanded only) */}
      {size === 'expanded' && data.actionDescription && (
        <div style={{ fontSize: 10, color: '#6c757d', marginTop: 6, fontStyle: 'italic' }}>
          <strong style={{ fontStyle: 'normal', color: '#495057' }}>Next: </strong>
          {truncate(data.actionDescription, 80)}
        </div>
      )}

      {/* Player tokens row — only render if at least one player is here */}
      {data.playerCount > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
          {data.playerColors.map((color, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                border: '1.5px solid #fff',
                boxShadow: '0 0 0 1px #00000022',
              }}
              aria-label="player token"
            />
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { boardNode: BoardNode };

// A* pathfinding edge that routes around node bounding boxes instead of
// cutting through them. Registered here (not inline) so React Flow doesn't
// re-create the map every render. See Workstream 3 / Phase C in
// BETA_PLAN_V3.md — uses @jalez/react-flow-smart-edge (v12-compatible
// fork of @tisoap/react-flow-smart-edge).
const edgeTypes = { smart: SmartBezierEdge };

// ===================================================================
// Component
// ===================================================================

interface BoardCanvasProps {
  currentPlayerId: string | null;
  players: Player[];
  /** When true, nodes are draggable and drag-stop logs the new coords.
   *  Also enables click-to-hide on individual edges. */
  isAdmin?: boolean;
  /** Global edge visibility. When false, no edges render. */
  edgesVisible?: boolean;
  /** Per-edge hide set, keyed by edge id (`${source}__${target}`). */
  hiddenEdgeIds?: Set<string>;
  /** Called when an edge is clicked in admin mode. Parent persists. */
  onHideEdge?: (edgeId: string) => void;
}

function BoardCanvasInner({
  currentPlayerId,
  players,
  isAdmin = false,
  edgesVisible = true,
  hiddenEdgeIds,
  onHideEdge,
}: BoardCanvasProps) {
  const { dataService, stateService, movementService } = useGameContext();
  const [validMoves, setValidMoves] = useState<string[]>([]);
  // Hover/expand state for the BoardV3-parity tile behavior. In admin
  // edit mode, both are forced to inactive so React Flow drag works
  // cleanly without competing click handlers.
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);
  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 150ms hover delay to avoid flicker as the cursor moves across tiles.
  const handleNodeHover = useCallback((spaceName: string | null) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (spaceName === null) {
      setHoveredSpace(null);
      return;
    }
    hoverTimerRef.current = setTimeout(() => setHoveredSpace(spaceName), 150);
  }, []);

  const handleNodeClick = useCallback((spaceName: string) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredSpace(null);
    setExpandedSpace(prev => (prev === spaceName ? null : spaceName));
  }, []);

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  // Clicking the canvas background collapses any expanded tile.
  const handlePaneClick = useCallback(() => {
    setExpandedSpace(null);
  }, []);

  // Subscribe to valid-moves like BoardV3 does
  useEffect(() => {
    const update = () => {
      const s = stateService.getGameState();
      if (s.gamePhase === 'PLAY' && s.currentPlayerId && !s.hasPlayerMovedThisTurn && !s.isMoving) {
        try { setValidMoves(movementService.getValidMoves(s.currentPlayerId)); }
        catch { setValidMoves([]); }
      } else { setValidMoves([]); }
    };
    update();
    return stateService.subscribe(update);
  }, [stateService, movementService]);

  // Build static layout once from CSV. Player overlays come from rendering re-runs.
  const { initialNodes, initialEdges } = useMemo(() => {
    const configs = dataService.getGameConfig();
    const movements = dataService.getAllMovements();

    const nodes: Node<BoardNodeData>[] = configs.map(cfg => {
      const pos = dataService.getPosition(cfg.space_name) || { x: 0, y: 0 };
      const titleOverride = cfg.display_label_override || '';
      // First-visit content for the hover/expand cards. Subsequent-visit
      // content is preferred when the current viewer has visited; we
      // refresh those in the dynamic useEffect below.
      const content = dataService.getSpaceContent(cfg.space_name, 'First');
      const npcPrefix = extractPrefix(cfg.space_name);
      const npcName = CHARACTER_MAP[npcPrefix]?.name;
      return {
        id: cfg.space_name,
        type: 'boardNode',
        position: pos,
        data: {
          spaceName: cfg.space_name,
          title: titleOverride || shortName(cfg.space_name),
          phase: cfg.phase || '',
          isCurrent: false,     // populated dynamically below
          isValidMove: false,   // populated dynamically below
          playerCount: 0,
          playerColors: [],
          isExpanded: false,
          story: content?.story,
          actionDescription: content?.action_description,
          npcName,
        },
      };
    });

    // Edges from First-visit movement rows. Each space's destination_1..5
    // becomes an outgoing edge. (Subsequent-visit edges aren't drawn — they
    // duplicate First in 95% of cases. If a space's Subsequent destinations
    // diverge significantly, that's a Phase C polish item.)
    const edges: Edge[] = [];
    for (const mov of movements) {
      if (mov.visit_type !== 'First') continue;
      const dests = [
        mov.destination_1, mov.destination_2,
        mov.destination_3, mov.destination_4, mov.destination_5,
      ].filter((d): d is string => !!d && d.trim().length > 0);
      for (const dest of dests) {
        edges.push({
          id: `${mov.space_name}__${dest}`,
          source: mov.space_name,
          target: dest,
          type: 'smart',
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          style: { stroke: '#adb5bd', strokeWidth: 1.5 },
        });
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [dataService]);

  // Local state for nodes/edges so React Flow can drive drags + we can
  // overlay player tokens / valid-move highlights without rebuilding layout.
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  // Apply visibility filters from parent. Edges hidden by:
  //   - Global toggle (edgesVisible=false) → hide all
  //   - Per-edge hide set (hiddenEdgeIds.has(id)) → hide that one
  const visibleEdges = useMemo(() => {
    if (!edgesVisible) return [];
    if (!hiddenEdgeIds || hiddenEdgeIds.size === 0) return edges;
    return edges.filter(e => !hiddenEdgeIds.has(e.id));
  }, [edges, edgesVisible, hiddenEdgeIds]);

  // Click an edge in admin mode → hide it. Single-click is the gesture
  // (React Flow has no native double-click on edges, and right-click
  // brings up the browser context menu which we'd have to suppress).
  // The toggle's "restore" button brings them all back.
  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    if (!isAdmin || !onHideEdge) return;
    onHideEdge(edge.id);
  }, [isAdmin, onHideEdge]);

  // Recompute the dynamic data fields whenever players/validMoves/currentPlayerId
  // change, AND whenever hover/expand/edit state changes. The hover+click
  // callbacks have to be injected here so each node's `.data` can reach them
  // (custom node components only receive `data`, not closures from the parent).
  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const playersHere = players.filter(p => p.currentSpace === n.id);
      const isCurrent = !!currentPlayerId && playersHere.some(p => p.id === currentPlayerId);
      return {
        ...n,
        data: {
          ...n.data,
          isCurrent,
          isValidMove: validMoves.includes(n.id),
          playerCount: playersHere.length,
          playerColors: playersHere.map(p => p.color || '#666'),
          isExpanded: expandedSpace === n.id,
          hoveredSpace,
          isEditMode: isAdmin,
          onHover: handleNodeHover,
          onClick: handleNodeClick,
        },
      };
    }));
  }, [players, validMoves, currentPlayerId, hoveredSpace, expandedSpace, isAdmin, handleNodeHover, handleNodeClick]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(prev => applyNodeChanges(changes, prev) as Node<BoardNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(prev => applyEdgeChanges(changes, prev));
  }, []);

  const onNodeDragStop = useCallback((_e: unknown, node: Node) => {
    if (!isAdmin) return;
    // Phase D will wire this to /api/sources POST. For now, log so admins
    // can copy coords into Spaces.csv manually.
    console.log(`[BoardCanvas] ${node.id} → x=${Math.round(node.position.x)}, y=${Math.round(node.position.y)}`);
  }, [isAdmin]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={handlePaneClick}
        nodesDraggable={isAdmin}
        nodesConnectable={false}
        elementsSelectable={isAdmin}
        edgesFocusable={isAdmin}
        snapToGrid={isAdmin}
        snapGrid={[10, 10]}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#e9ecef" gap={20} />
        <Controls showInteractive={false} />
        {isAdmin && <MiniMap pannable zoomable />}
      </ReactFlow>
    </div>
  );
}

export function BoardCanvas(props: BoardCanvasProps) {
  return (
    <ReactFlowProvider>
      <BoardCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
