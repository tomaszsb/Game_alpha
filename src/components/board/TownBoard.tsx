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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
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
import { registerDiagnostic } from '../../utils/feedbackDiagnostics';
import { cameraSeesNothing } from '../../utils/townCamera';
import { extractPrefix } from '../../constants/characters';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { getStoredPanelMode, panelPalettes, type PanelMode } from '../player/panelTheme';
import { PlayerPawn, pawnHeight } from './PlayerPawn';
import { BuildingIcon } from '../common/BuildingIcon';
import { portraitSrc } from '../../utils/buildingIcon';
import { scaleMs, getGameSpeed } from '../../utils/gameSpeed';
import { setTownWalking } from '../../utils/boardStyle';
import { projectKindOf } from '../../utils/projectKind';
import { getSoundOn } from '../../utils/soundSetting';
import { TownViewPad, type ViewPadScreen } from './TownViewPad';
import { TownClocks, rowHeightPx, FlipClock, CLOCK_W, CLOCK_H, type ClockPlayer } from './TownClocks';
import { clockMonth, clockStartIso, clockDate } from '../../utils/gameClock';
import { areaSegments, hasLeftBoard, ownerOfRow, type AreaSegment } from '../../utils/townAreas';
import { treePicture, treeScale } from '../../utils/townTrees';
import { TownWeatherNode, buildWeatherBands, type WeatherData } from './TownWeather';
import { TownPropsNode, buildTownProps, propPoint, type PropsData } from './TownProps';
import { freeSpots, makeFreeTest } from '../../utils/townProps';
import { useScene } from '../../utils/sceneSetting';
import { seasonLook, mixHex, type SeasonLook } from '../../utils/townSeasons';
import { racePlaces } from '../../utils/liveTrophies';
import { getTrophyRules, type TrophyId } from '../../utils/trophyRules';
import { playResultChime, isAudioReady, primeAudio } from '../../utils/haptics';
import { pulseAnimation, pulseLookOf, type PulseLook } from '../../utils/pulseLook';
import {
  nextPose, poseRoundTown, roundPoint, roundWedges, ownerOfAngle, roundWalkPath, seatAngle,
  type RoundPose, type RoundTown, type RoundWedge,
} from '../../utils/townRound';
import {
  buildTownLayout,
  buildingBox,
  buildingViews,
  isoPoint,
  pointAlong,
  walkPath,
  walkTimes,
  resultBubbles,
  mergedResultBubbles,
  trophyBubbles,
  revealedBuildings,
  fadedBuildings,
  buildingOfRoom,
  DEFAULT_BUBBLE_MS,
  bubbleVolume,
  type PlayerNumbers,
  type ResultBubble,
  type BuildingView,
  type TownBuilding,
  type TownLayout,
  type TownTree,
  type Who,
} from '../../utils/townLayout';

/** Board pixels per town grid tile. */
export const TOWN_TILE = 50;
/** Room above each block for its name sign, so fitting the view keeps the signs on screen. */
const SIGN_SPACE = 90;
/** How long the mouse rests on a building before its rooms open, so passing over one does not pop it
 *  open and shut (Tom, 2026-10-12: "a lot of flickering"). */
const HOVER_OPEN_MS = 400;
/** Fitting the whole town leaves room along the top for the row of clocks (about 50 px at normal size). */
const FIT_PADDING = { top: '64px', right: '6%', bottom: '6%', left: '6%' } as const satisfies Record<string, `${number}px` | `${number}%`>;
/** A round town has no row of clocks along the top (each clock rides on the rim with its player's side). */
const ROUND_FIT_PADDING = { top: '16px', right: '3%', bottom: '3%', left: '3%' } as const satisfies Record<string, `${number}px` | `${number}%`>;
/** A screen that follows the current player never zooms out past this (names stay readable). */
const FOLLOW_MIN_ZOOM = 0.75;


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
// The turning table (round town). Every node already stands at its NEW place (React Flow knows the true
// positions, so the camera, the clicks and the blank-board diagnostics stay right); for one turn its own
// drawing is then moved back to where it was and slid there round the middle of town. Only `transform`
// moves (cheap on a TV stick), and when it ends the drawing sits on its node again with no transform at all.
// -------------------------------------------------------------------------------------------------

/** One turn of a node: by how many degrees, round the middle of town (`rx`, `ry` = middle minus the node's anchor, board px). */
export interface TurnAnim {
  key: number;
  deg: number;
  rx: number;
  ry: number;
  ms: number;
  /** The ground turns as a whole; everything else keeps facing the viewer (and keeps its size) as it goes round. */
  spin?: boolean;
}

/**
 * The CSS transform for a node part way through a turn (`at` degrees still to go, as a negative number at the start).
 * The town is drawn turned 45 degrees and squashed to half height, so a turn round the middle is "unsquash, rotate,
 * squash" about the middle; a building also turns back the same amount about its own anchor, so it keeps facing the
 * viewer. Both lists have the same steps, so the browser runs the angle smoothly along the oval.
 */
export function turnTransform(t: Pick<TurnAnim, 'rx' | 'ry' | 'spin'>, at: number): string {
  const orbit = `translate(${t.rx}px, ${t.ry}px) scaleY(0.5) rotate(${at}deg) scaleY(2) translate(${-t.rx}px, ${-t.ry}px)`;
  return t.spin ? orbit : `${orbit} scaleY(0.5) rotate(${-at}deg) scaleY(2)`;
}

function useTurn(ref: React.RefObject<Element | null>, turn: TurnAnim | undefined): void {
  // Before paint, in the same frame the node gets its new place: no frame ever shows it there unturned.
  useLayoutEffect(() => {
    const el = ref.current as (Element & { animate?: Element['animate'] }) | null;
    if (!el || !turn || !turn.deg || turn.ms <= 0 || typeof el.animate !== 'function') return undefined;
    const anim = el.animate([{ transform: turnTransform(turn, -turn.deg) }, { transform: turnTransform(turn, 0) }], { duration: turn.ms, easing: 'cubic-bezier(.5,0,.25,1)' });
    return () => anim.cancel();
    // a turn plays once, when its key is new
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn?.key]);
}

// -------------------------------------------------------------------------------------------------
// Ground: the grass, the streets and their centre lines. One node under everything.
// -------------------------------------------------------------------------------------------------

/** Who owns which ground, and the look of each player's month (index = seat). Built once per change in TownBoardInner. */
export interface GroundAreas {
  segments: AreaSegment[];
  /** A round town: the angles each player owns (before the table turns), and whose season the shared middle shows. */
  wedges?: RoundWedge[];
  middleSeat?: number;
  looks: SeasonLook[];
  /** Each player's colour, for the dotted line along their side of a cut. */
  colors: string[];
}

interface GroundData extends Record<string, unknown> {
  w: number;
  h: number;
  ox: number;
  oy: number;
  layout: TownLayout;
  mode: PanelMode;
  areas: GroundAreas;
  /** A round town: drawn as rings round the middle, turned to the table's pose. */
  round?: RoundTown;
  table?: number;
  turn?: TurnAnim;
}

/** How far the water reaches past the island, in tiles, so each band's blue runs out to the frame at any zoom. */
const WATER_REACH = 400;
/** The soft blend at a cut: this many tiles each side, in this many steps. */
const BLEND_TILES = 2;
const BLEND_STEPS = 8;
const FADE_MS = 1500;

