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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BezierEdge, useNodes } from '@xyflow/react';
import { SmartEdge } from '@jalez/react-flow-smart-edge';
import {
  svgDrawSmoothLinePath,
  pathfindingAStarDiagonal,
} from '@jalez/react-flow-smart-edge';
import type { SmartEdgeOptions } from '@jalez/react-flow-smart-edge';

import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/DataTypes';
import { PHASE_COLORS, shortName, truncate, computeTileVisualState, computeVisibleEdgeIds, BOARD_TILE_COMPACT, BOARD_TILE_MAX_INGRID, estimateTileMaxIngridHeight, uniqueDiceDestinations, resolveTileOverlap, boardFingerprint, readSavedViewport, writeSavedViewport, computeFocusCenter, resolveTileVisitType, TARGET_MIN_TILE_PX, TARGET_MAX_TILE_PX } from '../../utils/boardCommon';
import { getNpcCharacterInfo } from '../../constants/characters';
import { saveBoardPosition } from './saveBoardPosition';
import { resolveFundingAmountToken } from '../../utils/templateInterpolation';
// Dark/light mode coverage (TODO.md) — BoardCanvas is mounted in GameLayout
// as a SIBLING of PlayerPanelWrapper (same PLAY-phase render, same screen,
// same player who owns the dark-mode toggle in their own panel), so unlike
// a top-level route it has a real reachable mode signal. It's still outside
// PlayerPanelWrapper's React tree, so — same as the modals fixed in v3.1.12-14
// (ChoiceModal, CardReplacementModal, CardDetailsModal) — it reads the
// persisted flag directly instead of the usePanelMode hook. Only plain
// chrome (canvas fill, tile surface, generic body text) tracks the palette;
// phase/validity/status/player-identity colors are deliberately left fixed —
// see the theming block inside BoardNode below.
import { getStoredPanelMode, panelPalettes, type PanelMode } from '../player/panelTheme';

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
  // Action counter — populated only on the current player's tile so
  // playtesters can see "actions left" without opening the side panel.
  // <!-- fb:feedback-1779568815545-44221318 -->
  actionsCompleted?: number;
  actionsRequired?: number;
  // Story content (only used when expanded/hovered). `story` is the RAW
  // First-visit narrative from SPACE_CONTENT.csv, exactly as authored —
  // it is never mutated after the initial node build so `displayStory`
  // (below) can always re-derive from a pristine template. Rendering
  // must use `displayStory`, not `story`, directly.
  story?: string;
  // Display-ready version of the narrative, recomputed on every players/
  // currentPlayerId change (see the recompute useEffect below):
  //  1. Visit-type refresh (fb, Playwright playtest, LOW) — re-fetches
  //     SPACE_CONTENT.csv via dataService.getSpaceContent(spaceName,
  //     resolveTileVisitType(...)) so a tile shows Subsequent-visit copy
  //     once the CURRENT (active-turn) player has visited it before,
  //     instead of staying frozen on the First-visit text baked into the
  //     initial node build.
  //  2. {fundingAmount}-resolved via the same resolveFundingAmountToken()
  //     the sidebar (PlayerPanelV2) and the dice/action modals already
  //     use — this is what fb (playtest, HIGH) reported missing: the
  //     board tile rendered `story` directly and so never substituted
  //     {fundingAmount}, unlike those other two surfaces.
  // Falls back to the pristine `story` (First-visit) if a Subsequent row
  // isn't authored for that space, so nothing goes blank.
  displayStory?: string;
  // "Next:" line. Same visit-type refresh as displayStory (both come from
  // the same SPACE_CONTENT.csv row) — recomputed in the useEffect below,
  // overwritten in place each run since it has no funding-token
  // substitution and so no pristine-template requirement.
  actionDescription?: string;
  npcName?: string;
  // Discipline label — phase color alone can't tell an Architect tile from an
  // Engineer tile (both DESIGN), or DOB from FDNY (both REGULATORY). undefined
  // for spaces with no character entry (Bank/Investor/Lender/PM/Cheat/Finish —
  // the game has no NPC defined for those), which just falls back to phase.
  disciplineLabel?: string;
  disciplineColor?: string;
  // Callbacks back to the parent for hover/click state
  onHover?: (spaceName: string | null) => void;
  onClick?: (spaceName: string) => void;
  hoveredSpace?: string | null;
  isEditMode?: boolean;
  /** Render a dotted ghost outline representing the tile's max in-grid size.
   *  Wired by BoardLayoutEditor so admins can see how much room each tile
   *  needs in game when placing it. Off in normal gameplay. fb:97fa9c75. */
  showBuffer?: boolean;
  /** Dark/light mode for CHROME-only tile styling (surface fill, generic
   *  title/story text, buffer-ghost outline). Phase border/text, validity
   *  green, and the action-counter chip stay fixed regardless of mode —
   *  they're game-state signals, not decoration. Dark-mode coverage,
   *  TODO.md. */
  mode?: PanelMode;
  [key: string]: unknown;   // satisfy React Flow's Record<string, unknown> constraint
}

