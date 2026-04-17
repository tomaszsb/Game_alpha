// ===================================================================
// Board Layout Engine — extracted from board_v3_prototype.html
// Pure logic functions for building the game board path, edges, and layout.
// No DOM dependencies — fully testable.
// ===================================================================

// ===================================================================
// CONSTANTS
// ===================================================================
export const BOARD = {
  SLOT_W:        190,
  CONNECTOR_W:   8,
  TOTAL_SLOT:    198,
  TILE_W:        74,
  TILE_MIN_H:    34,
  BRANCH_H:      50,
  CONNECTOR_H:   4,
  UTURN_GAP:     6,
  ARM_W:         8,
  LINE_W:        4,
  LEGS_GAP:      4,
  TURN_ENTRY_W:  10,
  CORNER_R:      8,
  EDGE_MARGIN:   14,
  LINE_SPACING:  6,
};

export const PHASE_COLORS: Record<string, { border: string; text: string }> = {
  'SETUP':        { border: '#2196F3', text: '#1565c0' },
  'OWNER':        { border: '#2196F3', text: '#1565c0' },
  'FUNDING':      { border: '#FF9800', text: '#f57f17' },
  'DESIGN':       { border: '#9C27B0', text: '#7b1fa2' },
  'REGULATORY':   { border: '#f44336', text: '#c62828' },
  'CONSTRUCTION': { border: '#4CAF50', text: '#2e7d32' },
  'END':          { border: '#009688', text: '#00695c' },
};

export const PHASE_RANK: Record<string, number> = {
  SETUP: 0, OWNER: 1, FUNDING: 2, DESIGN: 3, REGULATORY: 4, CONSTRUCTION: 5, END: 6,
};

export const NPC_PREFIXES = [
  'OWNER-', 'ARCH-', 'ENG-', 'REG-DOB-', 'REG-FDNY-', 'CON-', 'PM-',
  'LEND-', 'BANK-', 'INVESTOR-', 'CHEAT-',
];

export const SPECIAL_NAMES: Record<string, string> = {
  'FINISH': 'Finish',
  'PM-DECISION-CHECK': 'PM Check',
  'START-QUICK-PLAY-GUIDE': 'Quick Play',
  'BANK-FUND-REVIEW': 'Bank Review',
  'INVESTOR-FUND-REVIEW': 'Investor Review',
};

// ===================================================================
// TYPES
// ===================================================================
export interface ConfigRow {
  space_name: string;
  phase: string;
  path_type: string;
  is_starting_space: string;
  [key: string]: string;
}

export interface MovementRow {
  space_name: string;
  visit_type: string;
  movement_type: string;
  destination_1: string;
  destination_2: string;
  destination_3: string;
  destination_4: string;
  destination_5: string;
  [key: string]: string;
}

export interface DiceRow {
  space_name: string;
  visit_type: string;
  roll_1: string;
  roll_2: string;
  roll_3: string;
  roll_4: string;
  roll_5: string;
  roll_6: string;
  [key: string]: string;
}

export type PathSegment =
  | { type: 'node'; name: string }
  | { type: 'legs'; parent: string; children: string[] }
  | { type: 'fork'; choice: boolean; branches: ForkBranch[] };

export interface ForkBranch {
  nodes: BranchItem[];
}

export type BranchItem =
  | string
  | { type: 'convergence'; name: string }
  | { type: 'mini-fork'; branches: string[][] };

export type Edge = [string, string] | [string, string, string];

export interface Point {
  x: number;
  y: number;
}

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

export function shortName(s: string): string {
  if (SPECIAL_NAMES[s]) return SPECIAL_NAMES[s];
  let name = s;
  for (const p of NPC_PREFIXES) {
    if (name.startsWith(p)) { name = name.slice(p.length); break; }
  }
  return name.split('-').map(w =>
    w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.toLowerCase().slice(1)
  ).join(' ');
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s;
}