function TownGround({ data }: NodeProps<Node<GroundData>>) {
  const ref = useRef<SVGSVGElement>(null);
  useTurn(ref, data.turn);
  if (data.round) return <RoundGround data={data} round={data.round} svgRef={ref} />;
  return <StripedGround data={data} />;
}

/** The round town's ground (townRound.ts): each player's season on their own wedge, the shared middle in the season of
 *  the player whose turn it is, a ring road, and a park with a fountain. */
function RoundGround({ data, round: rt, svgRef }: { data: GroundData; round: RoundTown; svgRef: React.RefObject<SVGSVGElement | null> }) {
  const { w, h, ox, oy, mode, areas } = data;
  const table = data.table ?? 0;
  const g = GROUND[mode];
  const pt = (angle: number, radius: number) => {
    const q = roundPoint(rt, angle + table, radius);
    const p = isoPoint(q.col, q.row, 0, TOWN_TILE);
    return `${(p.x - ox).toFixed(1)},${(p.y - oy).toFixed(1)}`;
  };
  const steps = (a0: number, a1: number) => Math.max(2, Math.ceil(Math.abs(a1 - a0) / 4));
  const arcLine = (a0: number, a1: number, r: number) => Array.from({ length: steps(a0, a1) + 1 }, (_, i) => pt(a0 + ((a1 - a0) * i) / steps(a0, a1), r)).join(' ');
  /** The ground between two angles and two distances from the middle (r0 = 0: a slice to the middle). */
  const band = (a0: number, a1: number, r0: number, r1: number) => {
    const out = arcLine(a0, a1, r1);
    if (r0 <= 0) return `${out} ${pt(0, 0)}`;
    const back = Array.from({ length: steps(a0, a1) + 1 }, (_, i) => pt(a1 - ((a1 - a0) * i) / steps(a0, a1), r0)).join(' ');
    return `${out} ${back}`;
  };
  const { looks, colors } = areas;
  const wedges = areas.wedges ?? [{ seat: 0, from: -90, to: 270 }];
  const look = (seat: number): SeasonLook => looks[seat] ?? looks[0];
  const mid = look(areas.middleSeat ?? 0);
  const fade: React.CSSProperties = prefersReducedMotion() ? {} : { transition: `fill ${FADE_MS}ms, stroke ${FADE_MS}ms` };
  const fill = (c: string): React.CSSProperties => ({ fill: c, ...fade });
  const far = rt.islandRadius + WATER_REACH;
  const shared = rt.roadRadius + 0.9;
  const stone = mode === 'dark' ? '#64748b' : '#d6d3d1';
  return (
    <svg ref={svgRef} width={w} height={h} style={{ display: 'block', pointerEvents: 'none', overflow: 'visible', transformOrigin: '0 0' }} aria-hidden="true" data-testid="town-ground-round">
      {wedges.map(wd => <polygon key={`w${wd.seat}`} points={band(wd.from, wd.to, 0, far)} style={fill(look(wd.seat).water)} />)}
      {wedges.map(wd => <polygon key={`g${wd.seat}`} points={band(wd.from, wd.to, 0, rt.islandRadius)} style={fill(look(wd.seat).grass)} />)}
      {wedges.map(wd => <polyline key={`e${wd.seat}`} points={arcLine(wd.from, wd.to, rt.islandRadius)} fill="none" style={{ stroke: look(wd.seat).edge, strokeWidth: 3, ...fade }} />)}
      {/* each player's own side, a soft band in their colour (colour on the board always means a player) */}
      {rt.sides.map(sd => (
        <polygon key={`side${sd.seat}`} points={band(sd.angle - sd.half, sd.angle + sd.half, rt.roadRadius + 1.6, rt.islandRadius - 0.4)} fill={colors[sd.seat] ?? '#475569'} fillOpacity={0.16} />
      ))}
      {/* the shared middle shows the season of the player whose turn it is */}
      <polygon points={band(0, 360, 0, shared)} style={fill(mid.grass)} />
      <polygon points={band(0, 360, rt.roadRadius - 0.75, rt.roadRadius + 0.75)} fill={g.street} />
      <polyline points={arcLine(0, 360, rt.roadRadius)} fill="none" stroke={g.line} strokeWidth={3} strokeDasharray="16 14" />
      <polygon points={band(0, 360, 0, rt.parkRadius)} style={fill(mixHex(mid.grass, '#ffffff', 0.1))} />
      <polyline points={arcLine(0, 360, Math.max(0.5, rt.parkRadius - 0.35))} fill="none" stroke={g.line} strokeOpacity={0.7} strokeWidth={7} />
      {rt.fountain > 0 && (
        <g data-testid="town-fountain">
          <polygon points={band(0, 360, 0, rt.fountain + 0.35)} fill={stone} stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
          <polygon points={band(0, 360, 0, rt.fountain)} style={fill(mid.water)} />
          <polygon points={band(0, 360, 0, rt.fountain * 0.3)} fill="#ffffff" fillOpacity={0.7} />
        </g>
      )}
      {/* the month's light over the ground (buildings stand above it and are never tinted) */}
      {wedges.map(wd => {
        const k = look(wd.seat);
        return (
          <g key={`t${wd.seat}`}>
            <polygon points={band(wd.from, wd.to, shared, far)} style={{ ...fill(k.tint), fillOpacity: k.tintOpacity }} />
            {k.daylight < 1 && <polygon points={band(wd.from, wd.to, shared, far)} style={{ fill: '#000', fillOpacity: 1 - k.daylight }} />}
          </g>
        );
      })}
      <polygon points={band(0, 360, 0, shared)} style={{ ...fill(mid.tint), fillOpacity: mid.tintOpacity }} />
      {mid.daylight < 1 && <polygon points={band(0, 360, 0, shared)} style={{ fill: '#000', fillOpacity: 1 - mid.daylight }} />}
      {/* a thin dotted line in each player's colour along their own side of every cut */}
      {wedges.length > 1 && wedges.map((wd, i) => {
        const next = wedges[(i + 1) % wedges.length];
        return (
          <g key={`d${wd.seat}`}>
            <polyline points={`${pt(wd.to - 0.6, shared)} ${pt(wd.to - 0.6, rt.islandRadius + 1)}`} stroke={colors[wd.seat] ?? '#475569'} strokeWidth={4} strokeDasharray="5 9" strokeLinecap="round" fill="none" />
            <polyline points={`${pt(wd.to + 0.6, shared)} ${pt(wd.to + 0.6, rt.islandRadius + 1)}`} stroke={colors[next.seat] ?? '#475569'} strokeWidth={4} strokeDasharray="5 9" strokeLinecap="round" fill="none" />
          </g>
        );
      })}
    </svg>
  );
}