function BoardNode({ data }: NodeProps<Node<BoardNodeData>>) {
  const phaseColors = PHASE_COLORS[data.phase] || { border: '#adb5bd', text: '#495057' };
  const borderColor = data.isValidMove ? '#10b981' : phaseColors.border;
  // Dark-mode coverage — CHROME only (tile surface fill + generic text).
  // Phase border/text above and everything validity/status/identity-colored
  // stays a fixed hex regardless of mode; see the field doc on
  // BoardNodeData.mode. Ternary-against-original (not a uniform palette
  // swap) so light mode renders pixel-identical to before — same approach
  // ModalBase uses for its own light/dark container background.
  const isDark = data.mode === 'dark';
  const dp = panelPalettes.dark;

  const isHovered = data.hoveredSpace === data.spaceName;
  // fb:97fa9c75 — five-step size hierarchy lives in computeTileVisualState
  // (src/utils/boardCommon.ts) so the state machine is unit-testable.
  const vs = computeTileVisualState({
    isEditMode: data.isEditMode,
    isExpanded: data.isExpanded,
    isCurrent: data.isCurrent,
    isHovered,
    isValidMove: data.isValidMove,
  });
  const { size, width, minHeight, zIndex, storyMax, showsFullText } = vs;
  const isBig = size !== 'compact';
  // fb:97fa9c75 — the CURRENT tile must be the visual focal point. Give it the
  // thickest border; valid-move tiles get a lighter outline so they read as a
  // secondary "you can go here" cue rather than competing for attention.
  const borderWidth = data.isCurrent ? 4 : data.isValidMove ? 2 : 1.5;

  // D — center-anchored growth (fb:97fa9c75). React Flow places tiles by their
  // top-left, so a grow from 150×60 → 220×120 pushes only right+down onto the
  // neighbors. Translate back by half the delta so growth is symmetric around
  // the original anchor — encroachment splits across both sides instead of
  // piling on one. No-op in edit mode (size is forced compact).
  const offsetX = -(width - BOARD_TILE_COMPACT.w) / 2;
  const offsetY = -(minHeight - BOARD_TILE_COMPACT.h) / 2;
  // B — popover treatment for the click-locked size. Heaviest shadow in the
  // ladder so the tile reads as a card floating above the grid; combined with
  // the zIndex bump from computeTileVisualState (30), neighbors visually
  // recede instead of looking trampled.
  const isPopover = size === 'expanded';

  // fb:97fa9c75 — salience hierarchy inverted so the current tile is the hero.
  //  - Current: bold phase-colored glow ring + faint phase-tinted fill + the
  //    strongest drop shadow. This is the "you are here" focal point.
  //  - Valid move: outline-only green cue (thin ring, NO background fill) so it
  //    reads as "available" without out-shouting the current tile. The green
  //    border (set above) still signals it's a destination.
  const ringStyle: React.CSSProperties = data.isCurrent
    ? {
        boxShadow: `0 0 0 4px ${phaseColors.border}66, 0 8px 22px rgba(0,0,0,0.30)`,
        background: `${phaseColors.border}14`,
      }
    : data.isValidMove
      ? { boxShadow: '0 0 0 2px #10b98133, 0 2px 6px rgba(0,0,0,0.12)' }
      : isBig
        ? { boxShadow: '0 6px 18px rgba(0,0,0,0.20)' }
        : { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

  // (size, width, minHeight, zIndex, storyMax all come from computeTileVisualState above)

  return (
    <div
      className="board-canvas-node"
      style={{
        position: 'relative',
        width,
        minHeight,
        borderRadius: 8,
        background: isDark ? dp.surf : '#fff',
        border: `${borderWidth}px solid ${borderColor}`,
        padding: '8px 10px',
        fontFamily: 'system-ui, sans-serif',
        transition: 'width 0.15s ease, min-height 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        zIndex,
        ...ringStyle,
        ...(isPopover ? { boxShadow: '0 16px 36px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)' } : {}),
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
      {/* Buffer ghost — visualizes how much room this tile will eat in game.
          Editor-only; admins should leave at least this footprint clear when
          placing neighbors. Dashed to read as a guideline, not a real border.
          fb:97fa9c75. fb:a4c50822 — height is now content-aware: a tile with a
          long story/action renders taller than the 130 floor and would overlap
          a flush neighbor, so the ghost grows downward to its estimated
          worst-case in-grid height. Top stays anchored to the currentBig
          centering (content grows down from there). */}
      {data.showBuffer && data.isEditMode && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: -((BOARD_TILE_MAX_INGRID.w - BOARD_TILE_COMPACT.w) / 2),
            top: -((BOARD_TILE_MAX_INGRID.h - BOARD_TILE_COMPACT.h) / 2),
            width: BOARD_TILE_MAX_INGRID.w,
            height: estimateTileMaxIngridHeight({
              title: data.title,
              story: data.displayStory ?? data.story,
              action: data.actionDescription,
              npcName: data.npcName,
            }),
            border: isDark ? `1.5px dashed ${dp.border}` : '1.5px dashed #adb5bd',
            borderRadius: 10,
            background: isDark ? 'rgba(51,65,85,0.16)' : 'rgba(173,181,189,0.06)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {/* Source/target handles invisible but required for edges */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Phase color alone can't distinguish an Architect tile from an
          Engineer tile (both DESIGN), or DOB from FDNY (both REGULATORY) —
          fb:feedback-1782657383215-a9d3221a. Named the discipline in plain
          text instead of an icon needing a hover to decode; the border stays
          phase-colored (coarse grouping), this label gets more specific
          (and its own color) whenever a character is known for the space. */}
      <div style={{
        fontSize: 9,
        color: data.disciplineColor || phaseColors.text,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {data.disciplineLabel || data.phase}
      </div>
      <div style={{
        fontSize: isBig ? 14 : 12,
        fontWeight: 700,
        color: isDark ? dp.text : '#212529',
        marginTop: 2,
        lineHeight: 1.2,
      }}>
        {data.title}
      </div>

      {/* Story snippet. Truncated on hover/valid-move tiles; shown in full on
          the current tile and any click-expanded tile (showsFullText).
          displayStory is the {fundingAmount}-resolved text (falls back to the
          raw template for the one frame before the recompute effect first
          runs) — see BoardNodeData.displayStory. */}
      {isBig && (data.displayStory ?? data.story) && (
        <div style={{ fontSize: 11, color: isDark ? dp.muted : '#495057', marginTop: 6, lineHeight: 1.35 }}>
          {data.npcName && <strong style={{ color: phaseColors.text }}>{data.npcName}: </strong>}
          {(() => {
            const text = (data.displayStory ?? data.story)!;
            return showsFullText ? text : truncate(text, storyMax);
          })()}
        </div>
      )}

      {/* Action description — shown in full on the current tile and click-
          expanded tiles (showsFullText). Hidden on smaller sizes. */}
      {showsFullText && data.actionDescription && (
        <div style={{ fontSize: 10, color: isDark ? dp.muted : '#6c757d', marginTop: 6, fontStyle: 'italic' }}>
          <strong style={{ fontStyle: 'normal', color: isDark ? dp.text : '#495057' }}>Next: </strong>
          {data.actionDescription}
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

      {/* Action counter chip — bottom-right of the current player's tile.
          Glanceable "completed / required" so playtesters can see remaining
          actions without opening the side panel. Hidden when required=0
          (e.g. movement-only spaces) so the chip isn't noise.
          <!-- fb:feedback-1779568815545-44221318 --> */}
      {data.isCurrent && typeof data.actionsRequired === 'number' && data.actionsRequired > 0 && (() => {
        const isDone = (data.actionsCompleted ?? 0) >= data.actionsRequired;
        // This chip only ever appears on the current player's tile, which is
        // always a "big" (currentBig/expanded) size — its colors were
        // hardcoded light-mode-only (never gated on isDark), so on a dark
        // tile it kept showing a light pastel badge. Reuses the panel's
        // existing dark palette (dp.good/goodSurf/goodBorder for "done");
        // there's no dedicated dark "warn" text/border token yet, so the
        // not-done state reuses warnSurf's amber hue directly for text/border
        // rather than inventing a new palette field for one chip.
        const colors = isDone
          ? {
              color: isDark ? dp.good : '#065f46',
              background: isDark ? dp.goodSurf : '#d1fae5',
              border: isDark ? dp.goodBorder : '#10b981',
            }
          : {
              color: isDark ? '#fbbf24' : '#7c2d12',
              background: isDark ? dp.warnSurf : '#fed7aa',
              border: isDark ? 'rgba(245, 158, 11, 0.4)' : '#fb923c',
            };
        return (
        <div
          aria-label={`${data.actionsCompleted ?? 0} of ${data.actionsRequired} actions completed`}
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.2,
            color: colors.color,
            background: colors.background,
            border: `1px solid ${colors.border}`,
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {isDone
            ? '✓ done'
            : `${data.actionsCompleted ?? 0}/${data.actionsRequired}`}
        </div>
        );
      })()}
    </div>
  );
}

const nodeTypes = { boardNode: BoardNode };

// PC-mode camera behavior (maintainer-forwarded review, 2026-07-14) — space-
// size-aware initial zoom + per-device persisted viewport. The pure logic
// (fingerprinting, localStorage read/write) lives in boardCommon.ts
// (boardFingerprint/readSavedViewport/writeSavedViewport/TARGET_MIN_TILE_PX/
// TARGET_MAX_TILE_PX) so it's unit-testable without rendering React Flow;
// see the two effects below (near the TV-mode centerOnCurrent effect) for
// how they're wired up, and boardCommon.ts's own comment block for the
// full rationale.

// A* pathfinding edge that routes around node bounding boxes instead of
// cutting through them. Registered here (not inline) so React Flow doesn't
// re-create the map every render. See Workstream 3 / Phase C in
// BETA_PLAN_V3.md — uses @jalez/react-flow-smart-edge (v12-compatible
// fork of @tisoap/react-flow-smart-edge).
//
// fb:30be69b2 — the upstream `SmartBezierEdge` ships with `nodePadding=10`,
// which on our ~150px tiles is only ~7% of tile width. Routes from
// PM-DECISION-CHECK skim CHEAT-BYPASS closely enough that the rendered
// curve overlaps the box. Wrap the underlying `SmartEdge` with
// `nodePadding=30` so the A* grid treats each tile as a wider obstacle
// and prefers detours over skim paths.
const TUNED_SMART_EDGE_OPTIONS: SmartEdgeOptions = {
  drawEdge: svgDrawSmoothLinePath,
  generatePath: pathfindingAStarDiagonal,
  fallback: BezierEdge as unknown as SmartEdgeOptions['fallback'],
  nodePadding: 30,
};

function SmartBezierEdgeTuned(props: EdgeProps): JSX.Element {
  const nodes = useNodes();
  return <SmartEdge {...props} nodes={nodes} options={TUNED_SMART_EDGE_OPTIONS} />;
}

const edgeTypes = { smart: SmartBezierEdgeTuned };

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
  /** Called after a drag-save round-trip succeeds. The BoardLayoutEditor
   *  uses this to refresh dataService.gameConfigs so the cached positions
   *  don't override the newly-persisted ones on a remount. Optional —
   *  in-game admin drag doesn't need it (game session is ephemeral). */
  onPositionSaved?: (spaceName: string, x: number, y: number) => void;
  /** Show the dotted max-in-grid buffer outline around every tile in edit
   *  mode. Used by BoardLayoutEditor; off in normal gameplay. fb:97fa9c75. */
  showBuffer?: boolean;
  /** TV mode: after initial fitView, re-fit the viewport to the current
   *  player's tile + their valid-move neighbors so 10-ft viewers can see
   *  "where am I, where can I go" without panning. Off (false) in PC mode
   *  where the player drives the camera themselves.
   *  <!-- fb:feedback-1779569130947-9c075c16 --> */
  centerOnCurrent?: boolean;
  /** Explicit dark/light override for board CHROME styling. When omitted,
   *  falls back to this device's own persisted PlayerPanelV2 preference
   *  (getStoredPanelMode) — the existing PC-mode behavior, unchanged.
   *  TVDisplay passes this explicitly, resolved from the shared, synced
   *  GameState.tvDarkMode field (one value for the whole shared screen,
   *  NOT this device's own localStorage — the TV has no local preference
   *  of its own to read). */
  mode?: PanelMode;
}

function BoardCanvasInner({
  currentPlayerId,
  players,
  isAdmin = false,
  edgesVisible = true,
  hiddenEdgeIds,
  onHideEdge,
  onPositionSaved,
  showBuffer = false,
  centerOnCurrent = false,
  mode: modeProp,
}: BoardCanvasProps) {
  const { dataService, stateService, movementService } = useGameContext();
  const { getViewport, setViewport, fitView, setCenter } = useReactFlow();
  // Dark/light mode for board CHROME only (canvas fill, tile surface, generic
  // text — see BoardNode). BoardCanvas is a sibling of PlayerPanelWrapper in
  // GameLayout, not a descendant, so it can't use the usePanelMode hook —
  // same non-hook localStorage read the modals (ChoiceModal,
  // CardReplacementModal, CardDetailsModal) already use. Re-read on every
  // render rather than cached in a ref/effect: this component re-renders
  // often (hover, stateService subscribe below), so the value catches up to
  // a toggle flipped elsewhere without needing new cross-component plumbing.
  // TV dark mode: when the caller (TVDisplay) passes `mode` explicitly —
  // resolved from the shared, synced GameState.tvDarkMode — that wins over
  // this device's own localStorage. PC mode (GameLayout) never passes it,
  // so behavior there is unchanged.
  const mode: PanelMode = modeProp ?? getStoredPanelMode();
  // Measures the actual rendered container — needed to compute a tile-size-
  // aware viewport ourselves (see boardFingerprint / getViewportForBounds
  // usage below), since that has to match the real pixel dimensions React
  // Flow itself is filling, not an assumed size.
  const wrapperRef = useRef<HTMLDivElement>(null);
  // False until the PC-mode restore effect has applied this device's saved
  // (or freshly computed) viewport — gates handleMoveEnd's persistence so
  // mount-time programmatic fits can't clobber the remembered zoom.
  const cameraReadyRef = useRef(false);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  // Required/completed action counters for the current player's turn. Driven
  // by the same stateService subscribe loop as validMoves so the on-tile chip
  // (BoardNode) updates the instant an action lands.
  // <!-- fb:feedback-1779568815545-44221318 -->
  const [actionCounts, setActionCounts] = useState<{ required: number; completed: number }>({
    required: 0,
    completed: 0,
  });
  // v3.0.62 (fb:55b6626f) — when false, suppress the green next-move highlight
  // on outgoing edges from the current player's tile. Arrows stay in the
  // structural layout but render in the dim path-taken style until the player
  // resolves every other required action on the space. Default true so
  // non-choice spaces and any pre-flag state render normally.
  const [movementChoiceUnlocked, setMovementChoiceUnlocked] = useState<boolean>(true);

  // Pan-button helper. panOnDrag is off in gameplay (left-click drag would
  // eat tile clicks, see v2.69.5), so players need explicit pan controls.
  // dx/dy are in viewport (screen) pixels; sign convention follows the
  // arrow on the button: ↑ moves the camera up (reveals content above).
  // We translate to viewport coords (which are the world translation, so
  // moving the camera up means shifting the world DOWN, i.e. viewport.y
  // increases).
  const PAN_STEP = 120;
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const v = getViewport();
      setViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom }, { duration: 150 });
    },
    [getViewport, setViewport]
  );
  // Drag-save status banner. `pending` while POSTing, `success` auto-dismisses
  // after 4s, `error` is sticky until the next drag so the admin can copy the
  // step/detail string out (mirrors DataEditor's save-status UX).
  const [saveStatus, setSaveStatus] = useState<{ type: 'pending' | 'success' | 'error'; message: string } | null>(null);
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

  // Subscribe to valid-moves like BoardV3 does. Also captures the action
  // counter snapshot so the on-tile chip stays in sync without a second
  // subscription (cheaper than two listeners + avoids ordering surprises).
  // <!-- fb:feedback-1779568815545-44221318 -->
  useEffect(() => {
    const update = () => {
      const s = stateService.getGameState();
      if (s.gamePhase === 'PLAY' && s.currentPlayerId && !s.hasPlayerMovedThisTurn && !s.isMoving) {
        try { setValidMoves(movementService.getValidMoves(s.currentPlayerId)); }
        catch { setValidMoves([]); }
      } else { setValidMoves([]); }
      setActionCounts({
        required: s.requiredActions ?? 0,
        completed: s.completedActionCount ?? 0,
      });
      setMovementChoiceUnlocked(s.movementChoiceUnlocked ?? true);
    };
    update();
    return stateService.subscribe(update);
  }, [stateService, movementService]);

  // Build static layout once from CSV. Player overlays come from rendering re-runs.
  const { initialNodes, initialEdges } = useMemo(() => {
    // START-QUICK-PLAY-GUIDE is a legacy instructional space — no movement
    // edges in or out, kept in data only for StateService's old-starting-space
    // migration (StateService.ts:687). It should never render as a board tile.
    const configs = dataService.getGameConfig().filter(
      cfg => cfg.space_name !== 'START-QUICK-PLAY-GUIDE'
    );
    const movements = dataService.getAllMovements();

    const nodes: Node<BoardNodeData>[] = configs.map(cfg => {
      const pos = dataService.getPosition(cfg.space_name) || { x: 0, y: 0 };
      const titleOverride = cfg.display_label_override || '';
      // First-visit content for the hover/expand cards, used as the pristine
      // `story` template and as the fallback before the recompute effect's
      // first run. Subsequent-visit content is preferred once the current
      // (active-turn) player has visited — refreshed into `displayStory`/
      // `actionDescription` by the dynamic useEffect below via
      // resolveTileVisitType().
      const content = dataService.getSpaceContent(cfg.space_name, 'First');
      // PM-voiced spaces (fb:7065e8df) resolve to undefined — no NPC name
      // prefix on the hover card when the story is the PM's own first-person
      // thought, not an NPC's.
      const characterInfo = getNpcCharacterInfo(cfg.space_name);
      const npcName = characterInfo?.name;
      // "The Architect" -> "ARCHITECT" (drop the article, let the label's
      // existing uppercase styling do the rest) — a name, not an icon to decode.
      const disciplineLabel = npcName?.replace(/^The\s+/i, '');
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
          disciplineLabel,
          disciplineColor: characterInfo?.color,
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
      let dests = [
        mov.destination_1, mov.destination_2,
        mov.destination_3, mov.destination_4, mov.destination_5,
      ].filter((d): d is string => !!d && d.trim().length > 0);

      // fb:35daf1ba — dice spaces (e.g. CHEAT-BYPASS) carry their destinations
      // in DICE_OUTCOMES.csv, not MOVEMENT.csv (whose destination columns are
      // blank for dice rows). Without this, NO dice space got static edges, so
      // the path-taken line couldn't render afterward (the reporter cheated to
      // FDNY and saw no line). Pull the unique roll destinations so the edge
      // exists in the graph; the visibleEdges filter still hides it until it's
      // path-taken or the current tile's outgoing move.
      if (dests.length === 0 && mov.movement_type === 'dice') {
        dests = uniqueDiceDestinations(dataService.getDiceOutcome(mov.space_name, 'First'));
      }

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
  //
  // Gameplay default (non-admin): only path-taken edges (dimmed) plus next-move
  // edges from the current tile (green). Hides the ~50-edge full network that
  // was the v3.0.x default, which playtesters found noisy. fb:96317d74.
  // Admin mode keeps every edge visible — the editor needs the full network to
  // hover/click-hide individual edges.
  const visibleEdges = useMemo(() => {
    if (!edgesVisible) return [];

    const currentPlayer = currentPlayerId ? players.find(p => p.id === currentPlayerId) : undefined;

    // Build the set of "interesting" edge ids for non-admin mode.
    // computeVisibleEdgeIds makes validMoves the single source of truth for
    // next-move edges (same narrowed set the player panel uses) — no superset
    // fallback to all outgoing edges. fb:84da66be.
    let allowedIds: Set<string> | null = null;
    let nextMoveIds: Set<string> = new Set();
    if (!isAdmin && currentPlayer) {
      const vis = computeVisibleEdgeIds(
        currentPlayer.currentSpace,
        validMoves,
        currentPlayer.spaceVisitLog || [],
      );
      allowedIds = vis.allowedIds;
      // v3.0.62 (fb:55b6626f) — suppress the green next-move highlight while
      // the movement choice is gated. Edges still render in path-taken style
      // (dim gray, dashed) so the board layout stays intact; they flip to
      // green the instant the player completes the last non-movement action.
      nextMoveIds = movementChoiceUnlocked ? vis.nextMoveIds : new Set();
    }

    return edges.filter(e => {
      if (hiddenEdgeIds && hiddenEdgeIds.has(e.id)) return false;
      if (allowedIds && !allowedIds.has(e.id)) return false;
      return true;
    }).map(e => {
      // Restyle in non-admin mode so path-taken edges (dim gray, dotted) are
      // visually distinct from next-move edges (solid green). Admin mode
      // keeps the default flat gray so the editor matches its old look.
      if (!allowedIds) return e;
      const isNextMove = nextMoveIds.has(e.id);
      if (isNextMove) {
        return {
          ...e,
          style: { stroke: '#10b981', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#10b981' },
        };
      }
      // Path-taken edge — dim and dashed.
      return {
        ...e,
        style: { stroke: '#adb5bd', strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#adb5bd' },
      };
    });
  }, [edges, edgesVisible, hiddenEdgeIds, isAdmin, currentPlayerId, players, validMoves, movementChoiceUnlocked]);

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
    // Playtest bug (HIGH, fb Playwright report) — the board tile for
    // OWNER-FUND-INITIATION rendered the literal "{fundingAmount}" while the
    // sidebar (PlayerPanelV2) and the dice/action modals both showed the
    // real dollar figure. Root cause: this component built each node's
    // `story` once (raw, from SPACE_CONTENT.csv) in the initialNodes useMemo
    // above and rendered it directly — it never called into
    // templateInterpolation.ts at all, unlike every other surface that
    // quotes the same story text. Resolve it here, in the one place that
    // already recomputes per-player-state fields on every players/
    // currentPlayerId change, using the SAME resolveFundingAmountToken()
    // helper the sidebar/modals use (no parallel templating logic).
    // `n.data.story` is intentionally never overwritten (see its doc
    // comment) so this always re-derives from the pristine template —
    // otherwise a first resolve to "" (no funds yet) would permanently
    // erase the {fundingAmount} token before the player is later funded.
    //
    // fb (Playwright playtest, LOW) — "a board tile's hover/expand narrative
    // still shows the First-visit copy even after a player has re-entered
    // that space." initialNodes hardcoded 'First' when building `story`/
    // `actionDescription` and nothing ever re-fetched them, despite a
    // comment here claiming otherwise. BoardCanvas renders the whole SHARED
    // board while visit history is per-player, so "visited" needs a "whose
    // perspective" answer — resolveTileVisitType() uses the same
    // currentPlayerId-based active-player convention as `isCurrent` and the
    // funding-token resolve just above (see its doc comment in
    // boardCommon.ts). No parallel data-fetching: same
    // dataService.getSpaceContent() call the initial First-visit build uses,
    // just with the resolved visit type.
    const activePlayer = currentPlayerId ? players.find(p => p.id === currentPlayerId) : undefined;
    setNodes(prev => prev.map(n => {
      const playersHere = players.filter(p => p.currentSpace === n.id);
      const isCurrent = !!currentPlayerId && playersHere.some(p => p.id === currentPlayerId);
      const fundingSource = dataService.getFundingSource(n.id);
      const visitType = resolveTileVisitType(activePlayer, n.id);
      const content = dataService.getSpaceContent(n.id, visitType);
      // Fall back to the pristine First-visit `story`/`actionDescription`
      // (from initialNodes) when Subsequent isn't authored for this space,
      // so the tile never goes blank.
      const baseStory = content?.story ?? n.data.story;
      const actionDescription = content?.action_description ?? n.data.actionDescription;
      const displayStory = baseStory
        ? resolveFundingAmountToken(baseStory, activePlayer || {}, fundingSource)
        : baseStory;
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
          showBuffer,
          onHover: handleNodeHover,
          onClick: handleNodeClick,
          actionDescription,
          // Action counter only rendered on the current tile; we still inject
          // the values on every node so the chip's render condition can stay
          // a pure function of `data`. <!-- fb:feedback-1779568815545-44221318 -->
          actionsRequired: actionCounts.required,
          actionsCompleted: actionCounts.completed,
          // Dark-mode coverage (chrome only — see BoardNode). `mode` in the
          // dep array below is what makes a toggle flipped elsewhere actually
          // reach the tiles on this component's next re-render.
          mode,
          displayStory,
        },
      };
    }));
  }, [players, validMoves, currentPlayerId, hoveredSpace, expandedSpace, isAdmin, showBuffer, handleNodeHover, handleNodeClick, actionCounts, mode, dataService]);

  // TV mode auto-focus. Two-phase since fb:2b5b9f2a ("when I moved from one
  // space to another the zoom level changes — it should not"):
  //   - FIRST focus of the session: fitView on the current tile + its
  //     valid-move neighbors, establishing a sensible zoom (unchanged from
  //     the original behavior).
  //   - EVERY LATER focus change: pan-only. The camera glides to center the
  //     same focus set at whatever zoom is already active (including any
  //     manual zoom the viewer chose meanwhile) — a steady board-game camera
  //     instead of re-fitting, whose zoom swung wildly turn to turn because
  //     it was derived from how spread out each space's destinations happen
  //     to be.
  // Runs whenever the current player or valid-moves set changes, with a
  // small delay so React Flow's initial fitView (the whole board) lands
  // first and our focus replaces it. Skipped if isAdmin (editor needs the
  // full overview) or in PC mode (player drives the camera themselves).
  // <!-- fb:feedback-1779569130947-9c075c16 -->
  // <!-- fb:feedback-1784158520583-2b5b9f2a -->
  const currentPlayer = currentPlayerId ? players.find(p => p.id === currentPlayerId) : undefined;
  const focusSpace = currentPlayer?.currentSpace;
  const hasAutoFocusedRef = useRef(false);
  useEffect(() => {
    if (!centerOnCurrent || isAdmin || !focusSpace) return;
    const focusIds = [focusSpace, ...validMoves];
    // 350ms duration is the React Flow default-ish feel — long enough to
    // read as a deliberate camera move, short enough to not miss the next
    // turn change.
    const timer = window.setTimeout(() => {
      // Pan-only follow once an initial framing exists. "Exists" is read
      // from the camera itself (any non-default viewport — a landed fit OR
      // a manual zoom/pan by the viewer) rather than from fitView's promise,
      // which never settles in environments that throttle animation frames.
      // Until the camera has actually moved off the untouched default, keep
      // retrying the full fit — self-healing when the very first fit lands
      // before nodes are measured and silently does nothing.
      const v = getViewport();
      const cameraTouched = hasAutoFocusedRef.current && !(v.x === 0 && v.y === 0 && v.zoom === 1);
      if (cameraTouched) {
        // Center the focus set's bounding box at the current zoom.
        // Positions come from initialNodes (the stable CSV layout);
        // computeFocusCenter (boardCommon) holds the pure math so it's
        // unit-testable without rendering React Flow.
        const center = computeFocusCenter(initialNodes, focusIds);
        if (!center) return;
        setCenter(center.x, center.y, { zoom: v.zoom, duration: 350 });
        return;
      }
      try {
        fitView({
          nodes: focusIds.map(id => ({ id })),
          padding: 0.25,
          duration: 350,
          maxZoom: 1.5,
        });
        hasAutoFocusedRef.current = true;
      } catch {
        // fitView throws if a node id doesn't exist; safe to swallow because
        // the next render's setNodes will trigger this effect again.
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [centerOnCurrent, isAdmin, focusSpace, validMoves, fitView, setCenter, getViewport, initialNodes]);

  // PC-mode initial camera: restore this device's saved viewport for this
  // exact board layout, or fall back to a tile-size-aware fit (see the
  // TARGET_MIN_TILE_PX/TARGET_MAX_TILE_PX block above BoardNode's nodeTypes
  // for the full rationale). Skipped for TV mode (has its own auto-focus
  // above) and the editor (needs the plain full-board fitView from the
  // `fitView` prop to place tiles). Small delay for the same reason the TV
  // effect uses one — let the `fitView` prop's initial paint land first.
  useEffect(() => {
    if (centerOnCurrent || isAdmin) return;
    if (initialNodes.length === 0) return;
    const timer = window.setTimeout(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const { width, height } = wrapper.getBoundingClientRect();
      if (width === 0 || height === 0) return; // not laid out yet — skip rather than guess

      const bounds = getNodesBounds(initialNodes);
      const fingerprint = boardFingerprint(initialNodes.length, bounds);
      const saved = readSavedViewport(fingerprint);
      if (saved) {
        setViewport(saved, { duration: 0 });
        cameraReadyRef.current = true;
        return;
      }

      const minZoom = TARGET_MIN_TILE_PX / BOARD_TILE_COMPACT.w;
      const maxZoom = TARGET_MAX_TILE_PX / BOARD_TILE_COMPACT.w;
      const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, 0.1);
      setViewport(viewport, { duration: 0 });
      writeSavedViewport(fingerprint, viewport);
      cameraReadyRef.current = true;
    }, 100);
    return () => window.clearTimeout(timer);
    // initialNodes is a stable useMemo keyed on dataService, so this only
    // re-runs on a genuine board-layout change, not on every player/turn
    // update (those only touch nodes[i].data, never initialNodes itself).
  }, [centerOnCurrent, isAdmin, initialNodes, setViewport]);

  // Persist the player's own subsequent pans/zooms (idea 6 above — "remember
  // the chosen zoom for that device"). Same PC-mode-only scoping as the
  // effect above; TV mode's per-turn auto-focus would otherwise repeatedly
  // overwrite this with its own transient camera moves.
  //
  // Nothing persists until the restore effect above has applied this
  // device's saved viewport (cameraReadyRef). Without this gate, React
  // Flow's own mount-time `fitView` prop fired onMoveEnd and overwrote the
  // device's saved zoom with the plain full-board fit before the restore
  // effect could read it — so the remembered zoom never actually survived
  // a reload, and the camera silently reset on every mount. A readiness
  // flag rather than an event-is-null check because the on-board +/- zoom
  // buttons are ALSO programmatic (null event) moves, and those must keep
  // persisting. fb:2b5b9f2a (same "zoom keeps changing on its own" thread
  // as the TV pan-only fix above).
  const handleMoveEnd = useCallback(() => {
    if (!cameraReadyRef.current) return; // mount-time programmatic fit — not a user choice
    if (centerOnCurrent || isAdmin) return;
    if (initialNodes.length === 0) return;
    const fingerprint = boardFingerprint(initialNodes.length, getNodesBounds(initialNodes));
    writeSavedViewport(fingerprint, getViewport());
  }, [centerOnCurrent, isAdmin, initialNodes, getViewport]);

  // fb:feedback-1782842971898-c73c35ca — "board node overlaps a tile, want a
  // way to force nodes not to overlap." Live during drag (not just on drop),
  // check the dragged tile's ACTUAL rendered box (React Flow's `.measured` —
  // no guessing at a fixed size) against every sibling's actual box; if it
  // would overlap, push the drop point back along the axis of least
  // penetration so the tile hugs the sibling's edge instead of crossing it.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(prev => {
      const resolved = changes.map(change => {
        if (change.type !== 'position' || !change.position) return change;
        const dragged = prev.find(n => n.id === change.id);
        const draggedW = dragged?.measured?.width ?? BOARD_TILE_COMPACT.w;
        const draggedH = dragged?.measured?.height ?? BOARD_TILE_COMPACT.h;
        let { x, y } = change.position;
        for (const other of prev) {
          if (other.id === change.id) continue;
          const otherW = other.measured?.width ?? BOARD_TILE_COMPACT.w;
          const otherH = other.measured?.height ?? BOARD_TILE_COMPACT.h;
          const push = resolveTileOverlap(
            { x, y, w: draggedW, h: draggedH },
            { x: other.position.x, y: other.position.y, w: otherW, h: otherH }
          );
          if (push) { x += push.dx; y += push.dy; }
        }
        return { ...change, position: { x, y } };
      });
      return applyNodeChanges(resolved, prev) as Node<BoardNodeData>[];
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(prev => applyEdgeChanges(changes, prev));
  }, []);

  // Drag-to-save (Workstream 3 Phase D, v2.66.0; instance layer since
  // Phase 1). When an admin drops a tile, the new pos_x/pos_y is POSTed to
  // the classroom's instance config (/api/instances/.../positions), which
  // survives deploys — see saveBoardPosition.ts for the step contract.
  const onNodeDragStop = useCallback(async (_e: unknown, node: Node) => {
    if (!isAdmin) return;
    const x = Math.round(node.position.x);
    const y = Math.round(node.position.y);

    setSaveStatus({ type: 'pending', message: `Saving ${node.id}…` });
    const result = await saveBoardPosition(node.id, x, y);
    if (result.success) {
      setSaveStatus({ type: 'success', message: `Saved ${node.id} → (${x}, ${y})` });
      window.setTimeout(() => {
        setSaveStatus(prev => (prev && prev.type === 'success' ? null : prev));
      }, 4000);
      // Notify parent (BoardLayoutEditor) so it can refresh dataService and
      // remount this canvas — otherwise stale cached coords win on remount.
      onPositionSaved?.(node.id, x, y);
    } else {
      setSaveStatus({
        type: 'error',
        message: `Save failed (${result.step}: ${result.detail})`
      });
    }
  }, [isAdmin, onPositionSaved]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {saveStatus && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 50,
            background:
              saveStatus.type === 'success' ? '#ecfdf5'
              : saveStatus.type === 'error' ? '#fef2f2'
              : '#f8f9fa',
            color:
              saveStatus.type === 'success' ? '#065f46'
              : saveStatus.type === 'error' ? '#7f1d1d'
              : '#495057',
            border: `1px solid ${
              saveStatus.type === 'success' ? '#10b981'
              : saveStatus.type === 'error' ? '#dc3545'
              : '#adb5bd'
            }`,
            padding: '8px 12px',
            borderRadius: 6,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 13,
            maxWidth: 380,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
          }}
        >
          {saveStatus.message}
        </div>
      )}
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
        onMoveEnd={handleMoveEnd}
        nodesDraggable={isAdmin}
        nodesConnectable={false}
        // elementsSelectable={true} always — React Flow's selection plumbing
        // is what lets mousedown/click events reach the custom node's handlers
        // cleanly. With it false in gameplay, React Flow's pan-or-drag
        // machinery captured the mousedown first and the tile's onMouseEnter/
        // onClick never fired (the hover-to-expand + click-to-expand bug).
        // We don't render any selection UI, so allowing selection is invisible.
        elementsSelectable={true}
        // panOnDrag only in admin mode. During gameplay, canvas pan-on-drag
        // would consume mousedown on tiles before our hover/click handlers
        // could see them. Players can use the Controls (bottom-left) zoom +
        // fit buttons to navigate; the board's fitView keeps it usable
        // without manual panning.
        panOnDrag={isAdmin}
        edgesFocusable={isAdmin}
        snapToGrid={isAdmin}
        snapGrid={[10, 10]}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color={mode === 'dark' ? panelPalettes.dark.bg : '#e9ecef'} gap={20} />
        <Controls showInteractive={false}>
          {/* Pan buttons — arrow indicates direction the camera moves.
              Required for gameplay where left-click drag is disabled (v2.69.5). */}
          <ControlButton onClick={() => panBy(0, PAN_STEP)} title="Pan up">
            <span aria-hidden="true">↑</span>
          </ControlButton>
          <ControlButton onClick={() => panBy(PAN_STEP, 0)} title="Pan left">
            <span aria-hidden="true">←</span>
          </ControlButton>
          <ControlButton onClick={() => panBy(-PAN_STEP, 0)} title="Pan right">
            <span aria-hidden="true">→</span>
          </ControlButton>
          <ControlButton onClick={() => panBy(0, -PAN_STEP)} title="Pan down">
            <span aria-hidden="true">↓</span>
          </ControlButton>
        </Controls>
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
