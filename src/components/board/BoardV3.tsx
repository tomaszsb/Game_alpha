// src/components/board/BoardV3.tsx
//
// Data-driven board with SVG arrow routing — replaces ProgressBarMap.
// Ported from board_v3_prototype.html.

import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useGameContext } from '../../context/GameContext';
import { Player } from '../../types/DataTypes';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import {
  BOARD, PHASE_COLORS, PathSegment, ForkBranch, BranchItem, Edge, Point,
  ConfigRow, MovementRow, DiceRow,
  shortName, truncate, flattenBranchNodes, branchFamily,
  buildGamePathFromData, buildEdges, buildDataMaps, getAllSpaceNames,
  splitRows, smoothPath, phaseColor, phaseOf,
} from '../../utils/boardLayout';
import './BoardV3.css';

// ===================================================================
// PHASE GROUP SKIP — these phases don't get group headers on the board
// ===================================================================
const PHASE_GROUP_SKIP = new Set(['SETUP', 'OWNER', 'FUNDING']);

// ===================================================================
// COMPONENT
// ===================================================================
interface BoardV3Props {
  currentPlayerId: string | null;
  players: Player[];
}

export function BoardV3({ currentPlayerId, players }: BoardV3Props) {
  const { dataService, stateService, movementService } = useGameContext();

  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Data-driven path building (memoized — CSV data never changes) ----
  const boardData = useMemo(() => {
    const configRows: ConfigRow[] = dataService.getGameConfig().map(gc => ({
      space_name: gc.space_name,
      phase: gc.phase,
      path_type: gc.path_type,
      is_starting_space: gc.is_starting_space ? 'Yes' : 'No',
    }));
    const movementRows: MovementRow[] = dataService.getAllMovements().map(m => ({
      space_name: m.space_name,
      visit_type: m.visit_type,
      movement_type: m.movement_type,
      destination_1: m.destination_1 || '',
      destination_2: m.destination_2 || '',
      destination_3: m.destination_3 || '',
      destination_4: m.destination_4 || '',
      destination_5: m.destination_5 || '',
    }));
    const diceRows: DiceRow[] = dataService.getAllDiceOutcomes().map(d => ({
      space_name: d.space_name,
      visit_type: d.visit_type,
      roll_1: d.roll_1 || '',
      roll_2: d.roll_2 || '',
      roll_3: d.roll_3 || '',
      roll_4: d.roll_4 || '',
      roll_5: d.roll_5 || '',
      roll_6: d.roll_6 || '',
    }));

    const { path: gamePath, getMovement, getDiceReachable } = buildGamePathFromData(movementRows, configRows, diceRows);
    const edges = buildEdges(gamePath);
    const { phaseMap } = buildDataMaps(configRows, movementRows, diceRows);
    const allSpaces = getAllSpaceNames(gamePath);

    // Detect convergence nodes
    const convergenceNodes = new Set<string>();
    for (const seg of gamePath) {
      if (seg.type === 'fork') {
        for (const br of seg.branches) {
          for (const item of br.nodes) {
            if (typeof item !== 'string' && item.type === 'convergence') {
              convergenceNodes.add(item.name);
            }
          }
        }
      }
    }

    // Add cross-branch convergence edges from game data
    for (const conv of convergenceNodes) {
      for (const name of allSpaces) {
        if (name === conv) continue;
        const mov = getMovement(name);
        const diceReach = getDiceReachable(name);
        if (mov.destinations.includes(conv) || diceReach.includes(conv)) {
          if (!edges.some(e => e[0] === name && e[1] === conv)) {
            edges.push([name, conv]);
          }
        }
      }
    }

    return { gamePath, edges, phaseMap, allSpaces, convergenceNodes };
  }, [dataService]);

  // ---- Container resize ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // ---- Valid moves subscription ----
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

  // ---- Row splitting ----
  const rows = useMemo(() => {
    const cw = containerWidth - 56;
    return splitRows(boardData.gamePath, cw);
  }, [boardData.gamePath, containerWidth]);

  // ---- Interaction handlers ----
  const handleMouseEnter = useCallback((name: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredSpace(name), 150);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredSpace(null);
  }, []);
  const handleClick = useCallback((name: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredSpace(null);
    setExpandedSpace(prev => prev === name ? null : name);
  }, []);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  // ---- Player helpers ----
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const getPlayersOnSpace = useCallback((n: string) => players.filter(p => p.currentSpace === n), [players]);
  const isVisited = useCallback((n: string) => currentPlayer?.visitedSpaces?.includes(n) ?? false, [currentPlayer]);

  // ---- Rendering helpers ----
  const getAccentColor = useCallback((spaceName: string) => {
    const npcPrefix = extractPrefix(spaceName);
    const npcInfo = CHARACTER_MAP[npcPrefix];
    return npcInfo?.color ?? PHASE_COLORS[boardData.phaseMap[spaceName]]?.border ?? '#adb5bd';
  }, [boardData.phaseMap]);

  const getContent = useCallback((spaceName: string) => {
    const visited = isVisited(spaceName);
    const visitType = visited ? 'Subsequent' as const : 'First' as const;
    return dataService.getSpaceContent(spaceName, visitType);
  }, [dataService, isVisited]);

  const renderAvatars = (playersHere: Player[]) => {
    if (playersHere.length === 0) return null;
    return (
      <div className="pbm-node-avatars">
        {playersHere.slice(0, 3).map(p => (
          <div key={p.id} className="pbm-node-avatar"
            style={{ background: p.color || '#007bff' }} title={p.name}>
            {p.avatar || p.name.charAt(0)}
          </div>
        ))}
      </div>
    );
  };

  const renderTile = (spaceName: string) => {
    const isCurrent = currentPlayer?.currentSpace === spaceName;
    const isExp = expandedSpace === spaceName;
    const isHov = hoveredSpace === spaceName && !isCurrent && !isExp;
    const isValid = validMoves.includes(spaceName);
    const visited = isVisited(spaceName);
    const accentColor = getAccentColor(spaceName);
    const playersHere = getPlayersOnSpace(spaceName);
    const content = getContent(spaceName);

    if (isCurrent || isExp || isHov) {
      const cardCls = isCurrent ? 'pbm-card--current' : isExp ? 'pbm-card--expanded' : 'pbm-card--hover';
      const nameCls = isCurrent ? ' pbm-card-name--current' : '';
      const storyMax = isHov ? 60 : 100;
      const npcPrefix = extractPrefix(spaceName);
      const npcName = CHARACTER_MAP[npcPrefix]?.name;

      return (
        <div className={`pbm-card ${cardCls}${isValid ? ' pbm-card--valid-move' : ''}`}
          style={{ borderLeftColor: accentColor }}>
          <div className={`pbm-card-name${nameCls}`}>{shortName(spaceName)}</div>
          {content?.story && (
            <div className="pbm-card-story">
              {npcName && <strong>{npcName}: </strong>}{truncate(content.story, storyMax)}
            </div>
          )}
          {!isHov && content?.action_description && (
            <div className="pbm-card-action">
              <strong>Action:</strong> {truncate(content.action_description, 80)}
            </div>
          )}
          {renderAvatars(playersHere)}
        </div>
      );
    }

    const nodeClass = [
      'pbm-node',
      isValid && 'pbm-node--valid-move',
      !isValid && visited && 'pbm-node--visited',
      playersHere.length > 0 && 'pbm-node--has-players',
    ].filter(Boolean).join(' ');

    return (
      <div className={nodeClass}
        style={{ borderLeft: `3px solid ${accentColor}` }}
        title={spaceName}>
        <span>{shortName(spaceName)}</span>
        {renderAvatars(playersHere)}
      </div>
    );
  };

  const renderSlot = (spaceName: string, extraStyle?: React.CSSProperties) => (
    <div key={spaceName} className="pbm-slot" data-space={spaceName}
      style={extraStyle}
      onMouseEnter={() => handleMouseEnter(spaceName)}
      onMouseLeave={handleMouseLeave}
      onClick={() => handleClick(spaceName)}>
      {renderTile(spaceName)}
    </div>
  );

  const renderFork = (seg: Extract<PathSegment, { type: 'fork' }>, segIdx: number) => {
    const branchVisited = seg.branches.map(br =>
      flattenBranchNodes(br.nodes).some(n => isVisited(n))
    );
    const anyVisited = branchVisited.some(Boolean);

    return (
      <div key={`fork-${segIdx}`} className="pbm-fork">
        {seg.branches.map((br, bi) => {
          const dimmed = anyVisited && !branchVisited[bi];
          return (
            <div key={bi} className={`pbm-fork-branch${dimmed ? ' pbm-fork-branch--dimmed' : ''}`}>
              {br.nodes.map((item, ni) => {
                if (typeof item === 'string') {
                  return renderSlot(item, { padding: '2px 4px' });
                } else if (item.type === 'convergence') {
                  return renderSlot(item.name, { padding: '2px 4px 2px 50px' });
                } else if (item.type === 'mini-fork') {
                  return (
                    <div key={`mf-${ni}`} className="pbm-mini-fork">
                      {item.branches.map((sub, si) => (
                        <div key={si} className="pbm-mini-fork-sub">
                          {sub.map(node => renderSlot(node, { padding: '2px 4px' }))}
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderLegs = (seg: Extract<PathSegment, { type: 'legs' }>, segIdx: number) => {
    const allChildren = [...seg.children];
    const aboveCount = Math.ceil(allChildren.length / 2);
    const aboveChildren = allChildren.slice(0, aboveCount);
    const belowChildren = allChildren.slice(aboveCount);

    return (
      <div key={`legs-${segIdx}`} className="pbm-legs-stack">
        {aboveChildren.map(child => renderSlot(child))}
        {renderSlot(seg.parent)}
        {belowChildren.map(child => renderSlot(child))}
      </div>
    );
  };

  // ---- SVG Arrow Drawing (imperative, runs after render) ----
  useLayoutEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        drawArrows();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  });

  function drawArrows() {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const cRect = container.getBoundingClientRect();
    const containerW = container.scrollWidth;

    svg.setAttribute('width', String(containerW));
    svg.setAttribute('height', String(container.scrollHeight));
    svg.style.width = containerW + 'px';
    svg.style.height = container.scrollHeight + 'px';

    // ---- Measure tile positions ----
    const rects: Record<string, { left: number; right: number; top: number; bottom: number; cx: number; cy: number }> = {};
    container.querySelectorAll('[data-space]').forEach(el => {
      const htmlEl = el as HTMLElement;
      const node = htmlEl.querySelector('.pbm-node');
      const card = htmlEl.querySelector('.pbm-card');
      const tile = (node || card) as HTMLElement | null;
      if (!tile) return;
      const b = tile.getBoundingClientRect();
      const sl = container.scrollLeft, st = container.scrollTop;
      const r = {
        left: b.left - cRect.left + sl,
        right: b.right - cRect.left + sl,
        top: b.top - cRect.top + st,
        bottom: b.bottom - cRect.top + st,
        cx: (b.left + b.right) / 2 - cRect.left + sl,
        cy: (b.top + b.bottom) / 2 - cRect.top + st,
      };
      if (card && !node) {
        r.cx = (r.left + r.right) / 2;
      }
      rects[htmlEl.dataset.space!] = r;
    });

    const { gamePath, edges: EDGES, convergenceNodes: CONVERGENCE_NODES } = boardData;

    // ---- Build row map ----
    const tileRowMap: Record<string, number> = {};
    for (let ri = 0; ri < rows.length; ri++) {
      for (const seg of rows[ri]) {
        if (seg.type === 'node') tileRowMap[seg.name] = ri;
        else if (seg.type === 'legs') {
          tileRowMap[seg.parent] = ri;
          for (const c of seg.children) tileRowMap[c] = ri;
        } else if (seg.type === 'fork') {
          for (const br of seg.branches) flattenBranchNodes(br.nodes).forEach(n => { tileRowMap[n] = ri; });
        }
      }
    }

    // ---- Classify legs edges ----
    const legsEdgeSet = new Set<string>();
    for (const seg of gamePath) {
      if (seg.type === 'legs') {
        for (const child of seg.children) legsEdgeSet.add(seg.parent + '->' + child);
      }
    }

    // ---- Fan-out trunk routing ----
    const fanOutTrunks: Record<string, { trunkX: number; targets: Set<string> }> = {};
    const edgesBySource: Record<string, string[]> = {};
    for (const [from, to] of EDGES) {
      if (!edgesBySource[from]) edgesBySource[from] = [];
      edgesBySource[from].push(to);
    }
    for (const [from, targets] of Object.entries(edgesBySource)) {
      if (targets.length < 3) continue;
      const r = rects[from];
      if (!r) continue;
      const targetYs = targets.map(t => rects[t]?.cy).filter((y): y is number => y !== undefined);
      const ySpread = Math.max(...targetYs) - Math.min(...targetYs);
      if (ySpread < 30) continue;
      fanOutTrunks[from] = { trunkX: r.right + 20, targets: new Set(targets) };
    }
    const fanOutTargets = new Set<string>();
    for (const t of Object.values(fanOutTrunks)) {
      for (const name of t.targets) fanOutTargets.add(name);
    }

    // ---- Merge channels ----
    const mergeChannels: Record<string, number> = {};
    for (const edge of EDGES) {
      if (edge[2] !== 'merge') continue;
      const [upper, bottom] = edge;
      const ru = rects[upper], rb = rects[bottom];
      if (!ru || !rb) continue;
      const channelX = Math.max(ru.right, rb.right) + 18;
      mergeChannels[upper + '->' + bottom] = channelX;
      for (const e2 of EDGES) {
        if (e2[0] === bottom && e2[2] !== 'merge') {
          mergeChannels[bottom + '->' + e2[1]] = channelX;
        }
      }
    }

    // ---- Branch tile map and Y bounds ----
    const tileBranch: Record<string, number> = {};
    const branchYBounds: { top: number; bottom: number }[] = [];
    for (const seg of gamePath) {
      if (seg.type === 'fork') {
        for (let bi = 0; bi < seg.branches.length; bi++) {
          let bTop = Infinity, bBot = -Infinity;
          for (const n of flattenBranchNodes(seg.branches[bi].nodes)) {
            tileBranch[n] = bi;
            const r = rects[n];
            if (r) { bTop = Math.min(bTop, r.top); bBot = Math.max(bBot, r.bottom); }
          }
          branchYBounds[bi] = { top: bTop, bottom: bBot };
        }
      }
    }

    // ---- Helpers ----
    function pt(name: string, side: string, yOffset = 0): Point | null {
      const r = rects[name];
      if (!r) return null;
      if (side === 'right') return { x: r.right, y: r.cy + yOffset };
      if (side === 'left') return { x: r.left, y: r.cy + yOffset };
      if (side === 'top') return { x: r.cx, y: r.top };
      if (side === 'bottom') return { x: r.cx, y: r.bottom };
      return null;
    }

    const margin = 6;

    function hitsBoxV(x: number, yMin: number, yMax: number, excludeFrom: string, excludeTo: string, scopeBranch?: number): boolean {
      for (const [name, r] of Object.entries(rects)) {
        if (name === excludeFrom || name === excludeTo) continue;
        if (scopeBranch !== undefined && tileBranch[name] !== undefined && tileBranch[name] !== scopeBranch) continue;
        if (x > r.left - margin && x < r.right + margin && yMax > r.top - margin && yMin < r.bottom + margin) return true;
      }
      return false;
    }

    function hitsBoxH(y: number, xMin: number, xMax: number, excludeFrom: string, excludeTo: string, scopeBranch?: number): boolean {
      for (const [name, r] of Object.entries(rects)) {
        if (name === excludeFrom || name === excludeTo) continue;
        if (scopeBranch !== undefined && tileBranch[name] !== undefined && tileBranch[name] !== scopeBranch) continue;
        if (y > r.top - margin && y < r.bottom + margin && xMax > r.left - margin && xMin < r.right + margin) return true;
      }
      return false;
    }

    function findClearX(startX: number, yMin: number, yMax: number, excludeFrom: string, excludeTo: string, scopeBranch?: number): number {
      for (let offset = 0; offset < 300; offset += 5) {
        if (!hitsBoxV(startX + offset, yMin, yMax, excludeFrom, excludeTo, scopeBranch)) return startX + offset;
        if (!hitsBoxV(startX - offset, yMin, yMax, excludeFrom, excludeTo, scopeBranch)) return startX - offset;
      }
      return startX;
    }

    function findClearY(startY: number, xMin: number, xMax: number, excludeFrom: string, excludeTo: string, scopeBranch?: number): number {
      for (let offset = 0; offset < 300; offset += 5) {
        if (!hitsBoxH(startY + offset, xMin, xMax, excludeFrom, excludeTo, scopeBranch)) return startY + offset;
        if (!hitsBoxH(startY - offset, xMin, xMax, excludeFrom, excludeTo, scopeBranch)) return startY - offset;
      }
      return startY;
    }

    function routeAroundBoxes(p1: Point, p2: Point, from: string, to: string): Point[] {
      if (Math.abs(p1.y - p2.y) < 1) {
        if (!hitsBoxH(p1.y, Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), from, to)) return [p1, p2];
        const clearY = findClearY(p1.y, Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), from, to);
        return [p1, { x: p1.x, y: clearY }, { x: p2.x, y: clearY }, p2];
      }
      if (Math.abs(p1.x - p2.x) < 1) {
        if (!hitsBoxV(p1.x, Math.min(p1.y, p2.y), Math.max(p1.y, p2.y), from, to)) return [p1, p2];
        const clearX = findClearX(p1.x, Math.min(p1.y, p2.y), Math.max(p1.y, p2.y), from, to);
        return [p1, { x: clearX, y: p1.y }, { x: clearX, y: p2.y }, p2];
      }
      const cornerA = { x: p2.x, y: p1.y };
      const cornerB = { x: p1.x, y: p2.y };
      if (!hitsBoxH(p1.y, Math.min(p1.x, cornerA.x), Math.max(p1.x, cornerA.x), from, to) &&
          !hitsBoxV(p2.x, Math.min(p1.y, p2.y), Math.max(p1.y, p2.y), from, to)) return [p1, cornerA, p2];
      if (!hitsBoxV(p1.x, Math.min(p1.y, cornerB.y), Math.max(p1.y, cornerB.y), from, to) &&
          !hitsBoxH(p2.y, Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), from, to)) return [p1, cornerB, p2];
      const yMin = Math.min(p1.y, p2.y), yMax = Math.max(p1.y, p2.y);
      const preferX = p1.x < p2.x ? p1.x + 18 : p2.x + 18;
      const clearX = findClearX(preferX, yMin, yMax, from, to);
      let y1 = p1.y, y2 = p2.y;
      if (hitsBoxH(y1, Math.min(p1.x, clearX), Math.max(p1.x, clearX), from, to))
        y1 = findClearY(y1, Math.min(p1.x, clearX), Math.max(p1.x, clearX), from, to);
      if (hitsBoxH(y2, Math.min(clearX, p2.x), Math.max(clearX, p2.x), from, to))
        y2 = findClearY(y2, Math.min(clearX, p2.x), Math.max(clearX, p2.x), from, to);
      const result: Point[] = [p1];
      if (Math.abs(y1 - p1.y) > 1) result.push({ x: p1.x, y: y1 });
      result.push({ x: clearX, y: y1 }, { x: clearX, y: y2 });
      if (Math.abs(y2 - p2.y) > 1) result.push({ x: p2.x, y: y2 });
      result.push(p2);
      return result;
    }

    // ---- Pass 1: route each edge ----
    interface EdgePath {
      from: string; to: string; pts: Point[]; color: string;
      isMerge: boolean; isFanOut: boolean; isConvergence: boolean;
    }
    const edgePaths: EdgePath[] = [];

    for (const edge of EDGES) {
      const [from, to, edgeTag] = edge;
      const isMerge = edgeTag === 'merge';
      const a = rects[from], b = rects[to];
      if (!a || !b) continue;
      const color = phaseColor(from, boardData.phaseMap);
      const fromRow = tileRowMap[from];
      const toRow = tileRowMap[to];
      const isCrossRow = fromRow !== undefined && toRow !== undefined && fromRow !== toRow;
      let pts: Point[] | null = null;
      const isLegs = legsEdgeSet.has(from + '->' + to);
      const trunk = fanOutTrunks[from];

      if (isMerge) {
        const p1 = pt(from, 'right');
        if (!p1) continue;
        const channelX = mergeChannels[from + '->' + to] || (Math.max(a.right, b.right) + 18);
        pts = [p1, { x: channelX, y: p1.y }, { x: channelX, y: b.cy }];
      } else if (trunk && trunk.targets.has(to) && !isLegs) {
        const p1 = pt(from, 'right');
        const p2 = pt(to, 'left', 6);
        if (!p1 || !p2) continue;
        pts = [p1, { x: trunk.trunkX, y: p1.y }, { x: trunk.trunkX, y: p2.y }, p2];
      } else if (isLegs) {
        const dy = b.cy - a.cy;
        const p1 = pt(from, dy > 0 ? 'bottom' : 'top');
        const p2 = pt(to, dy > 0 ? 'top' : 'bottom');
        if (p1 && p2) pts = [p1, p2];
      } else if (isCrossRow) {
        const goRight = fromRow % 2 === 0;
        const p1 = pt(from, 'bottom');
        const p2 = pt(to, 'top');
        if (!p1 || !p2) continue;
        if (Math.abs(p1.x - p2.x) < 30) {
          pts = [p1, p2];
        } else {
          const edgeX = goRight ? containerW - BOARD.EDGE_MARGIN : BOARD.EDGE_MARGIN;
          pts = [p1, { x: p1.x, y: p1.y + 8 }, { x: edgeX, y: p1.y + 8 }, { x: edgeX, y: p2.y - 8 }, { x: p2.x, y: p2.y - 8 }, p2];
        }
      } else {
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;

        if (Math.abs(dy) < 8 && dx > 0) {
          const p1 = pt(from, 'right'), p2 = pt(to, 'left');
          if (p1 && p2) pts = routeAroundBoxes(p1, p2, from, to);
        } else if (Math.abs(dy) < 8 && dx < 0) {
          const p1 = pt(from, 'left'), p2 = pt(to, 'right');
          if (p1 && p2) pts = routeAroundBoxes(p1, p2, from, to);
        } else if (dx > 0 && CONVERGENCE_NODES.has(to)) {
          const p1 = pt(from, 'right'), p2 = pt(to, 'left');
          if (!p1 || !p2) continue;
          let edgeX = Math.max(p2.x - 25, a.right + 8);
          const cyMin = Math.min(p1.y, p2.y) - 4, cyMax = Math.max(p1.y, p2.y) + 4;
          if (hitsBoxV(edgeX, cyMin, cyMax, from, to)) edgeX = findClearX(edgeX, cyMin, cyMax, from, to);
          pts = [p1, { x: edgeX, y: p1.y }, { x: edgeX, y: p2.y }, p2];
        } else if (dx > 0) {
          const p1 = pt(from, 'right'), p2 = pt(to, 'left');
          if (p1 && p2) pts = routeAroundBoxes(p1, p2, from, to);
        } else if (dx < 0 && Math.abs(dy) > 20) {
          // Return arrow routing with gap-based midY
          const scope = tileBranch[from];
          const entryOff = fanOutTargets.has(to) ? -6 : 0;
          const p1 = pt(from, 'right'), p2 = pt(to, 'left', entryOff);
          if (!p1 || !p2) continue;
          const yMinE = Math.min(p1.y, p2.y) - 4, yMaxE = Math.max(p1.y, p2.y) + 4;
          let edgeX = mergeChannels[from + '->' + to] || (a.right + 18);
          if (b.right + 18 > edgeX) edgeX = b.right + 18;
          if (hitsBoxV(edgeX, yMinE, yMaxE, from, to)) edgeX = findClearX(edgeX, yMinE, yMaxE, from, to);
          let midY: number;
          const goingUp = p2.y < p1.y;
          const bounds = scope !== undefined ? branchYBounds[scope] : null;
          if (bounds && goingUp) {
            if (scope > 0) {
              const aboveBounds = branchYBounds[scope - 1];
              midY = aboveBounds ? (aboveBounds.bottom + bounds.top) / 2 : bounds.top - 9;
            } else {
              midY = bounds.top - 9;
            }
          } else if (bounds && !goingUp && branchYBounds[scope + 1]) {
            midY = (bounds.bottom + branchYBounds[scope + 1].top) / 2;
          } else {
            midY = (p1.y + p2.y) / 2;
          }
          if (midY > b.top - margin && midY < b.bottom + margin) {
            const above = b.top - margin - 4, below = b.bottom + margin + 4;
            midY = (Math.abs(midY - above) < Math.abs(midY - below)) ? above : below;
          }
          const xMinM = Math.min(edgeX, p2.x - 18), xMaxM = Math.max(edgeX, p2.x - 18);
          if (hitsBoxH(midY, xMinM, xMaxM, from, to)) midY = findClearY(midY, xMinM, xMaxM, from, to);
          if (hitsBoxH(p1.y, p1.x, edgeX, from, to, scope)) {
            const exitX = p1.x + 8;
            pts = [p1, { x: exitX, y: p1.y }, { x: exitX, y: midY }, { x: p2.x - 18, y: midY }, { x: p2.x - 18, y: p2.y }, p2];
          } else if (Math.abs(edgeX - (p2.x - 18)) < 5) {
            pts = [p1, { x: edgeX, y: p1.y }, { x: edgeX, y: p2.y }, p2];
          } else {
            pts = [p1, { x: edgeX, y: p1.y }, { x: edgeX, y: midY }, { x: p2.x - 18, y: midY }, { x: p2.x - 18, y: p2.y }, p2];
          }
        } else {
          const p1 = pt(from, 'right'), p2 = pt(to, 'left');
          if (p1 && p2) pts = routeAroundBoxes(p1, p2, from, to);
        }
      }

      if (pts && pts[0] && pts[pts.length - 1]) {
        const isFanOut = !!(trunk && trunk.targets.has(to) && !isLegs);
        const isConvergence = CONVERGENCE_NODES.has(to);
        edgePaths.push({ from, to, pts, color, isMerge, isFanOut, isConvergence });
      }
    }

    // ---- Pass 2: separate parallel overlapping lines ----
    interface Segment { type: string; fixed: number; min: number; max: number; edgeIdx: number; ptIdx: number; }
    const segments: Segment[] = [];
    for (let ei = 0; ei < edgePaths.length; ei++) {
      const ep = edgePaths[ei];
      for (let i = 0; i < ep.pts.length - 1; i++) {
        if (ep.isFanOut && i === 1) continue;
        const a2 = ep.pts[i], b2 = ep.pts[i + 1];
        if (Math.abs(a2.y - b2.y) < 1)
          segments.push({ type: 'h', fixed: a2.y, min: Math.min(a2.x, b2.x), max: Math.max(a2.x, b2.x), edgeIdx: ei, ptIdx: i });
        else if (Math.abs(a2.x - b2.x) < 1)
          segments.push({ type: 'v', fixed: a2.x, min: Math.min(a2.y, b2.y), max: Math.max(a2.y, b2.y), edgeIdx: ei, ptIdx: i });
      }
    }

    const SNAP = 8;
    const ufParent = segments.map((_, i) => i);
    function ufFind(i: number): number { return ufParent[i] === i ? i : (ufParent[i] = ufFind(ufParent[i])); }
    function ufUnion(a2: number, b2: number) { ufParent[ufFind(a2)] = ufFind(b2); }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const si = segments[i], sj = segments[j];
        if (si.type !== sj.type || Math.abs(si.fixed - sj.fixed) > SNAP) continue;
        if (si.max > sj.min + 1 && sj.max > si.min + 1) ufUnion(i, j);
      }
    }

    const groups: Record<number, number[]> = {};
    for (let i = 0; i < segments.length; i++) {
      const root = ufFind(i);
      if (!groups[root]) groups[root] = [];
      groups[root].push(i);
    }

    for (const indices of Object.values(groups)) {
      const colorSet = new Set(indices.map(i => edgePaths[segments[i].edgeIdx].color));
      if (colorSet.size <= 1) continue;
      const colors = [...colorSet];
      const colorTrack: Record<string, number> = {};
      colors.forEach((c, t) => { colorTrack[c] = (t - (colors.length - 1) / 2) * BOARD.LINE_SPACING; });
      for (const idx of indices) {
        const seg = segments[idx];
        const offset = colorTrack[edgePaths[seg.edgeIdx].color];
        const { pts: epts } = edgePaths[seg.edgeIdx];
        if (seg.type === 'h') {
          epts[seg.ptIdx] = { x: epts[seg.ptIdx].x, y: epts[seg.ptIdx].y + offset };
          epts[seg.ptIdx + 1] = { x: epts[seg.ptIdx + 1].x, y: epts[seg.ptIdx + 1].y + offset };
        } else {
          epts[seg.ptIdx] = { x: epts[seg.ptIdx].x + offset, y: epts[seg.ptIdx].y };
          epts[seg.ptIdx + 1] = { x: epts[seg.ptIdx + 1].x + offset, y: epts[seg.ptIdx + 1].y };
        }
      }
    }

    // ---- Stub post-processing ----
    const STUB_LEN = 36;
    for (const ep of edgePaths) {
      if (ep.isMerge || ep.isConvergence) continue;
      const { pts: epts } = ep;
      if (epts.length < 2) continue;
      const last = epts[epts.length - 1], prev = epts[epts.length - 2];
      const targetRect = rects[ep.to];
      if (!targetRect || Math.abs(last.x - targetRect.left) > 4) continue;
      const isVertical = Math.abs(last.x - prev.x) < 2 && Math.abs(last.y - prev.y) > 2;
      const isHorizontal = Math.abs(last.y - prev.y) < 2 && Math.abs(last.x - prev.x) > 2;
      const horizLen = isHorizontal ? Math.abs(last.x - prev.x) : 0;
      if (isHorizontal && horizLen >= STUB_LEN) continue;
      const entryX = targetRect.left, entryY = targetRect.cy;
      let stubX = entryX - STUB_LEN;
      const stubYMin = Math.min((isVertical ? prev.y : entryY), entryY) - 4;
      const stubYMax = Math.max((isVertical ? prev.y : entryY), entryY) + 4;
      if (hitsBoxV(stubX, stubYMin, stubYMax, ep.from, ep.to)) stubX = findClearX(stubX - 10, stubYMin, stubYMax, ep.from, ep.to);
      if (isHorizontal && horizLen < STUB_LEN && epts.length >= 3) {
        epts.splice(epts.length - 2, 2, { x: stubX, y: prev.y }, { x: stubX, y: entryY }, { x: entryX, y: entryY });
      } else if (isVertical) {
        if (epts.length === 2) {
          const start = epts[0];
          epts.length = 0;
          epts.push(start, { x: stubX, y: start.y }, { x: stubX, y: entryY }, { x: entryX, y: entryY });
        } else {
          epts.splice(epts.length - 2, 2, { x: stubX, y: prev.y }, { x: stubX, y: entryY }, { x: entryX, y: entryY });
        }
      }
    }

    // ---- Pass 3: render SVG ----
    let svgHTML = '<defs>';
    const usedColors = new Set(edgePaths.map(e => e.color));
    for (const c of usedColors) {
      const id = 'arr-' + c.replace('#', '');
      svgHTML += `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`;
      svgHTML += `<path d="M 0 0 L 10 5 L 0 10 z" fill="${c}"/>`;
      svgHTML += '</marker>';
    }
    svgHTML += '</defs>';
    for (const ep of edgePaths) {
      const mid = 'arr-' + ep.color.replace('#', '');
      const d = smoothPath(ep.pts);
      if (ep.isMerge) {
        svgHTML += `<path class="svg-edge" d="${d}" stroke="${ep.color}"/>`;
      } else {
        svgHTML += `<path class="svg-edge" d="${d}" stroke="${ep.color}" marker-end="url(#${mid})"/>`;
      }
    }
    svg.innerHTML = svgHTML;
  }

  // ---- Main render ----
  return (
    <div className="board-v3" ref={containerRef}>
      <svg className="svg-arrows" ref={svgRef} />
      <div className="pbm-snake">
        {rows.map((row, ri) => {
          const isReversed = ri % 2 === 1;
          let globalOffset = 0;
          for (let r = 0; r < ri; r++) globalOffset += rows[r].length;

          // Group segments by phase
          const phaseGroups: { phase: string | null; items: { seg: PathSegment; origIdx: number }[] }[] = [];
          row.forEach((seg, si) => {
            const origIdx = globalOffset + si;
            let sp: string | null = null;
            if (seg.type === 'node') sp = seg.name;
            else if (seg.type === 'legs') sp = seg.children[0] || seg.parent;
            else if (seg.type === 'fork') {
              const flat = flattenBranchNodes(seg.branches[0]?.nodes || []);
              sp = flat[0] || null;
            }
            const phase = sp ? phaseOf(sp, boardData.phaseMap) : null;
            const lastGroup = phaseGroups[phaseGroups.length - 1];
            if (lastGroup && lastGroup.phase === phase) {
              lastGroup.items.push({ seg, origIdx });
            } else {
              phaseGroups.push({ phase, items: [{ seg, origIdx }] });
            }
          });

          return (
            <React.Fragment key={`row-${ri}`}>
              {ri > 0 && <div className="pbm-uturn" />}
              <div className={`pbm-row ${isReversed ? 'pbm-row--reverse' : ''}`}>
                {ri > 0 && <div className="pbm-turn-entry" />}
                {phaseGroups.map((group, gi) => {
                  const colors = group.phase ? PHASE_COLORS[group.phase] : null;
                  const showPhaseHeader = colors && group.phase && !PHASE_GROUP_SKIP.has(group.phase);
                  const inner = group.items.map(({ seg, origIdx }) => {
                    if (seg.type === 'fork') return renderFork(seg, origIdx);
                    if (seg.type === 'legs') return renderLegs(seg, origIdx);
                    return renderSlot(seg.name);
                  });
                  if (showPhaseHeader) {
                    return (
                      <div key={`pg-${ri}-${gi}`} className="pbm-phase-group"
                        style={{ borderTopColor: colors!.border }}>
                        <span className="pbm-phase-label" style={{ color: colors!.text }}>
                          {group.phase!.charAt(0) + group.phase!.slice(1).toLowerCase()}
                        </span>
                        {inner}
                      </div>
                    );
                  }
                  return <React.Fragment key={`pg-${ri}-${gi}`}>{inner}</React.Fragment>;
                })}
                {ri < rows.length - 1 && <div className="pbm-row-spacer" />}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="pbm-legend">
        {Object.entries(PHASE_COLORS).map(([phase, pc]) => (
          <div key={phase} className="pbm-legend-item">
            <div className="pbm-legend-dot" style={{ background: pc.border }} />
            <span>{phase.charAt(0) + phase.slice(1).toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