function StripedGround({ data }: { data: GroundData }) {
  const { w, h, ox, oy, layout, mode, areas } = data;
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
  const { segments, looks, colors } = areas;
  const look = (seat: number): SeasonLook => looks[seat] ?? looks[0];
  // the colour change fades over about 1.5 s; the end colour is set at once, so a missing frame never leaves it stuck
  const fade: React.CSSProperties = prefersReducedMotion() ? {} : { transition: `fill ${FADE_MS}ms, stroke ${FADE_MS}ms` };
  const fill = (c: string): React.CSSProperties => ({ fill: c, ...fade });
  const cuts = segments.slice(0, -1).map((s, i) => ({ row: s.to, above: s.seat, below: segments[i + 1].seat }));
  const wc0 = c0 - WATER_REACH, wc1 = c1 + WATER_REACH;
  const wr0 = r0 - WATER_REACH, wr1 = r1 + WATER_REACH;
  const lo = (s: AreaSegment) => Math.max(s.from, r0);
  const hi = (s: AreaSegment) => Math.min(s.to, r1);
  return (
    <svg width={w} height={h} style={{ display: 'block', pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
      {segments.map(s => (
        <polygon key={`w${s.from}`} points={quad(wc0, Math.max(s.from, wr0), wc1, Math.min(s.to, wr1))} style={fill(look(s.seat).water)} />
      ))}
      {cuts.map(c => Array.from({ length: BLEND_STEPS }, (_, i) => {
        const a = c.row - BLEND_TILES + (i * 2 * BLEND_TILES) / BLEND_STEPS;
        return <polygon key={`wb${c.row}-${i}`} points={quad(wc0, a, wc1, a + (2 * BLEND_TILES) / BLEND_STEPS)} style={fill(mixHex(look(c.above).water, look(c.below).water, (i + 0.5) / BLEND_STEPS))} />;
      }))}
      {segments.filter(s => hi(s) > lo(s)).map(s => (
        <polygon key={`g${s.from}`} points={quad(c0, lo(s), c1, hi(s))} style={fill(look(s.seat).grass)} />
      ))}
      {cuts.map(c => Array.from({ length: BLEND_STEPS }, (_, i) => {
        const a = c.row - BLEND_TILES + (i * 2 * BLEND_TILES) / BLEND_STEPS;
        return <polygon key={`gb${c.row}-${i}`} points={quad(c0, a, c1, a + (2 * BLEND_TILES) / BLEND_STEPS)} style={fill(mixHex(look(c.above).grass, look(c.below).grass, (i + 0.5) / BLEND_STEPS))} />;
      }))}
      {segments.filter(s => hi(s) > lo(s)).map(s => {
        const edge = { stroke: look(s.seat).edge, strokeWidth: 3, ...fade };
        return (
          <g key={`e${s.from}`}>
            <line {...line([c0, lo(s)], [c0, hi(s)])} style={edge} />
            <line {...line([c1, lo(s)], [c1, hi(s)])} style={edge} />
            {s.from <= r0 && <line {...line([c0, r0], [c1, r0])} style={edge} />}
            {s.to >= r1 && <line {...line([c0, r1], [c1, r1])} style={edge} />}
          </g>
        );
      })}
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
      {/* the month's light over the ground (buildings stand above it and are never tinted) */}
      {segments.map(s => {
        const k = look(s.seat);
        const a = Math.max(s.from, wr0), z = Math.min(s.to, wr1);
        return (
          <g key={`t${s.from}`}>
            <polygon points={quad(wc0, a, wc1, z)} style={{ ...fill(k.tint), fillOpacity: k.tintOpacity }} />
            {k.daylight < 1 && <polygon points={quad(wc0, a, wc1, z)} style={{ fill: '#000', fillOpacity: 1 - k.daylight }} />}
          </g>
        );
      })}
      {/* a thin dotted line in each player's colour along their own side of every cut */}
      {cuts.map(c => (
        <g key={`d${c.row}`}>
          <line {...line([c0 - 1, c.row - 0.12], [c1 + 1, c.row - 0.12])} stroke={colors[c.above] ?? '#475569'} strokeWidth={4} strokeDasharray="5 9" strokeLinecap="round" opacity={1} />
          <line {...line([c0 - 1, c.row + 0.12], [c1 + 1, c.row + 0.12])} stroke={colors[c.below] ?? '#475569'} strokeWidth={4} strokeDasharray="5 9" strokeLinecap="round" opacity={1} />
        </g>
      ))}
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
  /** The colour of the player whose building this is (several players only): a dot on the sign, so each can find their own. */
  seatColor?: string;
  /** The construction site that is not this game's kind of project: it stays standing, faded. */
  faded: boolean;
  /** False until the building has earned its name (revealedBuildings): it still stands, with a "?" for a name. */
  named: boolean;
  mode: PanelMode;
  bubbles: Bubble[];
  onBubbleDone: (key: number) => void;
  turn?: TurnAnim;
  /** A move choice in a round town: pulsing while still open, steady once picked, a slow dim pulse for the others. */
  pulse?: 'choose' | 'chosen' | 'rest';
  pulseLook?: PulseLook & { still: boolean };
  /** How much bigger the sign is drawn (round town, `round_sign_scale`); 1 = as made. */
  signScale?: number;
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
  const { building: b, view, open, ox, oy, w, h, roofX, roofY, labels, portrait, named, faded, seatColor, mode, bubbles, onBubbleDone, pulse, pulseLook, signScale } = data;
  const pal = panelPalettes[mode];
  const isDest = view.destinationRooms.length > 0;
  const ring = view.isCurrent ? HERE : isDest ? DEST : pal.borderStrong;
  const icon = <BuildingIcon icon={b.icon} portrait={portrait} size={40} />;
  const ref = useRef<HTMLDivElement>(null);
  useTurn(ref, data.turn);
  const peak = pulse && pulseLook ? (pulse === 'rest' ? pulseLook.restGlow : pulseLook.glow) : 0;
  const steady = !pulseLook || pulseLook.still || pulse === 'chosen';

  return (
    <div
      ref={ref}
      data-testid={`town-building-${b.id}`}
      data-pulse={pulse}
      data-named={named ? 'true' : 'false'}
      data-faded={faded ? 'true' : 'false'}
      data-open={open ? 'true' : 'false'}
      data-current={view.isCurrent ? 'true' : 'false'}
      data-destination={isDest ? 'true' : 'false'}
      style={{ position: 'relative', width: w, height: h, cursor: 'pointer', pointerEvents: 'none', opacity: faded ? 0.5 : 1, transformOrigin: '0 0' }}
    >
      <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
        <g style={{ pointerEvents: 'visiblePainted' }}><Block b={b} ox={ox} oy={oy} /></g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: roofX - ox,
          top: roofY - oy - 10,
          // A round town shows the whole town at once, so its signs (and the pawns on them) are drawn bigger to stay readable on a TV.
          transform: signScale && signScale !== 1 ? `translate(-50%, -100%) scale(${signScale})` : 'translate(-50%, -100%)',
          transformOrigin: '50% 100%',
          pointerEvents: 'auto',
          background: pal.bg,
          color: pal.text,
          border: `3px solid ${ring}`,
          borderRadius: 12,
          padding: '6px 10px 8px',
          boxShadow: view.isCurrent || (isDest && !pulse) ? `0 0 14px ${ring}` : '0 4px 10px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          maxWidth: 420,
          width: 'max-content',
        }}
      >
        {pulse && pulseLook && (
          // The glow round a move choice: only its brightness and size move (pulseLook.ts), never its colour.
          <span aria-hidden data-testid="town-pulse" style={{
            position: 'absolute', inset: -7, borderRadius: 16, pointerEvents: 'none', boxShadow: `0 0 18px 7px ${DEST}`,
            ['--uc-pulse-peak' as string]: peak,
            ...(steady ? { opacity: peak } : { animation: pulseAnimation('uc-town-pulse', pulse === 'rest' ? pulseLook.restMs : pulseLook.ms) }),
          }} />
        )}
        {bubbles.map(bb => <FloatingBubble key={bb.key} bubble={bb} onDone={onBubbleDone} />)}
        {view.playersHere.length > 0 && (
          // The players here stand on top of the sign as big pawns (fb:fefe42f8).
          <div style={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end', gap: 4, pointerEvents: 'none', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.35))' }}>
            {view.playersHere.map(p => (
              <PlayerPawn key={p.id} avatar={p.avatar} color={p.color} width={PAWN_W} title={p.name} testId={`town-pawn-${p.id}`} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap', opacity: named ? 1 : 0.5 }}>{named ? b.name : '?'}</span>
          {seatColor && <span aria-hidden data-testid="town-seat-dot" style={{ width: 14, height: 14, borderRadius: '50%', background: seatColor, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)', flex: 'none' }} />}
        </div>
        {named && !open && isDest && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {view.destinationRooms.map(r => (
              <span key={r} data-testid={`town-room-${r}`} data-destination="true" style={{ fontSize: 16, fontWeight: 700, color: DEST, whiteSpace: 'nowrap' }}>
                → {labels[r] ?? r}
              </span>
            ))}
          </div>
        )}
        {named && open && b.rooms.length + b.altRooms.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
            {[...b.rooms, ...b.altRooms].map(r => {
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

/** How wide a player's pawn is drawn (board px): its face is 2.4 times the old 28 px face, and it stands about 4 times as tall. */
const PAWN_W = 84;

/** How wide a tree is drawn (px) at its starting size: the 64 px picture, enlarged. */
const TREE_PX = 96;

interface TreeData { tree: TownTree; src: string; size: number; turn?: TurnAnim; [key: string]: unknown }

/** A tree standing on the grass: only a picture, never in the way of the mouse. */
function TownTreeNode({ data }: NodeProps) {
  const d = data as unknown as TreeData;
  const ref = useRef<HTMLImageElement>(null);
  useTurn(ref, d.turn);
  return (
    <img
      ref={ref} src={d.src} alt="" draggable={false} data-testid={`town-tree-${d.tree.id}`}
      style={{ width: d.size, height: d.size, display: 'block', imageRendering: 'pixelated', pointerEvents: 'none', userSelect: 'none', transformOrigin: '0 0' }}
    />
  );
}

interface RimClockData { player: ClockPlayer; startIso: string; scale: number; current: boolean; turn?: TurnAnim; [key: string]: unknown }

/** A round town's clock: it rides on the rim with its player's side, and its words stay upright as the table turns. */
function TownRimClockNode({ data }: NodeProps) {
  const d = data as unknown as RimClockData;
  const ref = useRef<HTMLDivElement>(null);
  useTurn(ref, d.turn);
  return (
    <div ref={ref} data-testid="town-rim-clock" style={{ width: CLOCK_W * d.scale, height: CLOCK_H * d.scale, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', pointerEvents: 'none', transformOrigin: '0 0' }}>
      <FlipClock player={d.player} date={clockDate(d.startIso, d.player.timeSpent)} big={false} scale={d.scale} current={d.current} still={prefersReducedMotion()} />
    </div>
  );
}

const nodeTypes = { townGround: TownGround, townBuilding: TownBuildingNode, townTree: TownTreeNode, townWeather: TownWeatherNode, townProps: TownPropsNode, townRimClock: TownRimClockNode };

/** The pulse a move choice breathes with (pulseLook.ts): dim, bright, dim. Its peak comes from the element. */
const PULSE_CSS = `@keyframes uc-town-pulse { 0%, 100% { opacity: calc(var(--uc-pulse-peak) * 0.2); transform: scale(1); } 50% { opacity: var(--uc-pulse-peak); transform: scale(1.05); } }`;

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
      <PlayerPawn avatar={walk.avatar} color={walk.color} width={PAWN_W} title={walk.name} />
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
  /** Chime volume 0..1 from the town data (`bubble_sound_volume`); 0 = silent. */
  volume: number;
  /** The player's colour, shown as a dot when more than one player is in the game so a result can be told apart. */
  tag?: string;
}

/**
 * What one change of a player's numbers did, held back briefly (BUBBLE_SETTLE_MS) so the several changes
 * a single tap makes (the space left, the next space entered) become ONE bubble per kind instead of
 * one from each building (fb:5b8a060c).
 */
interface PendingResult {
  playerId: string;
  at: number;
  before: PlayerNumbers;
  after: PlayerNumbers;
  /** Their place in each race before and after (null = no race), for the trophy markers. */
  placesBefore: Record<TrophyId, number | null>;
  placesAfter: Record<TrophyId, number | null>;
  /** The building the player is in after this change. */
  space: string;
  /** How long after this change the player's walk ends (0 = no walk). */
  walkMs: number;
}

const BUBBLE_SETTLE_MS = 350;

const NO_PLACES: Record<TrophyId, number | null> = { time: null, money: null, quality: null };
const TROPHY_EMOJI: Record<TrophyId, string> = { time: '📅', quality: '📋', money: '💰' };

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
    // The chime goes with the bubble's first appearance (after the walk), so "something happened" is heard
    // as well as seen. This device's Sound switch can turn it off; it is silent until the page is tapped.
    const chime = window.setTimeout(() => { if (getSoundOn()) playResultChime(bubble.tone, bubble.volume); }, bubble.delayMs);
    return () => { anim?.cancel(); window.clearTimeout(done); window.clearTimeout(chime); };
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
      {bubble.tag && <span aria-hidden style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: bubble.tag, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', marginRight: 8, verticalAlign: 'middle' }} />}
      {bubble.kind === 'trophy' && bubble.trophy && <TrophyMark race={bubble.trophy} />}
      {bubble.text}
    </div>
  );
}

/** The trophy's picture (TROPHIES.csv) in a marker bubble; the emoji when the data names none or it will not load. */
function TrophyMark({ race }: { race: TrophyId }): JSX.Element {
  const [broken, setBroken] = useState(false);
  const icon = getTrophyRules().icons[race];
  return icon && !broken
    ? <img src={`/images/${icon}`} alt="" width={26} height={26} onError={() => setBroken(true)} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
    : <span aria-hidden style={{ marginRight: 6 }}>{TROPHY_EMOJI[race]}</span>;
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
  /** Which screen this is: the TV draws no view buttons, the remote strip folds them away. Default PC. */
  screen?: ViewPadScreen;
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

/** The town's shape for this game: fixed on the game when it started (townRound.ts newGameTownShape), the same on every screen. */
export function useTownShape(): 'round' | undefined {
  const { stateService } = useGameContext();
  return useSyncExternalStore(
    cb => stateService.subscribe(cb),
    () => stateService.getGameState().townShape,
    () => undefined,
  );
}

/** The town for this board, or null when TOWN.csv has no buildings. */
export function useTownLayout(seats = 1): TownLayout | null {
  const { dataService } = useGameContext();
  const labels = useTownLabels();
  const shape = useTownShape();
  return useMemo(() => {
    const rows = dataService.getTownRows?.() ?? [];
    if (rows.length === 0) return null;
    const spaces = dataService.getGameConfig()
      .map(c => c.space_name)
      .filter(s => s !== 'START-QUICK-PLAY-GUIDE');
    return buildTownLayout(rows, spaces, extractPrefix, s => labels[s] ?? s, seats, shape);
  }, [dataService, labels, seats, shape]);
}

type RoundLayout = TownLayout & { round: RoundTown };

function TownBoardInner({ currentPlayerId, players, centerOnCurrent = false, mode: modeProp, focusRequest, layout: baseLayout, screen = 'pc' }: TownBoardProps) {
  const { stateService, movementService, gameRulesService } = useGameContext();
  const { fitView, setCenter, getViewport } = useReactFlow();
  const mode: PanelMode = modeProp ?? getStoredPanelMode();
  const labels = useTownLabels();
  const { appearances } = useNpcPortrait();
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [startIso, setStartIso] = useState(() => clockStartIso(stateService.getGameState()));
  useEffect(() => {
    const sync = () => setStartIso(clockStartIso(stateService.getGameState()));
    sync();
    return stateService.subscribe(sync);
  }, [stateService]);
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
  const [pending, setPending] = useState<PendingResult[]>([]);
  // Scope as the panel shows it (summed from the player's work packages). The stored projectScope
  // field can read 0 for a moment at a turn change, which made a false "−$5.2M scope" bubble.
  const { dataService } = useGameContext();
  // new building or existing one, once a player has a scope (projectKind.ts): decides which construction site is theirs.
  const kindOf = useCallback((p: Player) => projectKindOf(p, dataService), [dataService]);
  // Who a player is to the town: their project kind and which seat they hold (each player has their own office, owner house and site).
  const whoOf = useCallback((p: Player): Who => ({ kind: kindOf(p), seat: players.findIndex(x => x.id === p.id) }), [kindOf, players]);

  // A round town (townRound.ts): the table turns the current player's side to the front, and the ring brings forward
  // the shared building they stand in. A new pose waits while anyone walks, so no walk is drawn across a turning town.
  const round = baseLayout.round;
  const currentIdx = players.findIndex(p => p.id === currentPlayerId);
  const currentSeat = Math.max(0, Math.min(currentIdx, Math.max(1, baseLayout.seats) - 1));
  const currentHere = currentIdx >= 0 ? buildingOfRoom(baseLayout, players[currentIdx].currentSpace, whoOf(players[currentIdx])) : undefined;
  const ringIndex = round && currentHere ? round.ring.indexOf(currentHere) : -1;
  const scene = useScene();
  // Motion off (this screen's Scene set to Calm or Off, or the device asks for less motion): the table turns at once.
  const moving = scene === 'full' && !prefersReducedMotion();
  const turnMs = round && moving ? scaleMs(round.turnMs) : 0;
  const [pose, setPose] = useState<{ now: RoundPose; key: number; dTable: number; dRing: number; ms: number }>(() => ({
    now: round ? nextPose(null, currentSeat, ringIndex, round, baseLayout.seats) : { table: 0, ring: 0 }, key: 0, dTable: 0, dRing: 0, ms: 0,
  }));
  const layout = useMemo(() => (round ? poseRoundTown(baseLayout as RoundLayout, pose.now) : baseLayout), [baseLayout, round, pose.now]);
  let walkStarted = false;
  const numbersOf = (p: Player): PlayerNumbers => ({ money: p.money ?? 0, days: p.timeSpent ?? 0, scope: gameRulesService.calculateProjectScope(p.id) });
  const placesNow = (): ((id: string) => Record<TrophyId, number | null>) => {
    try { const board = gameRulesService.computeLiveBoard(); return (id) => racePlaces(board, id); } catch { return () => NO_PLACES; }
  };
  const [seen, setSeen] = useState<{ players: Player[]; spaces: Map<string, string> | null; numbers: Map<string, PlayerNumbers> | null; places: Map<string, Record<TrophyId, number | null>> | null; n: number }>({ players: [], spaces: null, numbers: null, places: null, n: 0 });
  if (seen.players !== players) {
    const before = seen.spaces;
    const beforeNumbers = seen.numbers;
    const beforePlaces = seen.places;
    const placesOf = placesNow();
    setSeen({ players, spaces: new Map(players.map(p => [p.id, p.currentSpace])), numbers: new Map(players.map(p => [p.id, numbersOf(p)])), places: new Map(players.map(p => [p.id, placesOf(p.id)])), n: seen.n + 1 });
    if (before && !prefersReducedMotion()) {
      const times = walkTimes(layout.settings);
      const fast = getGameSpeed() === 'fast';
      const started: Walk[] = [];
      for (const p of players) {
        const was = before.get(p.id);
        if (!was || was === p.currentSpace) continue;
        const from = buildingOfRoom(layout, was, whoOf(p));
        const to = buildingOfRoom(layout, p.currentSpace, whoOf(p));
        if (!from || !to) continue;
        const hop = from === to;
        const target = layout.buildings.find(x => x.id === to)!;
        const route = hop ? [{ col: target.col + target.width / 2, row: target.row + target.depth / 2 }] : layout.round ? roundWalkPath(layout as RoundLayout, from, to) : walkPath(layout, from, to);
        const ms = hop ? times.hopMs : fast ? times.fastMs : times.walkMs;
        if (route.length === 0 || ms <= 0) continue;
        started.push({
          key: seen.n * 100 + started.length, playerId: p.id, name: p.name, avatar: p.avatar, color: p.color, ms,
          points: route.map(g => isoPoint(g.col, g.row, 0, TOWN_TILE)),
        });
      }
      if (started.length) {
        walkStarted = true;
        setWalks(w => [...w.filter(x => !started.some(s => s.playerId === x.playerId)), ...started]);
      }
    }
    // Results float up from the building the player is in (after their walk, if they walked).
    if (beforeNumbers) {
      const still = prefersReducedMotion();
      // The moment this change was seen, stamped once for every player's pending result. Reading the clock here is
      // deliberate: this block runs once per NEW players list (the "adjust state while rendering" pattern), not on every render.
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      const held: PendingResult[] = [];
      for (const p of players) {
        const was = beforeNumbers.get(p.id);
        if (!was) continue;
        const nowNumbers = numbersOf(p);
        const moved = before?.get(p.id) !== undefined && before?.get(p.id) !== p.currentSpace && !still;
        const placesWas = beforePlaces?.get(p.id) ?? NO_PLACES;
        const placesIs = placesOf(p.id);
        // The player's own numbers (or square) changed: that is their Commit or Negotiate. Someone else's move that
        // only shifts this player's place says nothing here.
        if (resultBubbles(was, nowNumbers).length === 0 && !moved) continue;
        // A change that arrives together with a move is the work done at the space the player LEFT (the
        // architect's days are charged when they end their turn there, then they walk to the office), so the
        // result floats up from that building, not from the one they just reached (fb:f0de9095, 2026-10-19).
        held.push({ playerId: p.id, at: now, before: was, after: nowNumbers, placesBefore: placesWas, placesAfter: placesIs, space: moved ? before!.get(p.id)! : p.currentSpace, walkMs: 0 });
      }
      if (held.length) setPending(ps => [...ps, ...held]);
    }
  }
  // The table turns once nobody is walking (a walk that started in this very render counts as walking).
  if (round && walks.length === 0 && !walkStarted) {
    const next = nextPose(pose.now, currentSeat, ringIndex, round, baseLayout.seats);
    if (Math.abs(next.table - pose.now.table) > 0.01 || Math.abs(next.ring - pose.now.ring) > 0.01) {
      setPose({ now: next, key: pose.key + 1, dTable: next.table - pose.now.table, dRing: next.ring - pose.now.ring, ms: turnMs });
    }
  }
  // One tap can change a player's numbers several times in a row (the space they leave, the one they
  // enter). Wait a moment, then make ONE bubble per kind per player from the building they ended in.
  const bubbleKey = useRef(0);
  useEffect(() => {
    if (pending.length === 0) return;
    const timer = window.setTimeout(() => {
      const batch = pending;
      setPending([]);
      const baseMs = parseFloat(layout.settings.bubble_ms ?? '') || DEFAULT_BUBBLE_MS;
      const ms = getGameSpeed() === 'fast' ? baseMs / 2 : baseMs;
      const still = prefersReducedMotion();
      const made: Bubble[] = [];
      for (const pid of new Set(batch.map(x => x.playerId))) {
        const player = players.find(p => p.id === pid);
        const mineAll = batch.filter(x => x.playerId === pid);
        // One bubble per kind per BUILDING: work done at the space left and at the space entered each rise
        // from their own building (merged only when both are the same building).
        const bySpace = new Map<string, PendingResult[]>();
        for (const x of mineAll) bySpace.set(x.space, [...(bySpace.get(x.space) ?? []), x]);
        let order = 0;
        // The place markers are worked out once for the whole change (first 'before' to last 'after') and ride
        // with the building the player ended in.
        const markers = trophyBubbles(mineAll[0].placesBefore, mineAll[mineAll.length - 1].placesAfter);
        const lastSpace = mineAll[mineAll.length - 1].space;
        for (const [space, mine] of bySpace) {
          const list = [...mergedResultBubbles(mine), ...(space === lastSpace ? markers : [])];
          const bid = buildingOfRoom(layout, space, player ? whoOf(player) : undefined);
          const b = bid ? layout.buildings.find(x => x.id === bid) : undefined;
          if (!b || list.length === 0) continue;
          const walkWait = Math.max(0, ...mine.map(x => x.walkMs - (Date.now() - x.at)));
          list.forEach((r, i) => made.push({
            ...r, key: ++bubbleKey.current, playerId: pid,
            // Rises from the top of the building's sign, stacked so two results never sit on each other.
            buildingId: b.id, index: i,
            delayMs: walkWait + (order + i) * 250, ms, still, volume: bubbleVolume(layout.settings),
            tag: players.length > 1 ? player?.color : undefined,
          }));
          order += list.length;
        }
      }
      if (made.length) setBubbles(bs => [...bs, ...made]);
    }, BUBBLE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [pending, layout, players, whoOf]);
  const endBubble = useCallback((key: number) => setBubbles(bs => bs.filter(x => x.key !== key)), []);
  const endWalk = useCallback((key: number) => setWalks(w => w.filter(x => x.key !== key)), []);
  // Tell the rest of this screen a walk is on, so arriving pop-ups wait for it (boardStyle.ts).
  useEffect(() => {
    setTownWalking(walks.length > 0);
  }, [walks.length]);
  useEffect(() => () => setTownWalking(false), []);
  const walking = useMemo(() => new Set(walks.map(w => w.playerId)), [walks]);

  const currentWho = useMemo(() => { const c = players.find(p => p.id === currentPlayerId); return c ? whoOf(c) : undefined; }, [players, currentPlayerId, whoOf]);

  // A walking player shows on the street, not yet in the building they are walking to.
  const views = useMemo(
    () => buildingViews(
      layout,
      players.filter(p => !walking.has(p.id)).map(p => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, currentSpace: p.currentSpace, projectKind: whoOf(p).kind, seat: whoOf(p).seat })),
      currentPlayerId,
      validMoves,
      currentWho,
    ),
    [layout, players, walking, currentPlayerId, validMoves, whoOf, currentWho],
  );

  const portraitFor = useCallback((icon: string): string | null => portraitSrc(icon, appearances), [appearances]);

  // Names are earned (fb:aec545c4): the buildings all stand from the start; a name shows once a player has been in
  // the building or is offered a move into it, or by the town list's own rule ('shown' / 'scope').
  const scopeKinds = useMemo(
    () => players.flatMap(p => { const w = whoOf(p); return w.kind && gameRulesService.calculateProjectScope(p.id) > 0 ? [{ kind: w.kind, seat: w.seat }] : []; }),
    [players, whoOf, gameRulesService],
  );
  const named = useMemo(() => revealedBuildings(layout, {
    visited: players.flatMap(p => [...(p.visitedSpaces ?? []), p.currentSpace].map(space => ({ space, ...whoOf(p) }))),
    offered: { spaces: validMoves, ...currentWho },
    scopeKinds,
  }), [layout, players, validMoves, whoOf, currentWho, scopeKinds]);
  const faded = useMemo(() => fadedBuildings(layout, scopeKinds), [layout, scopeKinds]);

  // Each player's band shows the look of the month their own days have reached; ground of a player who has finished or
  // gone out goes to the nearest player still playing (townAreas.ts). Keyed on the few things that change it.
  const areaKey = JSON.stringify([players.map(p => [p.color, clockMonth(startIso, p.timeSpent ?? 0), hasLeftBoard(p)]), startIso, mode, layout.seats, round ? currentSeat : -1]);
  const areas = useMemo<GroundAreas>(() => {
    const seats = Math.max(1, layout.seats);
    const at = (i: number) => players[i] ?? players[0];
    return {
      segments: areaSegments(layout, Array.from({ length: seats }, (_, i) => !!at(i) && hasLeftBoard(at(i)))),
      looks: Array.from({ length: seats }, (_, i) => seasonLook(clockMonth(startIso, at(i)?.timeSpent ?? 0), mode)),
      colors: Array.from({ length: seats }, (_, i) => at(i)?.color ?? '#475569'),
      wedges: round ? roundWedges(round, Array.from({ length: seats }, (_, i) => !!at(i) && hasLeftBoard(at(i)))) : undefined,
      middleSeat: round ? currentSeat : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey, layout]);
  // Scenery spots are worked out once per town (a round town turns, and draws no small scenery yet).
  const freeTest = useMemo(() => makeFreeTest(baseLayout), [baseLayout]);
  const spots = useMemo(() => freeSpots(baseLayout), [baseLayout]);
  const waterColor = (areas.looks[round ? currentSeat : areas.segments[0]?.seat ?? 0] ?? seasonLook(1, mode)).water;
  const pulseLook = useMemo(() => (round ? { ...pulseLookOf(layout.settings), still: !moving } : undefined), [round, layout.settings, moving]);

  const nodes = useMemo(() => {
    const out: Node[] = [];
    const { minCol, minRow, maxCol, maxRow } = layout.bounds;
    // A round island is an oval on screen: its box is the oval's, not the far bigger diamond round it (the camera fits the box).
    const oval = round ? { c: isoPoint(round.cc, round.cr, 0, TOWN_TILE), rx: (round.islandRadius + 0.5) * Math.SQRT2 * TOWN_TILE, ry: ((round.islandRadius + 0.5) * TOWN_TILE) / Math.SQRT2 } : null;
    const corners = oval ? [
      { x: oval.c.x - oval.rx, y: oval.c.y - oval.ry }, { x: oval.c.x + oval.rx, y: oval.c.y + oval.ry },
    ] : [
      isoPoint(minCol - 1, minRow - 1, 0, TOWN_TILE), isoPoint(maxCol + 1, minRow - 1, 0, TOWN_TILE),
      isoPoint(maxCol + 1, maxRow + 1, 0, TOWN_TILE), isoPoint(minCol - 1, maxRow + 1, 0, TOWN_TILE),
    ];
    const gx = Math.min(...corners.map(c => c.x)), gy = Math.min(...corners.map(c => c.y));
    const gw = Math.max(...corners.map(c => c.x)) - gx, gh = Math.max(...corners.map(c => c.y)) - gy;
    // One turn of the table (round town): each node slides from its old place round the middle to its new one.
    const mid = round ? isoPoint(round.cc, round.cr, 0, TOWN_TILE) : { x: 0, y: 0 };
    const turnOf = (inRing: boolean, ax: number, ay: number, spin = false): TurnAnim | undefined => {
      const d = inRing ? pose.dRing : pose.dTable;
      return round && pose.key > 0 && pose.ms > 0 && Math.abs(d) > 0.01 ? { key: pose.key, deg: d, rx: mid.x - ax, ry: mid.y - ay, ms: pose.ms, spin } : undefined;
    };
    out.push({
      id: 'town-ground', type: 'townGround', position: { x: gx, y: gy }, zIndex: 0, style: { pointerEvents: 'none' },
      draggable: false, selectable: false, focusable: false,
      data: { w: gw, h: gh, ox: gx, oy: gy, layout, mode, areas, round, table: pose.now.table, turn: turnOf(false, gx, gy, true) } satisfies GroundData,
    });
    // Weather: one layer just above the ground and under every building (so it never covers a sign, a clock or a marker).
    // Only the band of the player whose turn it is moves; the others show still hints. (Not on a round town yet.)
    if (!round) {
    const activeIdx = currentPlayerId ? players.findIndex(p => p.id === currentPlayerId) : -1;
    const activeSeat = activeIdx >= 0 && !hasLeftBoard(players[activeIdx]) ? Math.min(activeIdx, Math.max(1, layout.seats) - 1) : -1;
    out.push({
      id: 'town-weather', type: 'townWeather', position: { x: gx, y: gy }, zIndex: 5, style: { pointerEvents: 'none' },
      draggable: false, selectable: false, focusable: false,
      data: {
        w: gw, h: gh, mode,
        bands: buildWeatherBands({
          layout, segments: areas.segments, looks: areas.looks, days: Array.from({ length: Math.max(1, layout.seats) }, (_, i) => (players[i] ?? players[0])?.timeSpent ?? 0),
          seed: startIso, activeSeat, level: scene, light: screen !== 'pc', reducedMotion: prefersReducedMotion(), tile: TOWN_TILE, originX: gx, originY: gy,
        }),
      } satisfies WeatherData,
    });
    // Small scenery on the free grass (flowers, grass, leaves, drifts), under every building.
    const scenery = buildTownProps({
      layout, spots, free: freeTest, segments: areas.segments, looks: areas.looks,
      days: Array.from({ length: Math.max(1, layout.seats) }, (_, i) => (players[i] ?? players[0])?.timeSpent ?? 0),
      seed: startIso, level: scene, light: screen !== 'pc', tile: TOWN_TILE, originX: gx, originY: gy,
    });
    out.push({
      id: 'town-props', type: 'townProps', position: { x: gx, y: gy }, zIndex: 6, style: { pointerEvents: 'none' },
      draggable: false, selectable: false, focusable: false,
      data: { w: gw, h: gh, fade: scene === 'full' && !prefersReducedMotion(), items: scenery.map(p => ({ prop: p, ...propPoint(p, TOWN_TILE, gx, gy) })) } satisfies PropsData,
    });
    }
    // A round town's move choices pulse; the one picked stays lit and the others dim (pulseLook.ts).
    const intent = currentIdx >= 0 ? players[currentIdx].moveIntent : undefined;
    const chosen = round && intent && validMoves.includes(intent) ? buildingOfRoom(layout, intent, currentWho) : undefined;
    for (const b of layout.buildings) {
      const box = buildingBox(b, TOWN_TILE);
      const view = views.get(b.id)!;
      const open = expanded === b.id || hovered === b.id || (centerOnCurrent && view.isCurrent);
      // Pawns stand on the sign: their room counts as part of the building, so the camera keeps them
      // in view (under the row of clocks, too).
      const pawnRoom = view.playersHere.length > 0 ? pawnHeight(PAWN_W) : 0;
      const signScale = round ? round.signScale : 1;
      const ox = box.x, oy = box.y - (SIGN_SPACE + pawnRoom) * signScale;
      const anchor = isoPoint(b.col + b.width / 2, b.row + b.depth / 2, 0, TOWN_TILE);
      const inRing = !!(round && (round.places.get(b.id) ?? round.places.get(round.rides.get(b.id)?.on ?? ''))?.ring);
      // The buildings the data paints in their player's colour (a round town's owner's house and office).
      const painted = round && b.seat !== undefined && round.playerColor.has(b.id.split('@')[0]) ? { ...b, color: players[b.seat]?.color ?? b.color } : b;
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
          building: painted, view, open, ox, oy, w: box.w, h: box.h + (SIGN_SPACE + pawnRoom) * signScale, signScale,
          turn: turnOf(inRing, anchor.x, anchor.y), pulseLook,
          pulse: round && view.destinationRooms.length > 0 ? (chosen ? (chosen === b.id ? 'chosen' : 'rest') : 'choose') : undefined,
          roofX: box.roofX, roofY: box.roofY, labels, portrait: portraitFor(b.icon), named: named.has(b.id), faded: faded.has(b.id), seatColor: layout.seats > 1 && b.seat !== undefined ? players[b.seat]?.color : undefined, mode,
          bubbles: bubbles.filter(x => x.buildingId === b.id), onBubbleDone: endBubble,
        } satisfies BuildingData,
      });
    }
    // Trees: the picture follows the month of whoever owns the ground under it now; the size follows the most days its home
    // player or its current owner has spent (they only ever count up, so a tree never shrinks).
    const seats = Math.max(1, layout.seats);
    const peakOf = (seat: number) => { const p = players[seat] ?? players[0]; return Math.max(p?.peakDays ?? 0, p?.timeSpent ?? 0); };
    for (const t of layout.trees) {
      const placed = round?.trees.find(x => x.id === t.id);
      const owner = placed ? (placed.park ? areas.middleSeat ?? 0 : ownerOfAngle(areas.wedges ?? [], placed.angle)) : ownerOfRow(areas.segments, t.row);
      const size = Math.round(TREE_PX * treeScale(Math.max(peakOf(Math.min(t.seat, seats - 1)), peakOf(owner))));
      const base = isoPoint(t.col, t.row, 0, TOWN_TILE);
      out.push({
        id: t.id, type: 'townTree', position: { x: base.x - size / 2, y: base.y - size * 0.94 },
        zIndex: 10 + Math.round((t.col + t.row) * 10), draggable: false, selectable: false, focusable: false,
        style: { pointerEvents: 'none' },
        data: { tree: t, src: treePicture(t, areas.looks[owner]?.tree ?? 'summer'), size, turn: turnOf(false, base.x, base.y) } satisfies TreeData,
      });
    }
    // A round town's clocks ride on the rim, each with its player's side (in place of the row along the top).
    if (round) {
      const allGone = players.every(hasLeftBoard);
      for (let seat = 0; seat < seats; seat++) {
        const p = players[seat];
        if (!p || (!allGone && hasLeftBoard(p))) continue;
        const q = roundPoint(round, seatAngle(seat, seats) + pose.now.table, round.clockRadius);
        const a = isoPoint(q.col, q.row, 0, TOWN_TILE);
        const cw = CLOCK_W * round.clockScale, ch = CLOCK_H * round.clockScale;
        out.push({
          id: `town-rim-clock-${p.id}`, type: 'townRimClock', position: { x: a.x - cw / 2, y: a.y - ch / 2 }, zIndex: 1800,
          draggable: false, selectable: false, focusable: false, style: { pointerEvents: 'none' },
          data: { player: { id: p.id, name: p.name, color: p.color, timeSpent: p.timeSpent ?? 0 }, startIso, scale: round.clockScale, current: p.id === currentPlayerId, turn: turnOf(false, a.x, a.y) } satisfies RimClockData,
        });
      }
    }
    return out;
  }, [layout, views, expanded, hovered, centerOnCurrent, labels, portraitFor, named, faded, players, mode, bubbles, endBubble, areas, scene, startIso, currentPlayerId, screen, spots, freeTest, round, pose, pulseLook, validMoves, currentWho, currentIdx]);

  // Follow the current player (TV, remote): first frame their building and its next moves, then
  // only glide at the zoom the viewer has, the same steady camera the classic board keeps.
  const current = currentPlayerId ? players.find(p => p.id === currentPlayerId) : undefined;
  const currentBuilding = current ? buildingOfRoom(layout, current.currentSpace, currentWho) : undefined;
  const destBuildings = useMemo(
    () => [...new Set(validMoves.map(m => buildingOfRoom(layout, m, currentWho)).filter((x): x is string => !!x))],
    [validMoves, layout, currentWho],
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
  // A round town never follows anyone: the table turns instead, under a camera that shows the whole town.
  const follow = centerOnCurrent && !round;
  useEffect(() => {
    if (follow || sizeTick === 0) return;
    try { fitView({ padding: round ? ROUND_FIT_PADDING : FIT_PADDING, duration: 0 }); } catch { /* not measured yet */ }
  }, [sizeTick, follow, fitView, round]);
  useEffect(() => {
    if (!follow || !currentBuilding) return;
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
          // Leave room under the row of clocks along the top (a TV), as well as the usual margin all round.
          const box = wrapperRef.current;
          const clockRoom = box ? rowHeightPx(players.filter(p => !hasLeftBoard(p)).length || players.length, box.clientWidth, box.clientHeight, screen) : 0;
          const top = `${Math.round(Math.max(clockRoom + 8, 0.3 * (box?.clientHeight ?? 0)))}px` as `${number}px`;
          fitView({ nodes: ids.map(id => ({ id })), padding: { top, right: '30%', bottom: '30%', left: '30%' }, duration: scaleMs(350), maxZoom: 1.3, minZoom: FOLLOW_MIN_ZOOM });
          framed.current = true;
        } catch { /* nodes not measured yet; the next change retries */ }
        return;
      }
      const bb = getNodesBounds(focus);
      setCenter(bb.x + bb.width / 2, bb.y + bb.height / 2, { zoom: getViewport().zoom, duration: scaleMs(350) });
    }, 100);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, currentBuilding, destBuildings, nodes, fitView, setCenter, getViewport, sizeTick, walks]);

  // Self-heal (fb:a6474bad): a following screen (TV, remote) whose camera has lost the town, or that
  // comes back from being hidden, frames the current player's building again. Checked every 3 s.
  useEffect(() => {
    if (!centerOnCurrent) return;
    const reframe = () => { framed.current = false; setSizeTick(n => n + 1); };
    const check = () => {
      const el = wrapperRef.current;
      if (!el || document.visibilityState === 'hidden') return;
      const boxes = nodes.filter(n => n.type === 'townBuilding').map(n => {
        const b = getNodesBounds([n]);
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      });
      if (cameraSeesNothing(getViewport(), boxes, { width: el.clientWidth, height: el.clientHeight })) reframe();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') reframe(); };
    const timer = window.setInterval(check, 3000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [centerOnCurrent, nodes, getViewport]);

  // For bug reports (feedbackDiagnostics.ts): why the camera is where it is (fb:a6474bad, a blank TV board).
  useEffect(() => registerDiagnostic('town', () => ({
    centerOnCurrent, currentBuilding, destBuildings, walks: walks.length, sizeTick, framed: framed.current,
    nodeCount: nodes.length, camera: getViewport(), round: !!round, pose: round ? pose.now : undefined,
  })), [centerOnCurrent, currentBuilding, destBuildings, walks, sizeTick, nodes, getViewport, round, pose]);

  // A jump asked for by the game log (PC): glide to that square's building at the current zoom.
  useEffect(() => {
    if (!focusRequest) return;
    const bid = buildingOfRoom(layout, focusRequest.spaceId, currentWho);
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

  return (
    <div ref={wrapperRef} data-testid="town-board" style={{ width: '100%', height: '100%', position: 'relative', background: waterColor }}>
      {/* v3.8.59: the React Flow credit link was #999 (2.2:1); same link, darker. Its own panel is a pale veil in both modes. */}
      <style>{'.react-flow .react-flow__attribution a { color: #4b5563; }'}</style>
      {round && <style>{PULSE_CSS}</style>}
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
        fitViewOptions={{ padding: round ? ROUND_FIT_PADDING : FIT_PADDING }}
        minZoom={0.2}
        maxZoom={2}
        colorMode={mode}
        style={{ backgroundColor: waterColor }}
      >
        <TownViewPad screen={screen} dark={mode === 'dark'} />
        {!round && <TownClocks players={players.map(p => ({ id: p.id, name: p.name, color: p.color, timeSpent: p.timeSpent ?? 0, gone: hasLeftBoard(p) }))} currentPlayerId={currentPlayerId} startIso={startIso} screen={screen} />}
        <ViewportPortal>
          {walks.map(w => <Walker key={w.key} walk={w} onDone={endWalk} />)}
        </ViewportPortal>
      </ReactFlow>
      <SoundHint volume={bubbleVolume(layout.settings)} />
    </div>
  );
}

/**
 * Browsers keep a page silent until someone taps or presses a key on it. Every screen that shows the
 * town unlocks sound on its first tap or key press (an OK on a TV remote counts). A TV has no tap
 * gate and nobody expects to touch it, so there a small note says so until then; the first press turns
 * sound on and the note goes away. The note shows only when sound is on and the data gives the chimes
 * a volume.
 */
function SoundHint({ volume }: { volume: number }) {
  const isTv = new URLSearchParams(window.location.search).get('mode') === 'tv';
  const [locked, setLocked] = useState(() => !isAudioReady());
  useEffect(() => {
    if (!locked) return undefined;
    const unlock = () => { primeAudio(); setLocked(false); };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, unlock, { once: true }));
    return () => events.forEach(e => window.removeEventListener(e, unlock));
  }, [locked]);
  if (!isTv || !locked || !(volume > 0) || !getSoundOn()) return null;
  return (
    <div
      data-testid="sound-hint"
      style={{
        position: 'absolute', left: 8, bottom: 8, zIndex: 4000, pointerEvents: 'none',
        background: 'rgba(15,23,42,0.85)', color: '#f1f5f9', borderRadius: 999, padding: '4px 12px',
        fontSize: 14, fontWeight: 600, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      🔇 Press OK once to turn the sound on
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
