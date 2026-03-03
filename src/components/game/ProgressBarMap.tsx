// src/components/game/ProgressBarMap.tsx
//
// Snake-path mini map — fixed-width slot grid with adaptive row splitting.
// Fork vertical lines and u-turn connections are calculated from known heights.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameContext } from '../../context/GameContext';
import { Space, Player } from '../../types/DataTypes';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import './ProgressBarMap.css';

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'SETUP':        { bg: '#e3f2fd', text: '#1565c0', border: '#2196F3' },
  'OWNER':        { bg: '#e3f2fd', text: '#1565c0', border: '#2196F3' },
  'FUNDING':      { bg: '#fff8e1', text: '#f57f17', border: '#FF9800' },
  'DESIGN':       { bg: '#f3e5f5', text: '#7b1fa2', border: '#9C27B0' },
  'REGULATORY':   { bg: '#ffebee', text: '#c62828', border: '#f44336' },
  'CONSTRUCTION': { bg: '#e8f5e9', text: '#2e7d32', border: '#4CAF50' },
  'END':          { bg: '#e0f2f1', text: '#00695c', border: '#009688' },
};

const NPC_PREFIXES = ['OWNER-', 'ARCH-', 'ENG-', 'REG-DOB-', 'REG-FDNY-', 'CON-', 'PM-', 'LEND-', 'BANK-', 'INVESTOR-', 'CHEAT-'];
const SPECIAL_NAMES: Record<string, string> = {
  'FINISH': 'Finish',
  'PM-DECISION-CHECK': 'PM Check',
  'START-QUICK-PLAY-GUIDE': 'Quick Play',
};

