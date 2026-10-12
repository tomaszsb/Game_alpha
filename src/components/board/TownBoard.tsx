// TownBoard - the town look for the game board (Tom, 2026-10-11; docs/core/TOWN_BOARD_REVIEW.md,
// first-build plan step A1). A LOOK ONLY: the same squares, roads and rules as BoardCanvas, drawn as
// rooms inside slightly 3-D buildings. Moves are still made in the player panel; clicking here only
// opens a building to read its rooms.
//
// What shows:
//   - every building: its name (and portrait); the players inside it
//   - a building opens to list its rooms on hover or click (PC), tap (remote), and by itself on a
//     screen that follows the current player (TV, remote): the building the current player is in
//   - next moves light up: the destination's building glows and names the room ("→ City Filing Fee")
// The layout comes from TOWN.csv (townLayout.ts); the building signs never tilt, so names keep their
// size. No walking yet (step A2): a piece jumps, as on the classic board.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  ControlButton,
  useReactFlow,
  getNodesBounds,
  ViewportPortal,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGameContext } from '../../context/GameContext';
import type { Player } from '../../types/DataTypes';
import { shortName, narrowToOfferedMoves } from '../../utils/boardCommon';
import { extractPrefix, getNpcImagePath, type NpcImageRole } from '../../constants/characters';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { getStoredPanelMode, panelPalettes, type PanelMode } from '../player/panelTheme';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { scaleMs, getGameSpeed } from '../../utils/gameSpeed';
import { setTownWalking } from '../../utils/boardStyle';
import {
  buildTownLayout,
  buildingBox,
  buildingViews,
  isoPoint,
  pointAlong,
  walkPath,
  walkTimes,
  resultBubbles,
  DEFAULT_BUBBLE_MS,
  type PlayerNumbers,
  type ResultBubble,
  type BuildingView,
  type TownBuilding,
  type TownLayout,
} from '../../utils/townLayout';

/** Board pixels per town grid tile. */
export const TOWN_TILE = 50;
/** Room above each block for its name sign, so fitting the view keeps the signs on screen. */
const SIGN_SPACE = 90;
/** How long the mouse rests on a building before its rooms open, so passing over one does not pop it
 *  open and shut (Tom, 2026-10-12: "a lot of flickering"). */
const HOVER_OPEN_MS = 400;
/** A screen that follows the current player never zooms out past this (names stay readable). */
const FOLLOW_MIN_ZOOM = 0.75;

const PORTRAIT_ROLES = new Set(['owner', 'architect', 'engineer', 'dob_examiner', 'dob_clerk', 'fdny_examiner', 'fdny_clerk', 'contractor', 'inspector']);

const GROUND = {
  light: { water: '#8fd0f0', grass: '#86c46f', edge: '#4d8a3d', street: '#626a76', line: '#f4f1e6' },
  dark: { water: '#0f172a', grass: '#2e4a32', edge: '#1f3322', street: '#3b4250', line: '#8b93a1' },
};
const DEST = '#16a34a';
const HERE = '#f59e0b';