export function branchFamily(name: string): string {
  const parts = name.split('-');
  return parts[0] === 'REG' ? parts.slice(0, 2).join('-') : parts[0];
}

// ===================================================================
// FLATTEN BRANCH NODES
// ===================================================================
export function flattenBranchNodes(nodes: BranchItem[]): string[] {
  const flat: string[] = [];
  for (const n of nodes) {
    if (typeof n === 'string') flat.push(n);
    else if (n.type === 'convergence') flat.push(n.name);
    else if (n.type === 'mini-fork') {
      for (const br of n.branches) flat.push(...br);
    }
  }
  return flat;
}

// ===================================================================
// CSV PARSING
// ===================================================================
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0, field = '', inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
      else if (ch === '"') { inQuotes = false; i++; }
      else { field += ch; i++; }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { fields.push(field); field = ''; i++; }
      else { field += ch; i++; }
    }
  }
  fields.push(field);
  return fields;
}

export function parseCSV<T extends Record<string, string>>(text: string): T[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj as T;
  });
}

// ===================================================================
// DATA LOOKUP BUILDERS
// ===================================================================
export interface DataMaps {
  configMap: Record<string, ConfigRow>;
  configOrder: Record<string, number>;
  movementMap: Record<string, Record<string, MovementRow>>;
  diceMap: Record<string, Record<string, DiceRow>>;
  phaseMap: Record<string, string>;
}

export function buildDataMaps(
  configRows: ConfigRow[],
  movementRows: MovementRow[],
  diceRows: DiceRow[]
): DataMaps {
  const configMap: Record<string, ConfigRow> = {};
  const configOrder: Record<string, number> = {};
  const movementMap: Record<string, Record<string, MovementRow>> = {};
  const diceMap: Record<string, Record<string, DiceRow>> = {};
  const phaseMap: Record<string, string> = {};

  const PHASE_DISPLAY: Record<string, string> = { SETUP: 'OWNER' };

  for (const r of configRows) configMap[r.space_name] = r;
  configRows.forEach((r, i) => { configOrder[r.space_name] = i; });
  for (const r of movementRows) {
    if (!movementMap[r.space_name]) movementMap[r.space_name] = {};
    movementMap[r.space_name][r.visit_type] = r;
  }
  for (const r of diceRows) {
    if (!diceMap[r.space_name]) diceMap[r.space_name] = {};
    diceMap[r.space_name][r.visit_type] = r;
  }
  for (const r of configRows) {
    phaseMap[r.space_name] = PHASE_DISPLAY[r.phase] || r.phase;
  }

  return { configMap, configOrder, movementMap, diceMap, phaseMap };
}

// ===================================================================
// GRAPH WALKER — builds GAME_PATH from data
// ===================================================================
export interface BuildResult {
  path: PathSegment[];
  placed: Set<string>;
  getMovement: (spaceName: string, visitType?: string) => { type: string; destinations: string[] };
  getDiceReachable: (spaceName: string) => string[];
}

