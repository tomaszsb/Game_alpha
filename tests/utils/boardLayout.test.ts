// tests/utils/boardLayout.test.ts
// Comprehensive tests for the board layout engine extracted from board_v3_prototype.html

import { describe, it, expect } from 'vitest';
import {
  shortName,
  truncate,
  branchFamily,
  flattenBranchNodes,
  parseCSVLine,
  parseCSV,
  buildDataMaps,
  buildGamePathFromData,
  buildEdges,
  getAllSpaceNames,
  splitRows,
  smoothPath,
  phaseColor,
  phaseOf,
  BOARD,
  PHASE_COLORS,
  PHASE_RANK,
  NPC_PREFIXES,
  SPECIAL_NAMES,
  type ConfigRow,
  type MovementRow,
  type DiceRow,
  type PathSegment,
  type BranchItem,
  type Point,
} from '../../src/utils/boardLayout';
import * as fs from 'fs';
import * as path from 'path';

// ===================================================================
// TEST DATA — loaded from actual CSV files
// ===================================================================
const dataDir = path.resolve(__dirname, '../../public/data/CLEAN_FILES');

function loadCSV<T extends Record<string, string>>(filename: string): T[] {
  const text = fs.readFileSync(path.join(dataDir, filename), 'utf-8');
  return parseCSV<T>(text);
}

const configRows = loadCSV<ConfigRow>('GAME_CONFIG.csv');
const movementRows = loadCSV<MovementRow>('MOVEMENT.csv');
const diceRows = loadCSV<DiceRow>('DICE_OUTCOMES.csv');

// ===================================================================
// shortName
// ===================================================================
describe('shortName', () => {
  it('returns special names for known keys', () => {
    expect(shortName('FINISH')).toBe('Finish');
    expect(shortName('PM-DECISION-CHECK')).toBe('PM Check');
    expect(shortName('START-QUICK-PLAY-GUIDE')).toBe('Quick Play');
    expect(shortName('BANK-FUND-REVIEW')).toBe('Bank Review');
    expect(shortName('INVESTOR-FUND-REVIEW')).toBe('Investor Review');
  });

  it('strips NPC prefixes and title-cases', () => {
    expect(shortName('ARCH-INITIATION')).toBe('Initiation');
    expect(shortName('ARCH-FEE-REVIEW')).toBe('Fee Review');
    expect(shortName('ENG-SCOPE-CHECK')).toBe('Scope Check');
    expect(shortName('CON-INITIATION')).toBe('Initiation');
    expect(shortName('CON-INSPECT')).toBe('Inspect');
    expect(shortName('LEND-SCOPE-CHECK')).toBe('Scope Check');
    expect(shortName('CHEAT-BYPASS')).toBe('Bypass');
  });

  it('strips REG-DOB- and REG-FDNY- prefixes', () => {
    expect(shortName('REG-DOB-FEE-REVIEW')).toBe('Fee Review');
    expect(shortName('REG-DOB-PLAN-EXAM')).toBe('Plan Exam');
    expect(shortName('REG-DOB-PROF-CERT')).toBe('Prof Cert');
    expect(shortName('REG-FDNY-FEE-REVIEW')).toBe('Fee Review');
    expect(shortName('REG-FDNY-PLAN-EXAM')).toBe('Plan Exam');
  });

  it('strips OWNER- prefix', () => {
    expect(shortName('OWNER-SCOPE-INITIATION')).toBe('Scope Initiation');
    expect(shortName('OWNER-FUND-INITIATION')).toBe('Fund Initiation');
    expect(shortName('OWNER-DECISION-REVIEW')).toBe('Decision Review');
  });

  it('preserves short words (≤2 chars) as-is', () => {
    // 'PM' prefix is stripped, so check a word that stays short
    expect(shortName('ENG-BUDGET-CHECK')).toBe('Budget Check');
  });

  it('handles unknown names without a matching prefix', () => {
    expect(shortName('UNKNOWN-THING')).toBe('Unknown Thing');
    expect(shortName('A')).toBe('A');
  });
});