function shade(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.min(255, Math.round(v * f)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// -------------------------------------------------------------------------------------------------
// Ground: the grass, the streets and their centre lines. One node under everything.
// -------------------------------------------------------------------------------------------------

interface GroundData extends Record<string, unknown> {
  w: number;
  h: number;
  ox: number;
  oy: number;
  layout: TownLayout;
  mode: PanelMode;
}

function TownGround({ data }: NodeProps<Node<GroundData>>) {
  const { w, h, ox, oy, layout, mode } = data;
  const g = GROUND[mode];
  const { minCol, minRow, maxCol, maxRow } = layout.bounds;
  const c0 = minCol - 1, r0 = minRow - 1, c1 = maxCol + 1, r1 = maxRow + 1;
  const pt = (c: number, r: number) => {
    const p = isoPoint(c, r, 0, TOWN_TILE);
    return `${p.x - ox},${p.y - oy}`;
  };
  const quad = (a: number, b: number, c: number, d: number) => `${pt(a, b)} ${pt(c, b)} ${pt(c, d)} ${pt(a, d)}`;
  const line = (a: [number, number], b: [number, number]) => {
    const p = isoPoint(a[0], a[1], 0, TOWN_TILE);
    const q = isoPoint(b[0], b[1], 0, TOWN_TILE);
    return { x1: p.x - ox, y1: p.y - oy, x2: q.x - ox, y2: q.y - oy };
  };
  return (
    <svg width={w} height={h} style={{ display: 'block', pointerEvents: 'none' }} aria-hidden="true">
      <polygon points={quad(c0, r0, c1, r1)} fill={g.grass} stroke={g.edge} strokeWidth={3} />
      {layout.streets.map((s, i) => (
        <polygon
          key={`s${i}`}
          points={s.axis === 'col' ? quad(s.at, r0, s.at + 1, r1) : quad(c0, s.at, c1, s.at + 1)}
          fill={g.street}
        />
      ))}
      {layout.streets.map((s, i) => {
        const l = s.axis === 'col' ? line([s.at + 0.5, r0], [s.at + 0.5, r1]) : line([c0, s.at + 0.5], [c1, s.at + 0.5]);
        return <line key={`l${i}`} {...l} stroke={g.line} strokeWidth={3} strokeDasharray="16 14" />;
      })}
    </svg>
  );
}

// -------------------------------------------------------------------------------------------------
// A building: its block (drawn in SVG, tilted) and its sign (HTML, never tilted).
// -------------------------------------------------------------------------------------------------

interface BuildingData extends Record<string, unknown> {
  building: TownBuilding;
  view: BuildingView;
  open: boolean;
  /** Node origin in board pixels (the block's box, less the sign space). */
  ox: number;
  oy: number;
  w: number;
  h: number;
  roofX: number;
  roofY: number;
  labels: Record<string, string>;
  portrait: string | null;
  mode: PanelMode;
  bubbles: Bubble[];
  onBubbleDone: (key: number) => void;
}

function Block({ b, ox, oy }: { b: TownBuilding; ox: number; oy: number }) {
  const P = (c: number, r: number, z: number) => {
    const p = isoPoint(c, r, z, TOWN_TILE);
    return `${p.x - ox},${p.y - oy}`;
  };
  const c0 = b.col, r0 = b.row, c1 = b.col + b.width, r1 = b.row + b.depth, h = b.height;
  const edge = 'rgba(0,0,0,0.35)';
  if (h === 0) {
    // A flat lot (the building site, the ribbon cutting).
    return <polygon points={`${P(c0, r0, 0)} ${P(c1, r0, 0)} ${P(c1, r1, 0)} ${P(c0, r1, 0)}`} fill={b.color} stroke={shade(b.color, 0.6)} strokeWidth={3} />;
  }
  const windows: React.ReactNode[] = [];
  for (let c = c0 + 0.6; c < c1 - 0.4; c += 1.2) {
    windows.push(<polygon key={`f${c}`} points={`${P(c, r1, h * 0.35)} ${P(c + 0.6, r1, h * 0.35)} ${P(c + 0.6, r1, h * 0.75)} ${P(c, r1, h * 0.75)}`} fill="rgba(255,255,255,0.75)" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />);
  }
  for (let r = r0 + 0.6; r < r1 - 0.4; r += 1.2) {
    windows.push(<polygon key={`s${r}`} points={`${P(c1, r, h * 0.35)} ${P(c1, r + 0.6, h * 0.35)} ${P(c1, r + 0.6, h * 0.75)} ${P(c1, r, h * 0.75)}`} fill="rgba(255,255,255,0.6)" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />);
  }
  return (
    <>
      <polygon points={`${P(c0, r1, 0)} ${P(c1, r1, 0)} ${P(c1, r1, h)} ${P(c0, r1, h)}`} fill={shade(b.color, 0.78)} stroke={edge} strokeWidth={2} />
      <polygon points={`${P(c1, r0, 0)} ${P(c1, r1, 0)} ${P(c1, r1, h)} ${P(c1, r0, h)}`} fill={shade(b.color, 0.62)} stroke={edge} strokeWidth={2} />
      <polygon points={`${P(c0, r0, h)} ${P(c1, r0, h)} ${P(c1, r1, h)} ${P(c0, r1, h)}`} fill={shade(b.color, 0.9)} stroke={edge} strokeWidth={2} />
      {windows}
    </>
  );
}

function TownBuildingNode({ data }: NodeProps<Node<BuildingData>>) {
  const { building: b, view, open, ox, oy, w, h, roofX, roofY, labels, portrait, mode, bubbles, onBubbleDone } = data;
  const pal = panelPalettes[mode];
  const isDest = view.destinationRooms.length > 0;
  const ring = view.isCurrent ? HERE : isDest ? DEST : pal.borderStrong;
  const icon = portrait
    ? <img src={portrait} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
    : <span aria-hidden="true" style={{ fontSize: 28, lineHeight: '40px', width: 40, textAlign: 'center', flex: 'none' }}>{b.icon || '🏢'}</span>;

  return (
    <div
      data-testid={`town-building-${b.id}`}
      data-open={open ? 'true' : 'false'}
      data-current={view.isCurrent ? 'true' : 'false'}
      data-destination={isDest ? 'true' : 'false'}
      style={{ position: 'relative', width: w, height: h, cursor: 'pointer', pointerEvents: 'none' }}
    >
      <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
        <g style={{ pointerEvents: 'visiblePainted' }}><Block b={b} ox={ox} oy={oy} /></g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: roofX - ox,
          top: roofY - oy - 10,
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'auto',
          background: pal.bg,
          color: pal.text,
          border: `3px solid ${ring}`,
          borderRadius: 12,
          padding: '6px 10px 8px',
          boxShadow: view.isCurrent || isDest ? `0 0 14px ${ring}` : '0 4px 10px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          maxWidth: 420,
          width: 'max-content',
        }}
      >
        {bubbles.map(bb => <FloatingBubble key={bb.key} bubble={bb} onDone={onBubbleDone} />)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>{b.name}</span>
          {view.playersHere.length > 0 && (
            <span style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
              {view.playersHere.map(p => (
                <PlayerAvatar key={p.id} avatar={p.avatar} color={p.color} size={28} title={p.name} />
              ))}
            </span>
          )}
        </div>
        {!open && isDest && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {view.destinationRooms.map(r => (
              <span key={r} data-testid={`town-room-${r}`} data-destination="true" style={{ fontSize: 16, fontWeight: 700, color: DEST, whiteSpace: 'nowrap' }}>
                → {labels[r] ?? r}
              </span>
            ))}
          </div>
        )}
        {open && b.rooms.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
            {b.rooms.map(r => {
              const here = view.currentRoom === r;
              const dest = view.destinationRooms.includes(r);
              return (
                <span
                  key={r}
                  data-testid={`town-room-${r}`}
                  data-current={here ? 'true' : 'false'}
                  data-destination={dest ? 'true' : 'false'}
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    padding: '5px 9px',
                    borderRadius: 7,
                    background: here ? (mode === 'dark' ? 'rgba(245,158,11,0.18)' : '#fff7e0') : dest ? pal.goodSurf : pal.surf,
                    border: `2px solid ${here ? HERE : dest ? DEST : pal.border}`,
                  }}
                >
                  {dest ? '→ ' : ''}{labels[r] ?? r}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { townGround: TownGround, townBuilding: TownBuildingNode };

// -------------------------------------------------------------------------------------------------
// The walk (step A2): a player's face walks the streets from the old building to the new one.
// -------------------------------------------------------------------------------------------------

interface Walk {
  key: number;
  playerId: string;
  name: string;
  avatar?: string;
  color?: string;
  /** Board pixels along the streets; a single point = a hop inside one building. */
  points: Array<{ x: number; y: number }>;
  ms: number;
}

/** Moves its face along the route by the clock (not by frame count, so a slow TV still ends on time). */
function Walker({ walk, onDone }: { walk: Walk; onDone: (key: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const place = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, walk.ms));
      const p = pointAlong(walk.points, t);
      // A hop (one point) is a small jump; a walk bobs a little with each step.
      const lift = walk.points.length === 1 ? Math.sin(Math.PI * t) * 26 : Math.abs(Math.sin(t * Math.PI * 8)) * 5;
      if (ref.current) ref.current.style.transform = `translate(${p.x}px, ${p.y - lift}px) translate(-50%, -100%)`;
      if (t < 1) raf = requestAnimationFrame(place);
    };
    place(start);
    raf = requestAnimationFrame(place);
    // Some screens (a hidden tab, a weak TV) give no animation frames: the walk still ends on time.
    const done = window.setTimeout(() => onDone(walk.key), walk.ms + 60);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [walk, onDone]);
  return (
    <div ref={ref} data-testid={`town-walker-${walk.playerId}`} style={{ position: 'absolute', left: 0, top: 0, zIndex: 3000, pointerEvents: 'none', filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.35))' }}>
      <PlayerAvatar avatar={walk.avatar} color={walk.color} size={44} title={walk.name} />
    </div>
  );
}

interface Bubble extends ResultBubble {
  key: number;
  playerId: string;
  /** The building it rises from; it starts at the top edge of that building's sign. */
  buildingId: string;
  /** Stack position among the bubbles of one change (0 = lowest). */
  index: number;
  /** Waits for the walk to end, and for the bubbles above it in the same change. */
  delayMs: number;
  ms: number;
  still: boolean;
}

const BUBBLE_COLOURS = {
  good: { bg: '#dcfce7', fg: '#166534', border: '#16a34a' },
  bad: { bg: '#fee2e2', fg: '#991b1b', border: '#dc2626' },
  info: { bg: '#dbeafe', fg: '#1e3a8a', border: '#2563eb' },
};

/** A result floating up from a building and fading (Web Animations, so it stays smooth and ends on time). */
function FloatingBubble({ bubble, onDone }: { bubble: Bubble; onDone: (key: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const rise = bubble.still ? 0 : 70;
    const anim = el?.animate?.(
      [
        { transform: 'translate(-50%, -100%) translateY(0px)', opacity: 0 },
        { transform: `translate(-50%, -100%) translateY(${-rise * 0.2}px)`, opacity: 1, offset: 0.15 },
        { transform: `translate(-50%, -100%) translateY(${-rise * 0.75}px)`, opacity: 1, offset: 0.75 },
        { transform: `translate(-50%, -100%) translateY(${-rise}px)`, opacity: 0 },
      ],
      { duration: bubble.ms, delay: bubble.delayMs, fill: 'both', easing: 'ease-out' },
    );
    const done = window.setTimeout(() => onDone(bubble.key), bubble.delayMs + bubble.ms + 60);
    return () => { anim?.cancel(); window.clearTimeout(done); };
  }, [bubble, onDone]);
  const c = BUBBLE_COLOURS[bubble.tone];
  return (
    <div
      ref={ref}
      data-testid={`town-bubble-${bubble.playerId}`}
      data-kind={bubble.kind}
      data-key={bubble.key}
      data-tone={bubble.tone}
      style={{
        position: 'absolute', left: '50%', top: -8 - bubble.index * 36, zIndex: 3500, pointerEvents: 'none', opacity: 0,
        transform: 'translate(-50%, -100%)', whiteSpace: 'nowrap',
        background: c.bg, color: c.fg, border: `2px solid ${c.border}`, borderRadius: 999,
        padding: '4px 12px', fontSize: 20, fontWeight: 800, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
      }}
    >
      {bubble.text}
    </div>
  );
}

const prefersReducedMotion = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// -------------------------------------------------------------------------------------------------
// The board
// -------------------------------------------------------------------------------------------------

export interface TownBoardProps {
  currentPlayerId: string | null;
  players: Player[];
  /** A screen that follows the current player (TV, remote): opens their building by itself. */
  centerOnCurrent?: boolean;
  mode?: PanelMode;
  focusRequest?: { spaceId: string; token: number } | null;
  /** The layout to draw (GameBoard builds it once from TOWN.csv). */
  layout: TownLayout;
}

/** Room names as the classic board shows them (display label, else the short name). */
export function useTownLabels(): Record<string, string> {
  const { dataService } = useGameContext();
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const cfg of dataService.getGameConfig()) {
      out[cfg.space_name] = cfg.display_label_override || shortName(cfg.space_name);
    }
    return out;
  }, [dataService]);
}