export function buildGamePathFromData(
  movementRows: MovementRow[],
  configRows: ConfigRow[],
  diceRows: DiceRow[]
): BuildResult {
  const { configMap, configOrder, movementMap, diceMap } = buildDataMaps(configRows, movementRows, diceRows);

  function rank(spaceName: string): number {
    return PHASE_RANK[configMap[spaceName]?.phase] ?? -1;
  }

  function getMovement(spaceName: string, visitType?: string): { type: string; destinations: string[] } {
    const mov = movementMap[spaceName]?.[visitType || 'First'];
    if (!mov) return { type: 'none', destinations: [] };
    const dests = [mov.destination_1, mov.destination_2, mov.destination_3, mov.destination_4, mov.destination_5].filter(Boolean);
    return { type: mov.movement_type, destinations: dests };
  }

  function getDiceReachable(spaceName: string): string[] {
    const dests = new Set<string>();
    for (const vt of ['First', 'Subsequent']) {
      const dr = diceMap[spaceName]?.[vt];
      if (!dr) continue;
      for (const roll of [dr.roll_1, dr.roll_2, dr.roll_3, dr.roll_4, dr.roll_5, dr.roll_6]) {
        if (roll) roll.split(' or ').forEach(d => { const t = d.trim(); if (t) dests.add(t); });
      }
    }
    return [...dests];
  }

  function isSideQuest(spaceName: string): boolean {
    const pt = configMap[spaceName]?.path_type?.toLowerCase() || '';
    return pt.includes('side quest');
  }

  function sortByForward(arr: string[]): string[] {
    return arr.sort((a, b) => rank(a) - rank(b) || (configOrder[a] ?? 99) - (configOrder[b] ?? 99));
  }

  const placed = new Set<string>();
  const path: PathSegment[] = [];
  let current: string | null | undefined = configRows.find(r => r.is_starting_space === 'Yes')?.space_name;

  while (current) {
    if (placed.has(current)) break;
    const cfg = configMap[current];
    if (!cfg) break;
    const { type: movType, destinations } = getMovement(current);

    // === Special hub node (PM-DECISION-CHECK) ===
    if (cfg.path_type === 'Special') {
      const subInfo = getMovement(current, 'Subsequent');
      const allDests = [...new Set([...destinations, ...subInfo.destinations])];
      const parentPhase = cfg.phase;

      const samePhaseLegs = allDests
        .filter(d => d !== current && isSideQuest(d) && configMap[d]?.phase === parentPhase)
        .sort((a, b) => (configOrder[a] ?? 99) - (configOrder[b] ?? 99));

      const seg: PathSegment = { type: 'legs', parent: current, children: samePhaseLegs };
      path.push(seg);

      placed.add(current);
      samePhaseLegs.forEach(d => placed.add(d));

      const allLegs = new Set(samePhaseLegs);
      const forward = sortByForward(destinations.filter(d => !placed.has(d) && !allLegs.has(d)));

      function walkChain(start: string, queue: string[]): BranchItem[] {
        const chain: BranchItem[] = [];
        let cur: string | null = start;
        while (cur && !placed.has(cur)) {
          chain.push(cur);
          placed.add(cur);
          const m = getMovement(cur);
          if (m.type === 'none') break;
          if (m.type === 'fixed') {
            cur = (m.destinations[0] && !placed.has(m.destinations[0])) ? m.destinations[0] : null;
            continue;
          }
          if (m.type === 'dice') {
            const diceReach = getDiceReachable(cur);
            const fwdDice = diceReach.filter(d => !placed.has(d));
            if (fwdDice.length === 0) { cur = null; continue; }
            if (fwdDice.length === 1) {
              const dest = fwdDice[0];
              const curFamily = branchFamily(cur);
              const destFamily = branchFamily(dest);
              if (destFamily === curFamily || getMovement(dest).type === 'none') {
                cur = dest;
                continue;
              }
              queue.push(dest);
              cur = null;
              continue;
            }
            const curPT = configMap[cur]?.path_type;
            const curPhase = configMap[cur]?.phase;
            const sameBranch = fwdDice.filter(d =>
              configMap[d]?.path_type === curPT && configMap[d]?.phase === curPhase
            );
            if (sameBranch.length === 1) {
              for (const d of sortByForward(fwdDice.filter(x => x !== sameBranch[0]))) queue.push(d);
              cur = sameBranch[0];
              continue;
            }
            for (const d of sortByForward(fwdDice)) queue.push(d);
            cur = null;
            continue;
          }
          if (m.type === 'choice') {
            const curCfg = configMap[cur];
            const fwd = m.destinations.filter(d => !placed.has(d));
            const hasBackEdge = m.destinations.some(d => placed.has(d));
            if (curCfg?.path_type === 'LOGIC') {
              const samePhase = fwd.filter(d => configMap[d]?.phase === curCfg.phase);
              const crossPhase = fwd.filter(d => configMap[d]?.phase !== curCfg.phase);
              const sorted = sortByForward(samePhase);
              for (let i = 1; i < sorted.length; i++) queue.push(sorted[i]);
              for (const d of sortByForward(crossPhase)) queue.push(d);
              cur = sorted[0] || null;
              continue;
            }
            if (fwd.length === 0) { cur = null; break; }
            if (hasBackEdge && fwd.length === 0) { cur = null; break; }
            if (fwd.length > 1) {
              const curPhase = configMap[cur]?.phase;
              const allSamePhase = fwd.every(d => configMap[d]?.phase === curPhase);
              if (allSamePhase && curCfg?.path_type !== 'LOGIC') {
                const miniBranches: string[][] = [];
                const forkFamily = branchFamily(cur);
                for (const d of fwd) {
                  const sub: string[] = [];
                  let sc: string | null = d;
                  while (sc && !placed.has(sc)) {
                    if (sub.length > 0 && branchFamily(sc) !== forkFamily) {
                      queue.push(sc);
                      sc = null;
                      break;
                    }
                    sub.push(sc);
                    placed.add(sc);
                    const sm = getMovement(sc);
                    if (sm.type === 'none') { sc = null; break; }
                    if (sm.type === 'fixed') {
                      sc = (sm.destinations[0] && !placed.has(sm.destinations[0])) ? sm.destinations[0] : null;
                    } else if (sm.type === 'dice') {
                      const dr: string[] = getDiceReachable(sc).filter((x: string) => !placed.has(x));
                      const sameFamily: string[] = dr.filter((x: string) => branchFamily(x) === forkFamily);
                      const otherFamily: string[] = dr.filter((x: string) => branchFamily(x) !== forkFamily);
                      const followable: string[] = sameFamily.filter((x: string) => {
                        const xReach = getDiceReachable(x);
                        const xDests = getMovement(x).destinations;
                        const allFwd = [...new Set([...xReach, ...xDests])];
                        return allFwd.some(dd => branchFamily(dd) === forkFamily);
                      });
                      for (const x of otherFamily) queue.push(x);
                      for (const x of sameFamily.filter((ss: string) => !followable.includes(ss))) queue.push(x);
                      sc = followable.length === 1 ? followable[0] : null;
                      if (followable.length > 1) for (const x of followable) queue.push(x);
                    } else {
                      sc = null;
                    }
                  }
                  miniBranches.push(sub);
                }
                chain.push({ type: 'mini-fork', branches: miniBranches });
                const subEnds = miniBranches.map(b => b[b.length - 1]);
                const convergeCandidates = new Map<string, number>();
                for (const end of subEnds) {
                  const reach = [...getDiceReachable(end), ...getMovement(end).destinations];
                  for (const r of reach) {
                    if (!placed.has(r) && branchFamily(r) === forkFamily) {
                      convergeCandidates.set(r, (convergeCandidates.get(r) || 0) + 1);
                    }
                  }
                }
                let converge: string | null = null;
                for (const [cName, count] of convergeCandidates) {
                  if (count > 1 || convergeCandidates.size === 1) { converge = cName; break; }
                }
                if (converge) {
                  chain.push({ type: 'convergence', name: converge });
                  placed.add(converge);
                  const cm = getMovement(converge);
                  if (cm.type === 'none') { cur = null; break; }
                  if (cm.type === 'fixed') {
                    const dest = cm.destinations[0];
                    cur = (dest && !placed.has(dest)) ? dest : null;
                  } else if (cm.type === 'dice') {
                    const cdr = getDiceReachable(converge).filter(x => !placed.has(x));
                    const terminal = cdr.find(x => getMovement(x).type === 'none');
                    cur = terminal || null;
                  } else { cur = null; }
                  if (!cur) break;
                  continue;
                }
                cur = null;
                break;
              }
            }
            if (hasBackEdge) {
              for (const d of sortByForward(fwd)) queue.push(d);
              cur = null;
              break;
            }
            if (fwd.length > 1) {
              const sorted = sortByForward(fwd);
              for (let i = 1; i < sorted.length; i++) queue.push(sorted[i]);
              cur = sorted[0];
              continue;
            }
            cur = fwd[0];
            continue;
          }
        }
        return chain;
      }

      const seedQueue = [...forward];
      const branches: ForkBranch[] = [];
      while (seedQueue.length > 0) {
        const seed = seedQueue.shift()!;
        if (placed.has(seed)) continue;
        const chain = walkChain(seed, seedQueue);
        if (chain.length > 0) branches.push({ nodes: chain });
      }

      // Post-process: merge single-node orphan tails into parent branches
      const hubNodes = new Set([current, ...samePhaseLegs]);
      const hubReachable = new Set<string>();
      for (const hn of hubNodes) {
        const hMov = getMovement(hn);
        hMov.destinations.forEach(d => hubReachable.add(d));
        getDiceReachable(hn).forEach(d => hubReachable.add(d));
      }

      let merged = true;
      while (merged) {
        merged = false;
        for (let i = branches.length - 1; i >= 0; i--) {
          const flat_i = flattenBranchNodes(branches[i].nodes);
          const firstNode = flat_i[0];
          if (hubReachable.has(firstNode)) continue;
          const parents: number[] = [];
          for (let j = 0; j < branches.length; j++) {
            if (j === i) continue;
            const flat_j = flattenBranchNodes(branches[j].nodes);
            const lastNode = flat_j[flat_j.length - 1];
            const lastMov = getMovement(lastNode);
            const lastDice = getDiceReachable(lastNode);
            if (lastMov.destinations.includes(firstNode) || lastDice.includes(firstNode)) {
              parents.push(j);
            }
          }
          if (flat_i.length === 1 && parents.length >= 1) {
            const targetPhase = configMap[firstNode]?.phase;
            const best = parents.sort((a, b) => {
              const flatA = flattenBranchNodes(branches[a].nodes);
              const flatB = flattenBranchNodes(branches[b].nodes);
              const lastA = flatA[flatA.length - 1];
              const lastB = flatB[flatB.length - 1];
              const sameA = configMap[lastA]?.phase === targetPhase ? 1 : 0;
              const sameB = configMap[lastB]?.phase === targetPhase ? 1 : 0;
              if (sameA !== sameB) return sameB - sameA;
              return rank(lastB) - rank(lastA);
            })[0];
            branches[best].nodes.push(...branches[i].nodes);
            branches.splice(i, 1);
            merged = true;
            break;
          }
        }
      }

      // Sort branches by phase rank then prefix
      function branchSortKey(br: ForkBranch) {
        const name = flattenBranchNodes(br.nodes)[0];
        const r = rank(name);
        const prefix = name.replace(/-[^-]+$/, '');
        return { rank: r, prefix, order: configOrder[name] ?? 99 };
      }
      branches.sort((a, b) => {
        const ka = branchSortKey(a), kb = branchSortKey(b);
        if (ka.rank !== kb.rank) return ka.rank - kb.rank;
        if (ka.prefix !== kb.prefix) return ka.prefix < kb.prefix ? -1 : 1;
        return ka.order - kb.order;
      });

      if (branches.length > 0) {
        path.push({ type: 'fork', choice: true, branches });
      }
      current = null;
      continue;
    }

    // === Terminal ===
    if (movType === 'none') {
      path.push({ type: 'node', name: current });
      placed.add(current);
      current = null;
      continue;
    }

    // === Fixed ===
    if (movType === 'fixed') {
      path.push({ type: 'node', name: current });
      placed.add(current);
      current = (destinations[0] && !placed.has(destinations[0])) ? destinations[0] : null;
      continue;
    }

    // === Dice ===
    if (movType === 'dice') {
      path.push({ type: 'node', name: current });
      placed.add(current);
      const reachable = getDiceReachable(current);
      const forward = reachable.filter(d => !placed.has(d));
      forward.sort((a, b) => rank(b) - rank(a) || (configOrder[a] ?? 99) - (configOrder[b] ?? 99));
      current = forward[0] || null;
      continue;
    }

    // === Choice ===
    if (movType === 'choice') {
      const forward = destinations.filter(d => !placed.has(d));

      if (cfg.path_type === 'LOGIC') {
        path.push({ type: 'node', name: current });
        placed.add(current);
        current = sortByForward(forward)[0] || null;
        continue;
      }

      if (forward.length <= 1) {
        path.push({ type: 'node', name: current });
        placed.add(current);
        current = forward[0] || null;
        continue;
      }

      // Multiple forward → fork
      path.push({ type: 'node', name: current });
      placed.add(current);

      const branches: ForkBranch[] = [];
      for (const startDest of forward) {
        const branch: string[] = [];
        let bCur: string | null = startDest;
        while (bCur && !placed.has(bCur)) {
          branch.push(bCur);
          placed.add(bCur);
          const bInfo = getMovement(bCur);
          if (bInfo.type === 'fixed' && bInfo.destinations[0] && !placed.has(bInfo.destinations[0])) {
            bCur = bInfo.destinations[0];
          } else if (bInfo.type === 'dice') {
            const diceReach = getDiceReachable(bCur);
            const sameBranch = diceReach.filter(d =>
              !placed.has(d) && configMap[d]?.path_type === configMap[bCur!]?.path_type
            );
            if (sameBranch.length === 1) { bCur = sameBranch[0]; }
            else break;
          } else {
            break;
          }
        }
        branches.push({ nodes: branch });
      }

      path.push({ type: 'fork', choice: true, branches });

      // Find next node after fork
      let candidates: string[] = [];
      for (const br of branches) {
        const lastNode = br.nodes[br.nodes.length - 1] as string;
        const brMov = getMovement(lastNode);
        const reachable = brMov.type === 'dice' ? getDiceReachable(lastNode) : brMov.destinations;
        for (const dest of reachable) {
          if (!placed.has(dest)) {
            candidates.push(dest);
          } else {
            const backMov = getMovement(dest);
            const backReach = backMov.type === 'dice' ? getDiceReachable(dest) : backMov.destinations;
            for (const bd of backReach) {
              if (!placed.has(bd)) candidates.push(bd);
            }
          }
        }
      }
      candidates = sortByForward([...new Set(candidates)]);
      current = candidates[0] || null;
      continue;
    }

    break;
  }

  return { path, placed, getMovement, getDiceReachable };
}

