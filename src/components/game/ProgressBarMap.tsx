// src/components/game/ProgressBarMap.tsx
//
// Snake-path mini map with hardcoded path order, U-turn rows, and parallel branches.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameContext } from '../../context/GameContext';
import { GameSpace } from './GameSpace';
import { Space, Player } from '../../types/DataTypes';
import { extractPrefix, CHARACTER_MAP } from '../../constants/characters';
import './ProgressBarMap.css';

// Phase display colors
const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'SETUP':        { bg: '#e3f2fd', text: '#1565c0', border: '#2196F3' },
  'OWNER':        { bg: '#e3f2fd', text: '#1565c0', border: '#2196F3' },
  'FUNDING':      { bg: '#fff8e1', text: '#f57f17', border: '#FF9800' },
  'DESIGN':       { bg: '#f3e5f5', text: '#7b1fa2', border: '#9C27B0' },
  'REGULATORY':   { bg: '#ffebee', text: '#c62828', border: '#f44336' },
  'CONSTRUCTION': { bg: '#e8f5e9', text: '#2e7d32', border: '#4CAF50' },
  'END':          { bg: '#e0f2f1', text: '#00695c', border: '#009688' },
};

// Short display name for compact nodes
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
    const lc = w.toLowerCase();
    if (lc === 'initiation') return 'Init';
    if (lc === 'application') return 'App';
    if (lc === 'inspection') return 'Insp';
    if (lc === 'certificate') return 'Cert';
    if (lc === 'approval') return 'Appr';
    if (lc === 'construction') return 'Constr';
    if (lc === 'preliminary') return 'Prelim';
    if (lc === 'examination') return 'Exam';
    if (lc === 'review') return 'Rev';
    if (lc === 'decision') return 'Dec';
    if (lc === 'check') return 'Chk';
    return w.charAt(0).toUpperCase() + lc.slice(1);
  }).join(' ');
}

// ------- Hardcoded path definition -------

type PathSegment =
  | { type: 'node'; name: string }
  | { type: 'fork'; branches: { nodes: string[] }[] }
  | { type: 'legs'; parent: string; above: string; below: string };

const GAME_PATH: PathSegment[] = [
  // SETUP
  { type: 'node', name: 'OWNER-SCOPE-INITIATION' },
  { type: 'node', name: 'OWNER-FUND-INITIATION' },
  // OWNER — legs above/below PM Check
  { type: 'legs', parent: 'PM-DECISION-CHECK', above: 'OWNER-DECISION-REVIEW', below: 'CHEAT-BYPASS' },
  // FUNDING
  { type: 'node', name: 'LEND-SCOPE-CHECK' },
  { type: 'fork', branches: [
    { nodes: ['BANK-FUND-REVIEW'] },
    { nodes: ['INVESTOR-FUND-REVIEW'] },
  ]},
  // DESIGN
  { type: 'node', name: 'ARCH-INITIATION' },
  { type: 'node', name: 'ARCH-FEE-REVIEW' },
  { type: 'node', name: 'ARCH-SCOPE-CHECK' },
  { type: 'node', name: 'ENG-INITIATION' },
  { type: 'node', name: 'ENG-FEE-REVIEW' },
  { type: 'node', name: 'ENG-SCOPE-CHECK' },
  // REGULATORY (DOB + FDNY parallel)
  { type: 'fork', branches: [
    { nodes: ['REG-DOB-FEE-REVIEW', 'REG-DOB-TYPE-SELECT'] },
    { nodes: ['REG-FDNY-FEE-REVIEW', 'REG-FDNY-PLAN-EXAM'] },
  ]},
  // DOB choice branch
  { type: 'fork', branches: [
    { nodes: ['REG-DOB-PLAN-EXAM'] },
    { nodes: ['REG-DOB-PROF-CERT', 'REG-DOB-AUDIT'] },
  ]},
  // CONSTRUCTION
  { type: 'node', name: 'CON-INITIATION' },
  { type: 'node', name: 'CON-ISSUES' },
  { type: 'node', name: 'CON-INSPECT' },
  // FINAL
  { type: 'node', name: 'REG-DOB-FINAL-REVIEW' },
  { type: 'node', name: 'FINISH' },
];

// Estimate how many "slots" a segment takes (for row splitting)
function segmentSlotCount(seg: PathSegment): number {
  if (seg.type === 'node') return 1;
  if (seg.type === 'legs') return 2; // parent + leg space
  // Fork: width = max branch length + connector column
  const maxBranch = Math.max(...seg.branches.map(b => b.nodes.length));
  return maxBranch + 1;
}