/** The town for this board, or null when TOWN.csv has no buildings. */
export function useTownLayout(): TownLayout | null {
  const { dataService } = useGameContext();
  const labels = useTownLabels();
  return useMemo(() => {
    const rows = dataService.getTownRows?.() ?? [];
    if (rows.length === 0) return null;
    const spaces = dataService.getGameConfig()
      .map(c => c.space_name)
      .filter(s => s !== 'START-QUICK-PLAY-GUIDE');
    return buildTownLayout(rows, spaces, extractPrefix, s => labels[s] ?? s);
  }, [dataService, labels]);
}

function TownBoardInner({ currentPlayerId, players, centerOnCurrent = false, mode: modeProp, focusRequest, layout }: TownBoardProps) {
  const { stateService, movementService, gameRulesService } = useGameContext();
  const { fitView, setCenter, getViewport, setViewport } = useReactFlow();
  const mode: PanelMode = modeProp ?? getStoredPanelMode();
  const labels = useTownLabels();
  const { appearances } = useNpcPortrait();
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same next-move list the classic board lights (BoardCanvas), so the two can never disagree.
  useEffect(() => {
    const update = () => {
      const s = stateService.getGameState();
      if (s.gamePhase === 'PLAY' && s.currentPlayerId && !s.hasPlayerMovedThisTurn && !s.isMoving) {
        try { setValidMoves(narrowToOfferedMoves(movementService.getValidMoves(s.currentPlayerId), s.awaitingChoice)); }
        catch { setValidMoves([]); }
      } else {
        setValidMoves([]);
      }
    };
    update();
    return stateService.subscribe(update);
  }, [stateService, movementService]);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  // A player whose square changed walks from the old building to the new one. Only changes seen
  // while this board is showing walk; a screen that joins late just shows everyone where they are.
  const [walks, setWalks] = useState<Walk[]>([]);
  // The squares as last seen. Compared while rendering (React's "adjust state when a prop changes"
  // pattern), so a walk starts in the same paint as the move instead of one effect later.
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  // Scope as the panel shows it (summed from the player's work packages). The stored projectScope
  // field can read 0 for a moment at a turn change, which made a false "−$5.2M scope" bubble.
  const numbersOf = (p: Player): PlayerNumbers => ({ money: p.money ?? 0, days: p.timeSpent ?? 0, scope: gameRulesService.calculateProjectScope(p.id) });
  const [seen, setSeen] = useState<{ players: Player[]; spaces: Map<string, string> | null; numbers: Map<string, PlayerNumbers> | null; n: number }>({ players: [], spaces: null, numbers: null, n: 0 });
  if (seen.players !== players) {
    const before = seen.spaces;
    const beforeNumbers = seen.numbers;
    setSeen({ players, spaces: new Map(players.map(p => [p.id, p.currentSpace])), numbers: new Map(players.map(p => [p.id, numbersOf(p)])), n: seen.n + 1 });
    if (before && !prefersReducedMotion()) {
      const times = walkTimes(layout.settings);
      const fast = getGameSpeed() === 'fast';
      const started: Walk[] = [];
      for (const p of players) {
        const was = before.get(p.id);
        if (!was || was === p.currentSpace) continue;
        const from = layout.roomToBuilding.get(was);
        const to = layout.roomToBuilding.get(p.currentSpace);
        if (!from || !to) continue;
        const hop = from === to;
        const target = layout.buildings.find(x => x.id === to)!;
        const route = hop ? [{ col: target.col + target.width / 2, row: target.row + target.depth / 2 }] : walkPath(layout, from, to);
        const ms = hop ? times.hopMs : fast ? times.fastMs : times.walkMs;
        if (route.length === 0 || ms <= 0) continue;
        started.push({
          key: seen.n * 100 + started.length, playerId: p.id, name: p.name, avatar: p.avatar, color: p.color, ms,
          points: route.map(g => isoPoint(g.col, g.row, 0, TOWN_TILE)),
        });
      }
      if (started.length) setWalks(w => [...w.filter(x => !started.some(s => s.playerId === x.playerId)), ...started]);
    }
    // Results float up from the building the player is in (after their walk, if they walked).
    if (beforeNumbers) {
      const still = prefersReducedMotion();
      const fastNow = getGameSpeed() === 'fast';
      const times = walkTimes(layout.settings);
      const baseMs = parseFloat(layout.settings.bubble_ms ?? '') || DEFAULT_BUBBLE_MS;
      const ms = fastNow ? baseMs / 2 : baseMs;
      const made: Bubble[] = [];
      for (const p of players) {
        const was = beforeNumbers.get(p.id);
        if (!was) continue;
        const list = resultBubbles(was, numbersOf(p));
        if (list.length === 0) continue;
        const bid = layout.roomToBuilding.get(p.currentSpace);
        const b = bid ? layout.buildings.find(x => x.id === bid) : undefined;
        if (!b) continue;
        const moved = before?.get(p.id) !== undefined && before?.get(p.id) !== p.currentSpace && !still;
        const from = moved ? layout.roomToBuilding.get(before!.get(p.id)!) : undefined;
        const walkWait = !moved ? 0 : from === bid ? times.hopMs : fastNow ? times.fastMs : times.walkMs;
        list.forEach((r, i) => made.push({
          ...r, key: seen.n * 100 + 50 + made.length, playerId: p.id,
          // Rises from the top of the building's sign, stacked so two results never sit on each other.
          buildingId: b.id, index: i,
          delayMs: walkWait + i * 250, ms, still,
        }));
      }
      if (made.length) setBubbles(bs => [...bs, ...made]);
    }
  }
  const endBubble = useCallback((key: number) => setBubbles(bs => bs.filter(x => x.key !== key)), []);
  const endWalk = useCallback((key: number) => setWalks(w => w.filter(x => x.key !== key)), []);
  // Tell the rest of this screen a walk is on, so arriving pop-ups wait for it (boardStyle.ts).
  useEffect(() => {
    setTownWalking(walks.length > 0);
  }, [walks.length]);
  useEffect(() => () => setTownWalking(false), []);
  const walking = useMemo(() => new Set(walks.map(w => w.playerId)), [walks]);

  // A walking player shows on the street, not yet in the building they are walking to.
  const views = useMemo(
    () => buildingViews(
      layout,
      players.filter(p => !walking.has(p.id)).map(p => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, currentSpace: p.currentSpace })),
      currentPlayerId,
      validMoves,
    ),
    [layout, players, walking, currentPlayerId, validMoves],
  );

  const portraitFor = useCallback((icon: string): string | null => {
    if (!PORTRAIT_ROLES.has(icon)) return null;
    const a = appearances?.[icon as NpcImageRole];
    return a ? getNpcImagePath(icon as NpcImageRole, a) : null;
  }, [appearances]);

  const nodes = useMemo(() => {
    const out: Node[] = [];
    const { minCol, minRow, maxCol, maxRow } = layout.bounds;
    const corners = [
      isoPoint(minCol - 1, minRow - 1, 0, TOWN_TILE), isoPoint(maxCol + 1, minRow - 1, 0, TOWN_TILE),
      isoPoint(maxCol + 1, maxRow + 1, 0, TOWN_TILE), isoPoint(minCol - 1, maxRow + 1, 0, TOWN_TILE),
    ];
    const gx = Math.min(...corners.map(c => c.x)), gy = Math.min(...corners.map(c => c.y));
    const gw = Math.max(...corners.map(c => c.x)) - gx, gh = Math.max(...corners.map(c => c.y)) - gy;
    out.push({
      id: 'town-ground', type: 'townGround', position: { x: gx, y: gy }, zIndex: 0, style: { pointerEvents: 'none' },
      draggable: false, selectable: false, focusable: false,
      data: { w: gw, h: gh, ox: gx, oy: gy, layout, mode } satisfies GroundData,
    });
    for (const b of layout.buildings) {
      const box = buildingBox(b, TOWN_TILE);
      const view = views.get(b.id)!;
      const open = expanded === b.id || hovered === b.id || (centerOnCurrent && view.isCurrent);
      const ox = box.x, oy = box.y - SIGN_SPACE;
      out.push({
        id: b.id, type: 'townBuilding', position: { x: ox, y: oy },
        // Back to front, so nearer blocks cover farther ones; an open sign sits above everything.
        zIndex: open ? 2000 : bubbles.some(x => x.buildingId === b.id) ? 1900 : 10 + Math.round((b.col + b.row) * 10),
        draggable: false,
        // Only the drawn block and its sign catch the mouse, not the node's whole rectangle: the
        // rectangles overlap neighbours and streets, which opened the wrong building and made signs
        // pop open and shut as the mouse moved (measured 2026-10-12: wrong building at 10 of 53 spots).
        style: { pointerEvents: 'none' },
        data: {
          building: b, view, open, ox, oy, w: box.w, h: box.h + SIGN_SPACE,
          roofX: box.roofX, roofY: box.roofY, labels, portrait: portraitFor(b.icon), mode,
          bubbles: bubbles.filter(x => x.buildingId === b.id), onBubbleDone: endBubble,
        } satisfies BuildingData,
      });
    }
    return out;
  }, [layout, views, expanded, hovered, centerOnCurrent, labels, portraitFor, mode, bubbles, endBubble]);

  // Follow the current player (TV, remote): first frame their building and its next moves, then
  // only glide at the zoom the viewer has, the same steady camera the classic board keeps.
  const current = currentPlayerId ? players.find(p => p.id === currentPlayerId) : undefined;
  const currentBuilding = current ? layout.roomToBuilding.get(current.currentSpace) : undefined;
  const destBuildings = useMemo(
    () => [...new Set(validMoves.map(m => layout.roomToBuilding.get(m)).filter((x): x is string => !!x))],
    [validMoves, layout],
  );
  const framed = useRef(false);
  // Re-frame when the board's box changes size (a window resize, the panel column settling after
  // the first paint, a phone turning): PC re-fits the whole town; a following screen frames the
  // current player's building again.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [sizeTick, setSizeTick] = useState(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let timer: number | undefined;
    let last = '';
    const ro = new ResizeObserver(() => {
      const key = `${el.clientWidth}x${el.clientHeight}`;
      if (key === last || el.clientWidth === 0 || el.clientHeight === 0) return;
      last = key;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        framed.current = false;
        setSizeTick(n => n + 1);
      }, 150);
    });
    ro.observe(el);
    return () => { ro.disconnect(); window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (centerOnCurrent || sizeTick === 0) return;
    try { fitView({ padding: 0.06, duration: 0 }); } catch { /* not measured yet */ }
  }, [sizeTick, centerOnCurrent, fitView]);
  useEffect(() => {
    if (!centerOnCurrent || !currentBuilding) return;
    if (walks.length > 0) {
      // Watch the walk: glide to the middle of the newest walker's whole route, so the walk is on
      // screen from door to door (its face stands a little above the street, hence the lift).
      const w = walks[walks.length - 1];
      const xs = w.points.map(p => p.x), ys = w.points.map(p => p.y);
      const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const midY = (Math.min(...ys) + Math.max(...ys)) / 2 - 30;
      setCenter(midX, midY, { zoom: getViewport().zoom, duration: Math.min(w.ms, scaleMs(500)) });
      return;
    }
    const ids = [...new Set([currentBuilding, ...destBuildings])];
    const t = window.setTimeout(() => {
      const focus = nodes.filter(n => ids.includes(n.id));
      if (focus.length === 0) return;
      if (!framed.current) {
        try {
          fitView({ nodes: ids.map(id => ({ id })), padding: 0.3, duration: scaleMs(350), maxZoom: 1.3, minZoom: FOLLOW_MIN_ZOOM });
          framed.current = true;
        } catch { /* nodes not measured yet; the next change retries */ }
        return;
      }
      const bb = getNodesBounds(focus);
      setCenter(bb.x + bb.width / 2, bb.y + bb.height / 2, { zoom: getViewport().zoom, duration: scaleMs(350) });
    }, 100);
    return () => window.clearTimeout(t);
  }, [centerOnCurrent, currentBuilding, destBuildings, nodes, fitView, setCenter, getViewport, sizeTick, walks]);

  // A jump asked for by the game log (PC): glide to that square's building at the current zoom.
  useEffect(() => {
    if (!focusRequest) return;
    const bid = layout.roomToBuilding.get(focusRequest.spaceId);
    const n = bid ? nodes.find(x => x.id === bid) : undefined;
    if (!n) return;
    const bb = getNodesBounds([n]);
    setCenter(bb.x + bb.width / 2, bb.y + bb.height / 2, { zoom: getViewport().zoom, duration: scaleMs(500) });
    // nodes changes on every hover; only a NEW request should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const onEnter = useCallback((_: React.MouseEvent, n: Node) => {
    if (n.type !== 'townBuilding') return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(n.id), HOVER_OPEN_MS);
  }, []);
  const onLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHovered(null);
  }, []);
  const onClick = useCallback((_: React.MouseEvent, n: Node) => {
    if (n.type !== 'townBuilding') return;
    setExpanded(prev => (prev === n.id ? null : n.id));
  }, []);

  const PAN = 120;
  const panBy = (dx: number, dy: number) => {
    const v = getViewport();
    setViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom }, { duration: scaleMs(150) });
  };

  return (
    <div ref={wrapperRef} data-testid="town-board" style={{ width: '100%', height: '100%', position: 'relative', background: GROUND[mode].water }}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodeClick={onClick}
        onNodeMouseEnter={onEnter}
        onNodeMouseLeave={onLeave}
        onPaneClick={() => setExpanded(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        fitView
        fitViewOptions={{ padding: 0.06 }}
        minZoom={0.2}
        maxZoom={2}
        colorMode={mode}
        style={{ backgroundColor: GROUND[mode].water }}
      >
        <Controls showInteractive={false}>
          <ControlButton onClick={() => panBy(0, PAN)} title="Pan up"><span aria-hidden="true">↑</span></ControlButton>
          <ControlButton onClick={() => panBy(PAN, 0)} title="Pan left"><span aria-hidden="true">←</span></ControlButton>
          <ControlButton onClick={() => panBy(-PAN, 0)} title="Pan right"><span aria-hidden="true">→</span></ControlButton>
          <ControlButton onClick={() => panBy(0, -PAN)} title="Pan down"><span aria-hidden="true">↓</span></ControlButton>
        </Controls>
        <ViewportPortal>
          {walks.map(w => <Walker key={w.key} walk={w} onDone={endWalk} />)}
        </ViewportPortal>
      </ReactFlow>
    </div>
  );
}

export function TownBoard(props: TownBoardProps) {
  return (
    <ReactFlowProvider>
      <TownBoardInner {...props} />
    </ReactFlowProvider>
  );
}