// ===================================================================
// EDGE BUILDER
// ===================================================================
export function buildEdges(gamePath: PathSegment[]): Edge[] {
  const edges: Edge[] = [];
  let prev: string[] = [];
  for (const seg of gamePath) {
    if (seg.type === 'node') {
      for (const p of prev) edges.push([p, seg.name]);
      prev = [seg.name];
    } else if (seg.type === 'legs') {
      for (const p of prev) edges.push([p, seg.parent]);
      for (const child of seg.children) {
        edges.push([seg.parent, child]);
      }
      prev = [seg.parent];
    } else if (seg.type === 'fork') {
      const outs: string[] = [];
      const branchEndsAndStarts: { start: string; ends: string[]; activeEnds: string[] }[] = [];
      for (const br of seg.branches) {
        let lastNames = [...prev];
        let activeEnds = [...prev];
        const flat = flattenBranchNodes(br.nodes);
        const brStart = flat[0];
        for (let i = 0; i < br.nodes.length; i++) {
          const item = br.nodes[i];
          if (typeof item === 'string') {
            for (const ln of lastNames) edges.push([ln, item]);
            lastNames = [item];
            if (item !== 'FINISH') activeEnds = [item];
          } else if (item.type === 'convergence') {
            lastNames = [item.name];
          } else if (item.type === 'mini-fork') {
            const branchOuts: string[] = [];
            for (const sub of item.branches) {
              for (const ln of lastNames) edges.push([ln, sub[0]]);
              for (let si = 1; si < sub.length; si++) edges.push([sub[si-1], sub[si]]);
              branchOuts.push(sub[sub.length - 1]);
            }
            lastNames = branchOuts;
            activeEnds = [...branchOuts];
          }
        }
        branchEndsAndStarts.push({ start: brStart, ends: lastNames, activeEnds });
        outs.push(...lastNames);
      }
      // Row-end → next-row-start edges
      for (let i = 0; i < branchEndsAndStarts.length - 1; i++) {
        const nextStart = branchEndsAndStarts[i + 1].start;
        const aEnds = branchEndsAndStarts[i].activeEnds;
        if (aEnds.length <= 1) {
          for (const end of aEnds) edges.push([end, nextStart]);
        } else {
          const bottomEnd = aEnds[aEnds.length - 1];
          for (let ae = 0; ae < aEnds.length - 1; ae++) {
            edges.push([aEnds[ae], bottomEnd, 'merge']);
          }
          edges.push([bottomEnd, nextStart]);
        }
      }
      prev = outs;
    }
  }
  return edges;
}