function shortDisplayName(spaceName: string): string {
  if (SPECIAL_NAMES[spaceName]) return SPECIAL_NAMES[spaceName];
  let name = spaceName;
  for (const prefix of NPC_PREFIXES) {
    if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
  }
  return name.split('-').map(w => {
    if (w.length <= 2) return w;
    return w.charAt(0).toUpperCase() + w.toLowerCase().slice(1);
  }).join(' ');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ------- Path definition -------

type PathSegment =
  | { type: 'node'; name: string }
  | { type: 'fork'; branches: { nodes: string[] }[]; merge?: boolean }
  | { type: 'legs'; parent: string; above: string; below: string };

const GAME_PATH: PathSegment[] = [
  { type: 'node', name: 'OWNER-SCOPE-INITIATION' },
  { type: 'node', name: 'OWNER-FUND-INITIATION' },
  { type: 'legs', parent: 'PM-DECISION-CHECK', above: 'OWNER-DECISION-REVIEW', below: 'CHEAT-BYPASS' },
  { type: 'node', name: 'LEND-SCOPE-CHECK' },
  { type: 'fork', branches: [
    { nodes: ['BANK-FUND-REVIEW'] },
    { nodes: ['INVESTOR-FUND-REVIEW'] },
  ]},
  { type: 'node', name: 'ARCH-INITIATION' },
  { type: 'node', name: 'ARCH-FEE-REVIEW' },
  { type: 'node', name: 'ARCH-SCOPE-CHECK' },
  { type: 'node', name: 'ENG-INITIATION' },
  { type: 'node', name: 'ENG-FEE-REVIEW' },
  { type: 'node', name: 'ENG-SCOPE-CHECK' },
  { type: 'fork', branches: [
    { nodes: ['REG-DOB-FEE-REVIEW', 'REG-DOB-TYPE-SELECT'] },
    { nodes: ['REG-FDNY-FEE-REVIEW', 'REG-FDNY-PLAN-EXAM'] },
  ]},
  { type: 'fork', merge: true, branches: [
    { nodes: ['REG-DOB-PLAN-EXAM'] },
    { nodes: ['REG-DOB-PROF-CERT', 'REG-DOB-AUDIT'] },
  ]},
  { type: 'node', name: 'CON-INITIATION' },
  { type: 'node', name: 'CON-ISSUES' },
  { type: 'node', name: 'CON-INSPECT' },
  { type: 'node', name: 'REG-DOB-FINAL-REVIEW' },
  { type: 'node', name: 'FINISH' },
];

// --- Known heights for calculations ---
const BRANCH_H = 36; // fork branch fixed height
const SLOT_WIDTH = 134; // 120px slot + 14px connector

function segmentSlotCount(seg: PathSegment): number {
  if (seg.type === 'node') return 1;
  if (seg.type === 'legs') return 1;
  return Math.max(...seg.branches.map(b => b.nodes.length));
}

// ------- Component -------

interface ProgressBarMapProps {
  currentPlayerId: string | null;
  players: Player[];
}

export function ProgressBarMap({
  currentPlayerId,
  players,
}: ProgressBarMapProps): JSX.Element {
  const { dataService, stateService, movementService } = useGameContext();

  const [spacesMap, setSpacesMap] = useState<Map<string, Space>>(new Map());
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const map = new Map<string, Space>();
    for (const s of dataService.getAllSpaces()) map.set(s.name, s);
    setSpacesMap(map);
  }, [dataService]);

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

  useEffect(() => {
    const unsubscribe = stateService.subscribe((gs) => {
      if (gs.gamePhase === 'PLAY' && gs.currentPlayerId && !gs.hasPlayerMovedThisTurn && !gs.isMoving) {
        try { setValidMoves(movementService.getValidMoves(gs.currentPlayerId)); }
        catch { setValidMoves([]); }
      } else { setValidMoves([]); }
    });
    const s = stateService.getGameState();
    if (s.gamePhase === 'PLAY' && s.currentPlayerId && !s.hasPlayerMovedThisTurn) {
      try { setValidMoves(movementService.getValidMoves(s.currentPlayerId)); }
      catch { setValidMoves([]); }
    }
    return unsubscribe;
  }, [stateService, movementService]);

  const rows = useMemo(() => {
    const slotsPerRow = Math.max(4, Math.floor(containerWidth / SLOT_WIDTH));
    const result: PathSegment[][] = [];
    let currentRow: PathSegment[] = [];
    let currentSlots = 0;
    for (let i = 0; i < GAME_PATH.length; i++) {
      const seg = GAME_PATH[i];
      const slots = segmentSlotCount(seg);
      const isLast = i === GAME_PATH.length - 1;
      if (currentRow.length > 0 && currentSlots + slots > slotsPerRow && !isLast) {
        result.push(currentRow);
        currentRow = [seg];
        currentSlots = slots;
      } else {
        currentRow.push(seg);
        currentSlots += slots;
      }
    }
    if (currentRow.length > 0) result.push(currentRow);
    return result;
  }, [containerWidth]);

  const handleMouseEnter = useCallback((name: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredSpace(name), 120);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredSpace(null);
  }, []);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const getPlayersOnSpace = useCallback((n: string) => players.filter(p => p.currentSpace === n), [players]);
  const isVisited = useCallback((n: string) => currentPlayer?.visitedSpaces?.includes(n) ?? false, [currentPlayer]);

  const phaseMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const seg of GAME_PATH) {
      if (seg.type === 'node') {
        const cfg = dataService.getGameConfigBySpace(seg.name);
        if (cfg?.phase) map.set(seg.name, cfg.phase.toUpperCase());
      } else if (seg.type === 'legs') {
        for (const n of [seg.parent, seg.above, seg.below]) {
          const cfg = dataService.getGameConfigBySpace(n);
          if (cfg?.phase) map.set(n, cfg.phase.toUpperCase());
        }
      } else if (seg.type === 'fork') {
        for (const branch of seg.branches) {
          for (const n of branch.nodes) {
            const cfg = dataService.getGameConfigBySpace(n);
            if (cfg?.phase) map.set(n, cfg.phase.toUpperCase());
          }
        }
      }
    }
    return map;
  }, [dataService]);

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

  const renderNode = (spaceName: string, slotOpts?: { hideLeft?: boolean; hideRight?: boolean }) => {
    const space = spacesMap.get(spaceName);
    if (!space) return <div key={spaceName} className="pbm-slot"><div className="pbm-slot-line" /><div className="pbm-node">{spaceName}</div><div className="pbm-slot-line" /></div>;

    const isCurrentSpace = currentPlayer?.currentSpace === spaceName;
    const isValidMove = validMoves.includes(spaceName);
    const isExpanded = expandedSpace === spaceName;
    const isHovered = hoveredSpace === spaceName && !isCurrentSpace && !isExpanded;
    const playersHere = getPlayersOnSpace(spaceName);
    const visited = isVisited(spaceName);

    const npcPrefix = extractPrefix(spaceName);
    const npcInfo = CHARACTER_MAP[npcPrefix];
    const accentColor = npcInfo?.color ?? PHASE_COLORS[phaseMap.get(spaceName) ?? '']?.border;

    const pickContent = () => {
      if (!space.content?.length) return undefined;
      if (visited) return space.content.find(c => c.visit_type === 'Subsequent') || space.content[0];
      return space.content.find(c => c.visit_type === 'First') || space.content[0];
    };

    let tileContent: JSX.Element;

    if (isCurrentSpace) {
      const content = pickContent();
      const npcName = npcInfo?.name;
      tileContent = (
        <div className="pbm-card pbm-card--current" style={{ borderLeftColor: accentColor || '#007bff' }}>
          <div className="pbm-card-name pbm-card-name--current">{shortDisplayName(spaceName)}</div>
          {content?.story && (
            <div className="pbm-card-story">
              {npcName && <strong>{npcName}: </strong>}{truncate(content.story, 100)}
            </div>
          )}
          {content?.action_description && (
            <div className="pbm-card-action">
              <strong>Action:</strong> {truncate(content.action_description, 80)}
            </div>
          )}
          {renderAvatars(playersHere)}
        </div>
      );
    } else if (isExpanded) {
      const content = pickContent();
      const npcName = npcInfo?.name;
      tileContent = (
        <div className="pbm-card pbm-card--expanded" style={{ borderLeftColor: accentColor || '#007bff' }}>
          <div className="pbm-card-name">{shortDisplayName(spaceName)}</div>
          {content?.story && (
            <div className="pbm-card-story">
              {npcName && <strong>{npcName}: </strong>}{truncate(content.story, 100)}
            </div>
          )}
          {content?.action_description && (
            <div className="pbm-card-action">
              <strong>Action:</strong> {truncate(content.action_description, 80)}
            </div>
          )}
          {renderAvatars(playersHere)}
        </div>
      );
    } else if (isHovered) {
      const content = pickContent();
      const hoverBorder = isValidMove ? '#ffc107' : (accentColor || '#007bff');
      tileContent = (
        <div className={`pbm-card pbm-card--hover${isValidMove ? ' pbm-card--valid-move' : ''}`} style={{ borderLeftColor: hoverBorder }}>
          <div className="pbm-card-name">{shortDisplayName(spaceName)}</div>
          {content?.story && (
            <div className="pbm-card-story">{truncate(content.story, 60)}</div>
          )}
          {renderAvatars(playersHere)}
        </div>
      );
    } else {
      const nodeClass = [
        'pbm-node',
        isValidMove && 'pbm-node--valid-move',
        !isValidMove && visited && 'pbm-node--visited',
        playersHere.length > 0 && 'pbm-node--has-players',
      ].filter(Boolean).join(' ');
      const nodeStyle: React.CSSProperties = {};
      if (accentColor) {
        nodeStyle.borderLeftWidth = '3px';
        nodeStyle.borderLeftColor = accentColor;
      }
      if (playersHere.length > 0 && !isValidMove) {
        nodeStyle.borderColor = accentColor || '#28a745';
      }
      tileContent = (
        <div className={nodeClass} style={nodeStyle} title={spaceName}>
          <span>{shortDisplayName(spaceName)}</span>
          {renderAvatars(playersHere)}
        </div>
      );
    }

    return (
      <div key={spaceName} className="pbm-slot"
        onMouseEnter={() => handleMouseEnter(spaceName)}
        onMouseLeave={handleMouseLeave}
        onClick={() => setExpandedSpace(isExpanded ? null : spaceName)}>
        {!slotOpts?.hideLeft && <div className="pbm-slot-line" />}
        {tileContent}
        {!slotOpts?.hideRight && <div className="pbm-slot-line" />}
      </div>
    );
  };

  const renderConnector = (key: string) => (
    <div key={key} className="pbm-connector" />
  );

  const renderFork = (seg: Extract<PathSegment, { type: 'fork' }>, segIdx: number) => {
    const numBranches = seg.branches.length;
    // Calculate vertical line positions from known branch heights
    const firstArmY = BRANCH_H / 2; // center of first branch
    const lastArmY = (numBranches - 1) * BRANCH_H + BRANCH_H / 2; // center of last branch
    const vlineTop = firstArmY;
    const vlineHeight = lastArmY - firstArmY;

    const branchVisited = seg.branches.map(branch =>
      branch.nodes.some(n => isVisited(n))
    );
    const anyBranchVisited = branchVisited.some(Boolean);

    return (
      <div key={`fork-${segIdx}`} className="pbm-fork">
        {/* Left vertical line — calculated position */}
        <div className="pbm-fork-vline pbm-fork-vline--left"
          style={{ top: `${vlineTop}px`, height: `${vlineHeight}px` }} />
        {/* Right vertical line — calculated position */}
        <div className="pbm-fork-vline pbm-fork-vline--right"
          style={{ top: `${vlineTop}px`, height: `${vlineHeight}px` }} />
        {seg.branches.map((branch, bi) => {
          const dimmed = anyBranchVisited && !branchVisited[bi];
          return (
            <div key={bi} className={`pbm-fork-branch${dimmed ? ' pbm-fork-branch--dimmed' : ''}`}>
              <div className="pbm-fork-arm" />
              {branch.nodes.map((spaceName, ni) => (
                <React.Fragment key={spaceName}>
                  {ni > 0 && renderConnector(`fc-${spaceName}`)}
                  {renderNode(spaceName)}
                </React.Fragment>
              ))}
              <div className={`pbm-fork-arm${seg.merge ? ' pbm-fork-arm--merge' : ''}`} />
            </div>
          );
        })}
      </div>
    );
  };

  const renderLegs = (seg: Extract<PathSegment, { type: 'legs' }>, segIdx: number) => (
    <div key={`legs-${segIdx}`} className="pbm-legs">
      {renderNode(seg.above, { hideLeft: true, hideRight: true })}
      {renderNode(seg.parent)}
      {renderNode(seg.below, { hideLeft: true, hideRight: true })}
    </div>
  );

  const getSegmentFirstSpace = (seg: PathSegment): string | null => {
    if (seg.type === 'node') return seg.name;
    if (seg.type === 'legs') return seg.above;
    if (seg.type === 'fork') return seg.branches[0]?.nodes[0] ?? null;
    return null;
  };

  const renderSegment = (seg: PathSegment, segIdx: number, showLeadConnector: boolean, edgeOpts?: { hideLeft?: boolean; hideRight?: boolean }) => {
    if (seg.type === 'fork') {
      return (
        <React.Fragment key={`seg-${segIdx}`}>
          {showLeadConnector && renderConnector(`lc-${segIdx}`)}
          {renderFork(seg, segIdx)}
        </React.Fragment>
      );
    }
    if (seg.type === 'legs') {
      return (
        <React.Fragment key={`seg-${segIdx}`}>
          {showLeadConnector && renderConnector(`lc-${segIdx}`)}
          {renderLegs(seg, segIdx)}
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={`seg-${segIdx}-${seg.name}`}>
        {showLeadConnector && renderConnector(`lc-${segIdx}`)}
        {renderNode(seg.name, edgeOpts)}
      </React.Fragment>
    );
  };

  return (
    <div className="progress-bar-map" ref={containerRef}>
      <div className="pbm-snake">
        {rows.map((row, ri) => {
          const isReversed = ri % 2 === 1;
          let globalOffset = 0;
          for (let r = 0; r < ri; r++) globalOffset += rows[r].length;

          const phaseGroups: { phase: string | null; items: { seg: PathSegment; origIdx: number; si: number }[] }[] = [];
          row.forEach((seg, si) => {
            const origIdx = globalOffset + si;
            const sp = getSegmentFirstSpace(seg);
            const phase = sp ? (phaseMap.get(sp) ?? null) : null;
            const lastGroup = phaseGroups[phaseGroups.length - 1];
            if (lastGroup && lastGroup.phase === phase) {
              lastGroup.items.push({ seg, origIdx, si });
            } else {
              phaseGroups.push({ phase, items: [{ seg, origIdx, si }] });
            }
          });

          return (
            <React.Fragment key={`row-${ri}`}>
              {/* U-turn gap (no line — spacer/entry extensions handle the connection) */}
              {ri > 0 && <div className="pbm-uturn" />}
              <div className={`pbm-row ${isReversed ? 'pbm-row--reverse' : ''}`}>
                {ri > 0 && (
                  <div className={`pbm-turn-entry ${isReversed ? 'pbm-turn-entry--right' : 'pbm-turn-entry--left'}`} />
                )}
                {phaseGroups.map((group, gi) => {
                  const colors = group.phase ? PHASE_COLORS[group.phase] : null;
                  const inner = group.items.map(({ seg, origIdx, si }, itemIdx) => {
                    const isFirstEver = ri === 0 && gi === 0 && itemIdx === 0;
                    const isLastEver = ri === rows.length - 1 && gi === phaseGroups.length - 1 && itemIdx === group.items.length - 1;
                    const edgeOpts = (isFirstEver || isLastEver) ? { hideLeft: isFirstEver, hideRight: isLastEver } : undefined;
                    return renderSegment(seg, origIdx, si > 0, edgeOpts);
                  });
                  if (colors && group.phase) {
                    return (
                      <div key={`pg-${ri}-${gi}`} className="pbm-phase-group" style={{ borderTopColor: colors.border }}>
                        <span className="pbm-phase-label" style={{ color: colors.text }}>
                          {group.phase.charAt(0) + group.phase.slice(1).toLowerCase()}
                        </span>
                        {inner}
                      </div>
                    );
                  }
                  return <React.Fragment key={`pg-${ri}-${gi}`}>{inner}</React.Fragment>;
                })}
                {ri < rows.length - 1 && (
                  <div className={`pbm-row-spacer ${isReversed ? 'pbm-row-spacer--left' : 'pbm-row-spacer--right'}`} />
                )}
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
