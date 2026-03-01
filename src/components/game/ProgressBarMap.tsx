// src/components/game/ProgressBarMap.tsx
//
// Snake-path mini map with side quest legs — fully data-driven.
// Walks the movement graph from starting spaces to build the path layout.
// Main path determined by path_type; side quests branch downward as legs.
// Current player's node expands inline to show PlayerPanelWrapper.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameContext } from '../../context/GameContext';
import { GameSpace } from './GameSpace';
import { PlayerPanelWrapper } from '../player/PlayerPanelWrapper';
import { Space, Player } from '../../types/DataTypes';
import { IServiceContainer } from '../../types/ServiceContracts';
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
  // Title-case: SCOPE-INITIATION → Scope Init
  return name.split('-').map(w => {
    if (w.length <= 2) return w; // keep short words as-is (e.g. "or")
    const lc = w.toLowerCase();
    // Abbreviate long words
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

// Side quest path_types (case-insensitive match)
function isSideQuestType(pathType: string): boolean {
  return pathType.toLowerCase().includes('side quest');
}

// "Choice branch" path types — parallel paths (e.g., DOB exam Regular vs Prof)
function isChoiceBranchType(pathType: string): boolean {
  return pathType === 'Regular' || pathType === 'Prof';
}

// Is this a main-path space?
function isMainPathType(pathType: string): boolean {
  return !isSideQuestType(pathType) && !isChoiceBranchType(pathType);
}

// ------- Path structure types -------

interface PathBranch {
  parentSpace: string;  // Main path node this branches from
  label: string;        // Branch label (phase name of branch nodes)
  nodes: string[];      // Ordered nodes in this branch
}

interface PathPhaseGroup {
  phase: string;
  label: string;
  mainNodes: string[];            // Ordered main path nodes in this phase
  branches: Map<string, PathBranch[]>; // keyed by main node name
}

// ------- Build path from data -------

function buildSnakePath(
  dataService: { getAllSpaces: () => Space[]; getGameConfigBySpace: (name: string) => any; getMovement: (name: string, vt: 'First' | 'Subsequent') => any; getDiceOutcome: (name: string, vt: 'First' | 'Subsequent') => any }
): PathPhaseGroup[] {
  const allSpaces = dataService.getAllSpaces();
  const gameSpaces = allSpaces.filter(s => {
    const config = dataService.getGameConfigBySpace(s.name);
    return config?.path_type !== 'Tutorial' && config?.path_type !== 'none';
  });

  const configMap = new Map<string, any>();
  const spaceSet = new Set<string>();
  for (const s of gameSpaces) {
    const config = dataService.getGameConfigBySpace(s.name);
    configMap.set(s.name, config);
    spaceSet.add(s.name);
  }

  // Get all destinations from a space (movement + dice outcomes)
  const getDestinations = (spaceName: string): string[] => {
    const dests = new Set<string>();
    for (const vt of ['First', 'Subsequent'] as const) {
      const mov = dataService.getMovement(spaceName, vt);
      if (mov) {
        [mov.destination_1, mov.destination_2, mov.destination_3, mov.destination_4, mov.destination_5]
          .filter((d: string | undefined): d is string => !!d && spaceSet.has(d))
          .forEach(d => dests.add(d));
      }
      const dice = dataService.getDiceOutcome(spaceName, vt);
      if (dice) {
        [dice.roll_1, dice.roll_2, dice.roll_3, dice.roll_4, dice.roll_5, dice.roll_6]
          .filter((d: string | undefined): d is string => !!d)
          .flatMap(d => d.split(' or ').map(s => s.trim()))
          .filter(d => spaceSet.has(d))
          .forEach(d => dests.add(d));
      }
    }
    return Array.from(dests);
  };

  // 1. Walk main path from starting spaces
  const startingSpaces = gameSpaces
    .filter(s => configMap.get(s.name)?.is_starting_space)
    .map(s => s.name);

  const mainPath: string[] = [];
  const mainPathSet = new Set<string>();
  const visited = new Set<string>();

  // BFS preferring main-path-type destinations
  const queue = [...startingSpaces];
  // Add starting spaces to main path
  for (const start of startingSpaces) {
    if (!mainPathSet.has(start)) {
      mainPath.push(start);
      mainPathSet.add(start);
    }
    visited.add(start);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dests = getDestinations(current);

    for (const dest of dests) {
      if (visited.has(dest)) continue;
      visited.add(dest);

      const destConfig = configMap.get(dest);
      const destPathType = destConfig?.path_type || '';

      if (isMainPathType(destPathType)) {
        mainPath.push(dest);
        mainPathSet.add(dest);
        queue.push(dest);
      }
      // Side quests and choice branches are handled below
    }
  }

  // 2. Find spaces not on main path — these are branches
  const branchSpaces = gameSpaces.filter(s => !mainPathSet.has(s.name)).map(s => s.name);

  // 3. For each branch space, find which main path node connects to it
  const branchMap = new Map<string, PathBranch[]>(); // keyed by parent main node

  // Group branch spaces by their parent main node and phase
  const branchGroups = new Map<string, { parent: string; phase: string; nodes: string[] }>();

  for (const branchSpace of branchSpaces) {
    const config = configMap.get(branchSpace);
    const phase = config?.phase || 'Unknown';

    // Find main path node(s) that connect to this branch space
    let parentNode: string | null = null;
    for (const mainNode of mainPath) {
      const dests = getDestinations(mainNode);
      if (dests.includes(branchSpace)) {
        parentNode = mainNode;
        break;
      }
    }

    // If no direct main path parent, check if another branch space connects to it
    if (!parentNode) {
      for (const otherBranch of branchSpaces) {
        if (otherBranch === branchSpace) continue;
        const dests = getDestinations(otherBranch);
        if (dests.includes(branchSpace)) {
          // Find the parent of the other branch space
          for (const mainNode of mainPath) {
            const mainDests = getDestinations(mainNode);
            if (mainDests.includes(otherBranch)) {
              parentNode = mainNode;
              break;
            }
          }
          break;
        }
      }
    }

    if (!parentNode) parentNode = mainPath[0]; // fallback

    const groupKey = `${parentNode}|${phase}`;
    if (!branchGroups.has(groupKey)) {
      branchGroups.set(groupKey, { parent: parentNode, phase, nodes: [] });
    }
    branchGroups.get(groupKey)!.nodes.push(branchSpace);
  }

  // Convert branch groups to PathBranch objects
  for (const [, group] of branchGroups) {
    if (!branchMap.has(group.parent)) {
      branchMap.set(group.parent, []);
    }
    branchMap.get(group.parent)!.push({
      parentSpace: group.parent,
      label: group.phase,
      nodes: group.nodes,
    });
  }

  // 4. Group main path into phases
  const phaseGroups: PathPhaseGroup[] = [];
  let currentPhase = '';

  for (const spaceName of mainPath) {
    const config = configMap.get(spaceName);
    const phase = config?.phase || 'Unknown';

    if (phase !== currentPhase) {
      phaseGroups.push({
        phase,
        label: phase.charAt(0) + phase.slice(1).toLowerCase(),
        mainNodes: [spaceName],
        branches: new Map(),
      });
      currentPhase = phase;
    } else {
      phaseGroups[phaseGroups.length - 1].mainNodes.push(spaceName);
    }
  }

  // Attach branches to phase groups
  for (const group of phaseGroups) {
    for (const nodeName of group.mainNodes) {
      const branches = branchMap.get(nodeName);
      if (branches) {
        group.branches.set(nodeName, branches);
      }
    }
  }

  return phaseGroups;
}

// ------- Component -------

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 25 };

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

  const [spacesMap, setSpacesMap] = useState<Map<string, Space>>(new Map());
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load spaces into map
  useEffect(() => {
    const map = new Map<string, Space>();
    for (const s of dataService.getAllSpaces()) map.set(s.name, s);
    setSpacesMap(map);
  }, [dataService]);

  // Build path structure from data
  const phaseGroups = useMemo(
    () => buildSnakePath(dataService),
    [dataService]
  );

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

    // Active: expand to PlayerPanelWrapper
    if (isCurrentSpace && currentPlayerId) {
      return (
        <motion.div key={spaceName} layout transition={springTransition} className="pbm-slot">
          <div className="pbm-expanded-panel">
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
        </motion.div>
      );
    }

    // Expanded (clicked) tile — show space story + action detail
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

    // Valid move: show medium GameSpace tile, click to expand
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

    // Hovered: show GameSpace tile, click to expand
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
  };

  const renderConnector = (visited: boolean, key: string) => (
    <div key={key} className={`pbm-connector${visited ? ' pbm-connector--visited' : ''}`} />
  );

  const renderBranchNodes = (branch: PathBranch) => (
    <React.Fragment key={`${branch.parentSpace}-${branch.label}`}>
      {branch.nodes.map((spaceName, ni) => (
        <React.Fragment key={spaceName}>
          {renderConnector(isVisited(spaceName), `bc-${spaceName}`)}
          {renderNode(spaceName)}
        </React.Fragment>
      ))}
    </React.Fragment>
  );

  return (
    <div className="progress-bar-map">
      <div className="pbm-snake">
        {phaseGroups.map((group, si) => (
          <React.Fragment key={`${group.phase}-${si}`}>
            {si > 0 && <div className="pbm-phase-connector" />}
            {group.mainNodes.map((spaceName, ni) => {
              const branches = group.branches.get(spaceName) || [];
              return (
                <React.Fragment key={spaceName}>
                  {ni > 0 && renderConnector(isVisited(spaceName), `mc-${spaceName}`)}
                  {renderNode(spaceName)}
                  {branches.map(b => renderBranchNodes(b))}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        ))}
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