// ===================================================================
// GET ALL SPACE NAMES
// ===================================================================
export function getAllSpaceNames(gamePath: PathSegment[]): string[] {
  const names: string[] = [];
  for (const seg of gamePath) {
    if (seg.type === 'node') names.push(seg.name);
    else if (seg.type === 'legs') {
      names.push(...seg.children, seg.parent);
    }
    else if (seg.type === 'fork') seg.branches.forEach(b => names.push(...flattenBranchNodes(b.nodes)));
  }
  return names;
}

// ===================================================================
// ROW SPLITTING (flexbox snake)
// ===================================================================
function segSlots(seg: PathSegment): number {
  if (seg.type === 'node') return 1;
  if (seg.type === 'legs') return 1;
  return Math.max(...seg.branches.map(b => b.nodes.length));
}

export function splitRows(gamePath: PathSegment[], containerWidth: number): PathSegment[][] {
  const slotsPerRow = Math.max(4, Math.floor(containerWidth / BOARD.TOTAL_SLOT));
  const rows: PathSegment[][] = [];
  let row: PathSegment[] = [], slots = 0;
  for (let i = 0; i < gamePath.length; i++) {
    const seg = gamePath[i];
    const s = segSlots(seg);
    const isLast = i === gamePath.length - 1;
    if (row.length > 0 && slots + s > slotsPerRow && !isLast) {
      rows.push(row);
      row = [seg]; slots = s;
    } else {
      row.push(seg); slots += s;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

// ===================================================================
// SVG PATH GENERATION
// ===================================================================
export function smoothPath(pts: Point[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const r = Math.min(BOARD.CORNER_R, len1 / 2, len2 / 2);
    if (r < 1) { d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`; continue; }
    const ax = curr.x - (dx1 / len1) * r, ay = curr.y - (dy1 / len1) * r;
    const bx = curr.x + (dx2 / len2) * r, by = curr.y + (dy2 / len2) * r;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)}`;
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${pts[pts.length - 1].y.toFixed(1)}`;
  return d;
}

// ===================================================================
// PHASE HELPERS
// ===================================================================
export function phaseColor(name: string, phaseMap: Record<string, string>): string {
  const p = phaseMap[name];
  return p ? (PHASE_COLORS[p]?.border || '#adb5bd') : '#adb5bd';
}

export function phaseOf(name: string, phaseMap: Record<string, string>): string | null {
  return phaseMap[name] || null;
}