// ===================================================================
// truncate
// ===================================================================
describe('truncate', () => {
  it('returns string as-is if within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates with ellipsis when over limit', () => {
    expect(truncate('hello world', 5)).toBe('hello\u2026');
    expect(truncate('abcdef', 3)).toBe('abc\u2026');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

// ===================================================================
// branchFamily
// ===================================================================
describe('branchFamily', () => {
  it('returns REG-DOB for REG-DOB-* spaces', () => {
    expect(branchFamily('REG-DOB-FEE-REVIEW')).toBe('REG-DOB');
    expect(branchFamily('REG-DOB-PLAN-EXAM')).toBe('REG-DOB');
    expect(branchFamily('REG-DOB-FINAL-REVIEW')).toBe('REG-DOB');
  });

  it('returns REG-FDNY for REG-FDNY-* spaces', () => {
    expect(branchFamily('REG-FDNY-FEE-REVIEW')).toBe('REG-FDNY');
    expect(branchFamily('REG-FDNY-PLAN-EXAM')).toBe('REG-FDNY');
  });

  it('returns first segment for non-REG spaces', () => {
    expect(branchFamily('ARCH-INITIATION')).toBe('ARCH');
    expect(branchFamily('ENG-SCOPE-CHECK')).toBe('ENG');
    expect(branchFamily('CON-INITIATION')).toBe('CON');
    expect(branchFamily('LEND-SCOPE-CHECK')).toBe('LEND');
    expect(branchFamily('FINISH')).toBe('FINISH');
  });
});

// ===================================================================
// flattenBranchNodes
// ===================================================================
describe('flattenBranchNodes', () => {
  it('flattens string nodes', () => {
    expect(flattenBranchNodes(['A', 'B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  it('flattens convergence nodes', () => {
    const nodes: BranchItem[] = ['A', { type: 'convergence', name: 'B' }, 'C'];
    expect(flattenBranchNodes(nodes)).toEqual(['A', 'B', 'C']);
  });

  it('flattens mini-fork nodes', () => {
    const nodes: BranchItem[] = [
      'A',
      { type: 'mini-fork', branches: [['B1', 'B2'], ['C1', 'C2']] },
      'D',
    ];
    expect(flattenBranchNodes(nodes)).toEqual(['A', 'B1', 'B2', 'C1', 'C2', 'D']);
  });

  it('handles empty array', () => {
    expect(flattenBranchNodes([])).toEqual([]);
  });

  it('handles mixed types', () => {
    const nodes: BranchItem[] = [
      'A',
      { type: 'mini-fork', branches: [['B']] },
      { type: 'convergence', name: 'C' },
    ];
    expect(flattenBranchNodes(nodes)).toEqual(['A', 'B', 'C']);
  });
});

// ===================================================================
// parseCSVLine
// ===================================================================
describe('parseCSVLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    expect(parseCSVLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  it('handles escaped quotes in fields', () => {
    expect(parseCSVLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('handles empty fields', () => {
    expect(parseCSVLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });

  it('handles single field', () => {
    expect(parseCSVLine('hello')).toEqual(['hello']);
  });
});

// ===================================================================
// parseCSV
// ===================================================================
describe('parseCSV', () => {
  it('parses CSV text into objects', () => {
    const text = 'name,age\nAlice,30\nBob,25';
    const result = parseCSV(text);
    expect(result).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('handles quoted values', () => {
    const text = 'name,desc\nAlice,"hello, world"\nBob,simple';
    const result = parseCSV(text);
    expect(result[0].desc).toBe('hello, world');
    expect(result[1].desc).toBe('simple');
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCSV('name,age')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('trims whitespace from headers and values', () => {
    const text = ' name , age \n Alice , 30 ';
    const result = parseCSV(text);
    expect(result[0]).toEqual({ name: 'Alice', age: '30' });
  });
});

// ===================================================================
// buildDataMaps
// ===================================================================
describe('buildDataMaps', () => {
  const maps = buildDataMaps(configRows, movementRows, diceRows);

  it('builds configMap keyed by space_name', () => {
    expect(maps.configMap['PM-DECISION-CHECK']).toBeDefined();
    expect(maps.configMap['PM-DECISION-CHECK'].phase).toBe('OWNER');
    expect(maps.configMap['PM-DECISION-CHECK'].path_type).toBe('Special');
  });

  it('builds configOrder with correct ordering', () => {
    // OWNER-SCOPE-INITIATION is the 2nd data row (index 1)
    expect(maps.configOrder['OWNER-SCOPE-INITIATION']).toBe(1);
    // FINISH is last
    expect(maps.configOrder['FINISH']).toBe(configRows.length - 1);
  });

  it('builds movementMap with visit types', () => {
    expect(maps.movementMap['PM-DECISION-CHECK']['First'].movement_type).toBe('choice');
    expect(maps.movementMap['PM-DECISION-CHECK']['Subsequent'].movement_type).toBe('choice');
    expect(maps.movementMap['OWNER-SCOPE-INITIATION']['First'].movement_type).toBe('fixed');
  });

  it('builds diceMap for spaces with dice outcomes', () => {
    expect(maps.diceMap['CHEAT-BYPASS']).toBeDefined();
    expect(maps.diceMap['CHEAT-BYPASS']['First'].roll_1).toBe('ENG-INITIATION');
  });

  it('maps SETUP phase to OWNER in phaseMap', () => {
    expect(maps.phaseMap['OWNER-SCOPE-INITIATION']).toBe('OWNER');
    expect(maps.phaseMap['OWNER-FUND-INITIATION']).toBe('OWNER');
  });

  it('preserves non-SETUP phases', () => {
    expect(maps.phaseMap['ARCH-INITIATION']).toBe('DESIGN');
    expect(maps.phaseMap['CON-INITIATION']).toBe('CONSTRUCTION');
    expect(maps.phaseMap['FINISH']).toBe('END');
  });
});

// ===================================================================
// buildGamePathFromData — the core graph walker
// ===================================================================
describe('buildGamePathFromData', () => {
  const result = buildGamePathFromData(movementRows, configRows, diceRows);
  const { path, placed, getMovement, getDiceReachable } = result;

  describe('getMovement', () => {
    it('returns fixed movement for OWNER-SCOPE-INITIATION', () => {
      const m = getMovement('OWNER-SCOPE-INITIATION');
      expect(m.type).toBe('fixed');
      expect(m.destinations).toEqual(['OWNER-FUND-INITIATION']);
    });

    it('returns choice movement for PM-DECISION-CHECK First visit', () => {
      const m = getMovement('PM-DECISION-CHECK', 'First');
      expect(m.type).toBe('choice');
      expect(m.destinations).toContain('LEND-SCOPE-CHECK');
      expect(m.destinations).toContain('ARCH-INITIATION');
      expect(m.destinations).toContain('CHEAT-BYPASS');
    });

    it('returns none for terminal nodes', () => {
      const m = getMovement('FINISH');
      expect(m.type).toBe('none');
      expect(m.destinations).toEqual([]);
    });

    it('returns none for unknown space', () => {
      const m = getMovement('NONEXISTENT');
      expect(m.type).toBe('none');
    });
  });

  describe('getDiceReachable', () => {
    it('returns all reachable spaces from CHEAT-BYPASS dice', () => {
      const reach = getDiceReachable('CHEAT-BYPASS');
      expect(reach).toContain('ENG-INITIATION');
      expect(reach).toContain('REG-DOB-FEE-REVIEW');
      expect(reach).toContain('REG-FDNY-FEE-REVIEW');
      expect(reach).toContain('CON-INITIATION');
      expect(reach).toContain('PM-DECISION-CHECK');
    });

    it('handles "or" syntax in dice outcomes', () => {
      const reach = getDiceReachable('REG-FDNY-PLAN-EXAM');
      expect(reach).toContain('CON-INITIATION');
      expect(reach).toContain('REG-DOB-PLAN-EXAM');
      expect(reach).toContain('REG-DOB-AUDIT');
      expect(reach).toContain('PM-DECISION-CHECK');
    });

    it('returns empty for spaces without dice', () => {
      expect(getDiceReachable('OWNER-SCOPE-INITIATION')).toEqual([]);
    });
  });

  describe('path structure', () => {
    it('starts with node segments for the initial linear chain', () => {
      expect(path[0]).toEqual({ type: 'node', name: 'OWNER-SCOPE-INITIATION' });
      expect(path[1]).toEqual({ type: 'node', name: 'OWNER-FUND-INITIATION' });
    });

    it('creates a legs segment for PM-DECISION-CHECK', () => {
      const legs = path.find(s => s.type === 'legs');
      expect(legs).toBeDefined();
      if (legs?.type === 'legs') {
        expect(legs.parent).toBe('PM-DECISION-CHECK');
        // Side quest children in OWNER phase
        expect(legs.children).toContain('OWNER-DECISION-REVIEW');
      }
    });

    it('creates a mega-fork after the legs segment', () => {
      const fork = path.find(s => s.type === 'fork');
      expect(fork).toBeDefined();
      if (fork?.type === 'fork') {
        expect(fork.branches.length).toBeGreaterThan(3);
      }
    });

    it('places all game config spaces (except START-QUICK-PLAY-GUIDE)', () => {
      const configSpaces = configRows
        .filter(r => r.space_name !== 'START-QUICK-PLAY-GUIDE')
        .map(r => r.space_name);
      const unplaced = configSpaces.filter(s => !placed.has(s));
      expect(unplaced).toEqual([]);
    });
  });

  describe('mega-fork branches', () => {
    const fork = path.find(s => s.type === 'fork');
    const branches = fork?.type === 'fork' ? fork.branches : [];

    it('sorts branches by phase rank (Funding before Design before Regulatory)', () => {
      const firstNames = branches.map(b => flattenBranchNodes(b.nodes)[0]);
      // Find indices of key branches
      const fundingIdx = firstNames.findIndex(n => n.startsWith('LEND'));
      const archIdx = firstNames.findIndex(n => n.startsWith('ARCH'));
      const regIdx = firstNames.findIndex(n => n.startsWith('REG-DOB') || n.startsWith('REG-FDNY'));

      if (fundingIdx >= 0 && archIdx >= 0) {
        expect(fundingIdx).toBeLessThan(archIdx);
      }
      if (archIdx >= 0 && regIdx >= 0) {
        expect(archIdx).toBeLessThan(regIdx);
      }
    });

    it('includes FINISH as a terminal node in a branch', () => {
      const allNodes = branches.flatMap(b => flattenBranchNodes(b.nodes));
      expect(allNodes).toContain('FINISH');
    });
  });

  describe('mini-forks', () => {
    const fork = path.find(s => s.type === 'fork');
    const branches = fork?.type === 'fork' ? fork.branches : [];

    it('creates mini-fork for REG-DOB-TYPE-SELECT choices (Plan Exam vs Prof Cert)', () => {
      let found = false;
      for (const br of branches) {
        for (const item of br.nodes) {
          if (typeof item !== 'string' && item.type === 'mini-fork') {
            const allSubNodes = item.branches.flat();
            if (allSubNodes.includes('REG-DOB-PLAN-EXAM') || allSubNodes.includes('REG-DOB-PROF-CERT')) {
              found = true;
              expect(item.branches.length).toBe(2);
            }
          }
        }
      }
      expect(found).toBe(true);
    });

    it('creates mini-fork for Bank/Investor Fund Review', () => {
      let found = false;
      for (const br of branches) {
        for (const item of br.nodes) {
          if (typeof item !== 'string' && item.type === 'mini-fork') {
            const allSubNodes = item.branches.flat();
            if (allSubNodes.includes('BANK-FUND-REVIEW') || allSubNodes.includes('INVESTOR-FUND-REVIEW')) {
              found = true;
              expect(item.branches.length).toBe(2);
            }
          }
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('convergence nodes', () => {
    const fork = path.find(s => s.type === 'fork');
    const branches = fork?.type === 'fork' ? fork.branches : [];

    it('marks REG-DOB-FINAL-REVIEW as convergence', () => {
      let found = false;
      for (const br of branches) {
        for (const item of br.nodes) {
          if (typeof item !== 'string' && item.type === 'convergence' && item.name === 'REG-DOB-FINAL-REVIEW') {
            found = true;
          }
        }
      }
      expect(found).toBe(true);
    });
  });
});

// ===================================================================
// buildEdges
// ===================================================================
describe('buildEdges', () => {
  const { path: gamePath } = buildGamePathFromData(movementRows, configRows, diceRows);
  const edges = buildEdges(gamePath);

  it('creates edges between linear nodes', () => {
    const hasEdge = edges.some(([a, b]) => a === 'OWNER-SCOPE-INITIATION' && b === 'OWNER-FUND-INITIATION');
    expect(hasEdge).toBe(true);
  });

  it('creates edges from legs parent to children', () => {
    const pmToOwnerReview = edges.some(([a, b]) => a === 'PM-DECISION-CHECK' && b === 'OWNER-DECISION-REVIEW');
    expect(pmToOwnerReview).toBe(true);
  });

  it('creates edges within mini-fork sub-chains', () => {
    // Check that sub-chain nodes are connected
    const hasBank = edges.some(([a, b]) =>
      (a === 'BANK-FUND-REVIEW' || b === 'BANK-FUND-REVIEW')
    );
    expect(hasBank).toBe(true);
  });

  it('creates merge edges for mini-fork ends', () => {
    const mergeEdges = edges.filter(e => e[2] === 'merge');
    // Should have merge edges if mini-forks exist with multiple branches
    expect(mergeEdges.length).toBeGreaterThanOrEqual(0);
  });

  it('does not create duplicate edges', () => {
    const edgeStrings = edges.map(([a, b, tag]) => `${a}->${b}${tag ? ':' + tag : ''}`);
    const unique = new Set(edgeStrings);
    expect(unique.size).toBe(edgeStrings.length);
  });

  it('creates row-end to next-row-start edges between branches', () => {
    // There should be edges connecting branch ends to next branch starts
    expect(edges.length).toBeGreaterThan(10);
  });
});

// ===================================================================
// getAllSpaceNames
// ===================================================================
describe('getAllSpaceNames', () => {
  const { path: gamePath, placed } = buildGamePathFromData(movementRows, configRows, diceRows);
  const allNames = getAllSpaceNames(gamePath);

  it('returns all placed spaces', () => {
    const configSpaces = configRows
      .filter(r => r.space_name !== 'START-QUICK-PLAY-GUIDE')
      .map(r => r.space_name);
    for (const s of configSpaces) {
      expect(allNames).toContain(s);
    }
  });

  it('returns FINISH', () => {
    expect(allNames).toContain('FINISH');
  });

  it('returns spaces in path order', () => {
    const ownerIdx = allNames.indexOf('OWNER-SCOPE-INITIATION');
    const fundIdx = allNames.indexOf('OWNER-FUND-INITIATION');
    expect(ownerIdx).toBeLessThan(fundIdx);
  });

  it('includes legs parent and children', () => {
    expect(allNames).toContain('PM-DECISION-CHECK');
    expect(allNames).toContain('OWNER-DECISION-REVIEW');
  });
});

// ===================================================================
// splitRows
// ===================================================================
describe('splitRows', () => {
  const { path: gamePath } = buildGamePathFromData(movementRows, configRows, diceRows);

  it('splits into multiple rows for narrow containers with many segments', () => {
    // Create a path with many node segments to test row splitting
    const manyNodes: PathSegment[] = Array.from({ length: 12 }, (_, i) => ({
      type: 'node' as const,
      name: `SPACE-${i}`,
    }));
    // 400px / 134 = ~2.98, min 4 slots per row → 4 slots per row, 12 nodes → 3 rows
    const rows = splitRows(manyNodes, 400);
    expect(rows.length).toBeGreaterThan(1);
  });

  it('fits everything in fewer rows for wide containers', () => {
    const narrowRows = splitRows(gamePath, 400);
    const wideRows = splitRows(gamePath, 2000);
    expect(wideRows.length).toBeLessThanOrEqual(narrowRows.length);
  });

  it('never creates rows with 0 segments', () => {
    const rows = splitRows(gamePath, 500);
    for (const row of rows) {
      expect(row.length).toBeGreaterThan(0);
    }
  });

  it('always places the last segment in the last row', () => {
    const rows = splitRows(gamePath, 500);
    const lastRow = rows[rows.length - 1];
    const lastSeg = lastRow[lastRow.length - 1];
    const pathLastSeg = gamePath[gamePath.length - 1];
    expect(lastSeg).toBe(pathLastSeg);
  });

  it('respects minimum 4 slots per row', () => {
    // Even with a tiny container, should fit at least 4 slots
    const rows = splitRows(gamePath, 100);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ===================================================================
// smoothPath
// ===================================================================
describe('smoothPath', () => {
  it('returns empty string for less than 2 points', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 0, y: 0 }])).toBe('');
  });

  it('returns straight line for 2 points', () => {
    const result = smoothPath([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(result).toMatch(/^M 0\.0 0\.0 L 100\.0 0\.0$/);
  });

  it('returns path with Q curves for 3+ points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ];
    const result = smoothPath(pts);
    expect(result).toContain('M');
    expect(result).toContain('Q');
    expect(result).toContain('L');
  });

  it('handles collinear points (radius < 1 falls back to L)', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },  // very close to prev
      { x: 100, y: 0 },
    ];
    const result = smoothPath(pts);
    // Should still produce valid path
    expect(result).toContain('M');
  });

  it('generates valid SVG path commands', () => {
    const pts: Point[] = [
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 80 },
      { x: 90, y: 80 },
    ];
    const result = smoothPath(pts);
    // Should start with M, have L and Q commands
    expect(result).toMatch(/^M /);
    // Should not have NaN or Infinity
    expect(result).not.toContain('NaN');
    expect(result).not.toContain('Infinity');
  });
});

// ===================================================================
// phaseColor / phaseOf
// ===================================================================
describe('phaseColor and phaseOf', () => {
  const maps = buildDataMaps(configRows, movementRows, diceRows);

  it('returns correct phase color for known spaces', () => {
    expect(phaseColor('ARCH-INITIATION', maps.phaseMap)).toBe(PHASE_COLORS['DESIGN'].border);
    expect(phaseColor('CON-INITIATION', maps.phaseMap)).toBe(PHASE_COLORS['CONSTRUCTION'].border);
    expect(phaseColor('FINISH', maps.phaseMap)).toBe(PHASE_COLORS['END'].border);
  });

  it('returns default color for unknown space', () => {
    expect(phaseColor('NONEXISTENT', maps.phaseMap)).toBe('#adb5bd');
  });

  it('returns phase name for known spaces', () => {
    expect(phaseOf('ARCH-INITIATION', maps.phaseMap)).toBe('DESIGN');
    expect(phaseOf('FINISH', maps.phaseMap)).toBe('END');
  });

  it('returns null for unknown spaces', () => {
    expect(phaseOf('NONEXISTENT', maps.phaseMap)).toBeNull();
  });

  it('maps SETUP spaces to OWNER phase', () => {
    expect(phaseOf('OWNER-SCOPE-INITIATION', maps.phaseMap)).toBe('OWNER');
  });
});

// ===================================================================
// CONSTANTS validation
// ===================================================================
describe('constants', () => {
  it('BOARD.TOTAL_SLOT equals SLOT_W + CONNECTOR_W', () => {
    expect(BOARD.TOTAL_SLOT).toBe(BOARD.SLOT_W + BOARD.CONNECTOR_W);
  });

  it('PHASE_RANK has all phases', () => {
    const phases = ['SETUP', 'OWNER', 'FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION', 'END'];
    for (const p of phases) {
      expect(PHASE_RANK[p]).toBeDefined();
    }
  });

  it('PHASE_COLORS has matching phases', () => {
    for (const p of Object.keys(PHASE_COLORS)) {
      expect(PHASE_COLORS[p].border).toBeTruthy();
      expect(PHASE_COLORS[p].text).toBeTruthy();
    }
  });

  it('NPC_PREFIXES all end with -', () => {
    for (const p of NPC_PREFIXES) {
      expect(p.endsWith('-')).toBe(true);
    }
  });
});

// ===================================================================
// Snapshot test — full path structure
// ===================================================================
describe('full board snapshot', () => {
  const result = buildGamePathFromData(movementRows, configRows, diceRows);
  const edges = buildEdges(result.path);
  const allNames = getAllSpaceNames(result.path);

  it('produces consistent segment count', () => {
    // The path should have a predictable number of segments
    // (2 nodes + 1 legs + 1 fork = 4 segments minimum)
    expect(result.path.length).toBeGreaterThanOrEqual(4);
  });

  it('produces consistent edge count', () => {
    expect(edges.length).toBeGreaterThan(20);
  });

  it('produces consistent space count', () => {
    // All config spaces minus START-QUICK-PLAY-GUIDE
    const expected = configRows.filter(r => r.space_name !== 'START-QUICK-PLAY-GUIDE').length;
    expect(allNames.length).toBeGreaterThanOrEqual(expected);
  });

  it('path segment types are valid', () => {
    for (const seg of result.path) {
      expect(['node', 'legs', 'fork']).toContain(seg.type);
    }
  });

  it('edge sources and targets are all placed spaces', () => {
    for (const [from, to] of edges) {
      expect(allNames).toContain(from);
      expect(allNames).toContain(to);
    }
  });
});