// ------- Component -------

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 25 };

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

  // Load spaces into map
  useEffect(() => {
    const map = new Map<string, Space>();
    for (const s of dataService.getAllSpaces()) map.set(s.name, s);
    setSpacesMap(map);
  }, [dataService]);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Subscribe to valid moves
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

  // Split GAME_PATH into rows based on container width
  const NODE_WIDTH = 90; // node ~74px + connector ~16px
  const rows = useMemo(() => {
    const slotsPerRow = Math.max(4, Math.floor(containerWidth / NODE_WIDTH));
    const result: PathSegment[][] = [];
    let currentRow: PathSegment[] = [];
    let currentSlots = 0;

    for (let i = 0; i < GAME_PATH.length; i++) {
      const seg = GAME_PATH[i];
      const slots = segmentSlotCount(seg);
      // Check if this is the last segment — if so, try to keep it on the current row
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

  // Hover debounce
  const handleMouseEnter = useCallback((name: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredSpace(name), 80);
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

  // Render a single node
  const renderNode = (spaceName: string) => {
    const space = spacesMap.get(spaceName);
    if (!space) return <span key={spaceName} className="pbm-node">{spaceName}</span>;

    const isCurrentSpace = currentPlayer?.currentSpace === spaceName;
    const isValidMove = validMoves.includes(spaceName);
    const isExpanded = expandedSpace === spaceName;
    const isHovered = hoveredSpace === spaceName && !isCurrentSpace && !isExpanded;
    const playersHere = getPlayersOnSpace(spaceName);
    const visited = isVisited(spaceName);

    const npcPrefix = extractPrefix(spaceName);
    const npcInfo = CHARACTER_MAP[npcPrefix];
    const accentColor = npcInfo?.color;

    const nodeClass = [
      'pbm-node',
      isCurrentSpace && 'pbm-node--current',
      !isCurrentSpace && isValidMove && 'pbm-node--valid-move',
      !isCurrentSpace && !isValidMove && visited && 'pbm-node--visited',
      playersHere.length > 0 && !isCurrentSpace && 'pbm-node--has-players',
    ].filter(Boolean).join(' ');

    const nodeStyle: React.CSSProperties = {};
    if (accentColor && !isCurrentSpace) {
      nodeStyle.borderLeftWidth = '3px';
      nodeStyle.borderLeftColor = accentColor;
    }
    if (playersHere.length > 0 && !isCurrentSpace && !isValidMove) {
      nodeStyle.borderColor = accentColor || '#28a745';
    }

    // Current space: compact blue pulsing node (detail shown below snake)
    if (isCurrentSpace) {
      return (
        <motion.div key={spaceName} layout transition={springTransition} className="pbm-slot">
          <div className={nodeClass} style={nodeStyle} title={spaceName}>
            <span>{shortDisplayName(spaceName)}</span>
            {playersHere.length > 0 && (
              <div className="pbm-node-avatars">
                {playersHere.slice(0, 3).map(p => (
                  <div key={p.id} className="pbm-node-avatar"
                    style={{ background: p.color || '#007bff' }} title={p.name}>
                    {p.avatar || p.name.charAt(0)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      );
    }

    // Expanded (clicked) tile
    if (isExpanded) {
      const content = space.content?.find(c => c.visit_type === 'First') || space.content?.[0];
      const npcName = npcInfo?.name;
      return (
        <motion.div key={spaceName} layout transition={springTransition} className="pbm-slot"
          onMouseLeave={() => { handleMouseLeave(); setExpandedSpace(null); }}>
          <div className="pbm-expanded-detail" onClick={() => setExpandedSpace(null)}>
            <div className="pbm-detail-header" style={{ borderLeftColor: accentColor || '#007bff' }}>
              <strong>{spaceName}</strong>
              {content?.title && <span className="pbm-detail-title">{content.title}</span>}
            </div>
            {content?.story && (
              <div className="pbm-detail-story">
                {npcName && <span className="pbm-detail-npc">{npcName} says:</span>}
                <p>{content.story}</p>
              </div>
            )}
            {content?.action_description && (
              <div className="pbm-detail-action">
                <strong>PM Action:</strong> {content.action_description}
              </div>
            )}
            {playersHere.length > 0 && (
              <div className="pbm-detail-players">
                {playersHere.map(p => (
                  <span key={p.id} className="pbm-detail-player-badge" style={{ background: p.color || '#007bff' }}>
                    {p.avatar || p.name.charAt(0)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      );
    }

    // Valid move: show medium GameSpace tile
    if (isValidMove) {
      return (
        <motion.div key={spaceName} layout transition={springTransition} className="pbm-slot"
          onMouseEnter={() => handleMouseEnter(spaceName)} onMouseLeave={handleMouseLeave}>
          <div className="pbm-expanded-tile" onClick={() => setExpandedSpace(spaceName)}>
            <GameSpace space={space} playersOnSpace={playersHere}
              isValidMoveDestination={true} isCurrentPlayerSpace={false}
              showMovementIndicators={true} />
          </div>
        </motion.div>
      );
    }

    // Hovered: show GameSpace tile
    if (isHovered) {
      return (
        <motion.div key={spaceName} layout transition={springTransition} className="pbm-slot"
          onMouseEnter={() => handleMouseEnter(spaceName)} onMouseLeave={handleMouseLeave}>
          <div className="pbm-expanded-tile" onClick={() => setExpandedSpace(spaceName)}>
            <GameSpace space={space} playersOnSpace={playersHere}
              isValidMoveDestination={false} isCurrentPlayerSpace={false}
              showMovementIndicators={false} />
          </div>
        </motion.div>
      );
    }

    // Default: compact node
    return (
      <motion.div key={spaceName} layout transition={springTransition} className="pbm-slot"
        onMouseEnter={() => handleMouseEnter(spaceName)} onMouseLeave={handleMouseLeave}>
        <div className={nodeClass} style={nodeStyle} title={spaceName}
          onClick={() => setExpandedSpace(spaceName)}>
          <span>{shortDisplayName(spaceName)}</span>
          {playersHere.length > 0 && (
            <div className="pbm-node-avatars">
              {playersHere.slice(0, 3).map(p => (
                <div key={p.id} className="pbm-node-avatar"
                  style={{ background: p.color || '#007bff' }} title={p.name}>
                  {p.avatar || p.name.charAt(0)}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderConnector = (key: string) => (
    <div key={key} className="pbm-connector" />
  );

  // Render a fork segment (parallel branches, no labels — text is in the boxes)
  const renderFork = (seg: Extract<PathSegment, { type: 'fork' }>, segIdx: number) => {
    return (
      <div key={`fork-${segIdx}`} className="pbm-fork">
        {seg.branches.map((branch, bi) => (
          <div key={bi} className="pbm-fork-branch">
            <div className="pbm-fork-connector-col">
              <span className={`pbm-fork-glyph ${bi === 0 ? 'pbm-fork-glyph--top' : 'pbm-fork-glyph--bot'}`}>
                {bi === 0 ? '\u252C' : '\u2514'}
              </span>
            </div>
            {branch.nodes.map((spaceName) => (
              <React.Fragment key={spaceName}>
                {renderConnector(`fc-${spaceName}`)}
                {renderNode(spaceName)}
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Render a legs segment — parent node with one child above and one below, diagonal lines
  const renderLegs = (seg: Extract<PathSegment, { type: 'legs' }>, segIdx: number) => {
    return (
      <div key={`legs-${segIdx}`} className="pbm-legs">
        {/* Left: parent node */}
        <div className="pbm-legs-parent">
          {renderNode(seg.parent)}
        </div>
        {/* Right column: above node, below node, with SVG diagonal lines */}
        <div className="pbm-legs-branches">
          <div className="pbm-legs-branch-above">
            {renderNode(seg.above)}
          </div>
          <div className="pbm-legs-branch-below">
            {renderNode(seg.below)}
          </div>
          {/* SVG diagonal lines overlaying the gap between parent and branches */}
          <svg className="pbm-legs-lines" viewBox="0 0 30 72" preserveAspectRatio="none">
            <line x1="0" y1="36" x2="30" y2="6" stroke="#6c757d" strokeWidth="3" />
            <line x1="0" y1="36" x2="30" y2="66" stroke="#6c757d" strokeWidth="3" />
          </svg>
        </div>
      </div>
    );
  };

  // Render a single segment
  const renderSegment = (seg: PathSegment, segIdx: number, showLeadConnector: boolean) => {
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
        {renderNode(seg.name)}
      </React.Fragment>
    );
  };

  return (
    <div className="progress-bar-map" ref={containerRef}>
      <div className="pbm-snake">
        {rows.map((row, ri) => {
          const isReversed = ri % 2 === 1;
          const displayRow = isReversed ? [...row].reverse() : row;
          let globalOffset = 0;
          for (let r = 0; r < ri; r++) globalOffset += rows[r].length;

          return (
            <React.Fragment key={`row-${ri}`}>
              {ri > 0 && (
                <div className={`pbm-uturn ${isReversed ? 'pbm-uturn--right' : 'pbm-uturn--left'}`}>
                  <div className="pbm-uturn-line" />
                </div>
              )}
              <div className={`pbm-row ${isReversed ? 'pbm-row--reverse' : ''}`}>
                {displayRow.map((seg, si) => {
                  const origIdx = isReversed ? (globalOffset + row.length - 1 - si) : (globalOffset + si);
                  return renderSegment(seg, origIdx, si > 0);
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Current space detail panel */}
      {currentPlayer?.currentSpace && (() => {
        const space = spacesMap.get(currentPlayer.currentSpace);
        if (!space) return null;
        const content = space.content?.find(c => c.visit_type === 'First') || space.content?.[0];
        const npcPrefix = extractPrefix(currentPlayer.currentSpace);
        const npcInfo = CHARACTER_MAP[npcPrefix];
        const accentColor = npcInfo?.color;
        const npcName = npcInfo?.name;
        return (
          <div className="pbm-current-detail" style={{ borderLeftColor: accentColor || '#007bff' }}>
            <div className="pbm-current-detail-header">
              <strong>{currentPlayer.currentSpace}</strong>
              {content?.title && <span className="pbm-detail-title">{content.title}</span>}
            </div>
            {content?.story && (
              <div className="pbm-detail-story">
                {npcName && <span className="pbm-detail-npc">{npcName} says:</span>}
                <p>{content.story}</p>
              </div>
            )}
            {content?.action_description && (
              <div className="pbm-detail-action">
                <strong>PM Action:</strong> {content.action_description}
              </div>
            )}
          </div>
        );
      })()}

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
